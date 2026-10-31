-- Factor-Gente · 0002: entrevista coordinada, anticipos, cobros y tarifas
-- Pegar completo en Supabase → SQL Editor → Run. Debe terminar con "Success. No rows returned".

-- Entrevista coordinada por Factor-Gente: fecha y lugar; la empresa no recibe el teléfono
alter table public.shortlist add column cita timestamptz, add column lugar text;

-- Anticipo: por omisión toda empresa nueva lo paga; el administrador marca a las de confianza
alter table public.companies add column requiere_anticipo boolean not null default true;
alter table public.vacancies add column anticipo_pagado boolean not null default false;

create or replace function public.guard_company() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    if tg_op = 'INSERT' then new.requiere_anticipo := true; else new.requiere_anticipo := old.requiere_anticipo; end if;
  end if;
  return new;
end $$;

create trigger companies_guard before insert or update on public.companies
  for each row execute function public.guard_company();

create or replace function public.guard_vacancy() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    if tg_op = 'INSERT' then new.estado := 'Abierta'; new.anticipo_pagado := false;
    else new.estado := old.estado; new.anticipo_pagado := old.anticipo_pagado; end if;
  end if;
  return new;
end $$;

-- Tarifas (una sola fila, la edita el administrador)
create table public.tarifas (
  id int primary key default 1 check (id = 1),
  cuota_operativo int not null default 2500,
  meses_admin numeric not null default 1,
  anticipo_pct int not null default 30,
  plazo_dias int not null default 7
);
insert into public.tarifas default values;

alter table public.tarifas enable row level security;
create policy tarifas_read on public.tarifas for select using (true);
create policy tarifas_admin on public.tarifas for update using (is_admin()) with check (is_admin());

-- Cobros: anticipos y colocaciones
create table public.cobros (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies on delete cascade,
  vacancy_id uuid references public.vacancies on delete cascade,
  candidate_id uuid references public.candidates on delete set null,
  concepto text not null check (concepto in ('Anticipo', 'Colocación')),
  monto int not null,
  vence date,
  pagado date,
  created_at timestamptz not null default now()
);

alter table public.cobros enable row level security;
create policy cobros_admin on public.cobros for all using (is_admin()) with check (is_admin());
create policy cobros_empresa on public.cobros for select
  using (company_id in (select id from companies where user_id = auth.uid()));

-- Ternas de la empresa: el nombre aparece cuando hay entrevista agendada; el teléfono solo si se liberó
drop function public.my_ternas();
create function public.my_ternas()
returns table (vacancy_id uuid, candidate_id uuid, letra int, quiere boolean, liberado boolean,
               nombre text, tel text, ult_puesto text, ult_tiempo text, esco text, pmin int, pmax int,
               tipo_pref text, disp text, mov text[], habilidades text[], carta text, res jsonb,
               cita timestamptz, lugar text)
language sql stable security definer set search_path = public as $$
  select s.vacancy_id, s.candidate_id,
         (row_number() over (partition by s.vacancy_id order by s.created_at))::int,
         s.quiere, s.liberado,
         case when s.liberado or s.cita is not null then c.nombre end,
         case when s.liberado then c.tel end,
         c.ult_puesto, c.ult_tiempo, c.esco, c.pmin, c.pmax, c.tipo_pref, c.disp, c.mov, c.habilidades, c.carta,
         t.res, s.cita, s.lugar
  from shortlist s
  join vacancies v on v.id = s.vacancy_id
  join companies co on co.id = v.company_id
  join candidates c on c.id = s.candidate_id
  left join tests t on t.candidate_id = c.id and t.estado = 'completada'
  where s.enviado and co.user_id = auth.uid();
$$;

grant execute on function public.my_ternas to authenticated;
