-- Factor-Gente · 0004: reclutadores, garantía editable y cobro automático al contratar
-- Pegar completo en Supabase → SQL Editor → Run. Debe terminar con "Success. No rows returned".

-- ============ Equipo: administrador y reclutador ============
alter table public.admins add column rol text not null default 'admin' check (rol in ('admin', 'reclutador'));

-- is_admin() = cualquier persona del equipo (administrador o reclutador)
-- is_jefe()  = solo administrador (cobros, tarifas, borrar, equipo)
create or replace function public.is_jefe() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid() and rol = 'admin');
$$;

create table public.staff_invites (
  email text primary key,
  rol text not null check (rol in ('admin', 'reclutador')),
  created_at timestamptz not null default now()
);
alter table public.staff_invites enable row level security;
create policy invites_jefe on public.staff_invites for all using (is_jefe()) with check (is_jefe());

-- Al crear cuenta con un correo invitado, la persona entra al equipo
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.is_anonymous, false) = false and new.email is not null then
    if not exists (select 1 from admins) then
      insert into admins (user_id, rol) values (new.id, 'admin');
    elsif exists (select 1 from staff_invites where lower(email) = lower(new.email)) then
      insert into admins (user_id, rol) select new.id, rol from staff_invites where lower(email) = lower(new.email);
      delete from staff_invites where lower(email) = lower(new.email);
    end if;
  end if;
  return new;
end $$;

-- Si el correo invitado ya tiene cuenta, entra al equipo de inmediato
create or replace function public.apply_invite() returns trigger
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  select id into uid from auth.users
   where lower(email) = lower(new.email) and coalesce(is_anonymous, false) = false;
  if uid is not null then
    insert into admins (user_id, rol) values (uid, new.rol)
      on conflict (user_id) do update set rol = excluded.rol;
    return null;
  end if;
  return new;
end $$;

create trigger staff_invites_apply before insert on public.staff_invites
  for each row execute function public.apply_invite();

create or replace function public.list_staff()
returns table (user_id uuid, email text, rol text, pendiente boolean)
language sql stable security definer set search_path = public as $$
  select a.user_id, u.email::text, a.rol, false from admins a join auth.users u on u.id = a.user_id where is_jefe()
  union all
  select null, i.email, i.rol, true from staff_invites i where is_jefe();
$$;

create policy admins_jefe_upd on public.admins for update using (is_jefe()) with check (is_jefe());
create policy admins_jefe_del on public.admins for delete using (is_jefe() and user_id <> auth.uid());

-- ============ Lo de dinero y borrar: solo el administrador ============
drop policy cobros_admin on public.cobros;
create policy cobros_jefe on public.cobros for all using (is_jefe()) with check (is_jefe());

drop policy tarifas_admin on public.tarifas;
create policy tarifas_jefe on public.tarifas for update using (is_jefe()) with check (is_jefe());

drop policy cand_delete on public.candidates;
create policy cand_delete on public.candidates for delete using (user_id = auth.uid() or is_jefe());

drop policy vac_delete on public.vacancies;
create policy vac_delete on public.vacancies for delete using (is_jefe());

create or replace function public.guard_company() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not is_jefe() then
    if tg_op = 'INSERT' then new.requiere_anticipo := true; else new.requiere_anticipo := old.requiere_anticipo; end if;
  end if;
  return new;
end $$;

create or replace function public.guard_vacancy() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    -- empresa: no cambia el estado ni el anticipo
    if tg_op = 'INSERT' then new.estado := 'Abierta'; new.anticipo_pagado := false;
    else new.estado := old.estado; new.anticipo_pagado := old.anticipo_pagado; end if;
  elsif not is_jefe() then
    -- reclutador: cambia el estado, no el anticipo
    if tg_op = 'INSERT' then new.anticipo_pagado := false; else new.anticipo_pagado := old.anticipo_pagado; end if;
  end if;
  return new;
end $$;

-- ============ Garantía editable (inicia en 30 días) ============
alter table public.tarifas add column garantia_dias int not null default 30;

-- ============ Cobro automático al registrar una contratación ============
create or replace function public.cobro_colocacion() returns trigger
language plpgsql security definer set search_path = public as $$
declare v vacancies; t tarifas; total int; anticipo int := 0;
begin
  select * into v from vacancies where id = new.vacancy_id;
  select * into t from tarifas where id = 1;
  if v.area = 'Operativo' then total := t.cuota_operativo;
  else total := round(t.meses_admin * (coalesce(v.smin, v.smax, 0) + coalesce(v.smax, v.smin, 0)) / 2.0);
  end if;
  if v.anticipo_pagado then anticipo := round(total * t.anticipo_pct / 100.0); end if;
  insert into cobros (company_id, vacancy_id, candidate_id, concepto, monto, vence)
  values (v.company_id, v.id, new.candidate_id, 'Colocación', greatest(total - anticipo, 0), current_date + t.plazo_dias);
  return new;
end $$;

create trigger placements_cobro after insert on public.placements
  for each row execute function public.cobro_colocacion();

grant execute on function public.is_jefe, public.list_staff to authenticated;
