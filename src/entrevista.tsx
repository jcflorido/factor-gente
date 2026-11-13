import { useCallback, useEffect, useState } from 'react';
import { fmtCita, money } from './lib/catalog';
import { supabase } from './lib/supabase';
import type { Candidate, Entrevista, MiConfirmacion, MiEntrevista, Vacancy } from './lib/types';
import { F, PREVIEW_MSG, Sel, toast } from './ui';

// Guía fija de la entrevista previa: las mismas preguntas para todos, para poder comparar
export const GUIA: { p: string; ayuda: string }[] = [
  { p: 'Experiencia real en el puesto', ayuda: '¿Qué hacía exactamente, cuánto tiempo, con qué máquinas o herramientas?' },
  { p: 'Motivo de salida y permanencia', ayuda: '¿Por qué salió del último trabajo? ¿Qué lo haría quedarse en el siguiente?' },
  { p: 'Horario y disponibilidad', ayuda: '¿Puede con el turno, sábados o tiempo extra? ¿Desde cuándo puede empezar?' },
  { p: 'Traslado', ayuda: '¿Cómo llegaría, cuánto tiempo y cuánto le cuesta?' },
  { p: 'Sueldo y forma de pago', ayuda: '¿Cuánto necesita de verdad? ¿Le funciona semanal, destajo o quincenal?' },
  { p: 'Actitud y comunicación', ayuda: '¿Fue puntual? ¿Se expresa con claridad? ¿Muestra interés?' },
];
const MEDIOS = ['Llamada', 'Videollamada de WhatsApp', 'Zoom o Meet', 'Presencial'];
const RESULTADOS = ['Recomendado', 'Con reservas', 'No recomendado'];
const RES_PILL: Record<string, string> = { Recomendado: 'ok', 'Con reservas': 'warn', 'No recomendado': 'bad' };
const EST_PILL: Record<string, string> = { Agendada: 'info', Realizada: 'ok', 'No asistió': 'bad', Cancelada: 'lea' };

type Run = (p: PromiseLike<{ error: { message: string } | null }>, ok?: string) => Promise<boolean>;

// ============ Panel: entrevista previa en la ficha del candidato ============
export function EntrevistaEquipo({ c, vacs, onCambio }: { c: Candidate; vacs: Vacancy[]; onCambio: () => void }) {
  const [lista, setLista] = useState<Entrevista[]>([]);
  const [agendar, setAgendar] = useState(false);
  const [registrar, setRegistrar] = useState<string | null>(null);
  const cargar = useCallback(async () => {
    const { data } = await supabase.from('entrevistas').select('*').eq('candidate_id', c.id).order('created_at', { ascending: false });
    setLista((data as Entrevista[]) ?? []);
  }, [c.id]);
  useEffect(() => { cargar(); }, [cargar]);
  const run: Run = async (p, ok) => {
    const { error } = await p;
    if (error) { toast(error.message, true); return false; }
    if (ok) toast(ok);
    await cargar(); onCambio();
    return true;
  };
  const hecha = lista.find((e) => e.estado === 'Realizada');
  return (
    <div className="stack-sm docs-equipo">
      <span className="eyebrow">Entrevista previa con Factor·Gente</span>
      {!lista.length && <p className="hint">Aún no tiene entrevista. Sin ella, el candidato no lleva el sello "Entrevistado" en la terna.</p>}
      {lista.map((e) => (
        <div className="item" key={e.id}>
          <div className="item-h"><strong>{e.cita ? fmtCita(e.cita) : 'Sin fecha'} · {e.medio}</strong>
            <span className="meta"><span className={'pill ' + (EST_PILL[e.estado] ?? 'info')}>{e.estado}</span>
              {e.resultado && <span className={'pill ' + (RES_PILL[e.resultado] ?? 'info')}>{e.resultado}{e.calificacion != null ? ` · ${e.calificacion}/5` : ''}</span>}</span></div>
          {e.enlace && <div className="meta"><span className="mono">{e.enlace}</span></div>}
          {e.vacancy_id && <div className="meta"><span>Vacante: {vacs.find((v) => v.id === e.vacancy_id)?.puesto ?? '—'}</span></div>}
          {e.comentario && <p className="hint">“{e.comentario}”</p>}
          {e.respuestas && (
            <details><summary>Ver calificación por pregunta</summary>
              <div className="bars">{e.respuestas.map((r) => (
                <div className="bar-r" key={r.p}><span>{r.p}</span><i style={{ ['--w' as string]: `${(r.v / 5) * 100}%` }} /><span className="mono">{r.v}</span></div>
              ))}</div>
              {e.respuestas.filter((r) => r.nota).map((r) => <p className="hint" key={r.p}><b>{r.p}:</b> {r.nota}</p>)}
            </details>
          )}
          {e.estado === 'Agendada' && registrar !== e.id && (
            <div className="actions">
              <button type="button" className="btn sm primary" onClick={() => setRegistrar(e.id)}>Registrar entrevista</button>
              <button type="button" className="btn sm" onClick={() => run(supabase.from('entrevistas').update({ estado: 'No asistió' }).eq('id', e.id), 'Marcado: no asistió.')}>No asistió</button>
              <button type="button" className="btn sm" onClick={() => run(supabase.from('entrevistas').update({ estado: 'Cancelada' }).eq('id', e.id), 'Entrevista cancelada.')}>Cancelar</button>
            </div>
          )}
          {registrar === e.id && <RegistrarForm e={e} run={run} onClose={() => setRegistrar(null)} />}
        </div>
      ))}
      <div className="actions">
        {!agendar && <button type="button" className={'btn sm' + (hecha ? '' : ' primary')} onClick={() => setAgendar(true)}>{lista.length ? 'Agendar otra entrevista' : 'Agendar entrevista previa'}</button>}
      </div>
      {agendar && <AgendarForm c={c} vacs={vacs} run={run} onClose={() => setAgendar(false)} />}
    </div>
  );
}

