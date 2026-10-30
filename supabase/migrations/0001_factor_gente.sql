-- Factor-Gente · tablas, seguridad (RLS) y funciones
-- Pegar completo en Supabase → SQL Editor → Run. Debe terminar con "Success. No rows returned".

create extension if not exists pgcrypto;

-- ============ Administradores ============
create table public.admins (
  user_id uuid primary key references auth.users on delete cascade
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

-- La primera persona que se registra con correo queda como administrador
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.is_anonymous, false) = false and new.email is not null
     and not exists (select 1 from admins) then
    insert into admins (user_id) values (new.id);
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ Candidatos ============
create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users on delete set null,
  created_by uuid references auth.users on delete set null default auth.uid(),
  asistido boolean not null default false,
  nombre text not null,
  edad int not null check (edad between 18 and 90),
  sexo text not null default 'Prefiero no decir',
  tel text not null,
  correo text,
  municipio text not null,
  colonia text,
  esco text,
  area text not null check (area in ('Operativo', 'Administrativo', 'Supervisión')),
  puesto text,
  funciones text,
  habilidades text[] not null default '{}',
  carta text,
  ult_puesto text, ult_empresa text, ult_funciones text, ult_tiempo text,
  ult_sueldo int, ult_salida text, ult_tipo text,
  pmin int, pmax int, tipo_pref text, horario text, disp text, transp text,
  mov text[] not null default '{}',
  inclusion boolean not null default false,
  ajuste text,
  consent_aviso boolean not null check (consent_aviso),
  consent_compartir boolean not null check (consent_compartir),
  consent_pruebas boolean not null default false,
  consent_servicios boolean not null default false,
  estado text not null default 'Disponible' check (estado in ('Disponible', 'En proceso', 'Colocado', 'Inactivo')),
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ Pruebas (Mini-IPIP) ============
create table public.tests (
  candidate_id uuid primary key references public.candidates on delete cascade,
  estado text not null default 'asignada' check (estado in ('asignada', 'completada')),
  answers int[],
  res jsonb,
  assigned_at timestamptz not null default now(),
  completed_at timestamptz
);

-- ============ Empresas y vacantes ============
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null default auth.uid() references auth.users on delete cascade,
  nombre text not null,
  giro text,
  contacto text,
  tel text,
  created_at timestamptz not null default now()
);

create table public.vacancies (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies on delete cascade,
  puesto text not null,
  area text not null check (area in ('Operativo', 'Administrativo', 'Supervisión')),
  n int not null default 1,
  zona text not null,
  funciones text not null,
  esco text, exp text,
  habilidades text[] not null default '{}',
  tipo text, smin int, smax int, horario text,
  prest text[] not null default '{}',
  transporte boolean not null default false,
  comedor boolean not null default false,
  incluyente boolean not null default false,
  salidas int not null default 0,
  motivo text,
  sexo text not null default 'Indistinto' check (sexo in ('Indistinto', 'Mujer', 'Hombre')),
  edad_min int check (edad_min is null or edad_min >= 18),
  edad_max int check (edad_max is null or edad_max >= 18),
  just text,
  pub text not null default 'anonima' check (pub in ('anonima', 'privada')),
  acepta boolean not null check (acepta),
  estado text not null default 'Abierta' check (estado in ('Abierta', 'Terna enviada', 'Cubierta', 'Cancelada')),
  created_at timestamptz not null default now(),
  constraint motivo_si_pide_sexo_o_edad check (
    (sexo = 'Indistinto' and edad_min is null and edad_max is null) or length(trim(coalesce(just, ''))) > 0
  )
);

create table public.interests (
  candidate_id uuid references public.candidates on delete cascade,
  vacancy_id uuid references public.vacancies on delete cascade,
  created_at timestamptz not null default now(),
  primary key (candidate_id, vacancy_id)
);

create table public.shortlist (
  vacancy_id uuid references public.vacancies on delete cascade,
  candidate_id uuid references public.candidates on delete cascade,
  enviado boolean not null default false,
  quiere boolean not null default false,
  liberado boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (vacancy_id, candidate_id)
);

create table public.placements (
  candidate_id uuid references public.candidates on delete cascade,
  vacancy_id uuid references public.vacancies on delete cascade,
  ingreso date not null default current_date,
  c30 boolean, c60 boolean, c90 boolean,
  primary key (candidate_id, vacancy_id)
);

-- ============ Interesados en la consultora ============
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users on delete cascade,
  candidate_id uuid references public.candidates on delete cascade,
  company_id uuid references public.companies on delete cascade,
  nombre text not null,
  tipo text not null check (tipo in ('Candidato', 'Empresa')),
  servicios text[] not null default '{}',
  via text,
  tel text not null,
  created_at timestamptz not null default now()
);

-- ============ Sueldos de referencia ============
create table public.ref_salaries (
  id serial primary key,
  puesto text not null,
  kw text[] not null default '{}',
  min int not null,
  max int not null,
  pago text,
  orden int not null default 0
);

