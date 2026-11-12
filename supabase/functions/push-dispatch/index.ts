// Factor·Gente · envía las notificaciones push pendientes (Web Push / VAPID)
// La invoca la base de datos (pg_net) cada vez que se encola algo,.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:contacto@jcflorido.me',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
);

type Notification = { id: number; user_id: string; title: string; body: string; url: string };
type Subscription = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };

Deno.serve(async (req) => {
  if (req.headers.get('x-dispatch-secret') !== Deno.env.get('DISPATCH_SECRET')) {
    return new Response('forbidden', { status: 403 });
  }

  const { data: items, error } = await supabase.rpc('claim_notifications', { p_limit: 200 });
  if (error) return new Response(error.message, { status: 500 });
  const notifications = (items ?? []) as Notification[];
  if (!notifications.length) return Response.json({ sent: 0 });

  const userIds = [...new Set(notifications.map((n) => n.user_id))];
  const { data: subs } = await supabase.from('push_subscriptions').select('*').in('user_id', userIds);
  const subscriptions = (subs ?? []) as Subscription[];

  let sent = 0;
  const dead = new Set<string>();
  await Promise.all(notifications.flatMap((n) =>
    subscriptions.filter((s) => s.user_id === n.user_id).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: n.title, body: n.body, url: n.url, tag: `n${n.id}` }),
          { TTL: 3600 },
        );
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // El celular ya no acepta esta suscripción: se borra
        if (status === 404 || status === 410) dead.add(s.id);
        else console.error('push error', status, e);
      }
    })
  ));

  if (dead.size) await supabase.from('push_subscriptions').delete().in('id', [...dead]);
  return Response.json({ sent, notifications: notifications.length });
});
