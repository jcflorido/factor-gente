import { useCallback, useEffect, useState } from 'react';
import { daysSince, fmtDate } from './lib/catalog';
import { supabase } from './lib/supabase';
import type { Candidate, Documento, Referencia } from './lib/types';
import { F, PREVIEW_MSG, Sel, toast } from './ui';

// Documentos de cajón que se piden por defecto
export const DOCS_BASE: { tipo: string; nombre: string; ayuda: string }[] = [
  { tipo: 'CV', nombre: 'CV (currículum)', ayuda: 'Si no tienes, no pasa nada: armamos uno con los datos de tu perfil.' },
  { tipo: 'INE', nombre: 'INE (identificación oficial)', ayuda: 'Foto clara de frente y vuelta.' },
  { tipo: 'Domicilio', nombre: 'Comprobante de domicilio', ayuda: 'Recibo de luz, agua o teléfono de los últimos 3 meses.' },
  { tipo: 'IMSS', nombre: 'Constancia de semanas cotizadas del IMSS', ayuda: 'Se descarga gratis en la app IMSS Digital o en la página del IMSS.' },
];
const AYUDA: Record<string, string> = Object.fromEntries(DOCS_BASE.map((d) => [d.tipo, d.ayuda]));
const BUCKET = 'documentos';
const MAX_MB = 8;

const ESTADO_PILL: Record<string, string> = { Solicitado: 'warn', Recibido: 'info', Revisado: 'ok', Rechazado: 'bad' };
const pendiente = (d: Documento) => d.estado === 'Solicitado' || d.estado === 'Rechazado';

// Las fotos se achican antes de subirlas para que pesen poco (máx. 1600 px, JPEG)
async function preparar(file: File): Promise<{ blob: Blob; ext: string; type: string }> {
  const esFoto = /^image\/(jpeg|png|webp)$/.test(file.type);
  if (!esFoto) {
    const ext = (file.name.split('.').pop() || 'pdf').toLowerCase();
    return { blob: file, ext, type: file.type || 'application/pdf' };
  }
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    cv.getContext('2d')!.drawImage(bmp, 0, 0, cv.width, cv.height);
    const blob = await new Promise<Blob | null>((r) => cv.toBlob(r, 'image/jpeg', 0.82));
    if (blob && blob.size < file.size) return { blob, ext: 'jpg', type: 'image/jpeg' };
  } catch { /* si no se puede achicar, se sube tal cual */ }
  return { blob: file, ext: (file.name.split('.').pop() || 'jpg').toLowerCase(), type: file.type };
}

export async function subirDocumento(d: Documento, file: File) {
  if (file.size > MAX_MB * 1024 * 1024) throw new Error(`El archivo pesa más de ${MAX_MB} MB. Toma la foto de nuevo o usa un PDF más ligero.`);
  const { blob, ext, type } = await preparar(file);
  const path = `${d.candidate_id}/${d.id}-${Date.now()}.${ext}`;
  const up = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: type, upsert: false });
  if (up.error) throw new Error(up.error.message);
  const { error } = await supabase.rpc('doc_subido', { p_doc: d.id, p_path: path, p_archivo: file.name });
  if (error) { await supabase.storage.from(BUCKET).remove([path]); throw new Error(error.message); }
  if (d.path) await supabase.storage.from(BUCKET).remove([d.path]);
}

// Borra todos los archivos de un candidato (al borrar su cuenta o al limpiar después del proceso)
export async function borrarArchivos(candidateId: string) {
  const { data } = await supabase.storage.from(BUCKET).list(candidateId, { limit: 200 });
  const paths = (data ?? []).map((f) => `${candidateId}/${f.name}`);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
}

async function abrir(path: string) {
  const win = window.open('', '_blank');
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 600);
  if (error || !data) { win?.close(); return toast('No se pudo abrir el archivo: ' + (error?.message ?? ''), true); }
  if (win) win.location.href = data.signedUrl; else window.location.href = data.signedUrl;
}

