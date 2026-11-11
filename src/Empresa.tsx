import { useCallback, useEffect, useState } from 'react';
import { AREAS, ESCO, HORARIO, MUNI, PAGO, PREST, TARIFAS_BASE, anticipoDe, fmtCita, fmtDate, money, perfilTexto, todayIso } from './lib/catalog';
import { supabase } from './lib/supabase';
import type { Cobro, Company, RefSalary, Tarifas, Terna, Vacancy } from './lib/types';
import { DEMO_CO, DEMO_COBROS, DEMO_TERNAS, DEMO_VAC } from './lib/demo';
import { Check, Checks, ContactCard, F, PREVIEW_MSG, Radios, RefCard, Sel, ServicesCard, Skills, toast } from './ui';

export function EmpresaHome({ userId, preview }: { userId: string; preview?: boolean }) {
  const [co, setCo] = useState<Company | null | undefined>(undefined);
  const [vacs, setVacs] = useState<Vacancy[]>([]);
  const [ternas, setTernas] = useState<Terna[]>([]);
  const [refs, setRefs] = useState<RefSalary[]>([]);
  const [tarifas, setTarifas] = useState<Tarifas>(TARIFAS_BASE);
  const [cobros, setCobros] = useState<Cobro[]>([]);

  const load = useCallback(async () => {
    const [a, b, t, r, f, c] = await Promise.all([
      supabase.from('companies').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('vacancies').select('*').order('created_at', { ascending: false }),
      supabase.rpc('my_ternas'),
      supabase.from('ref_salaries').select('*').order('orden'),
      supabase.from('tarifas').select('*').maybeSingle(),
      supabase.from('cobros').select('*').order('created_at', { ascending: false }),
    ]);
    setCo((a.data as Company) ?? null);
    setVacs((b.data as Vacancy[]) ?? []);
    setTernas((t.data as Terna[]) ?? []);
    setRefs((r.data as RefSalary[]) ?? []);
    setTarifas((f.data as Tarifas) ?? TARIFAS_BASE);
    setCobros((c.data as Cobro[]) ?? []);
    if (preview) { setCo(DEMO_CO); setVacs([DEMO_VAC]); setTernas(DEMO_TERNAS); setCobros(DEMO_COBROS); }
  }, [userId, preview]);
  useEffect(() => { load(); }, [load]);

  if (co === undefined) return <p className="empty">Cargando…</p>;
  if (!co) return <CompanyForm onSaved={load} />;

  const quiero = async (vid: string, cid: string) => {
    if (preview) return toast(PREVIEW_MSG);
    const { error } = await supabase.rpc('request_interview', { p_vacancy: vid, p_candidate: cid });
    if (error) return toast(error.message, true);
    toast('Listo. Factor-Gente te confirmará fecha y hora de la entrevista.');
    load();
  };

  return (
    <>
      <div className="intro"><span className="eyebrow">Empresa · {co.nombre}</span><h2>Solicitar personal</h2>
        <p>Describe el puesto. Factor-Gente filtra su base de candidatos y le envía una terna que se apega al perfil. Solo paga si contrata.</p></div>
      <div className="grid">
        <VacancyForm company={co} tarifas={tarifas} onSaved={load} preview={preview} />
        <div className="stack">
          <section className="card">
            <div className="card-h"><h3>Mis solicitudes</h3><p>{vacs.length}</p></div>
            <div className="list">
              {vacs.map((v) => {
                const ts = ternas.filter((t) => t.vacancy_id === v.id).sort((a, b) => a.letra - b.letra);
                return (
                  <div className="item" key={v.id}>
                    <div className="item-h"><strong>{v.puesto} <span className="hint">× {v.n}</span></strong><VacPill e={v.estado} /></div>
                    <div className="meta"><span>Alta {fmtDate(v.created_at)}</span><span className="mono">{money(v.smin)}–{money(v.smax)}</span><span>{v.tipo}</span><span>{v.pub === 'anonima' ? 'Publicada sin nombre' : 'Privada'}</span></div>
                    {co.requiere_anticipo && !v.anticipo_pagado && v.estado !== 'Cubierta' && v.estado !== 'Cancelada' && (
                      <p className="note">Para empezar la búsqueda se requiere un anticipo de <b className="mono">{money(anticipoDe(v, tarifas))}</b>, que se descuenta del cobro final. Factor-Gente te enviará los datos para el pago.</p>
                    )}
                    {ts.length ? <p className="hint">Terna recibida. Pide entrevista y Factor-Gente la coordina con el candidato.</p> : <p className="hint">Factor-Gente está buscando candidatos.</p>}
                    {ts.map((t) => (
                      <div className="item surface" key={t.candidate_id}>
                        <div className="item-h"><strong>{t.nombre ?? 'Candidato ' + 'ABCDE'[t.letra - 1]}</strong>
                          {t.cita ? <span className="pill ok">Entrevista agendada</span> : t.quiere ? <span className="pill info">Pediste entrevista</span> : null}</div>
                        {t.cita && <p className="note"><b>Entrevista:</b> {fmtCita(t.cita)} · {t.lugar}. Factor-Gente ya le avisó al candidato.</p>}
                        <div className="ficha">
                          <div><span>Último puesto</span>{t.ult_puesto ?? '—'} · {t.ult_tiempo ?? ''}</div>
                          <div><span>Estudios</span>{t.esco}</div>
                          <div><span>Pretende</span><b className="mono">{money(t.pmin)}–{money(t.pmax)}</b></div>
                          <div><span>Forma de pago</span>{t.tipo_pref}</div>
                          <div><span>Disponibilidad</span>{t.disp}</div>
                          <div><span>Puede trabajar en</span>{t.mov.join(', ')}</div>
                          <div><span>Habilidades</span>{t.habilidades.join(', ')}</div>
                          <div><span>Perfil</span>{t.res ? perfilTexto(t.res) : 'Sin prueba'}</div>
                        </div>
                        {t.carta && <p className="hint">“{t.carta}”</p>}
                        {t.liberado && t.tel && <p className="mono">WhatsApp: {t.tel}</p>}
                        {!t.quiere && !t.cita && (
                          <div className="actions"><button type="button" className="btn sm primary" onClick={() => quiero(v.id, t.candidate_id)}>Quiero entrevistarlo</button></div>
                        )}
                        {t.quiere && !t.cita && <p className="hint">Factor-Gente te confirmará fecha y hora.</p>}
                      </div>
                    ))}
                  </div>
                );
              })}
              {!vacs.length && <p className="empty">Aún no hay solicitudes.</p>}
            </div>
          </section>
          <ContactCard tipo="Empresa" nombre={co.nombre} tel={co.tel ?? ''} companyId={co.id} vacantes={vacs.map((v) => ({ id: v.id, puesto: v.puesto }))} preview={preview} />
          {cobros.length > 0 && (
            <section className="card">
              <div className="card-h"><h3>Mis pagos</h3></div>
              <div className="list">{cobros.map((c) => (
                <div className="item" key={c.id}>
                  <div className="item-h"><strong>{c.concepto} · {vacs.find((v) => v.id === c.vacancy_id)?.puesto}</strong>
                    {c.pagado ? <span className="pill ok">Pagado</span> : c.vence && c.vence < todayIso() ? <span className="pill bad">Vencido</span> : <span className="pill warn">Pendiente</span>}</div>
                  <div className="meta"><span className="mono">{money(c.monto)}</span>{!c.pagado && c.vence && <span>Vence {fmtDate(c.vence)}</span>}{c.pagado && <span>Pagado {fmtDate(c.pagado)}</span>}</div>
                </div>
              ))}</div>
              <p className="hint">La garantía de reemplazo de {tarifas.garantia_dias} días aplica cuando la colocación está pagada.</p>
            </section>
          )}
          <RefCard refs={refs} />
          <ServicesCard tipo="Empresa" nombre={co.nombre} tel={co.tel ?? ''} companyId={co.id} preview={preview} />
        </div>
      </div>
    </>
  );
}

