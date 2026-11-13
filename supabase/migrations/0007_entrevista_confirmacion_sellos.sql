-- Factor-Gente · 0007: entrevista previa con Factor-Gente, confirmación de condiciones y sellos en la terna
-- Pegar completo en Supabase → SQL Editor → Run. Debe terminar con "Success. No rows returned".

-- ============ Entrevista previa ============
-- Solo el equipo la ve completa; el candidato solo ve su cita (función mis_entrevistas)
create table public.entrevistas (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates on delete cascade,
  vacancy_id uuid references public.vacancies on delete set null,
  cita timestamptz,
  medio text not null default 'Llamada' check (medio in ('Llamada', 'Videollamada de WhatsApp', 'Zoom o Meet', 'Presencial')),
  enlace text,
  estado text not null default 'Agendada' check (estado in ('Agendada', 'Realizada', 'No asistió', 'Cancelada')),
  respuestas jsonb,
  calificacion numeric(3, 1),
  resultado text check (resultado is null or resultado in ('Recomendado', 'Con reservas', 'No recomendado')),
  comentario text,
  entrevistador uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now(),
  realizada_at timestamptz
);
create index entrevistas_cand_idx on public.entrevistas (candidate_id);
alter table public.entrevistas enable row level security;
create policy entrevistas_equipo on public.entrevistas for all using (is_admin()) with check (is_admin());