function SubirBoton({ d, onDone, texto, preview }: { d: Documento; onDone: () => void; texto: string; preview?: boolean }) {
  const [busy, setBusy] = useState(false);
  const elegir = async (f: File | undefined) => {
    if (!f) return;
    if (preview) return toast(PREVIEW_MSG);
    setBusy(true);
    try { await subirDocumento(d, f); toast('Archivo recibido. ¡Gracias!'); onDone(); }
    catch (e) { toast('No se pudo subir: ' + (e as Error).message, true); }
    setBusy(false);
  };
  return (
    <label className={'btn sm' + (d.estado === 'Recibido' ? '' : ' primary') + (busy ? ' disabled' : '')}>
      {busy ? 'Subiendo…' : texto}
      <input type="file" accept="image/*,application/pdf" hidden disabled={busy} onChange={(e) => { elegir(e.target.files?.[0]); e.target.value = ''; }} />
    </label>
  );
}

const DEMO_DOCS: Documento[] = [
  { id: 'dd1', candidate_id: 'demo', tipo: 'INE', nombre: 'INE (identificación oficial)', cantidad: null, estado: 'Solicitado', path: null, archivo: null, nota: null, solicitado_at: new Date().toISOString(), recibido_at: null, revisado_at: null, recordado_at: null },
  { id: 'dd2', candidate_id: 'demo', tipo: 'CV', nombre: 'CV (currículum)', cantidad: null, estado: 'Recibido', path: null, archivo: 'cv.pdf', nota: null, solicitado_at: new Date().toISOString(), recibido_at: new Date().toISOString(), revisado_at: null, recordado_at: null },
  { id: 'dd3', candidate_id: 'demo', tipo: 'Referencias', nombre: '2 referencias laborales', cantidad: 2, estado: 'Solicitado', path: null, archivo: null, nota: null, solicitado_at: new Date().toISOString(), recibido_at: null, revisado_at: null, recordado_at: null },
];

// ============ Lado del candidato ============
export function MisDocumentos({ candidateId, preview }: { candidateId: string; preview?: boolean }) {
  const [docs, setDocs] = useState<Documento[]>([]);
  const cargar = useCallback(async () => {
    if (preview) { setDocs(DEMO_DOCS); return; }
    const { data } = await supabase.from('documentos').select('*').eq('candidate_id', candidateId).order('solicitado_at');
    setDocs((data as Documento[]) ?? []);
  }, [candidateId, preview]);
  useEffect(() => { cargar(); }, [cargar]);
  if (!docs.length) return null;
  const faltan = docs.filter(pendiente).length;
  return (
    <section className={'card' + (faltan ? ' attention' : '')} id="documentos" style={{ marginBottom: 0 }}>
      <div className="card-h"><h3>Documentos</h3>{faltan > 0 ? <span className="pill warn">{faltan} pendiente{faltan > 1 ? 's' : ''}</span> : <span className="pill ok">Completo</span>}</div>
      <p className="hint">Factor·Gente te los pide porque avanzas en un proceso. Son opcionales, solo los ve el equipo de Factor·Gente y no se comparten con la empresa.</p>
      <div className="list">{docs.map((d) => (
        <div className="item" key={d.id}>
          <div className="item-h"><strong>{d.nombre}</strong><span className={'pill ' + (ESTADO_PILL[d.estado] ?? 'info')}>{d.estado === 'Solicitado' ? 'Pendiente' : d.estado}</span></div>
          {d.estado === 'Rechazado' && d.nota && <p className="note">Hay que volver a enviarlo: {d.nota}</p>}
          {d.tipo === 'Referencias'
            ? (pendiente(d) ? <RefsForm d={d} preview={preview} onDone={cargar} /> : <p className="hint">Gracias, ya recibimos tus referencias.</p>)
            : <>
                {pendiente(d) && AYUDA[d.tipo] && <p className="hint">{AYUDA[d.tipo]}</p>}
                {d.archivo && <p className="hint">Enviaste: {d.archivo}</p>}
                {d.estado !== 'Revisado' && <div className="actions"><SubirBoton d={d} onDone={cargar} preview={preview} texto={d.estado === 'Recibido' ? 'Cambiar archivo' : 'Subir foto o PDF'} /></div>}
              </>}
        </div>
      ))}</div>
    </section>
  );
}