// 1 → "un mes", 0.5 → "dos semanas", 2 → "2 meses"
const periodo = (m: number) => m === 1 ? 'un mes' : m === 0.5 ? 'dos semanas' : m < 1 ? `${Math.round(m * 4.33)} semanas` : `${m} meses`;

export function VacPill({ e }: { e: string }) {
  return <span className={'pill ' + (e === 'Abierta' ? 'ok' : e === 'Terna enviada' ? 'info' : e === 'Cancelada' ? 'bad' : 'lea')}>{e}</span>;
}

function CompanyForm({ onSaved }: { onSaved: () => void }) {
  const [d, setD] = useState({ nombre: '', giro: '', contacto: '', tel: '' });
  const [busy, setBusy] = useState(false);
  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!d.nombre.trim() || !d.tel.trim()) return toast('Escribe el nombre de la empresa y un teléfono.', true);
    setBusy(true);
    const { error } = await supabase.from('companies').insert({ nombre: d.nombre.trim(), giro: d.giro.trim() || null, contacto: d.contacto.trim() || null, tel: d.tel.trim() });
    setBusy(false);
    if (error) return toast('No se pudo guardar: ' + error.message, true);
    onSaved();
  };
  return (
    <>
      <div className="intro"><span className="eyebrow">Empresa</span><h2>Datos de tu empresa</h2><p>Solo se piden una vez. El nombre de tu empresa nunca se publica.</p></div>
      <form className="card narrow" onSubmit={guardar} noValidate>
        <div className="row">
          <F label="Nombre de la empresa"><input type="text" value={d.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} /></F>
          <F label="Giro"><input type="text" value={d.giro} placeholder="Ej. Fabricante de calzado de dama" onChange={(e) => setD({ ...d, giro: e.target.value })} /></F>
        </div>
        <div className="row">
          <F label="Persona de contacto"><input type="text" value={d.contacto} onChange={(e) => setD({ ...d, contacto: e.target.value })} /></F>
          <F label="WhatsApp o teléfono"><input type="tel" value={d.tel} onChange={(e) => setD({ ...d, tel: e.target.value })} /></F>
        </div>
        <div className="actions"><button type="submit" className="btn primary" disabled={busy}>Continuar</button></div>
      </form>
    </>
  );
}

