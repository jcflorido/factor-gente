# Factor-Gente · Puesta en marcha

Todo usa planes gratuitos. Se hace una sola vez.

## 1. Supabase (base de datos)
1. https://supabase.com/dashboard → **New project** → nombre `factor-gente`.
2. **Authentication → Sign In / Providers**:
   - Activar **Allow anonymous sign-ins** (los candidatos entran sin correo).
   - En **Email**, desactivar **Confirm email**.
3. **SQL Editor → New query**: pegar y correr, en orden, cada archivo de `supabase/migrations/` (`0001_factor_gente.sql`, `0002_entrevista_cobros.sql`, `0003_mensajes.sql`, `0004_equipo_garantia.sql`, `0005_origen_vacantes_publicas.sql`, `0006_chat_documentos.sql`) → **Run** → *Success. No rows returned*.
4. **Authentication → URL Configuration**: Site URL `https://factorgente.jcflorido.me`; en Redirect URLs agregar también `http://localhost:5173`.
5. **Project Settings → API**: copiar Project URL y anon public key a `src/lib/supabase.ts` (o a `.env.local`).

## 1b. Notificaciones push (una sola vez)
1. Supabase → **Edge Functions** → *Deploy a new function* → *Via Editor*. Nombre: `push-dispatch`. Pega el contenido de `supabase/functions/push-dispatch/index.ts`. En su configuración, **desactiva "Verify JWT"**. **Deploy**.
2. **Edge Functions → Secrets**: agrega los 4 valores de `supabase/.secrets.local` (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `DISPATCH_SECRET`). Ese archivo no se sube a GitHub; no lo compartas.
3. **SQL Editor**:
```sql
insert into public.app_config (key, value) values
  ('dispatch_url', 'https://aytixgebriffxplfjtpk.supabase.co/functions/v1/push-dispatch'),
  ('dispatch_secret', 'PEGA-AQUI-EL-DISPATCH_SECRET')
on conflict (key) do update set value = excluded.value;
```
4. En cada celular: botón "Avísame en el celular…" (candidato y empresa) o "Avisarme en este dispositivo…" (panel). En iPhone, primero agregar la app a la pantalla de inicio.
- Si un aviso no llega: Edge Functions → push-dispatch → **Logs**, y `select * from notifications order by id desc limit 10;`.

## 2. Primer acceso (administrador)
La **primera persona que crea cuenta con correo** queda como administrador. JC debe entrar primero:
"Soy empresa" → "Crear cuenta de empresa" con su correo. Al entrar verá el Panel JC.

## 3. Publicar (Cloudflare Pages)
1. Repositorio privado en GitHub `jcflorido/factor-gente`.
2. Cloudflare → Workers & Pages → Create → Pages → conectar el repositorio.
   Build command `npm run build`, output `dist`.
3. Custom domain: `factorgente.jcflorido.me` (CNAME en Hostinger → `factor-gente.pages.dev`).

## Comprobar
- Celular sin sesión → "Busco trabajo" → llenar perfil → aparece en el Panel.
- Otra cuenta de empresa → nueva vacante → aparece en el Panel; armar terna y enviarla → la empresa ve fichas anónimas.
- La empresa pide entrevista → en el Panel "Liberar contacto" → la empresa ve nombre y WhatsApp.
