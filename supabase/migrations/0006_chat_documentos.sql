-- Factor-Gente · 0006: chat de ida y vuelta, solicitud de documentos y referencias, notificaciones push
-- Pegar completo en Supabase → SQL Editor → Run. Debe terminar con "Success. No rows returned".

create extension if not exists pg_net with schema extensions;

-- ============ Chat ============
-- Una conversación por candidato o por empresa con el equipo de Factor-Gente
create table public.chat (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references public.candidates on delete cascade,
  company_id uuid references public.companies on delete cascade,
  de_equipo boolean not null default false,
  autor uuid default auth.uid() references auth.users on delete set null,
  texto text not null check (length(trim(texto)) > 0 and length(texto) <= 3000),
  leido boolean not null default false,
  created_at timestamptz not null default now(),
  constraint chat_un_hilo check ((candidate_id is null) <> (company_id is null))
);
create index chat_cand_idx on public.chat (candidate_id, created_at);
create index chat_comp_idx on public.chat (company_id, created_at);

-- Los mensajes de la tarjeta anterior pasan al chat (antes de las reglas automáticas, para conservar
-- quién escribió y si ya se atendió; la tabla vieja se conserva)
insert into public.chat (candidate_id, company_id, de_equipo, autor, texto, leido, created_at)
select m.candidate_id, case when m.candidate_id is null then m.company_id end, false, m.user_id,
       m.texto || coalesce(' (vacante: ' || v.puesto || ')', ''), m.atendido, m.created_at
from public.mensajes m left join public.vacancies v on v.id = m.vacancy_id
where m.candidate_id is not null or m.company_id is not null;

-- Quien escribe no puede hacerse pasar por el equipo ni marcar como leído
create or replace function public.guard_chat() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.autor := auth.uid();
  new.leido := false;
  new.de_equipo := is_admin();
  return new;
end $$;
create trigger chat_guard before insert on public.chat
  for each row execute function public.guard_chat();

alter table public.chat enable row level security;
create policy chat_read on public.chat for select using (
  is_admin()
  or candidate_id in (select id from candidates where user_id = auth.uid())
  or company_id in (select id from companies where user_id = auth.uid()));
create policy chat_insert on public.chat for insert with check (
  is_admin()
  or candidate_id in (select id from candidates where user_id = auth.uid())
  or company_id in (select id from companies where user_id = auth.uid()));
create policy chat_admin_del on public.chat for delete using (is_jefe());