function AgendarForm({ c, vacs, run, onClose }: { c: Candidate; vacs: Vacancy[]; run: Run; onClose: () => void }) {
  const [cita, setCita] = useState('');
  const [medio, setMedio] = useState(MEDIOS[0]);
  const [enlace, setEnlace] = useState('');
  const [vac, setVac] = useState('');
  const abiertas = vacs.filter((v) => v.estado === 'Abierta' || v.estado === 'Terna enviada');
  const guardar = async () => {
    if (!cita) return toast('Elige fecha y hora.', true);
    const ok = await run(supabase.rpc('agendar_entrevista', {
      p_candidate: c.id, p_vacancy: vac || null, p_cita: new Date(cita).toISOString(), p_medio: medio, p_enlace: enlace.trim() || null,
    }), c.user_id ? 'Entrevista agendada. Le avisamos por el chat.' : 'Entrevista agendada. Avísale por WhatsApp.');
    if (ok) onClose();
  };
  const ph = medio === 'Presencial' ? 'Dirección del lugar' : medio === 'Zoom o Meet' ? 'Pega aquí el enlace de la reunión' : medio === 'Llamada' ? 'Opcional: quién llama a quién' : 'Opcional';
  return (
    <div className="item surface stack-sm">
      <div className="row">
        <F label="Fecha y hora"><input type="datetime-local" value={cita} onChange={(e) => setCita(e.target.value)} /></F>
        <F label="Medio"><Sel value={medio} onChange={setMedio} options={MEDIOS} /></F>
      </div>
      <div className="row">
        <F label={medio === 'Presencial' ? 'Lugar' : 'Enlace o indicaciones'}><input type="text" value={enlace} placeholder={ph} onChange={(e) => setEnlace(e.target.value)} /></F>
        <F label="¿Para qué vacante? (opcional)">
          <select value={vac} onChange={(e) => setVac(e.target.value)}>
            <option value="">General</option>
            {abiertas.map((v) => <option key={v.id} value={v.id}>{v.puesto}</option>)}
          </select>
        </F>
      </div>
      {!c.user_id && <p className="hint">Registro asistido: no tiene la app. Avísale de la cita por WhatsApp al {c.tel}.</p>}
      <div className="actions"><button type="button" className="btn sm primary" onClick={guardar}>Agendar</button><button type="button" className="btn sm" onClick={onClose}>Cancelar</button></div>
    </div>
  );
}

