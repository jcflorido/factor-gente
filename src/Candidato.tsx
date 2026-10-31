import { useCallback, useEffect, useState } from 'react';
import { AREAS, AREA_HINT, DISP, ESCO, HORARIO, ITEMS, MUNI, PAGO, SALIDA, SCALE, TIEMPO, TRANSP, money } from './lib/catalog';
import { supabase } from './lib/supabase';
import type { Candidate, PublicVacancy } from './lib/types';
import { Aviso, Check, Checks, ContactCard, F, Radios, Sel, ServicesCard, Skills, toast } from './ui';

interface Draft {
  nombre: string; edad: string; sexo: string; tel: string; correo: string; municipio: string; colonia: string; esco: string;
  area: string; puesto: string; funciones: string; habilidades: string[]; carta: string;
  ult_puesto: string; ult_empresa: string; ult_funciones: string; ult_tiempo: string; ult_sueldo: string; ult_salida: string; ult_tipo: string;
  pmin: string; pmax: string; tipo_pref: string; horario: string; disp: string; transp: string; mov: string[];
  inclusion: boolean; ajuste: string;
  consent_aviso: boolean; consent_compartir: boolean; consent_pruebas: boolean; consent_servicios: boolean;
}

const s = (v: string | number | null | undefined) => (v == null ? '' : String(v));
const n = (v: string) => (v.trim() ? Number(v) : null);

function toDraft(c: Candidate | null): Draft {
  return {
    nombre: s(c?.nombre), edad: s(c?.edad), sexo: c?.sexo ?? 'Prefiero no decir', tel: s(c?.tel), correo: s(c?.correo),
    municipio: c?.municipio ?? MUNI[0], colonia: s(c?.colonia), esco: c?.esco ?? 'Secundaria',
    area: c?.area ?? 'Operativo', puesto: s(c?.puesto), funciones: s(c?.funciones), habilidades: c?.habilidades ?? [], carta: s(c?.carta),
    ult_puesto: s(c?.ult_puesto), ult_empresa: s(c?.ult_empresa), ult_funciones: s(c?.ult_funciones), ult_tiempo: c?.ult_tiempo ?? TIEMPO[0],
    ult_sueldo: s(c?.ult_sueldo), ult_salida: c?.ult_salida ?? SALIDA[0], ult_tipo: c?.ult_tipo ?? PAGO[0],
    pmin: s(c?.pmin), pmax: s(c?.pmax), tipo_pref: c?.tipo_pref ?? 'Cualquiera', horario: c?.horario ?? 'Cualquiera', disp: c?.disp ?? DISP[0],
    transp: c?.transp ?? 'No', mov: c?.mov ?? [MUNI[0]], inclusion: c?.inclusion ?? false, ajuste: s(c?.ajuste),
    consent_aviso: c?.consent_aviso ?? false, consent_compartir: c?.consent_compartir ?? false,
    consent_pruebas: c?.consent_pruebas ?? false, consent_servicios: c?.consent_servicios ?? false,
  };
}

