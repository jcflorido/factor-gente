-- Factor-Gente · 0003: dudas y mensajes de empresas y candidatos
-- Pegar completo en Supabase → SQL Editor → Run. Debe terminar con "Success. No rows returned".

create table public.mensajes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users on delete cascade,
  candidate_id uuid references public.candidates on delete cascade,
  company_id uuid references public.companies on delete cascade,
  vacancy_id uuid references public.vacancies on delete set null,
  tipo text not null check (tipo in ('Candidato', 'Empresa')),
  nombre text not null,
  tel text not null,
  texto text not null check (length(trim(texto)) > 0),
  atendido boolean not null default false,
  created_at timestamptz not null default now()
);

-- Quien escribe no puede marcar su propio mensaje como atendido
create or replace function public.guard_mensaje() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then new.atendido := false; new.user_id := auth.uid(); end if;
  return new;
end $$;

create trigger mensajes_guard before insert on public.mensajes
  for each row execute function public.guard_mensaje();

alter table public.mensajes enable row level security;
create policy msg_insert on public.mensajes for insert with check (user_id = auth.uid());
create policy msg_read on public.mensajes for select using (user_id = auth.uid() or is_admin());
create policy msg_admin_upd on public.mensajes for update using (is_admin()) with check (is_admin());
create policy msg_admin_del on public.mensajes for delete using (is_admin());