function RegistrarForm({ e, run, onClose }: { e: Entrevista; run: Run; onClose: () => void }) {
  const [vals, setVals] = useState<number[]>(GUIA.map(() => 0));
  const [notas, setNotas] = useState<string[]>(GUIA.map(() => ''));
  const [resultado, setResultado] = useState(RESULTADOS[0]);
  const [comentario, setComentario] = useState('');
  const faltan = vals.filter((v) => !v).length;
  const prom = vals.filter(Boolean).length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.filter(Boolean).length) * 10) / 10 : null;
  const guardar = async () => {
    if (faltan) return toast(`Califica las ${GUIA.length} preguntas (faltan ${faltan}).`, true);
    const ok = await run(supabase.from('entrevistas').update({
      estado: 'Realizada', realizada_at: new Date().toISOString(), calificacion: prom, resultado, comentario: comentario.trim() || null,
      respuestas: GUIA.map((g, i) => ({ p: g.p, v: vals[i], nota: notas[i].trim() })),
    }).eq('id', e.id), 'Entrevista registrada.');
    if (ok) onClose();
  };
  return (
    <div className="stack-sm">
      <p className="hint">Califica del 1 (muy mal) al 5 (excelente). Las preguntas de ayuda son sugeridas: platica con naturalidad.</p>
      {GUIA.map((g, i) => (
        <div className="q" key={g.p}>
          <p><b>{i + 1}. {g.p}</b> <span className="hint">{g.ayuda}</span></p>
          <div className="scale" role="group" aria-label={g.p}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button type="button" key={n} aria-pressed={vals[i] === n} onClick={() => setVals(vals.map((v, j) => (j === i ? n : v)))}>{n}</button>
            ))}
          </div>
          <input type="text" value={notas[i]} placeholder="Nota (opcional)" aria-label={`Nota: ${g.p}`} onChange={(ev) => setNotas(notas.map((x, j) => (j === i ? ev.target.value : x)))} />
        </div>
      ))}
      <div className="row">
        <F label="Resultado"><Sel value={resultado} onChange={setResultado} options={RESULTADOS} /></F>
        <F label="Promedio"><input type="text" readOnly value={prom != null ? `${prom} / 5` : '—'} /></F>
      </div>
      <F label="Comentario general (solo lo ve el equipo)"><textarea value={comentario} onChange={(ev) => setComentario(ev.target.value)} placeholder="Ej. buena experiencia en pespunte, vive cerca, busca estabilidad" /></F>
      <p className="hint">"No recomendado" no da el sello "Entrevistado" en la terna.</p>
      <div className="actions"><button type="button" className="btn sm primary" onClick={guardar}>Guardar entrevista</button><button type="button" className="btn sm" onClick={onClose}>Cancelar</button></div>
    </div>
  );
}

// ============ Sellos de lo que verificó Factor-Gente ============
export function Sellos({ entrevistado, referencias, imss, ine, confirmo }: { entrevistado: boolean; referencias: number; imss: boolean; ine: boolean; confirmo: boolean }) {
  const items: [boolean, string][] = [
    [entrevistado, 'Entrevistado por Factor·Gente'],
    [referencias > 0, referencias > 1 ? `${referencias} referencias verificadas` : 'Referencia verificada'],
    [imss, 'Historial IMSS verificado'],
    [ine, 'Identidad verificada'],
    [confirmo, 'Confirmó condiciones'],
  ];
  const si = items.filter(([ok]) => ok);
  if (!si.length) return null;
  return <div className="sellos">{si.map(([, t]) => <span key={t} className="sello-ok">✓ {t}</span>)}</div>;
}

// ============ Candidato: su entrevista y las condiciones por confirmar ============
const DEMO_ENT: MiEntrevista[] = [{ id: 'de1', cita: new Date(Date.now() + 864e5).toISOString(), medio: 'Videollamada de WhatsApp', enlace: null, estado: 'Agendada', puesto: 'Pespuntadora' }];
const DEMO_CONF: MiConfirmacion[] = [{ vacancy_id: 'dv1', puesto: 'Pespuntadora', zona: 'San Francisco del Rincón', smin: 10500, smax: 12500, tipo: 'Destajo', horario: 'Matutino', prest: ['IMSS', 'Aguinaldo'], transporte: false, comedor: true, funciones: 'Pespunte de bota y botín.', confirmado: null }];