// Formulario de perfil: lo usa el candidato, y el administrador para el registro asistido o para corregir datos
export function CandidateForm({ initial, mode, userId, onSaved, onCancel }: {
  initial: Candidate | null; mode: 'self' | 'asistido' | 'admin'; userId?: string;
  onSaved: (c: Candidate) => void; onCancel?: () => void;
}) {
  const [d, setD] = useState<Draft>(() => toDraft(initial));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => { setD((x) => ({ ...x, [k]: v })); setErr(''); };
  const nuevo = !initial;

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!d.consent_aviso || !d.consent_compartir) return setErr('Para guardar, marca las dos casillas obligatorias de privacidad.');
    if (!d.nombre.trim() || !d.tel.trim()) return setErr('Escribe nombre y WhatsApp.');
    const edad = Number(d.edad);
    if (!edad || edad < 18) return setErr('Factor-Gente solo registra personas mayores de 18 años.');
    if (!d.mov.length) return setErr('Marca al menos un municipio donde pueda trabajar.');
    const row = {
      nombre: d.nombre.trim(), edad, sexo: d.sexo, tel: d.tel.trim(), correo: d.correo.trim() || null, municipio: d.municipio,
      colonia: d.colonia.trim() || null, esco: d.esco, area: d.area, puesto: d.puesto.trim() || null, funciones: d.funciones.trim() || null,
      habilidades: d.habilidades, carta: d.area !== 'Operativo' ? d.carta.trim() || null : null,
      ult_puesto: d.ult_puesto.trim() || null, ult_empresa: d.ult_empresa.trim() || null, ult_funciones: d.ult_funciones.trim() || null,
      ult_tiempo: d.ult_tiempo, ult_sueldo: n(d.ult_sueldo), ult_salida: d.ult_salida, ult_tipo: d.ult_tipo,
      pmin: n(d.pmin), pmax: n(d.pmax), tipo_pref: d.tipo_pref, horario: d.horario, disp: d.disp, transp: d.transp, mov: d.mov,
      inclusion: d.inclusion, ajuste: d.ajuste.trim() || null,
      consent_aviso: d.consent_aviso, consent_compartir: d.consent_compartir, consent_pruebas: d.consent_pruebas, consent_servicios: d.consent_servicios,
    };
    setBusy(true);
    const q = initial
      ? supabase.from('candidates').update(row).eq('id', initial.id).select().single()
      : supabase.from('candidates').insert(mode === 'self' ? { ...row, user_id: userId } : { ...row, asistido: true, user_id: null }).select().single();
    const { data, error } = await q;
    setBusy(false);
    if (error) return setErr('No se pudo guardar: ' + error.message);
    toast(mode === 'asistido' ? 'Candidato registrado.' : mode === 'admin' ? 'Datos actualizados.' : 'Perfil guardado.');
    onSaved(data as Candidate);
  };

  return (
    <form className="card" onSubmit={guardar} noValidate>
      <fieldset><legend>{mode === 'self' ? 'Tus datos' : 'Datos de la persona'}</legend>
        <div className="row">
          <F label="Nombre completo"><input type="text" value={d.nombre} onChange={(e) => set('nombre', e.target.value)} /></F>
          <F label="Edad" hint="Solo mayores de 18 años."><input type="number" min={18} max={90} value={d.edad} onChange={(e) => set('edad', e.target.value)} /></F>
          <F label={<>Sexo <span className="private">Solo lo ve Factor-Gente</span></>}><Sel value={d.sexo} onChange={(v) => set('sexo', v)} options={['Mujer', 'Hombre', 'Prefiero no decir']} /></F>
        </div>
        <div className="row">
          <F label="WhatsApp"><input type="tel" value={d.tel} onChange={(e) => set('tel', e.target.value)} /></F>
          <F label="Correo (opcional)"><input type="email" value={d.correo} onChange={(e) => set('correo', e.target.value)} /></F>
        </div>
        <div className="row">
          <F label="Municipio donde vive"><Sel value={d.municipio} onChange={(v) => set('municipio', v)} options={MUNI} /></F>
          <F label="Colonia"><input type="text" value={d.colonia} onChange={(e) => set('colonia', e.target.value)} /></F>
          <F label="Último grado de estudios"><Sel value={d.esco} onChange={(v) => set('esco', v)} options={ESCO} /></F>
        </div>
        <p className="hint">La INE o el CURP solo se piden si avanzas en un proceso de selección.</p>
      </fieldset>

      <fieldset><legend>¿En qué área trabaja?</legend>
        <Radios name="area" value={d.area} onChange={(v) => set('area', v)} options={AREAS} />
        <p className="hint">{AREA_HINT}</p>
        <F label="Puesto que busca"><input type="text" value={d.puesto} onChange={(e) => set('puesto', e.target.value)} /></F>
        <F label="¿Qué sabe hacer? Funciones"><textarea value={d.funciones} onChange={(e) => set('funciones', e.target.value)} /></F>
        <div className="stack-sm"><span className="lbl">Habilidades (toca las que tenga o agrega otras)</span>
          <Skills area={d.area} value={d.habilidades} onChange={(v) => set('habilidades', v)} ejemplo="Pespunte de bota vaquera" /></div>
        {d.area !== 'Operativo' && (
          <F label="Carta de presentación corta" hint="Para puestos administrativos y de supervisión.">
            <textarea value={d.carta} placeholder="En 3 o 4 líneas: quién eres y qué buscas." onChange={(e) => set('carta', e.target.value)} />
          </F>
        )}
      </fieldset>

      <fieldset><legend>Último trabajo</legend>
        <div className="row">
          <F label="Puesto"><input type="text" value={d.ult_puesto} onChange={(e) => set('ult_puesto', e.target.value)} /></F>
          <F label={<>Empresa <span className="private">No se comparte</span></>}><input type="text" value={d.ult_empresa} onChange={(e) => set('ult_empresa', e.target.value)} /></F>
          <F label="¿Cuánto tiempo estuvo?"><Sel value={d.ult_tiempo} onChange={(v) => set('ult_tiempo', v)} options={TIEMPO} /></F>
        </div>
        <F label="¿Qué hacía?"><textarea value={d.ult_funciones} onChange={(e) => set('ult_funciones', e.target.value)} /></F>
        <div className="row">
          <F label="¿Cómo le pagaban?"><Sel value={d.ult_tipo} onChange={(v) => set('ult_tipo', v)} options={PAGO} /></F>
          <F label="Lo que ganaba al mes (aprox.)" hint="Si era por semana o a destajo: lo de una semana normal × 4.3"><input type="number" step={100} value={d.ult_sueldo} onChange={(e) => set('ult_sueldo', e.target.value)} /></F>
          <F label="¿Por qué salió?"><Sel value={d.ult_salida} onChange={(v) => set('ult_salida', v)} options={SALIDA} /></F>
        </div>
      </fieldset>

      <fieldset><legend>Lo que busca</legend>
        <div className="row">
          <F label="Sueldo mensual mínimo"><input type="number" step={100} value={d.pmin} onChange={(e) => set('pmin', e.target.value)} /></F>
          <F label="Sueldo mensual deseado"><input type="number" step={100} value={d.pmax} onChange={(e) => set('pmax', e.target.value)} /></F>
          <F label="Forma de pago que prefiere"><Sel value={d.tipo_pref} onChange={(v) => set('tipo_pref', v)} options={['Cualquiera', ...PAGO]} /></F>
        </div>
        <div className="row">
          <F label="Horario"><Sel value={d.horario} onChange={(v) => set('horario', v)} options={HORARIO} /></F>
          <F label="¿Cuándo puede empezar?"><Sel value={d.disp} onChange={(v) => set('disp', v)} options={DISP} /></F>
          <F label="¿Tiene transporte propio?"><Sel value={d.transp} onChange={(v) => set('transp', v)} options={TRANSP} /></F>
        </div>
        <div className="stack-sm"><span className="lbl">¿En qué municipios puede trabajar?</span>
          <Checks value={d.mov} onChange={(v) => set('mov', v)} options={MUNI} /></div>
      </fieldset>

      <fieldset><legend>Inclusión <span className="hint">(opcional)</span></legend>
        <p className="hint">Algunas empresas abren vacantes para personas con discapacidad o adultos mayores. Llénalo solo si quieres que te tomemos en cuenta. Es un dato sensible: solo lo ve Factor-Gente.</p>
        <div className="checks"><Check checked={d.inclusion} onChange={(v) => set('inclusion', v)}>Tengo una discapacidad y quiero que me consideren para vacantes incluyentes.</Check></div>
        <F label="¿Necesita algún ajuste para trabajar? (opcional)"><input type="text" value={d.ajuste} placeholder="Ej. acceso sin escalones, instrucciones por escrito" onChange={(e) => set('ajuste', e.target.value)} /></F>
      </fieldset>

      <fieldset><legend>Privacidad y permisos</legend>
        <div className="checks">
          <Check checked={d.consent_aviso} onChange={(v) => set('consent_aviso', v)}>Leí el aviso de privacidad y confirmo que soy mayor de 18 años. <b>Obligatorio.</b></Check>
          <Check checked={d.consent_compartir} onChange={(v) => set('consent_compartir', v)}>Acepto que Factor-Gente comparta mi perfil, sin mis datos de contacto, con empresas que buscan personal. <b>Obligatorio.</b></Check>
          <Check checked={d.consent_pruebas} onChange={(v) => set('consent_pruebas', v)}>Acepto contestar pruebas de personalidad si me las asignan. Mis respuestas solo las ve Factor-Gente; a la empresa le llega un resumen. Opcional.</Check>
          <Check checked={d.consent_servicios} onChange={(v) => set('consent_servicios', v)}>Acepto que me ofrezcan otros servicios de la consultora: legal, fiscal, contable y organizacional. Opcional.</Check>
        </div>
        {mode === 'asistido' && <p className="note">Registro asistido: lee el aviso en voz alta y marca cada casilla solo si la persona está de acuerdo.</p>}
        <Aviso />
      </fieldset>

      {err && <p className="toast err" role="alert">{err}</p>}
      <div className="actions">
        <button type="submit" className="btn primary" disabled={busy}>{mode === 'self' ? (nuevo ? 'Crear mi perfil' : 'Guardar cambios') : mode === 'asistido' ? 'Guardar candidato' : 'Guardar cambios'}</button>
        {onCancel && <button type="button" className="btn" onClick={onCancel}>Cancelar</button>}
      </div>
    </form>
  );
}

