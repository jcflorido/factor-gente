import { supabase } from './supabase';

// Llave pública VAPID (es pública por diseño; la privada vive solo en Supabase)
const DEFAULT_VAPID = 'BDEKmDpdPIVESEgX2yg03xdt6gXY_q7AuKA7s2J79k1TWb1tp0mYfJnyofaTkJvMhftvKp1NWn5vpm-6lau2h0c';
const vapidKey = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) || DEFAULT_VAPID;

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

function urlB64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export async function enablePush(userId: string) {
  if (!pushSupported()) {
    throw new Error(isIos() && !isStandalone()
      ? 'En iPhone primero agrega la app a tu pantalla de inicio (Compartir → Agregar a inicio) y ábrela desde el ícono.'
      : 'Este navegador no permite notificaciones.');
  }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('No diste permiso para notificaciones. Puedes activarlo en los ajustes del navegador.');
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(vapidKey) });
  const j = sub.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert(
    { user_id: userId, endpoint: j.endpoint, p256dh: j.keys?.p256dh, auth: j.keys?.auth },
    { onConflict: 'endpoint' },
  );
  if (error) throw new Error(error.message);
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}