const BLANK = {
  puesto: '', n: '1', zona: MUNI[0], area: 'Operativo', funciones: '', esco: 'No se requiere', exp: 'No se requiere', habilidades: [] as string[],
  tipo: PAGO[0], smin: '', smax: '', horario: 'Matutino', prest: ['IMSS'], transporte: 'No', comedor: 'No', incluyente: false,
  salidas: '0', motivo: 'Sueldo', sexo: 'Indistinto', edad_min: '', edad_max: '', just: '', pub: 'anonima', acepta: false,
};

function VacancyForm({ company, tarifas, onSaved, preview }: { company: Company; tarifas: Tarifas; onSaved: () => void; preview?: boolean }) {
  const [d, setD] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = <K extends keyof typeof BLANK>(k: K, v: (typeof BLANK)[K]) => { setD((x) => ({ ...x, [k]: v })); setErr(''); };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!d.puesto.trim() || !d.funciones.trim()) return setErr('Escribe el puesto y sus funciones.');
    const emin = d.edad_min ? Number(d.edad_min) : null, emax = d.edad_max ? Number(d.edad_max) : null;
    const interno = d.sexo !== 'Indistinto' || emin || emax;
    if (interno && !d.just.trim()) return setErr('Explica el motivo por el que el puesto requiere sexo o edad.');
    if ((emin && emin < 18) || (emax && emax < 18)) return setErr('Las vacantes son solo para mayores de 18 años.');
    if (!d.acepta) return setErr('Para enviar, acepta las condiciones del servicio.');
    if (preview) return toast(PREVIEW_MSG);
    setBusy(true);
    const { error } = await supabase.from('vacancies').insert({
      company_id: company.id, puesto: d.puesto.trim(), area: d.area, n: Number(d.n) || 1, zona: d.zona, funciones: d.funciones.trim(),
      esco: d.esco, exp: d.exp, habilidades: d.habilidades, tipo: d.tipo, smin: d.smin ? Number(d.smin) : null, smax: d.smax ? Number(d.smax) : null,
      horario: d.horario, prest: d.prest, transporte: d.transporte === 'Sí', comedor: d.comedor === 'Sí', incluyente: d.incluyente,
      salidas: Number(d.salidas) || 0, motivo: d.motivo, sexo: d.sexo, edad_min: emin, edad_max: emax, just: interno ? d.just.trim() : null,
      pub: d.pub, acepta: d.acepta,
    });
    setBusy(false);
    if (error) return setErr('No se pudo enviar: ' + error.message);
    toast('Solicitud enviada. Factor-Gente ya está buscando candidatos.');
    setD(BLANK);
    onSaved();
  };

  return (
    <form className="card" onSubmit={enviar} noValidate>
      <fieldset><legend>Nueva vacante</legend>
        <div className="row">
          <F label="Puesto"><input type="text" value={d.puesto} placeholder="Ej. Cortador de piel" onChange={(e) => set('puesto', e.target.value)} /></F>
          <F label="¿Cuántas personas?"><input type="number" min={1} value={d.n} onChange={(e) => set('n', e.target.value)} /></F>
          <F label="Municipio donde se trabaja"><Sel value={d.zona} onChange={(v) => set('zona', v)} options={MUNI} /></F>
        </div>
        <Radios name="ef-area" value={d.area} onChange={(v) => set('area', v)} options={AREAS} />
        <F label="¿Qué funciones hará?"><textarea value={d.funciones} placeholder="Ej. Corte de piel a mano y en suaje, aprovechamiento de material." onChange={(e) => set('funciones', e.target.value)} /></F>
        <div className="row">
          <F label="Preparación mínima"><Sel value={d.esco} onChange={(v) => set('esco', v)} options={['No se requiere', ...ESCO]} /></F>
          <F label="Experiencia mínima"><Sel value={d.exp} onChange={(v) => set('exp', v)} options={['No se requiere', '6 meses', '1 año', '2 años', '3 años o más']} /></F>
        </div>
        <div className="stack-sm"><span className="lbl">Habilidades que requiere</span>
          <Skills area={d.area} value={d.habilidades} onChange={(v) => set('habilidades', v)} ejemplo="Manejo de máquina de inyección" /></div>
      </fieldset>
      <fieldset><legend>Lo que ofrece</legend>
        <div className="row">
          <F label="Forma de pago"><Sel value={d.tipo} onChange={(v) => set('tipo', v)} options={PAGO} /></F>
          <F label="Sueldo mensual desde"><input type="number" step={100} value={d.smin} placeholder="10000" onChange={(e) => set('smin', e.target.value)} /></F>
          <F label="Sueldo mensual hasta"><input type="number" step={100} value={d.smax} placeholder="12500" onChange={(e) => set('smax', e.target.value)} /></F>
        </div>
        <p className="hint">Si paga por semana o a destajo, calcula lo de una semana normal × 4.3. Consulta los sueldos de referencia de la zona.</p>
        <div className="row"><F label="Horario"><Sel value={d.horario} onChange={(v) => set('horario', v)} options={HORARIO} /></F></div>
        <Checks value={d.prest} onChange={(v) => set('prest', v)} options={PREST} />
        <div className="row">
          <F label="¿Hay transporte?"><Sel value={d.transporte} onChange={(v) => set('transporte', v)} options={['No', 'Sí']} /></F>
          <F label="¿Hay comedor?"><Sel value={d.comedor} onChange={(v) => set('comedor', v)} options={['No', 'Sí']} /></F>
        </div>
        <div className="checks"><Check checked={d.incluyente} onChange={(v) => set('incluyente', v)}>Vacante incluyente: abierta a personas con discapacidad o adultos mayores.</Check></div>
        <p className="hint">Contratar a personas con discapacidad o adultos mayores puede dar beneficios fiscales. Consúltalo con tu contador o con la consultora.</p>
      </fieldset>
      <fieldset><legend>Rotación del puesto</legend>
        <div className="row">
          <F label="¿Cuántas personas salieron de este puesto en los últimos 6 meses?"><input type="number" min={0} value={d.salidas} onChange={(e) => set('salidas', e.target.value)} /></F>
          <F label="Motivo principal de las salidas"><Sel value={d.motivo} onChange={(v) => set('motivo', v)} options={['Sueldo', 'Horario', 'Mejor oferta', 'Ambiente de trabajo', 'Distancia', 'No aplica']} /></F>
        </div>
        <p className="note">Con esto buscamos candidatos que sí se queden y cuidamos la garantía de reemplazo.</p>
      </fieldset>
      <fieldset><legend>Filtro interno <span className="private">No se publica</span></legend>
        <p className="hint">La ley prohíbe negar un empleo por sexo, edad, estado civil, embarazo, religión, salud o apariencia. Si el puesto de verdad requiere sexo o edad, indícalo aquí y explica el motivo: solo Factor-Gente lo usa para filtrar.</p>
        <div className="row">
          <F label="Sexo"><Sel value={d.sexo} onChange={(v) => set('sexo', v)} options={['Indistinto', 'Mujer', 'Hombre']} /></F>
          <F label="Edad desde"><input type="number" min={18} value={d.edad_min} placeholder="Indistinto" onChange={(e) => set('edad_min', e.target.value)} /></F>
          <F label="Edad hasta"><input type="number" min={18} value={d.edad_max} placeholder="Indistinto" onChange={(e) => set('edad_max', e.target.value)} /></F>
        </div>
        <F label={<>Motivo <span className="hint">(obligatorio si pides sexo o edad)</span></>}><input type="text" value={d.just} placeholder="Ej. el puesto atiende el vestidor de mujeres" onChange={(e) => set('just', e.target.value)} /></F>
      </fieldset>
      <fieldset><legend>Publicación</legend>
        <div className="radios">
          <label><input type="radio" name="pub" checked={d.pub === 'anonima'} onChange={() => set('pub', 'anonima')} /> Publicar sin el nombre de la empresa</label>
          <label><input type="radio" name="pub" checked={d.pub === 'privada'} onChange={() => set('pub', 'privada')} /> Privada: solo Factor-Gente la ve</label>
        </div>
        <div className="terms"><b>Condiciones del servicio</b><ul>
          <li>Operativo: {money(tarifas.cuota_operativo)} + IVA por persona colocada. Administrativo y supervisión: {periodo(tarifas.meses_admin)} del sueldo ofrecido + IVA.</li>
          {company.requiere_anticipo && <li>Anticipo del {tarifas.anticipo_pct}% para iniciar la búsqueda; se descuenta del cobro final.</li>}
          <li>Factor-Gente coordina las entrevistas con los candidatos.</li>
          <li>El resto se paga dentro de los {tarifas.plazo_dias} días siguientes a que la persona ingresa a trabajar.</li>
          <li>Garantía: si la persona sale en los primeros {tarifas.garantia_dias} días, enviamos un reemplazo sin costo, sujeto a los requisitos de abajo.</li>
          <li>Si la empresa contrata a un candidato presentado por Factor-Gente en los 12 meses siguientes, se cobra la colocación.</li>
          <li>La empresa contrata directamente; Factor-Gente solo recluta y filtra.</li></ul>
          <details open><summary>Requisitos de la garantía de reemplazo</summary>
            <ul>
              <li>La persona desempeña el puesto para el que fue contratada: mismas funciones, horario y lugar de trabajo.</li>
              <li>Se respetan el sueldo, las prestaciones y las condiciones publicadas en la vacante.</li>
              <li>La empresa aplicó el manual de integración (onboarding) que entrega Factor-Gente.</li>
              <li>El anticipo y el saldo están pagados dentro del plazo.</li>
              <li>La persona renunció o fue dada de baja por bajo desempeño o mala conducta. No aplica por recorte de personal, cierre, cambios de turno o de condiciones, ni por despido sin causa.</li>
              <li>La empresa avisa a Factor-Gente dentro de los 5 días hábiles siguientes a la salida.</li>
              <li>Un solo reemplazo por colocación, para el mismo puesto y sin devolución de dinero.</li>
              <li>La vacante no cambió de perfil ni de sueldo; si cambia, se trata como una búsqueda nueva.</li>
            </ul>
          </details></div>
        <div className="checks"><Check checked={d.acepta} onChange={(v) => set('acepta', v)}>Acepto las condiciones del servicio.</Check></div>
      </fieldset>
      {err && <p className="toast err" role="alert">{err}</p>}
      <div className="actions"><button type="submit" className="btn primary" disabled={busy}>Enviar solicitud</button></div>
    </form>
  );
}