// Pantalla del candidato que entra desde su celular
export function CandidatoHome({ userId, onDeleted }: { userId: string; onDeleted: () => void }) {
  const [c, setC] = useState<Candidate | null | undefined>(undefined);
  const [vacs, setVacs] = useState<PublicVacancy[]>([]);
  const [ints, setInts] = useState<string[]>([]);
  const [test, setTest] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [a, b, t] = await Promise.all([
      supabase.from('candidates').select('*').eq('user_id', userId).maybeSingle(),
      supabase.rpc('public_vacancies'),
      supabase.rpc('my_test_status'),
    ]);
    setC((a.data as Candidate) ?? null);
    setVacs((b.data as PublicVacancy[]) ?? []);
    setTest((t.data as string | null) ?? null);
    if (a.data) {
      const i = await supabase.from('interests').select('vacancy_id').eq('candidate_id', (a.data as Candidate).id);
      setInts((i.data ?? []).map((x: { vacancy_id: string }) => x.vacancy_id));
    }
  }, [userId]);
  useEffect(() => { load(); }, [load]);

  if (c === undefined) return <p className="empty">Cargando…</p>;

  const toggleInt = async (vid: string) => {
    if (!c) return;
    if (ints.includes(vid)) {
      await supabase.from('interests').delete().eq('candidate_id', c.id).eq('vacancy_id', vid);
      setInts(ints.filter((x) => x !== vid));
    } else {
      const { error } = await supabase.from('interests').insert({ candidate_id: c.id, vacancy_id: vid });
      if (error) return toast(error.message, true);
      setInts([...ints, vid]);
    }
  };

  return (
    <>
      <div className="intro"><span className="eyebrow">Bolsa de trabajo con filtro</span>
        <h2>{c ? `Hola, ${c.nombre.split(' ')[0]}` : 'Crea tu perfil de trabajo'}</h2>
        <p>{c ? 'Mantén tu perfil al día. Factor-Gente te busca la vacante que te queda y te contacta por WhatsApp.' : 'Llénalo desde tu celular en unos 5 minutos. Para ti el servicio es gratis.'}</p>
        <p className="hint">Este celular recuerda tu perfil. Si cambias de celular, escríbele a Factor-Gente para recuperar tus datos.</p>
      </div>
      <div className="grid">
        <CandidateForm key={c?.id ?? 'nuevo'} initial={c} mode="self" userId={userId} onSaved={(x) => { setC(x); load(); }} />
        <div className="stack">
          {c && <TestCard estado={test} permiso={c.consent_pruebas} onDone={() => setTest('completada')} />}
          <section className="card">
            <div className="card-h"><h3>Vacantes disponibles</h3><p>{vacs.length} publicadas</p></div>
            <div className="list">
              {vacs.map((v) => (
                <div className="item" key={v.id}>
                  <div className="item-h"><strong>{v.puesto}</strong><span className="pill info">{v.area}</span></div>
                  <div className="meta"><span>{v.zona}</span><span className="mono">{money(v.smin)}–{money(v.smax)}/mes</span><span>{v.tipo}</span><span>{v.horario}</span></div>
                  <div className="meta"><span>{[...v.prest, v.comedor ? 'Comedor' : '', v.transporte ? 'Transporte' : ''].filter(Boolean).join(' · ')}</span>{v.incluyente && <span className="pill lea">Vacante incluyente</span>}</div>
                  {c && <div className="actions"><button type="button" className={'btn sm' + (ints.includes(v.id) ? ' primary' : '')} onClick={() => toggleInt(v.id)}>{ints.includes(v.id) ? 'Te interesa ✓' : 'Me interesa'}</button></div>}
                </div>
              ))}
              {!vacs.length && <p className="empty">No hay vacantes publicadas por ahora. Crea tu perfil y te avisamos cuando haya una para ti.</p>}
            </div>
            <p className="hint">El nombre de la empresa se da a conocer cuando avanzas en el proceso.</p>
          </section>
          {c && <ContactCard tipo="Candidato" nombre={c.nombre} tel={c.tel} candidateId={c.id} />}
          {c && <ServicesCard tipo="Candidato" nombre={c.nombre} tel={c.tel} candidateId={c.id} />}
          {c && <DeleteAccount onDeleted={onDeleted} />}
        </div>
      </div>
    </>
  );
}