-- El equipo agenda: se guarda la cita y se le avisa al candidato por el chat
create or replace function public.agendar_entrevista(p_candidate uuid, p_vacancy uuid, p_cita timestamptz, p_medio text, p_enlace text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_txt text; v_puesto text;
begin
  if not is_admin() then raise exception 'Solo el equipo'; end if;
  insert into entrevistas (candidate_id, vacancy_id, cita, medio, enlace)
  values (p_candidate, p_vacancy, p_cita, coalesce(p_medio, 'Llamada'), nullif(trim(coalesce(p_enlace, '')), '')) returning id into v_id;
  select puesto into v_puesto from vacancies where id = p_vacancy;
  v_txt := 'Te agendamos una entrevista con Factor·Gente'
    || coalesce(' para la vacante de ' || v_puesto, '') || ': '
    || to_char(p_cita at time zone 'America/Mexico_City', 'DD/MM/YYYY "a las" HH24:MI') || ' hrs, por '
    || lower(coalesce(p_medio, 'llamada'))
    || coalesce(case when p_medio = 'Presencial' then ' en ' else ' (' end || nullif(trim(coalesce(p_enlace, '')), '')
                || case when p_medio = 'Presencial' then '' else ')' end, '')
    || '. Dura unos 15 minutos. Si no puedes a esa hora, contéstanos aquí para cambiarla.';
  insert into chat (candidate_id, texto) values (p_candidate, v_txt);
  return v_id;
end $$;

-- Lo que ve el candidato de sus entrevistas: fecha, medio y enlace (nunca las calificaciones)
create or replace function public.mis_entrevistas()
returns table (id uuid, cita timestamptz, medio text, enlace text, estado text, puesto text)
language sql stable security definer set search_path = public as $$
  select e.id, e.cita, e.medio, e.enlace, e.estado, v.puesto
  from entrevistas e join candidates c on c.id = e.candidate_id
  left join vacancies v on v.id = e.vacancy_id
  where c.user_id = auth.uid() and e.estado = 'Agendada' and (e.cita is null or e.cita > now() - interval '3 hours')
  order by e.cita;
$$;

-- ============ Confirmación de condiciones ============
-- Antes de entrar a la terna, el candidato acepta sueldo, horario, zona y prestaciones de esa vacante
alter table public.shortlist
  add column conf_pedida timestamptz,
  add column confirmado boolean,
  add column conf_at timestamptz,
  add column conf_motivo text;

create or replace function public.pedir_confirmacion(p_vacancy uuid, p_candidate uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v vacancies;
begin
  if not is_admin() then raise exception 'Solo el equipo'; end if;
  select * into v from vacancies where id = p_vacancy;
  update shortlist set conf_pedida = now(), confirmado = null, conf_at = null, conf_motivo = null
   where vacancy_id = p_vacancy and candidate_id = p_candidate;
  if not found then raise exception 'El candidato no está en la terna de esta vacante'; end if;
  insert into chat (candidate_id, texto) values (p_candidate,
    'Tenemos una vacante para ti: ' || v.puesto || ' en ' || v.zona
    || '. Antes de presentarte con la empresa, revisa las condiciones en la sección "Confirma las condiciones" de tu perfil y dinos si te interesan.');
end $$;

-- Vacantes que el candidato tiene que confirmar, con sus condiciones (sin el nombre de la empresa)
create or replace function public.mis_confirmaciones()
returns table (vacancy_id uuid, puesto text, zona text, smin int, smax int, tipo text, horario text, prest text[],
               transporte boolean, comedor boolean, funciones text, confirmado boolean)
language sql stable security definer set search_path = public as $$
  select v.id, v.puesto, v.zona, v.smin, v.smax, v.tipo, v.horario, v.prest, v.transporte, v.comedor, v.funciones, s.confirmado
  from shortlist s join candidates c on c.id = s.candidate_id join vacancies v on v.id = s.vacancy_id
  where c.user_id = auth.uid() and s.conf_pedida is not null and v.estado in ('Abierta', 'Terna enviada')
  order by s.conf_pedida desc;
$$;

create or replace function public.confirmar_condiciones(p_vacancy uuid, p_acepta boolean, p_motivo text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_cand uuid; v_nombre text; v_puesto text;
begin
  select c.id, c.nombre into v_cand, v_nombre from candidates c where c.user_id = auth.uid();
  if v_cand is null then raise exception 'No tienes perfil'; end if;
  update shortlist set confirmado = p_acepta, conf_at = now(), conf_motivo = nullif(trim(coalesce(p_motivo, '')), '')
   where vacancy_id = p_vacancy and candidate_id = v_cand and conf_pedida is not null;
  if not found then raise exception 'No hay nada que confirmar para esta vacante'; end if;
  select puesto into v_puesto from vacancies where id = p_vacancy;
  perform notify_equipo(v_nombre || case when p_acepta then ' aceptó las condiciones' else ' no aceptó las condiciones' end,
    v_puesto || coalesce(': ' || nullif(trim(coalesce(p_motivo, '')), ''), ''), '/?cand=' || v_cand::text);
end $$;

-- ============ Sellos en la terna ============
-- Lo que Factor-Gente verificó de cada candidato, para que la empresa lo vea
drop function public.my_ternas();
create function public.my_ternas()
returns table (vacancy_id uuid, candidate_id uuid, letra int, quiere boolean, liberado boolean,
               nombre text, tel text, ult_puesto text, ult_tiempo text, esco text, pmin int, pmax int,
               tipo_pref text, disp text, mov text[], habilidades text[], carta text, res jsonb,
               cita timestamptz, lugar text,
               s_entrevistado boolean, s_referencias int, s_imss boolean, s_ine boolean, s_confirmo boolean)
language sql stable security definer set search_path = public as $$
  select s.vacancy_id, s.candidate_id,
         (row_number() over (partition by s.vacancy_id order by s.created_at))::int,
         s.quiere, s.liberado,
         case when s.liberado or s.cita is not null then c.nombre end,
         case when s.liberado then c.tel end,
         c.ult_puesto, c.ult_tiempo, c.esco, c.pmin, c.pmax, c.tipo_pref, c.disp, c.mov, c.habilidades, c.carta,
         t.res, s.cita, s.lugar,
         exists (select 1 from entrevistas e where e.candidate_id = c.id and e.estado = 'Realizada' and coalesce(e.resultado, '') <> 'No recomendado'),
         (select count(*)::int from referencias r where r.candidate_id = c.id and r.verificada and coalesce(r.recontrataria, '') <> 'No'),
         exists (select 1 from documentos d where d.candidate_id = c.id and d.tipo = 'IMSS' and d.estado = 'Revisado'),
         exists (select 1 from documentos d where d.candidate_id = c.id and d.tipo = 'INE' and d.estado = 'Revisado'),
         coalesce(s.confirmado, false)
  from shortlist s
  join vacancies v on v.id = s.vacancy_id
  join companies co on co.id = v.company_id
  join candidates c on c.id = s.candidate_id
  left join tests t on t.candidate_id = c.id and t.estado = 'completada'
  where s.enviado and co.user_id = auth.uid();
$$;

grant execute on function public.my_ternas(), public.agendar_entrevista(uuid, uuid, timestamptz, text, text),
  public.mis_entrevistas(), public.pedir_confirmacion(uuid, uuid), public.mis_confirmaciones(),
  public.confirmar_condiciones(uuid, boolean, text) to authenticated;