export function MiEntrevistaCard({ preview }: { preview?: boolean }) {
  const [xs, setXs] = useState<MiEntrevista[]>([]);
  useEffect(() => {
    if (preview) { setXs(DEMO_ENT); return; }
    supabase.rpc('mis_entrevistas').then(({ data }) => setXs((data as MiEntrevista[]) ?? []));
  }, [preview]);
  if (!xs.length) return null;
  return (
    <section className="card attention" style={{ marginBottom: 0 }}>
      <div className="card-h"><h3>Tu entrevista con Factor·Gente</h3><span className="pill info">Agendada</span></div>
      {xs.map((e) => (
        <div className="item" key={e.id}>
          <strong>{e.cita ? fmtCita(e.cita) : 'Fecha por confirmar'}</strong>
          <div className="meta"><span>{e.medio}</span>{e.puesto && <span>Vacante: {e.puesto}</span>}</div>
          {e.enlace && (/^https?:\/\//.test(e.enlace)
            ? <div className="actions"><a className="btn sm primary" href={e.enlace} target="_blank" rel="noopener">Entrar a la reunión</a></div>
            : <p className="hint">{e.medio === 'Presencial' ? 'Lugar: ' : ''}{e.enlace}</p>)}
        </div>
      ))}
      <p className="hint">Dura unos 15 minutos. Si no puedes a esa hora, escríbenos en el chat para cambiarla.</p>
    </section>
  );
}

export function ConfirmarCondiciones({ preview }: { preview?: boolean }) {
  const [xs, setXs] = useState<MiConfirmacion[]>([]);
  const [no, setNo] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const cargar = useCallback(async () => {
    if (preview) { setXs(DEMO_CONF); return; }
    const { data } = await supabase.rpc('mis_confirmaciones');
    setXs((data as MiConfirmacion[]) ?? []);
  }, [preview]);
  useEffect(() => { cargar(); }, [cargar]);
  if (!xs.length) return null;
  const responder = async (vid: string, acepta: boolean) => {
    if (preview) return toast(PREVIEW_MSG);
    const { error } = await supabase.rpc('confirmar_condiciones', { p_vacancy: vid, p_acepta: acepta, p_motivo: acepta ? null : motivo });
    if (error) return toast('No se pudo enviar: ' + error.message, true);
    toast(acepta ? 'Listo. Te avisaremos cuando la empresa responda.' : 'Gracias por avisarnos. Seguimos buscando una vacante para ti.');
    setNo(null); setMotivo(''); cargar();
  };
  const pendientes = xs.filter((x) => x.confirmado == null).length;
  return (
    <section className={'card' + (pendientes ? ' attention' : '')} id="confirmar" style={{ marginBottom: 0 }}>
      <div className="card-h"><h3>Confirma las condiciones</h3>{pendientes > 0 && <span className="pill warn">{pendientes} por responder</span>}</div>
      <p className="hint">Antes de presentarte con la empresa, revisa que estas condiciones te funcionen. Así evitamos que pierdas tu tiempo.</p>
      {xs.map((v) => (
        <div className="item" key={v.vacancy_id}>
          <div className="item-h"><strong>{v.puesto}</strong>
            {v.confirmado === true ? <span className="pill ok">Aceptaste</span> : v.confirmado === false ? <span className="pill lea">No te interesó</span> : <span className="pill warn">Por responder</span>}</div>
          <div className="ficha">
            <div><span>Dónde</span>{v.zona}</div>
            <div><span>Sueldo mensual</span><b className="mono">{money(v.smin)}–{money(v.smax)}</b></div>
            <div><span>Forma de pago</span>{v.tipo ?? '—'}</div>
            <div><span>Horario</span>{v.horario ?? '—'}</div>
            <div><span>Prestaciones</span>{[...v.prest, v.comedor ? 'Comedor' : '', v.transporte ? 'Transporte' : ''].filter(Boolean).join(', ') || '—'}</div>
          </div>
          <p className="hint"><b>Funciones:</b> {v.funciones}</p>
          {v.confirmado == null && no !== v.vacancy_id && (
            <div className="actions">
              <button type="button" className="btn sm primary" onClick={() => responder(v.vacancy_id, true)}>Sí, acepto estas condiciones</button>
              <button type="button" className="btn sm" onClick={() => setNo(v.vacancy_id)}>No me interesa</button>
            </div>
          )}
          {no === v.vacancy_id && (
            <div className="stack-sm">
              <F label="¿Qué no te funciona? (opcional)"><input type="text" value={motivo} placeholder="Ej. el sueldo, el horario, queda lejos" onChange={(e) => setMotivo(e.target.value)} /></F>
              <div className="actions"><button type="button" className="btn sm primary" onClick={() => responder(v.vacancy_id, false)}>Enviar</button><button type="button" className="btn sm" onClick={() => setNo(null)}>Cancelar</button></div>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
