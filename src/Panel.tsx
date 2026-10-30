import { useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { ESTADOS, TRAITS, daysSince, fmtDate, isInc, llega, match, money, norm, pasaInterno, perfilTexto, refFor } from './lib/catalog';
import { supabase } from './lib/supabase';
import type { Candidate, Company, Interest, Lead, Placement, RefSalary, Shortlist, Test, Vacancy } from './lib/types';
import { CandidateForm } from './Candidato';
import { VacPill } from './Empresa';
import { Logo, RefCard, Sel, toast } from './ui';

interface Data {
  cands: Candidate[]; vacs: Vacancy[]; cos: Company[]; tests: Test[]; short: Shortlist[];
  places: Placement[]; ints: Interest[]; leads: Lead[]; refs: RefSalary[];
}
const EMPTY: Data = { cands: [], vacs: [], cos: [], tests: [], short: [], places: [], ints: [], leads: [], refs: [] };

const ESTADO_PILL: Record<string, string> = { Disponible: 'ok', 'En proceso': 'info', Colocado: 'lea', Inactivo: 'bad' };

export function Panel() {
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
    ]);
    const bad = r.find((x) => x.error);
    if (bad?.error) toast('No se pudieron cargar los datos: ' + bad.error.message, true);
    setD({
      cands: (r[0].data as Candidate[]) ?? [], vacs: (r[1].data as Vacancy[]) ?? [], cos: (r[2].data as Company[]) ?? [],
      tests: (r[3].data as Test[]) ?? [], short: (r[4].data as Shortlist[]) ?? [], places: (r[5].data as Placement[]) ?? [],
      ints: (r[6].data as Interest[]) ?? [], leads: (r[7].data as Lead[]) ?? [], refs: (r[8].data as RefSalary[]) ?? [],
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  const cand = (id: string) => d.cands.find((c) => c.id === id);
  const coName = (id: string) => d.cos.find((c) => c.id === id)?.nombre ?? '—';
  const testOf = (id: string) => d.tests.find((t) => t.candidate_id === id);
  const v = d.vacs.find((x) => x.id === selVac) ?? d.vacs[0];

  const run = async (p: PromiseLike<{ error: { message: string } | null }>, ok?: string) => {
    const { error } = await p;
    if (error) { toast(error.message, true); return false; }
    if (ok) toast(ok);
    await load();
    return true;
  };

  const disp = d.cands.filter((c) => c.estado === 'Disponible').length;
  const abiertas = d.vacs.filter((x) => x.estado === 'Abierta' || x.estado === 'Terna enviada').length;
  const maduras = d.places.filter((p) => daysSince(p.ingreso) >= 90);
  const siguen = maduras.filter((p) => p.c90 === true).length;
  const pend = d.short.filter((s) => s.quiere && !s.liberado);

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
        <p>Elige una vacante, revisa los candidatos sugeridos, asigna pruebas y arma la terna para la empresa.</p></div>
      <div className="kpis">
        <div className="kpi"><span>Candidatos disponibles</span><b>{disp}</b><small>de {d.cands.length} registrados</small></div>
        <div className="kpi"><span>Vacantes abiertas</span><b>{abiertas}</b><small>{d.vacs.filter((x) => x.estado === 'Terna enviada').length} con terna enviada</small></div>
        <div className="kpi"><span>Colocaciones</span><b>{d.places.length}</b><small>en seguimiento</small></div>
        <div className="kpi"><span>Siguen a 90 días</span><b>{maduras.length ? Math.round((siguen / maduras.length) * 100) + '%' : '—'}</b><small>{siguen} de {maduras.length} con 90 días</small></div>
      </div>

      {pend.length > 0 && (
        <section className="card attention">
          <div className="card-h"><h3>Empresas que quieren entrevistar</h3><span className="pill info">{pend.length}</span></div>
          <div className="list">{pend.map((s) => {
            const vv = d.vacs.find((x) => x.id === s.vacancy_id), c = cand(s.candidate_id);
            if (!vv || !c) return null;
            return (
              <div className="item" key={s.vacancy_id + s.candidate_id}><div className="item-h">
                <span><b>{coName(vv.company_id)}</b> quiere entrevistar a <b>{c.nombre}</b> · {vv.puesto}</span>
                <button type="button" className="btn sm primary" onClick={() => run(supabase.from('shortlist').update({ liberado: true }).eq('vacancy_id', s.vacancy_id).eq('candidate_id', s.candidate_id), 'Contacto liberado a la empresa.')}>Liberar contacto</button>
              </div></div>
            );
          })}</div>
        </section>
      )}

      <div className="grid">
        <div className="stack">
          {v ? <Sugeridos key={v.id} v={v} d={d} coName={coName} testOf={testOf} filtroInterno={filtroInterno} setFiltroInterno={setFiltroInterno}
              soloInc={soloInc} setSoloInc={setSoloInc} onCand={setSelCand} run={run} />
            : <section className="card"><h3>Sin vacantes todavía</h3><p className="empty">Cuando una empresa envíe una solicitud aparecerá aquí.</p></section>}
          {selCand && cand(selCand) && (
            <Detalle c={cand(selCand)!} test={testOf(selCand)} run={run} onClose={() => setSelCand(null)}
              onEdit={() => setForm({ mode: 'admin', c: cand(selCand)! })} />
          )}
          <Base cands={d.cands} buscar={buscar} setBuscar={setBuscar} onCand={setSelCand} />
          <Seguimiento d={d} cand={cand} run={run} />
        </div>
        <div className="stack">
          <section className="card">
            <div className="card-h"><h3>Vacantes</h3><p>{d.vacs.length}</p></div>
            <div className="list">{d.vacs.map((x) => (
              <button type="button" key={x.id} className={'item' + (x.id === v?.id ? ' sel' : '')} onClick={() => { setSelVac(x.id); setSelCand(null); }}>
                <span className="item-h"><strong>{x.puesto}</strong><VacPill e={x.estado} /></span>
                <span className="meta"><span>{coName(x.company_id)}</span><span>{x.area}</span><span>{x.pub === 'anonima' ? 'Publicada' : 'Privada'}</span></span>
              </button>
            ))}</div>
          </section>
          <Difusion onAsistido={() => setForm({ mode: 'asistido', c: null })} />
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

type Run = (p: PromiseLike<{ error: { message: string } | null }>, ok?: string) => Promise<boolean>;

function Sugeridos({ v, d, coName, testOf, filtroInterno, setFiltroInterno, soloInc, setSoloInc, onCand, run }: {
  v: Vacancy; d: Data; coName: (id: string) => string; testOf: (id: string) => Test | undefined;
  filtroInterno: boolean; setFiltroInterno: (b: boolean) => void; soloInc: boolean; setSoloInc: (b: boolean) => void;
  onCand: (id: string) => void; run: Run;
}) {
  const ref = refFor(v.puesto, d.refs);
  const terna = d.short.filter((s) => s.vacancy_id === v.id);
  const enTerna = (id: string) => terna.some((s) => s.candidate_id === id);
  const enviada = terna.some((s) => s.enviado);
  const interno = v.sexo !== 'Indistinto' || v.edad_min || v.edad_max;
  const liberado = terna.find((s) => s.liberado);

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
    await run(supabase.from('candidates').update({ estado: 'En proceso' }).in('id', ids).eq('estado', 'Disponible'), 'Terna enviada a ' + coName(v.company_id) + '.');
  };

  const contratar = async (cid: string) => {
    const ok = await run(supabase.from('placements').insert({ candidate_id: cid, vacancy_id: v.id }));
    if (!ok) return;
    await supabase.from('candidates').update({ estado: 'Colocado' }).eq('id', cid);
    await run(supabase.from('vacancies').update({ estado: 'Cubierta' }).eq('id', v.id), 'Colocación registrada. Empieza el seguimiento.');
  };

  return (
    <section className="card">
      <div className="card-h"><h3>Candidatos sugeridos · {v.puesto}</h3>
        <div className="actions">
          <label className="hint inline-check"><input type="checkbox" checked={filtroInterno} onChange={(e) => setFiltroInterno(e.target.checked)} /> Filtro interno (sexo / edad)</label>
          <label className="hint inline-check"><input type="checkbox" checked={soloInc} onChange={(e) => setSoloInc(e.target.checked)} /> Solo perfiles de inclusión</label>
        </div></div>
      <div className="meta">
        <span>{coName(v.company_id)}</span><span>{v.zona}</span><span className="mono">{money(v.smin)}–{money(v.smax)}</span><span>{v.tipo}</span>
        <span>Busca: {v.habilidades.join(', ') || '—'}</span>
        {v.incluyente && <span className="pill lea">Vacante incluyente</span>}
        {ref && v.smax && v.smax < ref.min && <span className="pill warn">Sueldo bajo vs. zona ({money(ref.min)}–{money(ref.max)})</span>}
        {v.salidas >= 3 && <span className="pill warn">Rotación alta: {v.salidas} salidas en 6 meses ({v.motivo})</span>}
        <label className="inline-check">Estado <Sel value={v.estado} onChange={(e) => run(supabase.from('vacancies').update({ estado: e }).eq('id', v.id))} options={['Abierta', 'Terna enviada', 'Cubierta', 'Cancelada']} /></label>
      </div>
      <details><summary>Ver detalle de la vacante</summary>
        <p><b>Funciones:</b> {v.funciones}</p>
        <p><b>Preparación:</b> {v.esco} · <b>Experiencia:</b> {v.exp} · <b>Horario:</b> {v.horario} · <b>Personas:</b> {v.n}</p>
        <p><b>Prestaciones:</b> {v.prest.join(', ') || '—'} · Transporte: {v.transporte ? 'sí' : 'no'} · Comedor: {v.comedor ? 'sí' : 'no'}</p>
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
        <button type="button" className="btn primary" disabled={!terna.length || terna.every((s) => s.enviado)} onClick={enviar}>
          {enviada && terna.every((s) => s.enviado) ? `Terna enviada (${terna.length})` : `Enviar terna a la empresa (${terna.length}/3)`}</button>
        {liberado && v.estado !== 'Cubierta' && cand_name(d, liberado.candidate_id) && (
          <button type="button" className="btn" onClick={() => contratar(liberado.candidate_id)}>Marcar contratado: {cand_name(d, liberado.candidate_id)}</button>
        )}
      </div>
    </section>
  );
}
const cand_name = (d: Data, id: string) => d.cands.find((c) => c.id === id)?.nombre;

function Detalle({ c, test, run, onClose, onEdit }: { c: Candidate; test?: Test; run: Run; onClose: () => void; onEdit: () => void }) {
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
        {!borrar ? <button type="button" className="btn sm danger" onClick={() => setBorrar(true)}>Borrar candidato</button> : (
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

function Seguimiento({ d, cand, run }: { d: Data; cand: (id: string) => Candidate | undefined; run: Run }) {
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
      <div className="card-h"><h3>Seguimiento de colocados</h3><p>Garantía: reemplazo sin costo si sale antes de 60 días</p></div>
      {!d.places.length ? <p className="empty">Aún no hay colocaciones.</p> : (
        <div className="tbl"><table><thead><tr><th>Persona</th><th>Puesto</th><th>Ingreso</th><th>30 d</th><th>60 d</th><th>90 d</th><th></th></tr></thead><tbody>
          {d.places.map((p) => {
            const vv = d.vacs.find((x) => x.id === p.vacancy_id);
            const gar = p.c30 === false || p.c60 === false;
            return (
              <tr key={p.candidate_id + p.vacancy_id}><td>{cand(p.candidate_id)?.nombre ?? '—'}</td><td>{vv?.puesto}</td><td>{fmtDate(p.ingreso)}</td>
                <td>{cell(p, 'c30', 30)}</td><td>{cell(p, 'c60', 60)}</td><td>{cell(p, 'c90', 90)}</td>
                <td>{gar ? <span className="pill bad">Aplica reemplazo</span> : p.c90 === true ? <span className="pill ok">Retenido</span> : null}</td></tr>
            );
          })}
        </tbody></table></div>
      )}
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
      <div className="actions"><button type="button" className="btn primary" onClick={onAsistido}>Registrar a alguien (asistido)</button></div>
      <p className="hint">Para quien no puede llenar el formulario: tú capturas sus datos mientras platican.</p>
    </section>
  );
}
