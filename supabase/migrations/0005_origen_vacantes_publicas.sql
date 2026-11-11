-- Factor-Gente · 0005: "¿Cómo nos conociste?" y vacantes visibles sin registrarse
-- Pegar completo en Supabase → SQL Editor → Run. Debe terminar con "Success. No rows returned".

-- De dónde llegó cada candidato y cada empresa
alter table public.candidates add column origen text;
alter table public.companies add column origen text;

-- Las vacantes publicadas (sin nombre de empresa ni filtros internos) se pueden ver sin cuenta
grant execute on function public.public_vacancies to anon;