function TestCard({ estado, permiso, onDone }: { estado: string | null; permiso: boolean; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [ans, setAns] = useState<number[]>(Array(20).fill(0));
  const [busy, setBusy] = useState(false);
  const done = ans.filter(Boolean).length;
  const enviar = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('submit_test', { p_answers: ans });
    setBusy(false);
    if (error) return toast('No se pudieron enviar: ' + error.message, true);
    toast('Respuestas enviadas. ¡Gracias!');
    onDone();
  };
  return (
    <section className="card">
      <div className="card-h"><h3>Mis pruebas</h3>{estado === 'completada' ? <span className="pill ok">Completada</span> : estado === 'asignada' ? <span className="pill warn">Pendiente</span> : null}</div>
      {estado === 'completada' && <p>Gracias. Tus respuestas ya llegaron a Factor-Gente. Si tu perfil encaja con una vacante, te contactaremos para las siguientes pruebas en línea.</p>}
      {!estado && <p className="empty">Por ahora no tienes pruebas. Factor-Gente te asigna una cuando tu perfil encaja con una vacante{permiso ? '' : ' y si diste permiso en "Privacidad y permisos"'}.</p>}
      {estado === 'asignada' && !open && (
        <>
          <p><b>Cuestionario de personalidad</b> · 20 frases · unos 5 minutos.</p>
          <p className="hint">No hay respuestas buenas ni malas. Contesta cómo eres normalmente, no cómo te gustaría ser.</p>
          <div className="actions"><button type="button" className="btn primary" onClick={() => setOpen(true)}>Empezar</button></div>
        </>
      )}
      {estado === 'asignada' && open && (
        <>
          <div className="progress" style={{ ['--w' as string]: `${(done / 20) * 100}%` }}><i /></div>
          <p className="hint mono">{done} de 20</p>
          <div>{ITEMS.map((t, i) => (
            <div className="q" key={i}><p>{i + 1}. {t}</p>
              <div className="scale" role="group" aria-label={`Respuesta ${i + 1}`}>
                {SCALE.map((sc, k) => (
                  <button type="button" key={sc} aria-pressed={ans[i] === k + 1} onClick={() => setAns(ans.map((a, j) => (j === i ? k + 1 : a)))}>{sc}</button>
                ))}
              </div>
            </div>
          ))}</div>
          <div className="actions"><button type="button" className="btn primary" disabled={done < 20 || busy} onClick={enviar}>Enviar respuestas</button>
            <span className="hint">Basado en el Mini-IPIP, cuestionario de uso libre con respaldo científico.</span></div>
        </>
      )}
    </section>
  );
}

function DeleteAccount({ onDeleted }: { onDeleted: () => void }) {
  const [ask, setAsk] = useState(false);
  const borrar = async () => {
    const { error } = await supabase.rpc('delete_my_account');
    if (error) return toast('No se pudo borrar: ' + error.message, true);
    await supabase.auth.signOut();
    toast('Tu cuenta y tus datos se borraron.');
    onDeleted();
  };
  return (
    <section className="card">
      <h3>Tu cuenta</h3>
      {!ask ? (
        <div className="actions"><button type="button" className="btn sm danger" onClick={() => setAsk(true)}>Borrar mi cuenta y mis datos</button></div>
      ) : (
        <div className="confirm" role="alert"><b>¿Seguro que quieres borrar tu cuenta?</b><span>Se borran tu perfil, tus pruebas y tus postulaciones. No se puede deshacer.</span>
          <div className="actions"><button type="button" className="btn sm danger fill" onClick={borrar}>Sí, borrar todo</button><button type="button" className="btn sm" onClick={() => setAsk(false)}>Cancelar</button></div></div>
      )}
    </section>
  );
}
