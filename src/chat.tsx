import { useCallback, useEffect, useRef, useState } from 'react';
import { fmtCita } from './lib/catalog';
import { currentSubscription, disablePush, enablePush, isIos, isStandalone, pushSupported } from './lib/push';
import { supabase } from './lib/supabase';
import type { ChatMsg, Hilo } from './lib/types';
import { PREVIEW_MSG, toast } from './ui';

type Hilo1 = { candidateId?: string | null; companyId?: string | null };

const DEMO_CHAT: ChatMsg[] = [
  { id: 'd1', candidate_id: 'demo', company_id: null, de_equipo: false, autor: null, texto: '¿Todavía está disponible la vacante de pespunte?', leido: true, created_at: new Date(Date.now() - 864e5).toISOString() },
  { id: 'd2', candidate_id: 'demo', company_id: null, de_equipo: true, autor: null, texto: 'Sí, sigue abierta. Para avanzar te pedimos tu INE y tu CV en la sección Documentos.', leido: false, created_at: new Date(Date.now() - 36e5).toISOString() },
];

// Conversación de un candidato o empresa con el equipo. La usan las dos partes.
export function Conversacion({ candidateId, companyId, equipo, preview, alto = 360, onLeido, nombreOtro }: Hilo1 & {
  equipo: boolean; preview?: boolean; alto?: number; onLeido?: () => void; nombreOtro?: string;
}) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [texto, setTexto] = useState('');
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const leidoRef = useRef(onLeido);
  leidoRef.current = onLeido;
  const campo = candidateId ? 'candidate_id' : 'company_id';
  const id = candidateId ?? companyId ?? '';

  const marcar = useCallback(async () => {
    if (preview || !id) return;
    await supabase.rpc('chat_leido', equipo ? { p_candidate: candidateId ?? null, p_company: companyId ?? null } : {});
    leidoRef.current?.();
  }, [preview, id, equipo, candidateId, companyId]);

  const cargar = useCallback(async () => {
    if (preview) { setMsgs(DEMO_CHAT); return; }
    if (!id) return;
    const { data } = await supabase.from('chat').select('*').eq(campo, id).order('created_at').limit(300);
    setMsgs((data as ChatMsg[]) ?? []);
    marcar();
  }, [preview, id, campo, marcar]);

  useEffect(() => { cargar(); }, [cargar]);

  // Mensajes nuevos al momento
  useEffect(() => {
    if (preview || !id) return;
    const ch = supabase.channel(`chat-${id}-${equipo ? 'e' : 'u'}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat', filter: `${campo}=eq.${id}` }, (p) => {
        const m = p.new as ChatMsg;
        setMsgs((xs) => (xs.some((x) => x.id === m.id) ? xs : [...xs, m]));
        if (m.de_equipo !== equipo) marcar();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [preview, id, campo, equipo, marcar]);

  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [msgs.length]);

  const enviar = async () => {
    const t = texto.trim();
    if (!t) return;
    if (preview) return toast(PREVIEW_MSG);
    setBusy(true);
    const { data, error } = await supabase.from('chat').insert({ [campo]: id, texto: t }).select().single();
    setBusy(false);
    if (error) return toast('No se pudo enviar: ' + error.message, true);
    setTexto('');
    setMsgs((xs) => (xs.some((x) => x.id === (data as ChatMsg).id) ? xs : [...xs, data as ChatMsg]));
  };

  return (
    <div className="chat">
      <div className="chat-msgs" ref={box} style={{ maxHeight: alto }} aria-live="polite">
        {!msgs.length && <p className="empty">{equipo ? 'Aún no hay mensajes en esta conversación.' : 'Escríbenos tu duda. Te contestamos aquí mismo.'}</p>}
        {msgs.map((m) => {
          const mio = m.de_equipo === equipo;
          return (
            <div key={m.id} className={'burbuja' + (mio ? ' mia' : '')}>
              {!mio && <span className="quien">{m.de_equipo ? 'Factor·Gente' : nombreOtro ?? 'Mensaje'}</span>}
              <p>{m.texto}</p>
              <span className="cuando">{fmtCita(m.created_at)}{mio && m.leido ? ' · Leído' : ''}</span>
            </div>
          );
        })}
      </div>
      <div className="chat-send">
        <textarea value={texto} rows={2} placeholder="Escribe tu mensaje" aria-label="Escribe tu mensaje"
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(pointer:fine)').matches) { e.preventDefault(); enviar(); } }} />
        <button type="button" className="btn primary" disabled={busy || !texto.trim()} onClick={enviar}>Enviar</button>
      </div>
    </div>
  );
}

// Tarjeta para el candidato o la empresa
export function ChatCard({ candidateId, companyId, userId, preview }: Hilo1 & { userId: string; preview?: boolean }) {
  const [nuevos, setNuevos] = useState(0);
  const id = candidateId ?? companyId;
  const contar = useCallback(async () => {
    if (preview) { setNuevos(1); return; }
    if (!id) return;
    const { count } = await supabase.from('chat').select('id', { count: 'exact', head: true })
      .eq(candidateId ? 'candidate_id' : 'company_id', id).eq('de_equipo', true).eq('leido', false);
    setNuevos(count ?? 0);
  }, [preview, id, candidateId]);
  useEffect(() => { contar(); }, [contar]);
  return (
    <section className="card" id="chat">
      <div className="card-h"><h3>Mensajes con Factor·Gente</h3>{nuevos > 0 && <span className="pill warn">{nuevos} nuevo{nuevos > 1 ? 's' : ''}</span>}</div>
      <p className="hint">Pregunta lo que necesites. Te contestamos aquí mismo, normalmente el mismo día hábil.</p>
      <Conversacion candidateId={candidateId} companyId={companyId} equipo={false} preview={preview} onLeido={() => setNuevos(0)} />
      <PushToggle userId={userId} preview={preview} texto="Avísame en el celular cuando me contesten" />
    </section>
  );
}

// Activar o quitar las notificaciones del celular
export function PushToggle({ userId, preview, texto }: { userId: string; preview?: boolean; texto: string }) {
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { currentSubscription().then((s) => setOn(!!s)).catch(() => setOn(false)); }, []);
  const ios = isIos() && !isStandalone();
  if (!pushSupported() && !ios) return null;
  const cambiar = async () => {
    if (preview) return toast(PREVIEW_MSG);
    setBusy(true);
    try {
      if (on) { await disablePush(); setOn(false); toast('Notificaciones desactivadas.'); }
      else { await enablePush(userId); setOn(true); toast('Listo. Te avisaremos en este celular.'); }
    } catch (e) { toast((e as Error).message, true); }
    setBusy(false);
  };
  return (
    <div className="push-row">
      <button type="button" className={'btn sm' + (on ? '' : ' aqua')} disabled={busy || on === null} onClick={cambiar}>
        {on ? 'Notificaciones activadas ✓' : texto}</button>
      {on && <span className="hint">Toca para desactivarlas.</span>}
      {ios && !on && <span className="hint">En iPhone, primero agrega la app a tu pantalla de inicio (Compartir → Agregar a inicio) y ábrela desde el ícono.</span>}
    </div>
  );
}

// Panel del equipo: todas las conversaciones
export function ChatPanel({ userId, abrir, onAbrir, onCand }: {
  userId: string; abrir: Hilo1 | null; onAbrir: (h: Hilo1 | null) => void; onCand: (id: string) => void;
}) {
  const [hilos, setHilos] = useState<Hilo[]>([]);
  const [verTodos, setVerTodos] = useState(false);
  const cargar = useCallback(async () => {
    const { data, error } = await supabase.rpc('chat_hilos');
    if (error) return toast('No se pudieron cargar los mensajes: ' + error.message, true);
    setHilos((data as Hilo[]) ?? []);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    const ch = supabase.channel('chat-panel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat' }, () => cargar())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [cargar]);

  const sinLeer = hilos.reduce((a, h) => a + h.sin_leer, 0);
  const lista = verTodos ? hilos : hilos.filter((h) => h.sin_leer > 0 || !h.ultimo_de_equipo).slice(0, 12);
  const sel = abrir && hilos.find((h) => (abrir.candidateId && h.candidate_id === abrir.candidateId) || (abrir.companyId && h.company_id === abrir.companyId));
  const esSel = (h: Hilo) => !!sel && h.candidate_id === sel.candidate_id && h.company_id === sel.company_id;

  return (
    <section className={'card' + (sinLeer ? ' attention' : '')} id="mensajes" style={{ marginBottom: 20 }}>
      <div className="card-h"><h3>Mensajes</h3>
        <div className="actions">
          {sinLeer > 0 && <span className="pill warn">{sinLeer} sin leer</span>}
          <label className="hint inline-check"><input type="checkbox" checked={verTodos} onChange={(e) => setVerTodos(e.target.checked)} /> Ver todas las conversaciones</label>
        </div></div>
      <div className="chat-panel">
        <div className="list hilos">
          {lista.map((h) => (
            <button type="button" key={(h.candidate_id ?? '') + (h.company_id ?? '')} className={'item' + (esSel(h) ? ' sel' : '')}
              onClick={() => onAbrir({ candidateId: h.candidate_id, companyId: h.company_id })}>
              <span className="item-h"><strong>{h.nombre}</strong>
                <span className="meta"><span className="pill lea">{h.tipo}</span>{h.sin_leer > 0 && <span className="pill warn">{h.sin_leer}</span>}</span></span>
              <span className="hint">{h.ultimo_de_equipo ? 'Tú: ' : ''}{h.ultimo.length > 90 ? h.ultimo.slice(0, 90) + '…' : h.ultimo}</span>
              <span className="hint">{fmtCita(h.ultimo_at)}</span>
            </button>
          ))}
          {!lista.length && <p className="empty">{hilos.length ? 'No hay conversaciones pendientes.' : 'Aún no hay mensajes. Cuando un candidato o una empresa te escriba, aparece aquí.'}</p>}
        </div>
        {abrir && (abrir.candidateId || abrir.companyId) && (
          <div className="stack-sm">
            <div className="item-h"><strong>{sel?.nombre ?? 'Conversación nueva'}</strong>
              <span className="actions">
                {abrir.candidateId && <button type="button" className="btn sm" onClick={() => onCand(abrir.candidateId!)}>Ver ficha</button>}
                <button type="button" className="btn sm" onClick={() => onAbrir(null)}>Cerrar</button></span></div>
            <Conversacion key={(abrir.candidateId ?? '') + (abrir.companyId ?? '')} candidateId={abrir.candidateId} companyId={abrir.companyId}
              equipo onLeido={cargar} nombreOtro={sel?.nombre} />
          </div>
        )}
      </div>
      <PushToggle userId={userId} texto="Avisarme en este dispositivo cuando alguien escriba" />
    </section>
  );
}