insert into public.ref_salaries (puesto, kw, min, max, pago, orden) values
  ('Pespunte', '{pespunt}', 9000, 13000, 'Destajo o semanal', 1),
  ('Corte', '{cortador,corte}', 10000, 13500, 'Semanal o destajo', 2),
  ('Montado', '{montad}', 10000, 13000, 'Semanal o destajo', 3),
  ('Ayudante general / acabado', '{ayudante,acabad,empaque}', 8500, 10000, 'Semanal fijo', 4),
  ('Almacenista', '{almacen}', 9500, 11500, 'Semanal fijo', 5),
  ('Recepción / ventas', '{recepcion,ventas,vendedor}', 9000, 11500, 'Quincenal', 6),
  ('Auxiliar contable o de nómina', '{contable,contador,nomina}', 12000, 16000, 'Quincenal', 7),
  ('Supervisor de producción', '{supervisor,jefe de linea,encargado}', 14000, 16000, 'Quincenal', 8);

-- ============ Reglas automáticas ============
-- Un candidato no puede cambiar su propio estado ni las notas del administrador
create or replace function public.guard_candidate() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    if tg_op = 'INSERT' then
      new.estado := 'Disponible'; new.asistido := false; new.notas := null; new.user_id := auth.uid();
    else
      new.estado := old.estado; new.notas := old.notas; new.asistido := old.asistido; new.user_id := old.user_id;
    end if;
  end if;
  -- Si retira el permiso para pruebas, se cancela la prueba pendiente
  if tg_op = 'UPDATE' and new.consent_pruebas = false then
    delete from tests where candidate_id = new.id and estado = 'asignada';
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger candidates_guard before insert or update on public.candidates
  for each row execute function public.guard_candidate();

-- Una empresa no puede cambiar el estado de su vacante
create or replace function public.guard_vacancy() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    if tg_op = 'INSERT' then new.estado := 'Abierta'; else new.estado := old.estado; end if;
  end if;
  return new;
end $$;

create trigger vacancies_guard before insert or update on public.vacancies
  for each row execute function public.guard_vacancy();

-- Solo se asignan pruebas a quien dio permiso
create or replace function public.guard_test() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from candidates where id = new.candidate_id and consent_pruebas) then
    raise exception 'El candidato no dio permiso para pruebas';
  end if;
  return new;
end $$;

create trigger tests_guard before insert on public.tests
  for each row execute function public.guard_test();

-- ============ Seguridad por filas (RLS) ============
alter table public.admins enable row level security;
alter table public.candidates enable row level security;
alter table public.tests enable row level security;
alter table public.companies enable row level security;
alter table public.vacancies enable row level security;
alter table public.interests enable row level security;
alter table public.shortlist enable row level security;
alter table public.placements enable row level security;
alter table public.leads enable row level security;
alter table public.ref_salaries enable row level security;

create policy admins_read on public.admins for select using (user_id = auth.uid() or is_admin());

create policy cand_read on public.candidates for select using (user_id = auth.uid() or is_admin());
create policy cand_insert on public.candidates for insert with check (user_id = auth.uid() or is_admin());
create policy cand_update on public.candidates for update using (user_id = auth.uid() or is_admin()) with check (user_id = auth.uid() or is_admin());
create policy cand_delete on public.candidates for delete using (user_id = auth.uid() or is_admin());

create policy tests_admin on public.tests for all using (is_admin()) with check (is_admin());

create policy comp_read on public.companies for select using (user_id = auth.uid() or is_admin());
create policy comp_insert on public.companies for insert with check (user_id = auth.uid() or is_admin());
create policy comp_update on public.companies for update using (user_id = auth.uid() or is_admin());

create policy vac_read on public.vacancies for select
  using (is_admin() or company_id in (select id from companies where user_id = auth.uid()));
create policy vac_insert on public.vacancies for insert
  with check (is_admin() or company_id in (select id from companies where user_id = auth.uid()));
create policy vac_update on public.vacancies for update
  using (is_admin() or company_id in (select id from companies where user_id = auth.uid()));
create policy vac_delete on public.vacancies for delete using (is_admin());

create policy int_read on public.interests for select
  using (is_admin() or candidate_id in (select id from candidates where user_id = auth.uid()));
create policy int_insert on public.interests for insert
  with check (candidate_id in (select id from candidates where user_id = auth.uid()));
create policy int_delete on public.interests for delete
  using (candidate_id in (select id from candidates where user_id = auth.uid()));

create policy short_admin on public.shortlist for all using (is_admin()) with check (is_admin());
create policy place_admin on public.placements for all using (is_admin()) with check (is_admin());

create policy leads_insert on public.leads for insert with check (user_id = auth.uid());
create policy leads_admin on public.leads for select using (is_admin());
create policy leads_delete on public.leads for delete using (is_admin());