-- Marca como leídos los mensajes del otro lado en una conversación
create or replace function public.chat_leido(p_candidate uuid default null, p_company uuid default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if is_admin() then
    update chat set leido = true
     where not de_equipo and not leido
       and ((p_candidate is not null and candidate_id = p_candidate) or (p_company is not null and company_id = p_company));
  else
    update chat set leido = true
     where de_equipo and not leido
       and (candidate_id in (select id from candidates where user_id = auth.uid())
            or company_id in (select id from companies where user_id = auth.uid()));
  end if;
end $$;

-- Para ver los mensajes nuevos al momento
alter publication supabase_realtime add table public.chat;

-- ============ Documentos ============
-- Solo se piden a petición de Factor-Gente; nunca bloquean el registro
create table public.documentos (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates on delete cascade,
  tipo text not null check (tipo in ('CV', 'INE', 'Domicilio', 'IMSS', 'Otro', 'Referencias')),
  nombre text not null,
  cantidad int check (cantidad is null or cantidad between 1 and 3),
  estado text not null default 'Solicitado' check (estado in ('Solicitado', 'Recibido', 'Revisado', 'Rechazado')),
  path text,
  archivo text,
  nota text,
  solicitado_por uuid default auth.uid() references auth.users on delete set null,
  solicitado_at timestamptz not null default now(),
  recibido_at timestamptz,
  revisado_at timestamptz,
  recordado_at timestamptz
);
create index documentos_cand_idx on public.documentos (candidate_id);

alter table public.documentos enable row level security;
create policy docs_read on public.documentos for select using (
  is_admin() or candidate_id in (select id from candidates where user_id = auth.uid()));
create policy docs_admin on public.documentos for all using (is_admin()) with check (is_admin());

-- Referencias laborales que captura el candidato; el equipo registra lo que le dijeron
create table public.referencias (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates on delete cascade,
  nombre text not null,
  empresa text,
  puesto text,
  telefono text not null,
  relacion text,
  verificada boolean not null default false,
  recontrataria text check (recontrataria is null or recontrataria in ('Sí', 'No', 'No sabe')),
  resultado text,
  verificado_por uuid references auth.users on delete set null,
  verificado_at timestamptz,
  created_at timestamptz not null default now()
);
create index referencias_cand_idx on public.referencias (candidate_id);

alter table public.referencias enable row level security;
create policy refs_read on public.referencias for select using (
  is_admin() or candidate_id in (select id from candidates where user_id = auth.uid()));
create policy refs_admin on public.referencias for all using (is_admin()) with check (is_admin());

-- Archivos: carpeta privada, una subcarpeta por candidato
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 8388608,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do nothing;

create policy docs_files_read on storage.objects for select using (
  bucket_id = 'documentos' and (public.is_admin()
    or (storage.foldername(name))[1] in (select id::text from public.candidates where user_id = auth.uid())));
create policy docs_files_insert on storage.objects for insert with check (
  bucket_id = 'documentos' and (public.is_admin()
    or (storage.foldername(name))[1] in (select id::text from public.candidates where user_id = auth.uid())));
create policy docs_files_delete on storage.objects for delete using (
  bucket_id = 'documentos' and (public.is_admin()
    or (storage.foldername(name))[1] in (select id::text from public.candidates where user_id = auth.uid())));

-- ============ Notificaciones push ============
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create policy push_mine on public.push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Bandeja de salida (solo el servidor la lee)
create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  body text not null default '',
  url text not null default '/',
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index notifications_pending_idx on public.notifications (id) where sent_at is null;
alter table public.notifications enable row level security;

-- Configuración privada: dirección de la función que envía los push y su secreto
create table public.app_config (key text primary key, value text not null);
alter table public.app_config enable row level security;

create or replace function public.notify(p_user uuid, p_title text, p_body text, p_url text default '/') returns void
language sql security definer set search_path = public as $$
  insert into notifications (user_id, title, body, url)
  select p_user, p_title, left(coalesce(p_body, ''), 180), coalesce(p_url, '/')
  where p_user is not null and p_user is distinct from auth.uid();
$$;

-- Avisa a todo el equipo
create or replace function public.notify_equipo(p_title text, p_body text, p_url text default '/') returns void
language sql security definer set search_path = public as $$
  select notify(user_id, p_title, p_body, p_url) from admins;
$$;

create or replace function public.invoke_dispatch() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare v_url text; v_secret text;
begin
  select value into v_url from app_config where key = 'dispatch_url';
  select value into v_secret from app_config where key = 'dispatch_secret';
  if v_url is not null then
    perform net.http_post(url := v_url, body := '{}'::jsonb,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-dispatch-secret', coalesce(v_secret, '')));
  end if;
  return null;
end $$;
create trigger notifications_dispatch after insert on public.notifications
  for each statement execute function public.invoke_dispatch();

-- La función que envía reclama un lote de forma atómica (evita envíos dobles)
create or replace function public.claim_notifications(p_limit integer default 200) returns setof public.notifications
language sql security definer set search_path = public as $$
  update notifications set sent_at = now()
   where id in (select id from notifications where sent_at is null order by id limit p_limit for update skip locked)
  returning *;
$$;

-- Cada mensaje del chat avisa al otro lado
create or replace function public.chat_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_nombre text;
begin
  if new.de_equipo then
    select coalesce((select user_id from candidates where id = new.candidate_id),
                    (select user_id from companies where id = new.company_id)) into v_user;
    perform notify(v_user, 'Factor·Gente te respondió', new.texto, '/?chat=1');
  else
    select coalesce((select nombre from candidates where id = new.candidate_id),
                    (select nombre from companies where id = new.company_id)) into v_nombre;
    perform notify_equipo('Mensaje de ' || coalesce(v_nombre, 'un usuario'), new.texto,
      '/?chat=' || coalesce(new.candidate_id, new.company_id)::text);
  end if;
  return null;
end $$;
create trigger chat_notify after insert on public.chat
  for each row execute function public.chat_notify();

-- ============ Funciones que usa la app ============
-- El equipo pide documentos y referencias: crea las solicitudes, escribe en el chat y avisa al candidato
create or replace function public.solicitar_documentos(p_candidate uuid, p_items jsonb, p_refs int default 0) returns void
language plpgsql security definer set search_path = public as $$
declare it jsonb; lista text := ''; v_user uuid;
begin
  if not is_admin() then raise exception 'Solo el equipo puede pedir documentos'; end if;
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    insert into documentos (candidate_id, tipo, nombre) values (p_candidate, it->>'tipo', it->>'nombre');
    lista := lista || case when lista = '' then '' else ', ' end || (it->>'nombre');
  end loop;
  if coalesce(p_refs, 0) > 0 then
    insert into documentos (candidate_id, tipo, nombre, cantidad)
    values (p_candidate, 'Referencias', p_refs || case when p_refs = 1 then ' referencia laboral' else ' referencias laborales' end, p_refs);
    lista := lista || case when lista = '' then '' else ', ' end
      || p_refs || case when p_refs = 1 then ' referencia laboral' else ' referencias laborales' end;
  end if;
  if lista = '' then raise exception 'Elige al menos un documento'; end if;
  insert into chat (candidate_id, texto) values (p_candidate,
    'Para avanzar en tu proceso te pedimos: ' || lista || '. Puedes subirlos en la sección "Documentos" de tu perfil. Es opcional, pero nos ayuda a presentarte mejor con la empresa.');
end $$;

-- Recordatorio de documentos pendientes
create or replace function public.recordar_documentos(p_candidate uuid) returns void
language plpgsql security definer set search_path = public as $$
declare lista text;
begin
  if not is_admin() then raise exception 'Solo el equipo'; end if;
  select string_agg(nombre, ', ') into lista from documentos
   where candidate_id = p_candidate and estado in ('Solicitado', 'Rechazado');
  if lista is null then raise exception 'No hay documentos pendientes'; end if;
  update documentos set recordado_at = now() where candidate_id = p_candidate and estado in ('Solicitado', 'Rechazado');
  insert into chat (candidate_id, texto) values (p_candidate,
    'Te recordamos que tienes pendiente: ' || lista || '. Súbelos en la sección "Documentos" cuando puedas.');
end $$;

-- El candidato terminó de subir un archivo
create or replace function public.doc_subido(p_doc uuid, p_path text, p_archivo text) returns void
language plpgsql security definer set search_path = public as $$
declare d documentos; v_nombre text;
begin
  select * into d from documentos where id = p_doc;
  if d.id is null then raise exception 'Documento no encontrado'; end if;
  if not is_admin() and not exists (select 1 from candidates where id = d.candidate_id and user_id = auth.uid()) then
    raise exception 'No tienes permiso';
  end if;
  if split_part(p_path, '/', 1) <> d.candidate_id::text then raise exception 'Ruta no válida'; end if;
  update documentos set path = p_path, archivo = p_archivo, estado = 'Recibido', recibido_at = now(), nota = null where id = p_doc;
  if not is_admin() then
    select nombre into v_nombre from candidates where id = d.candidate_id;
    perform notify_equipo(v_nombre || ' subió un documento', d.nombre, '/?cand=' || d.candidate_id::text);
  end if;
end $$;

-- El candidato envía sus referencias laborales
create or replace function public.enviar_referencias(p_doc uuid, p_refs jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare d documentos; r jsonb; n int := 0; v_nombre text;
begin
  select * into d from documentos where id = p_doc and tipo = 'Referencias';
  if d.id is null then raise exception 'Solicitud no encontrada'; end if;
  if not is_admin() and not exists (select 1 from candidates where id = d.candidate_id and user_id = auth.uid()) then
    raise exception 'No tienes permiso';
  end if;
  for r in select * from jsonb_array_elements(coalesce(p_refs, '[]'::jsonb)) loop
    if length(trim(coalesce(r->>'nombre', ''))) > 0 and length(trim(coalesce(r->>'telefono', ''))) > 0 then
      insert into referencias (candidate_id, nombre, empresa, puesto, telefono, relacion)
      values (d.candidate_id, trim(r->>'nombre'), nullif(trim(r->>'empresa'), ''), nullif(trim(r->>'puesto'), ''),
              trim(r->>'telefono'), nullif(trim(r->>'relacion'), ''));
      n := n + 1;
    end if;
  end loop;
  if n = 0 then raise exception 'Escribe al menos una referencia con nombre y teléfono'; end if;
  update documentos set estado = 'Recibido', recibido_at = now(), nota = null where id = p_doc;
  if not is_admin() then
    select nombre into v_nombre from candidates where id = d.candidate_id;
    perform notify_equipo(v_nombre || ' envió sus referencias', n || ' referencia(s)', '/?cand=' || d.candidate_id::text);
  end if;
end $$;

-- Conversaciones para el panel: una fila por hilo con el último mensaje y los no leídos
create or replace function public.chat_hilos()
returns table (candidate_id uuid, company_id uuid, nombre text, tipo text, ultimo text, ultimo_at timestamptz,
               ultimo_de_equipo boolean, sin_leer int)
language sql stable security definer set search_path = public as $$
  with h as (
    select c.candidate_id, c.company_id,
           count(*) filter (where not c.de_equipo and not c.leido)::int as sin_leer,
           max(c.created_at) as ultimo_at
    from chat c where is_admin()
    group by c.candidate_id, c.company_id
  )
  select h.candidate_id, h.company_id,
         coalesce(ca.nombre, co.nombre), case when h.candidate_id is not null then 'Candidato' else 'Empresa' end,
         l.texto, h.ultimo_at, l.de_equipo, h.sin_leer
  from h
  left join candidates ca on ca.id = h.candidate_id
  left join companies co on co.id = h.company_id
  left join lateral (
    select texto, de_equipo from chat x
    where x.candidate_id is not distinct from h.candidate_id and x.company_id is not distinct from h.company_id
    order by x.created_at desc limit 1) l on true
  order by (h.sin_leer > 0) desc, h.ultimo_at desc;
$$;

-- ============ Permisos de las funciones ============
revoke execute on function public.invoke_dispatch() from public, anon, authenticated;
revoke execute on function public.claim_notifications(integer) from public, anon, authenticated;
revoke execute on function public.notify(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.notify_equipo(text, text, text) from public, anon, authenticated;
revoke execute on function public.chat_notify() from public, anon, authenticated;
grant execute on function public.chat_leido(uuid, uuid), public.solicitar_documentos(uuid, jsonb, int),
  public.recordar_documentos(uuid), public.doc_subido(uuid, text, text), public.enviar_referencias(uuid, jsonb),
  public.chat_hilos() to authenticated;