function RefsForm({ d, onDone, preview }: { d: Documento; onDone: () => void; preview?: boolean }) {
  const n = d.cantidad ?? 2;
  const vacio = { nombre: '', empresa: '', puesto: '', telefono: '', relacion: 'Jefe directo' };
  const [refs, setRefs] = useState(Array.from({ length: n }, () => ({ ...vacio })));
  const [busy, setBusy] = useState(false);
  const set = (i: number, k: keyof typeof vacio, v: string) => setRefs(refs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const enviar = async () => {
    if (!refs.some((r) => r.nombre.trim() && r.telefono.trim())) return toast('Escribe al menos una referencia con nombre y teléfono.', true);
    if (preview) return toast(PREVIEW_MSG);
    setBusy(true);
    const { error } = await supabase.rpc('enviar_referencias', { p_doc: d.id, p_refs: refs });
    setBusy(false);
    if (error) return toast('No se pudo enviar: ' + error.message, true);
    toast('Referencias enviadas. ¡Gracias!');
    onDone();
  };
  return (
    <div className="stack-sm">
      <p className="hint">Personas de trabajos anteriores que puedan hablar de ti: un jefe, supervisor o encargado. Avísales que les vamos a llamar.</p>
      {refs.map((r, i) => (
        <div className="item surface" key={i}>
          <span className="lbl">Referencia {i + 1}</span>
          <div className="row">
            <F label="Nombre"><input type="text" value={r.nombre} onChange={(e) => set(i, 'nombre', e.target.value)} /></F>
            <F label="Teléfono"><input type="tel" value={r.telefono} onChange={(e) => set(i, 'telefono', e.target.value)} /></F>
          </div>
          <div className="row">
            <F label="Empresa"><input type="text" value={r.empresa} onChange={(e) => set(i, 'empresa', e.target.value)} /></F>
            <F label="Su puesto"><input type="text" value={r.puesto} placeholder="Ej. supervisor de pespunte" onChange={(e) => set(i, 'puesto', e.target.value)} /></F>
            <F label="¿Qué fue tuyo?"><Sel value={r.relacion} onChange={(v) => set(i, 'relacion', v)} options={['Jefe directo', 'Supervisor o encargado', 'Dueño del negocio', 'Compañero de trabajo', 'Otro']} /></F>
          </div>
        </div>
      ))}
      <div className="actions"><button type="button" className="btn sm primary" disabled={busy} onClick={enviar}>Enviar referencias</button></div>
    </div>
  );
}

// ============ Lado del equipo (en la ficha del candidato) ============
export function DocsEquipo({ c, jefe, onChat }: { c: Candidate; jefe: boolean; onChat: () => void }) {
  const [docs, setDocs] = useState<Documento[]>([]);
  const [refs, setRefs] = useState<Referencia[]>([]);
  const [pedir, setPedir] = useState(false);
  const cargar = useCallback(async () => {
    const [a, b] = await Promise.all([
      supabase.from('documentos').select('*').eq('candidate_id', c.id).order('solicitado_at'),
      supabase.from('referencias').select('*').eq('candidate_id', c.id).order('created_at'),
    ]);
    setDocs((a.data as Documento[]) ?? []);
    setRefs((b.data as Referencia[]) ?? []);
  }, [c.id]);
  useEffect(() => { cargar(); }, [cargar]);

  const run = async (p: PromiseLike<{ error: { message: string } | null }>, ok?: string) => {
    const { error } = await p;
    if (error) { toast(error.message, true); return false; }
    if (ok) toast(ok);
    await cargar();
    return true;
  };
  const pend = docs.filter(pendiente);
  const ultimoAviso = pend.reduce((m, d) => Math.max(m, new Date(d.recordado_at ?? d.solicitado_at).getTime()), 0);
  const tocaRecordar = pend.length > 0 && Date.now() - ultimoAviso > 48 * 3600e3;
  const verificadas = refs.filter((r) => r.verificada).length;

  return (
    <div className="stack-sm docs-equipo">
      <span className="eyebrow">Documentos y referencias</span>
      {!c.user_id && <p className="note">Registro asistido: esta persona no tiene la app. Pídele los documentos por WhatsApp y súbelos tú aquí.</p>}
      {docs.length > 0 && (
        <div className="list">{docs.map((d) => <DocFila key={d.id} d={d} jefe={jefe} run={run} recargar={cargar} />)}</div>
      )}
      {refs.length > 0 && (
        <div className="stack-sm">
          <span className="lbl">Referencias laborales ({verificadas} de {refs.length} verificadas)</span>
          {refs.map((r) => <RefFila key={r.id} r={r} run={run} />)}
        </div>
      )}
      <div className="actions">
        {!pedir && <button type="button" className="btn sm primary" onClick={() => setPedir(true)}>Solicitar documentos</button>}
        {pend.length > 0 && c.user_id && (
          <button type="button" className={'btn sm' + (tocaRecordar ? ' aqua' : '')} onClick={() => run(supabase.rpc('recordar_documentos', { p_candidate: c.id }), 'Recordatorio enviado por el chat.')}>
            Recordar pendientes{tocaRecordar ? ' (más de 2 días)' : ''}</button>
        )}
        {c.user_id && <button type="button" className="btn sm" onClick={onChat}>Abrir chat</button>}
        {jefe && docs.some((d) => d.path) && <BorrarTodo c={c} run={run} />}
      </div>
      {pedir && <SolicitarForm c={c} docs={docs} onCancel={() => setPedir(false)} onDone={async () => { setPedir(false); await cargar(); }} />}
    </div>
  );
}

function DocFila({ d, jefe, run, recargar }: { d: Documento; jefe: boolean; run: (p: PromiseLike<{ error: { message: string } | null }>, ok?: string) => Promise<boolean>; recargar: () => void }) {
  const [rechazo, setRechazo] = useState<string | null>(null);
  const hoy = new Date().toISOString();
  return (
    <div className="item">
      <div className="item-h"><strong>{d.nombre}</strong><span className={'pill ' + (ESTADO_PILL[d.estado] ?? 'info')}>{d.estado}</span></div>
      <div className="meta">
        <span>Pedido {fmtDate(d.solicitado_at)}</span>
        {d.recibido_at && <span>Recibido {fmtDate(d.recibido_at)}</span>}
        {pendiente(d) && <span>{daysSince(d.solicitado_at.slice(0, 10))} días sin respuesta</span>}
        {d.archivo && <span className="mono">{d.archivo}</span>}
      </div>
      {d.nota && <p className="hint">Nota: {d.nota}</p>}
      {rechazo === null ? (
        <div className="actions">
          {d.path && <button type="button" className="btn sm" onClick={() => abrir(d.path!)}>Ver archivo</button>}
          {d.estado === 'Recibido' && <button type="button" className="btn sm primary" onClick={() => run(supabase.from('documentos').update({ estado: 'Revisado', revisado_at: hoy }).eq('id', d.id), 'Marcado como revisado.')}>Revisado ✓</button>}
          {d.estado === 'Recibido' && <button type="button" className="btn sm" onClick={() => setRechazo('')}>Pedir otra vez</button>}
          {d.estado === 'Revisado' && <button type="button" className="btn sm" onClick={() => run(supabase.from('documentos').update({ estado: 'Recibido', revisado_at: null }).eq('id', d.id))}>Quitar revisado</button>}
          {d.tipo !== 'Referencias' && <SubirBoton d={d} onDone={recargar} texto={d.path ? 'Reemplazar' : 'Subirlo yo'} />}
          {jefe && pendiente(d) && <button type="button" className="btn sm danger" onClick={() => run(supabase.from('documentos').delete().eq('id', d.id), 'Solicitud cancelada.')}>Cancelar solicitud</button>}
        </div>
      ) : (
        <div className="stack-sm">
          <F label="¿Qué tiene que corregir? (lo verá el candidato)"><input type="text" value={rechazo} placeholder="Ej. la foto salió borrosa, falta la parte de atrás" onChange={(e) => setRechazo(e.target.value)} /></F>
          <div className="actions">
            <button type="button" className="btn sm primary" onClick={async () => {
              if (!rechazo.trim()) return toast('Escribe qué hay que corregir.', true);
              const ok = await run(supabase.from('documentos').update({ estado: 'Rechazado', nota: rechazo.trim() }).eq('id', d.id));
              if (ok) {
                await supabase.from('chat').insert({ candidate_id: d.candidate_id, texto: `Te pedimos enviar de nuevo: ${d.nombre}. Motivo: ${rechazo.trim()}` });
                toast('Le pedimos que lo envíe otra vez.'); setRechazo(null);
              }
            }}>Enviar</button>
            <button type="button" className="btn sm" onClick={() => setRechazo(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function RefFila({ r, run }: { r: Referencia; run: (p: PromiseLike<{ error: { message: string } | null }>, ok?: string) => Promise<boolean> }) {
  const [abierto, setAbierto] = useState(false);
  const [rec, setRec] = useState(r.recontrataria ?? 'Sí');
  const [res, setRes] = useState(r.resultado ?? '');
  const guardar = async () => {
    const ok = await run(supabase.from('referencias').update({
      verificada: true, recontrataria: rec, resultado: res.trim() || null, verificado_at: new Date().toISOString(),
      verificado_por: (await supabase.auth.getUser()).data.user?.id,
    }).eq('id', r.id), 'Referencia verificada.');
    if (ok) setAbierto(false);
  };
  return (
    <div className="item">
      <div className="item-h"><strong>{r.nombre}</strong>
        {r.verificada ? <span className={'pill ' + (r.recontrataria === 'No' ? 'bad' : 'ok')}>Verificada · ¿Lo recontrataría? {r.recontrataria}</span> : <span className="pill warn">Por llamar</span>}</div>
      <div className="meta"><span>{r.relacion}</span>{r.puesto && <span>{r.puesto}</span>}{r.empresa && <span>{r.empresa}</span>}<span className="mono">{r.telefono}</span></div>
      {r.resultado && !abierto && <p className="hint">“{r.resultado}”</p>}
      {!abierto ? (
        <div className="actions"><button type="button" className="btn sm" onClick={() => setAbierto(true)}>{r.verificada ? 'Editar' : 'Registrar llamada'}</button></div>
      ) : (
        <div className="stack-sm">
          <p className="hint">Preguntas sugeridas: ¿trabajó con usted y en qué fechas? ¿Qué puesto tenía? ¿Por qué salió? ¿Lo volvería a contratar?</p>
          <div className="row"><F label="¿Lo volvería a contratar?"><Sel value={rec} onChange={setRec} options={['Sí', 'No', 'No sabe']} /></F></div>
          <F label="Lo que te dijeron"><textarea value={res} onChange={(e) => setRes(e.target.value)} placeholder="Ej. trabajó 2 años como pespuntadora, puntual, salió por cambio de domicilio" /></F>
          <div className="actions"><button type="button" className="btn sm primary" onClick={guardar}>Guardar</button><button type="button" className="btn sm" onClick={() => setAbierto(false)}>Cancelar</button></div>
        </div>
      )}
    </div>
  );
}

function SolicitarForm({ c, docs, onCancel, onDone }: { c: Candidate; docs: Documento[]; onCancel: () => void; onDone: () => void }) {
  const yaPedido = (tipo: string) => docs.some((d) => d.tipo === tipo && d.estado !== 'Rechazado');
  const [sel, setSel] = useState<string[]>(DOCS_BASE.filter((d) => !yaPedido(d.tipo)).map((d) => d.tipo));
  const [otros, setOtros] = useState(['', '', '']);
  const [nRefs, setNRefs] = useState(yaPedido('Referencias') ? '0' : c.area === 'Operativo' ? '0' : '2');
  const [busy, setBusy] = useState(false);
  const enviar = async () => {
    const items = [
      ...DOCS_BASE.filter((d) => sel.includes(d.tipo)).map((d) => ({ tipo: d.tipo, nombre: d.nombre })),
      ...otros.map((o) => o.trim()).filter(Boolean).map((o) => ({ tipo: 'Otro', nombre: o })),
    ];
    if (!items.length && nRefs === '0') return toast('Elige al menos un documento.', true);
    setBusy(true);
    const { error } = await supabase.rpc('solicitar_documentos', { p_candidate: c.id, p_items: items, p_refs: Number(nRefs) });
    setBusy(false);
    if (error) return toast('No se pudo solicitar: ' + error.message, true);
    toast(c.user_id ? 'Solicitud enviada. Le llega por el chat de la app.' : 'Solicitud registrada. Pídeselos por WhatsApp.');
    onDone();
  };
  return (
    <div className="item surface stack-sm">
      <span className="lbl">¿Qué le pedimos a {c.nombre.split(' ')[0]}?</span>
      <div className="checks">{DOCS_BASE.map((d) => (
        <label key={d.tipo}><input type="checkbox" checked={sel.includes(d.tipo)} onChange={(e) => setSel(e.target.checked ? [...sel, d.tipo] : sel.filter((x) => x !== d.tipo))} />
          <span>{d.nombre}{yaPedido(d.tipo) ? <span className="hint"> · ya se pidió</span> : null}</span></label>
      ))}</div>
      <div className="row">{otros.map((o, i) => (
        <F key={i} label={`Otro documento ${i + 1} (opcional)`}><input type="text" value={o} placeholder={['Ej. licencia de manejo', 'Ej. certificado de estudios', 'Ej. carta de recomendación'][i]}
          onChange={(e) => setOtros(otros.map((x, j) => (j === i ? e.target.value : x)))} /></F>
      ))}</div>
      <div className="row"><F label="Referencias laborales"><Sel value={nRefs} onChange={setNRefs} options={['0', '1', '2', '3']} /></F></div>
      <p className="hint">Todo es opcional para el candidato y no bloquea su registro. Para administrativos y supervisores conviene pedir siempre la constancia del IMSS y referencias.</p>
      <div className="actions"><button type="button" className="btn sm primary" disabled={busy} onClick={enviar}>Enviar solicitud</button><button type="button" className="btn sm" onClick={onCancel}>Cancelar</button></div>
    </div>
  );
}

function BorrarTodo({ c, run }: { c: Candidate; run: (p: PromiseLike<{ error: { message: string } | null }>, ok?: string) => Promise<boolean> }) {
  const [ask, setAsk] = useState(false);
  if (!ask) return <button type="button" className="btn sm danger" onClick={() => setAsk(true)}>Borrar archivos</button>;
  return (
    <span className="confirm-inline">¿Borrar todos los archivos de {c.nombre.split(' ')[0]}? No se puede deshacer.
      <button type="button" className="btn sm danger fill" onClick={async () => {
        await borrarArchivos(c.id);
        await run(supabase.from('documentos').update({ path: null }).eq('candidate_id', c.id), 'Archivos borrados.');
        setAsk(false);
      }}>Sí, borrar</button>
      <button type="button" className="btn sm" onClick={() => setAsk(false)}>Cancelar</button></span>
  );
}