create policy ref_read on public.ref_salaries for select using (true);
create policy ref_admin on public.ref_salaries for all using (is_admin()) with check (is_admin());

-- ============ Funciones que usa la app ============
-- Vacantes publicadas, sin nombre de empresa ni filtros internos
create or replace function public.public_vacancies()
returns table (id uuid, puesto text, area text, zona text, smin int, smax int, tipo text, horario text,
               prest text[], comedor boolean, transporte boolean, incluyente boolean, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select id, puesto, area, zona, smin, smax, tipo, horario, prest, comedor, transporte, incluyente, created_at
  from vacancies
  where pub = 'anonima' and estado in ('Abierta', 'Terna enviada')
  order by created_at desc;
$$;

-- Ternas que recibió la empresa: ficha anónima; nombre y teléfono solo si ya se liberó el contacto
create or replace function public.my_ternas()
returns table (vacancy_id uuid, candidate_id uuid, letra int, quiere boolean, liberado boolean,
               nombre text, tel text, ult_puesto text, ult_tiempo text, esco text, pmin int, pmax int,
               tipo_pref text, disp text, mov text[], habilidades text[], carta text, res jsonb)
language sql stable security definer set search_path = public as $$
  select s.vacancy_id, s.candidate_id,
         (row_number() over (partition by s.vacancy_id order by s.created_at))::int,
         s.quiere, s.liberado,
         case when s.liberado then c.nombre end, case when s.liberado then c.tel end,
         c.ult_puesto, c.ult_tiempo, c.esco, c.pmin, c.pmax, c.tipo_pref, c.disp, c.mov, c.habilidades, c.carta,
         t.res
  from shortlist s
  join vacancies v on v.id = s.vacancy_id
  join companies co on co.id = v.company_id
  join candidates c on c.id = s.candidate_id
  left join tests t on t.candidate_id = c.id and t.estado = 'completada'
  where s.enviado and co.user_id = auth.uid();
$$;

create or replace function public.request_interview(p_vacancy uuid, p_candidate uuid) returns void
language sql security definer set search_path = public as $$
  update shortlist s set quiere = true
  from vacancies v join companies co on co.id = v.company_id
  where s.vacancy_id = p_vacancy and s.candidate_id = p_candidate and s.enviado
    and v.id = s.vacancy_id and co.user_id = auth.uid();
$$;

-- Estado de la prueba del candidato (sin mostrarle sus resultados)
create or replace function public.my_test_status() returns text
language sql stable security definer set search_path = public as $$
  select t.estado from tests t join candidates c on c.id = t.candidate_id where c.user_id = auth.uid();
$$;

-- Califica el Mini-IPIP en el servidor (20 respuestas de 1 a 5)
create or replace function public.submit_test(p_answers int[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  traits text[] := array['E','A','C','N','I','E','A','C','N','I','E','A','C','N','I','E','A','C','N','I'];
  signs int[] := array[1,1,1,1,1,-1,-1,-1,-1,-1,1,1,1,1,-1,-1,-1,-1,-1,-1];
  s jsonb := '{"E":0,"A":0,"C":0,"N":0,"I":0}';
  v int; cid uuid;
begin
  if array_length(p_answers, 1) is distinct from 20 then raise exception 'Faltan respuestas'; end if;
  select c.id into cid from candidates c join tests t on t.candidate_id = c.id
   where c.user_id = auth.uid() and t.estado = 'asignada';
  if cid is null then raise exception 'No tienes una prueba pendiente'; end if;
  for i in 1..20 loop
    if p_answers[i] not between 1 and 5 then raise exception 'Respuesta no válida'; end if;
    v := case when signs[i] > 0 then p_answers[i] else 6 - p_answers[i] end;
    s := jsonb_set(s, array[traits[i]], to_jsonb((s ->> traits[i])::int + v));
  end loop;
  update tests set estado = 'completada', answers = p_answers, completed_at = now(),
    res = jsonb_build_object(
      'C', round(((s->>'C')::numeric / 4 - 1) / 4 * 100),
      'S', 100 - round(((s->>'N')::numeric / 4 - 1) / 4 * 100),
      'A', round(((s->>'A')::numeric / 4 - 1) / 4 * 100),
      'E', round(((s->>'E')::numeric / 4 - 1) / 4 * 100),
      'I', round(((s->>'I')::numeric / 4 - 1) / 4 * 100))
  where candidate_id = cid;
end $$;

-- El candidato borra su cuenta y todos sus datos
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
begin
  if is_admin() then raise exception 'El administrador no puede borrarse desde aquí'; end if;
  delete from leads where user_id = auth.uid();
  delete from candidates where user_id = auth.uid();
  delete from auth.users where id = auth.uid();
end $$;

grant execute on function public.public_vacancies, public.my_ternas, public.request_interview,
  public.my_test_status, public.submit_test, public.delete_my_account, public.is_admin to authenticated;
