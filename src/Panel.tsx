import { useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { ESTADOS, TARIFAS_BASE, TRAITS, anticipoDe, cuota, daysSince, fmtCita, fmtDate, isInc, llega, match, money, norm, pasaInterno, perfilTexto, refFor, todayIso } from './lib/catalog';
import { supabase } from './lib/supabase';
import type { Candidate, Cobro, Company, Interest, Lead, Mensaje, Placement, RefSalary, Shortlist, Staff, Tarifas, Test, Vacancy } from './lib/types';
import { CandidateForm } from './Candidato';
import { VacPill } from './Empresa';
import { F, Logo, RefCard, Sel, ShareButtons, toast } from './ui';

interface Data {
  cands: Candidate[]; vacs: Vacancy[]; cos: Company[]; tests: Test[]; short: Shortlist[];
  places: Placement[]; ints: Interest[]; leads: Lead[]; refs: RefSalary[]; cobros: Cobro[]; tarifas: Tarifas; msgs: Mensaje[]; staff: Staff[];
}
const EMPTY: Data = { cands: [], vacs: [], cos: [], tests: [], short: [], places: [], ints: [], leads: [], refs: [], cobros: [], tarifas: TARIFAS_BASE, msgs: [], staff: [] };

const ESTADO_PILL: Record<string, string> = { Disponible: 'ok', 'En proceso': 'info', Colocado: 'lea', Inactivo: 'bad' };

type Run = (p: PromiseLike<{ error: { message: string } | null }>, ok?: string) => Promise<boolean>;

// rol 'admin' ve todo; 'reclutador' no ve cobros, tarifas ni equipo, y no borra
export function Panel({ rol }: { rol: 'admin' | 'reclutador' }) {
  const jefe = rol === 'admin';
  const [d, setD] = useState<Data>(EMPTY);
  const [selVac, setSelVac] = useState<string | null>(null);
  const [selCand, setSelCand] = useState<string | null>(null);
  const [filtroInterno, setFiltroInterno] = useState(true);
  const [soloInc, setSoloInc] = useState(false);
  const [form, setForm] = useState<{ mode: 'asistido' | 'admin'; c: Candidate | null } | null>(null);
  const [buscar, setBuscar] = useState('');

  const load = useCallback(async () => {
    const r = await Promise.all([
      supabase.from('candidates').select('*').order('created_at', { ascending: false }),
      supabase.from('vacancies').select('*').order('created_at', { ascending: false }),
      supabase.from('companies').select('*'),
      supabase.from('tests').select('candidate_id,estado,res,assigned_at,completed_at'),
      supabase.from('shortlist').select('*').order('created_at'),
      supabase.from('placements').select('*').order('ingreso', { ascending: false }),
      supabase.from('interests').select('candidate_id,vacancy_id'),
      supabase.from('leads').select('*').order('created_at', { ascending: false }),
      supabase.from('ref_salaries').select('*').order('orden'),
      supabase.from('cobros').select('*').order('created_at', { ascending: false }),
      supabase.from('tarifas').select('*').maybeSingle(),
      supabase.from('mensajes').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.rpc('list_staff'),
    ]);
    const bad = r.find((x) => x.error);
    if (bad?.error) toast('No se pudieron cargar los datos: ' + bad.error.message, true);
    setD({
      cands: (r[0].data as Candidate[]) ?? [], vacs: (r[1].data as Vacancy[]) ?? [], cos: (r[2].data as Company[]) ?? [],
      tests: (r[3].data as Test[]) ?? [], short: (r[4].data as Shortlist[]) ?? [], places: (r[5].data as Placement[]) ?? [],
      ints: (r[6].data as Interest[]) ?? [], leads: (r[7].data as Lead[]) ?? [], refs: (r[8].data as RefSalary[]) ?? [],
      cobros: (r[9].data as Cobro[]) ?? [], tarifas: (r[10].data as Tarifas) ?? TARIFAS_BASE, msgs: (r[11].data as Mensaje[]) ?? [],
      staff: (r[12].data as Staff[]) ?? [],
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  const cand = (id: string) => d.cands.find((c) => c.id === id);
  const co = (id: string) => d.cos.find((c) => c.id === id);
  const coName = (id: string) => co(id)?.nombre ?? '—';
  const testOf = (id: string) => d.tests.find((t) => t.candidate_id === id);
  const v = d.vacs.find((x) => x.id === selVac) ?? d.vacs[0];

  const run: Run = async (p, ok) => {
    const { error } = await p;
    if (error) { toast(error.message, true); return false; }
    if (ok) toast(ok);
    await load();
    return true;
  };

  // Contratado: se registra la colocación; la base de datos genera sola el cobro (menos el anticipo pagado)
  const contratar = async (s: Shortlist) => {
    const vv = d.vacs.find((x) => x.id === s.vacancy_id);
    if (!vv) return;
    const ok = await run(supabase.from('placements').insert({ candidate_id: s.candidate_id, vacancy_id: vv.id }));
    if (!ok) return;
    await supabase.from('candidates').update({ estado: 'Colocado' }).eq('id', s.candidate_id);
    const colocados = d.places.filter((p) => p.vacancy_id === vv.id).length + 1;
    if (colocados >= vv.n) await supabase.from('vacancies').update({ estado: 'Cubierta' }).eq('id', vv.id);
    await load();
    toast('Colocación registrada. Se generó el cobro y empieza el seguimiento.');
  };

  const disp = d.cands.filter((c) => c.estado === 'Disponible').length;
  const abiertas = d.vacs.filter((x) => x.estado === 'Abierta' || x.estado === 'Terna enviada').length;
  const maduras = d.places.filter((p) => daysSince(p.ingreso) >= 90);
  const siguen = maduras.filter((p) => p.c90 === true).length;
  const porCobrar = d.cobros.filter((c) => !c.pagado).reduce((a, c) => a + c.monto, 0);
  const pend = d.short.filter((s) => s.quiere && !s.cita && !s.liberado);
  const placed = (s: Shortlist) => d.places.some((p) => p.vacancy_id === s.vacancy_id && p.candidate_id === s.candidate_id);
  const agendadas = d.short.filter((s) => s.cita && !placed(s));

  if (form) {
    return (
      <>
        <div className="banner"><span><b>{form.mode === 'asistido' ? 'Registro asistido.' : 'Editar datos.'}</b> {form.mode === 'asistido' ? 'Estás capturando los datos de otra persona.' : 'Corriges el perfil de un candidato.'}</span>
          <button type="button" className="btn sm" onClick={() => setForm(null)}>Volver al panel</button></div>
        <div className="narrow-wrap">
          <CandidateForm initial={form.c} mode={form.mode} onCancel={() => setForm(null)}
            onSaved={async (c) => { setForm(null); setSelCand(c.id); await load(); }} />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="intro"><span className="eyebrow">Panel de Factor-Gente</span><h2>Filtro y colocación</h2>
        <p>Elige una vacante, revisa los candidatos sugeridos, asigna pruebas y arma la terna. Tú coordinas las entrevistas; la empresa no recibe teléfonos.</p></div>
      <div className="kpis">
        <div className="kpi"><span>Candidatos disponibles</span><b>{disp}</b><small>de {d.cands.length} registrados</small></div>
        <div className="kpi"><span>Vacantes abiertas</span><b>{abiertas}</b><small>{d.vacs.filter((x) => x.estado === 'Terna enviada').length} con terna enviada</small></div>
        {jefe
          ? <div className="kpi"><span>Por cobrar</span><b className="mono">{money(porCobrar)}</b><small>{d.cobros.filter((c) => !c.pagado).length} cobros pendientes</small></div>
          : <div className="kpi"><span>Colocaciones</span><b>{d.places.length}</b><small>en seguimiento</small></div>}
        <div className="kpi"><span>Siguen a 90 días</span><b>{maduras.length ? Math.round((siguen / maduras.length) * 100) + '%' : '—'}</b><small>{siguen} de {maduras.length} con 90 días</small></div>
      </div>

      <Bandeja msgs={d.msgs} vacs={d.vacs} run={run} />

      {pend.length > 0 && (
        <section className="card attention">
          <div className="card-h"><h3>Empresas que quieren entrevistar</h3><span className="pill info">{pend.length}</span></div>
          <p className="hint">Agenda la cita con la empresa y avísale al candidato por WhatsApp. La empresa verá el nombre, la fecha y el lugar, pero no el teléfono.</p>
          <div className="list">{pend.map((s) => {
            const vv = d.vacs.find((x) => x.id === s.vacancy_id), c = cand(s.candidate_id);
            if (!vv || !c) return null;
            return <Agendar key={s.vacancy_id + s.candidate_id} s={s} titulo={<><b>{coName(vv.company_id)}</b> quiere entrevistar a <b>{c.nombre}</b> · {vv.puesto}</>} tel={c.tel} run={run} />;
          })}</div>
        </section>
      )}

      {agendadas.length > 0 && (
        <section className="card">
          <div className="card-h"><h3>Entrevistas agendadas</h3><span className="pill info">{agendadas.length}</span></div>
          <div className="list">{agendadas.map((s) => {
            const vv = d.vacs.find((x) => x.id === s.vacancy_id), c = cand(s.candidate_id);
            if (!vv || !c) return null;
            return (
              <div className="item" key={s.vacancy_id + s.candidate_id}>
                <div className="item-h"><span><b>{c.nombre}</b> con <b>{coName(vv.company_id)}</b> · {vv.puesto}</span><span className="pill info">{fmtCita(s.cita!)}</span></div>
                <div className="meta"><span>{s.lugar}</span><span className="mono">WhatsApp candidato: {c.tel}</span></div>
                <div className="actions">
                  <button type="button" className="btn sm primary" onClick={() => contratar(s)}>Marcar contratado</button>
                  <button type="button" className="btn sm" onClick={() => run(supabase.from('shortlist').update({ cita: null, lugar: null }).eq('vacancy_id', s.vacancy_id).eq('candidate_id', s.candidate_id), 'Cita cancelada.')}>Cancelar cita</button>
                </div>
              </div>
            );
          })}</div>
          {jefe && <p className="hint">Al marcar contratado se genera el cobro por {money(d.tarifas.cuota_operativo)} (operativo) o el mes de sueldo (administrativo), con {d.tarifas.plazo_dias} días para pagar.</p>}
        </section>
      )}

      <div className="grid">
        <div className="stack">
          {v ? <Sugeridos key={v.id} v={v} d={d} jefe={jefe} company={co(v.company_id)} testOf={testOf} filtroInterno={filtroInterno} setFiltroInterno={setFiltroInterno}
              soloInc={soloInc} setSoloInc={setSoloInc} onCand={setSelCand} run={run} />
            : <section className="card"><h3>Sin vacantes todavía</h3><p className="empty">Cuando una empresa envíe una solicitud aparecerá aquí.</p></section>}
          {selCand && cand(selCand) && (
            <Detalle c={cand(selCand)!} test={testOf(selCand)} run={run} jefe={jefe} onClose={() => setSelCand(null)}
              onEdit={() => setForm({ mode: 'admin', c: cand(selCand)! })} />
          )}
          {jefe && <Cobros d={d} coName={coName} cand={cand} run={run} />}
          <Base cands={d.cands} buscar={buscar} setBuscar={setBuscar} onCand={setSelCand} />
          <Seguimiento d={d} cand={cand} run={run} jefe={jefe} />
        </div>
        <div className="stack">
          <section className="card">
            <div className="card-h"><h3>Vacantes</h3><p>{d.vacs.length}</p></div>
            <div className="list">{d.vacs.map((x) => (
              <button type="button" key={x.id} className={'item' + (x.id === v?.id ? ' sel' : '')} onClick={() => { setSelVac(x.id); setSelCand(null); }}>
                <span className="item-h"><strong>{x.puesto}</strong><VacPill e={x.estado} /></span>
                <span className="meta"><span>{coName(x.company_id)}</span><span>{x.area}</span><span>{x.pub === 'anonima' ? 'Publicada' : 'Privada'}</span></span>
              </button>
            ))}{!d.vacs.length && <p className="empty">Aún no hay vacantes.</p>}</div>
          </section>
          <Difusion onAsistido={() => setForm({ mode: 'asistido', c: null })} />
          <Origenes cands={d.cands} cos={d.cos} />
          {jefe && <TarifasCard t={d.tarifas} run={run} />}
          {jefe && <Equipo staff={d.staff} run={run} />}
          <RefCard refs={d.refs} />
          <section className="card">
            <div className="card-h"><h3>Interesados en la consultora</h3><p>{d.leads.length}</p></div>
            <div className="list">{d.leads.map((l) => (
              <div className="item" key={l.id}><div className="item-h"><strong>{l.nombre}</strong><span className="pill lea">{l.tipo}</span></div>
                <div className="meta"><span>{l.servicios.join(', ')}</span><span>Vía: {l.via}</span><span className="mono">{l.tel}</span><span>{fmtDate(l.created_at)}</span></div></div>
            ))}{!d.leads.length && <p className="empty">Aún no hay interesados.</p>}</div>
          </section>
          <section className="card"><h3>Pruebas</h3>
            <p className="hint"><b>Fase 1 (en la app):</b> cuestionario corto de personalidad (Mini-IPIP, 20 frases, uso libre). Solo lo contestan los candidatos a quienes se lo asignas y que dieron permiso.</p>
            <p className="hint"><b>Fase 2 (fuera de la app):</b> pruebas en línea con licencia e interpretación por psicólogo(a) con cédula.</p>
          </section>
        </div>
      </div>
    </>
  );
}

function Bandeja({ msgs, vacs, run }: { msgs: Mensaje[]; vacs: Vacancy[]; run: Run }) {
  const [verTodos, setVerTodos] = useState(false);
  const pendientes = msgs.filter((m) => !m.atendido);
  const lista = verTodos ? msgs : pendientes;
  if (!msgs.length) return null;
  return (
    <section className={'card' + (pendientes.length ? ' attention' : '')} style={{ marginBottom: 20 }}>
      <div className="card-h"><h3>Mensajes</h3>
        <div className="actions">
          {pendientes.length > 0 && <span className="pill warn">{pendientes.length} sin responder</span>}
          <label className="hint inline-check"><input type="checkbox" checked={verTodos} onChange={(e) => setVerTodos(e.target.checked)} /> Ver también los respondidos</label>
        </div></div>
      {!lista.length ? <p className="empty">No hay mensajes pendientes.</p> : (
        <div className="list">{lista.map((m) => (
          <div className="item" key={m.id}>
            <div className="item-h"><span><b>{m.nombre}</b> <span className="pill lea">{m.tipo}</span>{m.vacancy_id && <span className="hint"> · {vacs.find((v) => v.id === m.vacancy_id)?.puesto}</span>}</span>
              <span className="hint">{fmtCita(m.created_at)}</span></div>
            <p>{m.texto}</p>
            <div className="actions">
              <span className="mono">WhatsApp: {m.tel}</span>
              {m.atendido
                ? <button type="button" className="btn sm" onClick={() => run(supabase.from('mensajes').update({ atendido: false }).eq('id', m.id))}>Marcar pendiente</button>
                : <button type="button" className="btn sm primary" onClick={() => run(supabase.from('mensajes').update({ atendido: true }).eq('id', m.id), 'Marcado como respondido.')}>Ya le respondí</button>}
            </div>
          </div>
        ))}</div>
      )}
    </section>
  );
}

function Agendar({ s, titulo, tel, run }: { s: Shortlist; titulo: React.ReactNode; tel: string; run: Run }) {
  const [cita, setCita] = useState('');
  const [lugar, setLugar] = useState('');
  const [darTel, setDarTel] = useState(false);
  const agendar = () => {
    if (!cita || !lugar.trim()) return toast('Escribe fecha, hora y lugar de la entrevista.', true);
    return run(supabase.from('shortlist').update({ cita: new Date(cita).toISOString(), lugar: lugar.trim() }).eq('vacancy_id', s.vacancy_id).eq('candidate_id', s.candidate_id), 'Entrevista agendada. Avísale al candidato.');
  };
  return (
    <div className="item">
      <div className="item-h"><span>{titulo}</span></div>
      <div className="row">
        <F label="Fecha y hora"><input type="datetime-local" value={cita} onChange={(e) => setCita(e.target.value)} /></F>
        <F label="Lugar"><input type="text" value={lugar} placeholder="Ej. recepción de la planta, calle y número" onChange={(e) => setLugar(e.target.value)} /></F>
      </div>
      <div className="actions">
        <button type="button" className="btn sm primary" onClick={agendar}>Agendar entrevista</button>
        <span className="hint mono">WhatsApp del candidato: {tel}</span>
        {!darTel ? <button type="button" className="link" onClick={() => setDarTel(true)}>Dar teléfono a la empresa</button> : (
          <span className="confirm-inline">La empresa podrá contactarlo directamente. ¿Seguro?
            <button type="button" className="btn sm danger fill" onClick={() => run(supabase.from('shortlist').update({ liberado: true }).eq('vacancy_id', s.vacancy_id).eq('candidate_id', s.candidate_id), 'Teléfono liberado a la empresa.')}>Sí, darlo</button>
            <button type="button" className="btn sm" onClick={() => setDarTel(false)}>Cancelar</button></span>
        )}
      </div>
    </div>
  );
}

function Sugeridos({ v, d, jefe, company, testOf, filtroInterno, setFiltroInterno, soloInc, setSoloInc, onCand, run }: {
  v: Vacancy; d: Data; jefe: boolean; company?: Company; testOf: (id: string) => Test | undefined;
  filtroInterno: boolean; setFiltroInterno: (b: boolean) => void; soloInc: boolean; setSoloInc: (b: boolean) => void;
  onCand: (id: string) => void; run: Run;
}) {
  const ref = refFor(v.puesto, d.refs);
  const terna = d.short.filter((s) => s.vacancy_id === v.id);
  const enTerna = (id: string) => terna.some((s) => s.candidate_id === id);
  const interno = v.sexo !== 'Indistinto' || v.edad_min || v.edad_max;
  const pideAnticipo = !!company?.requiere_anticipo;
  const faltaAnticipo = pideAnticipo && !v.anticipo_pagado;
  const montoAnticipo = anticipoDe(v, d.tarifas);

  let rows = d.cands.filter((c) => c.estado !== 'Colocado' && c.estado !== 'Inactivo')
    .map((c) => ({ c, s: match(c, v, testOf(c.id)?.res), ok: pasaInterno(c, v) }))
    .filter((x) => x.s > 0);
  if (filtroInterno) rows = rows.filter((x) => x.ok);
  if (soloInc) rows = rows.filter((x) => isInc(x.c));
  rows.sort((a, b) => b.s - a.s);

  const toggle = (cid: string) => enTerna(cid)
    ? run(supabase.from('shortlist').delete().eq('vacancy_id', v.id).eq('candidate_id', cid).eq('enviado', false))
    : run(supabase.from('shortlist').insert({ vacancy_id: v.id, candidate_id: cid }));

  const enviar = async () => {
    const ok = await run(supabase.from('shortlist').update({ enviado: true }).eq('vacancy_id', v.id));
    if (!ok) return;
    await supabase.from('vacancies').update({ estado: 'Terna enviada' }).eq('id', v.id);
    const ids = terna.map((s) => s.candidate_id);
    await run(supabase.from('candidates').update({ estado: 'En proceso' }).in('id', ids).eq('estado', 'Disponible'), 'Terna enviada a ' + (company?.nombre ?? 'la empresa') + '.');
  };

  const registrarAnticipo = async () => {
    const ok = await run(supabase.from('cobros').insert({ company_id: v.company_id, vacancy_id: v.id, concepto: 'Anticipo', monto: montoAnticipo, vence: todayIso(), pagado: todayIso() }));
    if (ok) await run(supabase.from('vacancies').update({ anticipo_pagado: true }).eq('id', v.id), 'Anticipo registrado.');
  };

  return (
    <section className="card">
      <div className="card-h"><h3>Candidatos sugeridos · {v.puesto}</h3>
        <div className="actions">
          <label className="hint inline-check"><input type="checkbox" checked={filtroInterno} onChange={(e) => setFiltroInterno(e.target.checked)} /> Filtro interno (sexo / edad)</label>
          <label className="hint inline-check"><input type="checkbox" checked={soloInc} onChange={(e) => setSoloInc(e.target.checked)} /> Solo perfiles de inclusión</label>
        </div></div>
      <div className="meta">
        <span>{company?.nombre}</span><span>{v.zona}</span><span className="mono">{money(v.smin)}–{money(v.smax)}</span><span>{v.tipo}</span>
        <span>Busca: {v.habilidades.join(', ') || '—'}</span>
        {v.incluyente && <span className="pill lea">Vacante incluyente</span>}
        {ref && v.smax && v.smax < ref.min && <span className="pill warn">Sueldo bajo vs. zona ({money(ref.min)}–{money(ref.max)})</span>}
        {v.salidas >= 3 && <span className="pill warn">Rotación alta: {v.salidas} salidas en 6 meses ({v.motivo})</span>}
        <label className="inline-check">Estado <Sel value={v.estado} onChange={(e) => run(supabase.from('vacancies').update({ estado: e }).eq('id', v.id))} options={['Abierta', 'Terna enviada', 'Cubierta', 'Cancelada']} /></label>
      </div>
      <div className="meta">
        {jefe && <span>Cobro por persona: <b className="mono">{money(cuota(v, d.tarifas))}</b> × {v.n}</span>}
        {pideAnticipo ? (v.anticipo_pagado ? <span className="pill ok">Anticipo pagado</span> : <>
          <span className="pill warn">Anticipo pendiente{jefe ? `: ${money(montoAnticipo)}` : ''}</span>
          {jefe && <button type="button" className="btn sm" onClick={registrarAnticipo}>Registrar anticipo pagado</button>}</>) : <span className="pill ok">Sin anticipo</span>}
        {jefe && company && <label className="hint inline-check"><input type="checkbox" checked={!company.requiere_anticipo}
          onChange={(e) => run(supabase.from('companies').update({ requiere_anticipo: !e.target.checked }).eq('id', company.id))} /> Empresa de confianza (sin anticipo)</label>}
      </div>
      <details><summary>Ver detalle de la vacante</summary>
        <p><b>Funciones:</b> {v.funciones}</p>
        <p><b>Preparación:</b> {v.esco} · <b>Experiencia:</b> {v.exp} · <b>Horario:</b> {v.horario} · <b>Personas:</b> {v.n}</p>
        <p><b>Prestaciones:</b> {v.prest.join(', ') || '—'} · Transporte: {v.transporte ? 'sí' : 'no'} · Comedor: {v.comedor ? 'sí' : 'no'}</p>
        <p><b>Contacto de la empresa:</b> {company?.contacto} · <span className="mono">{company?.tel}</span></p>
      </details>
      {interno && <p className="note"><span className="private">Filtro interno:</span> {v.sexo}{(v.edad_min || v.edad_max) ? `, ${v.edad_min ?? '?'}–${v.edad_max ?? '?'} años` : ''}. Motivo que dio la empresa: “{v.just}”. Si el motivo no justifica el requisito, coméntalo con la empresa antes de filtrar.</p>}
      {!rows.length ? <p className="empty">No hay candidatos del área de esta vacante con estos filtros.</p> : (
        <div className="tbl"><table><thead><tr><th>Candidato</th><th>Último puesto</th><th>Pretende</th><th>Prueba</th><th>Coincidencia</th><th></th></tr></thead><tbody>
          {rows.map(({ c, s }) => {
            const t = testOf(c.id), en = enTerna(c.id), sent = terna.find((x) => x.candidate_id === c.id)?.enviado;
            return (
              <tr key={c.id}>
                <td><button type="button" className="link" onClick={() => onCand(c.id)}>{c.nombre}</button>
                  <div className="hint">{c.edad} años · {c.municipio}{d.ints.some((i) => i.candidate_id === c.id && i.vacancy_id === v.id) && <> · <b>se interesó</b></>}</div>
                  <div className="meta">{!llega(c, v) && <span className="pill warn">No marcó {v.zona}</span>}{isInc(c) && <span className="pill lea">Inclusión</span>}{c.asistido && <span className="pill info">Asistido</span>}</div></td>
                <td>{c.ult_puesto ?? '—'}<div className="hint">{c.ult_tiempo} · {c.ult_tipo} · {money(c.ult_sueldo)}</div></td>
                <td className="mono">{money(c.pmin)}–{money(c.pmax)}</td>
                <td>{t?.estado === 'completada' && t.res ? <span className="pill ok">Resp. {t.res.C}</span>
                  : t?.estado === 'asignada' ? <span className="pill warn">Asignada</span>
                  : c.consent_pruebas ? <button type="button" className="btn sm" onClick={() => run(supabase.from('tests').insert({ candidate_id: c.id }), 'Prueba asignada.')}>Asignar</button>
                  : <span className="pill bad">Sin permiso</span>}</td>
                <td><div className="score" style={{ ['--w' as string]: `${s}%` }}><span className="mono">{s}%</span><i /></div></td>
                <td><button type="button" className={'btn sm' + (en ? ' primary' : '')} disabled={(!en && terna.length >= 3) || !!sent} onClick={() => toggle(c.id)}>{sent ? 'Enviado' : en ? 'En terna ✓' : '+ Terna'}</button></td>
              </tr>
            );
          })}
        </tbody></table></div>
      )}
      <div className="actions">
        <button type="button" className="btn primary" disabled={!terna.length || terna.every((s) => s.enviado) || faltaAnticipo} onClick={enviar}>
          {terna.length && terna.every((s) => s.enviado) ? `Terna enviada (${terna.length})` : `Enviar terna a la empresa (${terna.length}/3)`}</button>
        {faltaAnticipo && terna.length > 0 && <span className="hint">{jefe
          ? 'Para enviar la terna, primero registra el anticipo o marca a la empresa como de confianza.'
          : 'Para enviar la terna falta el anticipo. Avísale al administrador.'}</span>}
      </div>
    </section>
  );
}

function Cobros({ d, coName, cand, run }: { d: Data; coName: (id: string) => string; cand: (id: string) => Candidate | undefined; run: Run }) {
  const hoy = todayIso();
  const estado = (c: Cobro) => c.pagado ? <span className="pill ok">Pagado {fmtDate(c.pagado)}</span>
    : c.vence && c.vence < hoy ? <span className="pill bad">Vencido</span> : <span className="pill warn">Pendiente</span>;
  return (
    <section className="card">
      <div className="card-h"><h3>Cobros</h3><p>{money(d.cobros.filter((c) => !c.pagado).reduce((a, c) => a + c.monto, 0))} por cobrar</p></div>
      {!d.cobros.length ? <p className="empty">Aún no hay cobros. Se generan al registrar un anticipo o al marcar a alguien como contratado.</p> : (
        <div className="tbl"><table><thead><tr><th>Empresa</th><th>Concepto</th><th>Monto</th><th>Vence</th><th>Estado</th><th></th></tr></thead><tbody>
          {d.cobros.map((c) => {
            const vv = d.vacs.find((x) => x.id === c.vacancy_id);
            return (
              <tr key={c.id}>
                <td>{coName(c.company_id)}<div className="hint">{vv?.puesto}{c.candidate_id && cand(c.candidate_id) ? ' · ' + cand(c.candidate_id)!.nombre : ''}</div></td>
                <td>{c.concepto}</td><td className="mono">{money(c.monto)}</td><td>{c.vence ? fmtDate(c.vence) : '—'}</td><td>{estado(c)}</td>
                <td>{!c.pagado && <button type="button" className="btn sm" onClick={() => run(supabase.from('cobros').update({ pagado: hoy }).eq('id', c.id), 'Pago registrado.')}>Marcar pagado</button>}</td>
              </tr>
            );
          })}
        </tbody></table></div>
      )}
      <p className="hint">La garantía de reemplazo solo aplica cuando la colocación está pagada.</p>
    </section>
  );
}

function TarifasCard({ t, run }: { t: Tarifas; run: Run }) {
  const [x, setX] = useState(t);
  useEffect(() => setX(t), [t]);
  const set = (k: keyof Tarifas, v: string) => setX({ ...x, [k]: Number(v) || 0 });
  const cambiado = JSON.stringify(x) !== JSON.stringify(t);
  return (
    <section className="card">
      <h3>Tarifas</h3>
      <div className="row">
        <F label="Operativo: cuota fija por persona"><input type="number" step={100} value={x.cuota_operativo} onChange={(e) => set('cuota_operativo', e.target.value)} /></F>
        <F label="Administrativo y supervisión: meses de sueldo"><input type="number" step={0.25} value={x.meses_admin} onChange={(e) => set('meses_admin', e.target.value)} /></F>
      </div>
      <div className="row">
        <F label="Anticipo (% del total)"><input type="number" min={0} max={100} value={x.anticipo_pct} onChange={(e) => set('anticipo_pct', e.target.value)} /></F>
        <F label="Días para pagar"><input type="number" min={0} value={x.plazo_dias} onChange={(e) => set('plazo_dias', e.target.value)} /></F>
      </div>
      <div className="row">
        <F label="Días de garantía de reemplazo"><input type="number" min={0} value={x.garantia_dias} onChange={(e) => set('garantia_dias', e.target.value)} /></F>
      </div>
      <div className="actions"><button type="button" className="btn sm primary" disabled={!cambiado} onClick={() => run(supabase.from('tarifas').update(x).eq('id', 1), 'Tarifas guardadas.')}>Guardar tarifas</button></div>
      <p className="hint">Las empresas ven estas condiciones al pedir personal. El anticipo se descuenta del cobro final.</p>
    </section>
  );
}

function Detalle({ c, test, run, jefe, onClose, onEdit }: { c: Candidate; test?: Test; run: Run; jefe: boolean; onClose: () => void; onEdit: () => void }) {
  const [notas, setNotas] = useState(c.notas ?? '');
  const [borrar, setBorrar] = useState(false);
  const r = test?.res;
  useEffect(() => setNotas(c.notas ?? ''), [c.id, c.notas]);
  return (
    <section className="card">
      <div className="card-h"><h3>{c.nombre}</h3>
        <div className="actions">
          <span className={'pill ' + (ESTADO_PILL[c.estado] ?? 'info')}>{c.estado}</span>
          <Sel value={c.estado} onChange={(e) => run(supabase.from('candidates').update({ estado: e }).eq('id', c.id))} options={ESTADOS} />
          <button type="button" className="btn sm" onClick={onEdit}>Editar datos</button>
          <button type="button" className="btn sm" onClick={onClose}>Cerrar</button>
        </div></div>
      <div className="ficha">
        <div><span>Edad · sexo</span>{c.edad} · {c.sexo}</div><div><span>WhatsApp</span><span className="mono">{c.tel}</span></div>
        <div><span>Vive en</span>{c.municipio}{c.colonia ? `, ${c.colonia}` : ''}</div><div><span>Estudios</span>{c.esco}</div>
        <div><span>Área · puesto</span>{c.area} · {c.puesto}</div><div><span>Registro</span>{fmtDate(c.created_at)}{c.asistido ? ' (asistido)' : ''}</div>
        <div><span>Puede trabajar en</span>{c.mov.join(', ')}</div><div><span>Transporte propio</span>{c.transp}</div>
        <div><span>Forma de pago</span>Antes: {c.ult_tipo} · Prefiere: {c.tipo_pref}</div>
        <div><span>Permisos</span>Pruebas: {c.consent_pruebas ? 'sí' : 'no'} · Servicios: {c.consent_servicios ? 'sí' : 'no'}</div>
      </div>
      {isInc(c) && <p className="note"><span className="private">Inclusión (dato sensible):</span> {c.inclusion ? 'Persona con discapacidad. ' : ''}{c.edad >= 60 ? 'Adulto mayor. ' : ''}{c.ajuste ? 'Ajuste: ' + c.ajuste : ''}</p>}
      <p><b>Funciones:</b> {c.funciones}</p>
      <p><b>Habilidades:</b> {c.habilidades.join(', ') || '—'}</p>
      <p><b>Último trabajo:</b> {c.ult_puesto}{c.ult_empresa ? ' en ' + c.ult_empresa : ''}, {c.ult_tiempo}. {c.ult_funciones} Ganaba {money(c.ult_sueldo)} al mes. Salió por: {c.ult_salida}.</p>
      <p><b>Busca:</b> {money(c.pmin)}–{money(c.pmax)} · {c.horario} · Disponible: {c.disp}</p>
      {c.carta && <p><b>Carta:</b> “{c.carta}”</p>}
      <span className="eyebrow">Cuestionario de personalidad</span>
      {r ? (
        <>
          <div className="bars">{TRAITS.map(([k, n]) => (
            <div className="bar-r" key={k}><span>{n}</span><i style={{ ['--w' as string]: `${r[k]}%` }} /><span className="mono">{r[k]}</span></div>
          ))}</div>
          <p className="note">Lectura: {perfilTexto(r)}. Resultado orientativo, no es diagnóstico. Escala 0–100.</p>
        </>
      ) : <p className="empty">{test?.estado === 'asignada' ? 'Asignada, esperando respuestas.' : c.consent_pruebas ? 'Sin prueba asignada.' : 'No dio permiso para pruebas.'}</p>}
      <label className="f">Notas internas (solo tú las ves)
        <textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej. referencias de su último trabajo, resultado de la entrevista…" />
      </label>
      <div className="actions">
        <button type="button" className="btn sm" disabled={notas === (c.notas ?? '')} onClick={() => run(supabase.from('candidates').update({ notas }).eq('id', c.id), 'Notas guardadas.')}>Guardar notas</button>
        {!jefe ? null : !borrar ? <button type="button" className="btn sm danger" onClick={() => setBorrar(true)}>Borrar candidato</button> : (
          <span className="confirm-inline">¿Borrar a {c.nombre} y todos sus datos?
            <button type="button" className="btn sm danger fill" onClick={async () => { if (await run(supabase.from('candidates').delete().eq('id', c.id), 'Candidato borrado.')) onClose(); }}>Sí, borrar</button>
            <button type="button" className="btn sm" onClick={() => setBorrar(false)}>Cancelar</button></span>
        )}
      </div>
    </section>
  );
}

function Base({ cands, buscar, setBuscar, onCand }: { cands: Candidate[]; buscar: string; setBuscar: (s: string) => void; onCand: (id: string) => void }) {
  const q = norm(buscar);
  const lista = q ? cands.filter((c) => norm([c.nombre, c.puesto, c.area, c.municipio, c.habilidades.join(' ')].join(' ')).includes(q)) : cands;
  return (
    <section className="card">
      <div className="card-h"><h3>Base de candidatos</h3><p>{cands.length}</p></div>
      <input type="text" value={buscar} placeholder="Buscar por nombre, puesto, habilidad o municipio" aria-label="Buscar candidatos" onChange={(e) => setBuscar(e.target.value)} />
      <div className="tbl"><table><thead><tr><th>Nombre</th><th>Área · puesto</th><th>Municipio</th><th>Estado</th><th>Registro</th></tr></thead><tbody>
        {lista.slice(0, 100).map((c) => (
          <tr key={c.id}><td><button type="button" className="link" onClick={() => onCand(c.id)}>{c.nombre}</button></td>
            <td>{c.area} · {c.puesto}</td><td>{c.municipio}</td>
            <td><span className={'pill ' + (ESTADO_PILL[c.estado] ?? 'info')}>{c.estado}</span></td><td>{fmtDate(c.created_at)}</td></tr>
        ))}
      </tbody></table></div>
      {!lista.length && <p className="empty">Sin resultados.</p>}
    </section>
  );
}

function Seguimiento({ d, cand, run, jefe }: { d: Data; cand: (id: string) => Candidate | undefined; run: Run; jefe: boolean }) {
  const g = d.tarifas.garantia_dias;
  const cell = (p: Placement, k: 'c30' | 'c60' | 'c90', dias: number) => {
    const val = p[k];
    const faltan = dias - daysSince(p.ingreso);
    if (faltan > 0 && val == null) return <span className="hint mono">en {faltan} d</span>;
    return (
      <select aria-label={`¿Sigue a los ${dias} días?`} value={val === true ? '1' : val === false ? '2' : '0'}
        onChange={(e) => run(supabase.from('placements').update({ [k]: e.target.value === '1' ? true : e.target.value === '2' ? false : null }).eq('candidate_id', p.candidate_id).eq('vacancy_id', p.vacancy_id))}>
        <option value="0">¿?</option><option value="1">Sigue</option><option value="2">Salió</option>
      </select>
    );
  };
  return (
    <section className="card">
      <div className="card-h"><h3>Seguimiento de colocados</h3><p>Garantía: reemplazo sin costo si sale antes de {g} días y la colocación está pagada</p></div>
      {!d.places.length ? <p className="empty">Aún no hay colocaciones.</p> : (
        <div className="tbl"><table><thead><tr><th>Persona</th><th>Puesto</th><th>Ingreso</th><th>30 d</th><th>60 d</th><th>90 d</th><th></th></tr></thead><tbody>
          {d.places.map((p) => {
            const vv = d.vacs.find((x) => x.id === p.vacancy_id);
            // Salió dentro del plazo de garantía: en el corte de 30 días, o en el de 60 si la garantía llega a 60
            const salio = p.c30 === false || p.c60 === false || p.c90 === false;
            const enGarantia = (p.c30 === false && g >= 1) || (p.c60 === false && g > 30) || (p.c90 === false && g > 60);
            const pagado = d.cobros.some((c) => c.concepto === 'Colocación' && c.vacancy_id === p.vacancy_id && c.candidate_id === p.candidate_id && c.pagado);
            const estado = !salio ? (p.c90 === true ? <span className="pill ok">Retenido</span> : null)
              : !enGarantia ? <span className="pill info">Salió fuera de garantía</span>
              : !jefe ? <span className="pill warn">Salió en garantía: revisar con el administrador</span>
              : pagado ? <span className="pill bad">Aplica reemplazo</span> : <span className="pill warn">Sin garantía: pago pendiente</span>;
            return (
              <tr key={p.candidate_id + p.vacancy_id}><td>{cand(p.candidate_id)?.nombre ?? '—'}</td><td>{vv?.puesto}</td><td>{fmtDate(p.ingreso)}</td>
                <td>{cell(p, 'c30', 30)}</td><td>{cell(p, 'c60', 60)}</td><td>{cell(p, 'c90', 90)}</td>
                <td>{estado}</td></tr>
            );
          })}
        </tbody></table></div>
      )}
    </section>
  );
}

// ¿Cómo nos conocieron? Conteo por canal para candidatos y empresas
function Origenes({ cands, cos }: { cands: Candidate[]; cos: Company[] }) {
  const contar = (xs: { origen: string | null }[]) => {
    const m = new Map<string, number>();
    xs.forEach((x) => m.set(x.origen || 'Sin respuesta', (m.get(x.origen || 'Sin respuesta') ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const tabla = (titulo: string, filas: [string, number][], total: number) => (
    <div className="stack-sm">
      <span className="lbl">{titulo} ({total})</span>
      {filas.length ? filas.map(([o, n]) => (
        <div className="bar-r" key={o}><span>{o}</span><i style={{ ['--w' as string]: `${total ? (n / total) * 100 : 0}%` }} /><span className="mono">{n}</span></div>
      )) : <p className="empty">Aún no hay registros.</p>}
    </div>
  );
  return (
    <section className="card">
      <h3>¿Cómo nos conocieron?</h3>
      {tabla('Candidatos', contar(cands), cands.length)}
      {tabla('Empresas', contar(cos), cos.length)}
      <p className="hint">Sirve para saber qué funciona mejor: anuncios, llamadas, correos, carteles o recomendaciones.</p>
    </section>
  );
}

function Equipo({ staff, run }: { staff: Staff[]; run: Run }) {
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState('Reclutador');
  const invitar = async () => {
    const e = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) return toast('Escribe un correo válido.', true);
    const ok = await run(supabase.from('staff_invites').insert({ email: e, rol: rol === 'Administrador' ? 'admin' : 'reclutador' }), 'Listo. Ya puede entrar con ese correo.');
    if (ok) setEmail('');
  };
  const quitar = (s: Staff) => s.pendiente
    ? run(supabase.from('staff_invites').delete().eq('email', s.email), 'Invitación cancelada.')
    : run(supabase.from('admins').delete().eq('user_id', s.user_id!), 'Acceso retirado.');
  return (
    <section className="card">
      <h3>Equipo</h3>
      <p className="hint">El reclutador ve candidatos, vacantes, mensajes y entrevistas. No ve cobros ni tarifas, y no puede borrar.</p>
      <div className="list">{staff.map((s) => (
        <div className="item" key={s.email}>
          <div className="item-h"><span className="mono">{s.email}</span>
            <span className={'pill ' + (s.rol === 'admin' ? 'lea' : 'info')}>{s.rol === 'admin' ? 'Administrador' : 'Reclutador'}{s.pendiente ? ' · falta crear cuenta' : ''}</span></div>
          <div className="actions">
            {!s.pendiente && s.user_id && (
              <Sel value={s.rol === 'admin' ? 'Administrador' : 'Reclutador'} options={['Administrador', 'Reclutador']}
                onChange={(r) => run(supabase.from('admins').update({ rol: r === 'Administrador' ? 'admin' : 'reclutador' }).eq('user_id', s.user_id!), 'Permisos actualizados.')} />
            )}
            <button type="button" className="btn sm danger" onClick={() => quitar(s)}>{s.pendiente ? 'Cancelar invitación' : 'Quitar acceso'}</button>
          </div>
        </div>
      ))}</div>
      <div className="row">
        <F label="Correo de la persona"><input type="email" value={email} placeholder="nombre@correo.com" onChange={(e) => setEmail(e.target.value)} /></F>
        <F label="Tipo"><Sel value={rol} onChange={setRol} options={['Reclutador', 'Administrador']} /></F>
      </div>
      <div className="actions"><button type="button" className="btn primary" onClick={invitar}>Agregar al equipo</button></div>
      <p className="hint">La persona entra a la app con "Entrar con correo". Si todavía no tiene cuenta, elige "Crear cuenta de empresa" con ese mismo correo y entra directo al panel.</p>
    </section>
  );
}

function Difusion({ onAsistido }: { onAsistido: () => void }) {
  const url = window.location.origin;
  const [svg, setSvg] = useState('');
  useEffect(() => { QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' }).then(setSvg).catch(() => setSvg('')); }, [url]);
  const host = useMemo(() => url.replace(/^https?:\/\//, ''), [url]);
  return (
    <section className="card">
      <h3>Difusión y registro</h3>
      <div className="poster">
        <div className="t"><span className="mark"><Logo size={22} />Factor<i>·</i>Gente</span>
          <b>¿Buscas trabajo en SFR, Purísima o León?</b>
          <span>Regístrate gratis desde tu celular. Nosotros te buscamos la vacante que te queda.</span>
          <span className="mono url">{host}</span></div>
        <div className="qr" role="img" aria-label="Código QR para registrarse" dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
      <p className="hint">Toma captura de este cartel para imprimirlo o compartirlo en WhatsApp y Facebook. El QR abre la app.</p>
      <span className="lbl">Compartir con quien busca trabajo</span>
      <ShareButtons texto="¿Buscas trabajo en SFR, Purísima o León? Regístrate gratis en Factor-Gente desde tu celular:" />
      <span className="lbl">Compartir con empresas</span>
      <ShareButtons texto="¿Necesitas personal? En Factor-Gente tú solo subes tu vacante; nosotros filtramos y te presentamos a los 2 o 3 candidatos que mejor encajan. Pagas solo si contratas:" />
      <div className="actions"><button type="button" className="btn primary" onClick={onAsistido}>Registrar a alguien (asistido)</button></div>
      <p className="hint">Para quien no puede llenar el formulario: tú capturas sus datos mientras platican.</p>
    </section>
  );
}
