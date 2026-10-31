import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { HAB, SERVICIOS, fmtDate, norm } from './lib/catalog';
import { supabase } from './lib/supabase';
import type { Mensaje } from './lib/types';

export function toast(msg: string, err = false) {
  const box = document.getElementById('toasts');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast-msg' + (err ? ' err' : '');
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 82 80" aria-hidden="true">
      <path d="M15 48 L32 65" stroke="var(--on-brand)" strokeWidth="14" strokeLinecap="round" fill="none" />
      <circle cx="14" cy="27" r="10" fill="var(--on-brand)" />
      <path d="M32 65 L60 33" stroke="var(--brand-accent)" strokeWidth="14" strokeLinecap="round" fill="none" />
      <circle cx="67" cy="13" r="10" fill="var(--brand-accent)" />
    </svg>
  );
}

export function F({ label, hint, children, wide }: { label: ReactNode; hint?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <label className="f" style={wide ? { gridColumn: '1 / -1' } : undefined}>
      {label}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

export function Sel({ value, onChange, options, id }: { value: string; onChange: (v: string) => void; options: string[]; id?: string }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => <option key={o}>{o}</option>)}
    </select>
  );
}

export function Radios({ value, onChange, options, name }: { value: string; onChange: (v: string) => void; options: string[]; name: string }) {
  return (
    <div className="radios">
      {options.map((o) => (
        <label key={o}><input type="radio" name={name} checked={value === o} onChange={() => onChange(o)} /> {o}</label>
      ))}
    </div>
  );
}

export function Checks({ value, onChange, options, inline = true }: { value: string[]; onChange: (v: string[]) => void; options: string[]; inline?: boolean }) {
  return (
    <div className={'checks' + (inline ? ' inline' : '')}>
      {options.map((o) => (
        <label key={o}>
          <input type="checkbox" checked={value.includes(o)} onChange={(e) => onChange(e.target.checked ? [...value, o] : value.filter((x) => x !== o))} /> {o}
        </label>
      ))}
    </div>
  );
}

export function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> <span>{children}</span></label>
  );
}

// Habilidades del área + las que la persona escriba
export function Skills({ area, value, onChange, ejemplo }: { area: string; value: string[]; onChange: (v: string[]) => void; ejemplo: string }) {
  const [otra, setOtra] = useState('');
  const todas = Object.values(HAB).flat().map(norm);
  const propias = value.filter((h) => !todas.includes(norm(h)));
  const lista = [...(HAB[area] ?? []), ...propias];
  const has = (h: string) => value.some((s) => norm(s) === norm(h));
  const toggle = (h: string) => onChange(has(h) ? value.filter((s) => norm(s) !== norm(h)) : [...value, h]);
  const agregar = () => {
    const nuevas = otra.split(',').map((s) => s.trim()).filter((s) => s && !has(s));
    if (nuevas.length) onChange([...value, ...nuevas]);
    setOtra('');
  };
  return (
    <div className="skills">
      <div className="chips">
        {lista.map((h) => (
          <button type="button" key={h} className="chip" aria-pressed={has(h)} onClick={() => toggle(h)}>{h}</button>
        ))}
      </div>
      <div className="add-hab">
        <input type="text" value={otra} placeholder={`Otra habilidad, ej. ${ejemplo}`} aria-label="Agregar otra habilidad"
          onChange={(e) => setOtra(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregar(); } }} />
        <button type="button" className="btn sm" onClick={agregar}>Agregar</button>
      </div>
      <span className="hint">Puedes escribir varias separadas por coma.</span>
    </div>
  );
}

export function ServicesCard({ tipo, nombre, tel, candidateId, companyId }: { tipo: 'Candidato' | 'Empresa'; nombre: string; tel: string; candidateId?: string; companyId?: string }) {
  const [sv, setSv] = useState<string[]>([]);
  const [t, setT] = useState(tel);
  const [via, setVia] = useState('WhatsApp');
  const [busy, setBusy] = useState(false);
  const enviar = async () => {
    if (!sv.length) return toast('Elige al menos un servicio.', true);
    if (!t.trim()) return toast('Escribe tu WhatsApp o teléfono para poder contactarte.', true);
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from('leads').insert({
      user_id: u.user?.id, nombre: nombre || tipo, tipo, servicios: sv, via, tel: t.trim(),
      candidate_id: candidateId ?? null, company_id: companyId ?? null,
    });
    setBusy(false);
    if (error) return toast('No se pudo enviar: ' + error.message, true);
    setSv([]);
    toast('Listo. Te contactaremos pronto.');
  };
  return (
    <section className="card services">
      <h3>¿Quieres conocer más servicios de la consultora?</h3>
      <p className="hint">Además de reclutamiento, JC Florido ofrece asesoría legal, fiscal, contable y organizacional.</p>
      <Checks value={sv} onChange={setSv} options={SERVICIOS} />
      <F label="Tu WhatsApp o teléfono"><input type="tel" value={t} onChange={(e) => setT(e.target.value)} /></F>
      <F label="¿Cómo prefieres que te contactemos?"><Sel value={via} onChange={setVia} options={['WhatsApp', 'Llamada', 'Correo', 'Mandarme la página web']} /></F>
      <div className="actions"><button type="button" className="btn aqua" disabled={busy} onClick={enviar}>Quiero que me contacten</button></div>
      <p className="hint">Tus datos los recibe solo JC Florido y él te contacta. Mientras tanto puedes visitar <span className="mono">jcflorido.me</span>.</p>
    </section>
  );
}

// Dudas para Factor-Gente: llegan a la bandeja del panel y JC contesta por WhatsApp
export function ContactCard({ tipo, nombre, tel, candidateId, companyId, vacantes = [] }: {
  tipo: 'Candidato' | 'Empresa'; nombre: string; tel: string; candidateId?: string; companyId?: string;
  vacantes?: { id: string; puesto: string }[];
}) {
  const [texto, setTexto] = useState('');
  const [vac, setVac] = useState('');
  const [mios, setMios] = useState<Mensaje[]>([]);
  const [busy, setBusy] = useState(false);
  const cargar = useCallback(async () => {
    const { data } = await supabase.from('mensajes').select('*').order('created_at', { ascending: false }).limit(5);
    setMios((data as Mensaje[]) ?? []);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  const enviar = async () => {
    if (!texto.trim()) return toast('Escribe tu duda o comentario.', true);
    setBusy(true);
    const { error } = await supabase.from('mensajes').insert({
      tipo, nombre, tel, texto: texto.trim(), candidate_id: candidateId ?? null, company_id: companyId ?? null, vacancy_id: vac || null,
    });
    setBusy(false);
    if (error) return toast('No se pudo enviar: ' + error.message, true);
    setTexto(''); setVac('');
    toast('Mensaje enviado. Te respondemos por WhatsApp.');
    cargar();
  };
  return (
    <section className="card contact">
      <h3>¿Tienes una duda? Escríbenos</h3>
      <p className="hint">Te respondemos por WhatsApp al <span className="mono">{tel}</span> el mismo día hábil.</p>
      {vacantes.length > 0 && (
        <F label="¿Sobre qué vacante? (opcional)">
          <select value={vac} onChange={(e) => setVac(e.target.value)}>
            <option value="">General</option>
            {vacantes.map((v) => <option key={v.id} value={v.id}>{v.puesto}</option>)}
          </select>
        </F>
      )}
      <F label="Tu mensaje"><textarea value={texto} placeholder="Escribe aquí tu pregunta" onChange={(e) => setTexto(e.target.value)} /></F>
      <div className="actions"><button type="button" className="btn primary" disabled={busy} onClick={enviar}>Enviar mensaje</button></div>
      {mios.length > 0 && (
        <div className="list">{mios.map((m) => (
          <div className="item" key={m.id}>
            <div className="item-h"><span className="hint">{fmtDate(m.created_at)}</span>{m.atendido ? <span className="pill ok">Respondido</span> : <span className="pill warn">En espera</span>}</div>
            <p>{m.texto}</p>
          </div>
        ))}</div>
      )}
    </section>
  );
}

export function Aviso() {
  return (
    <details>
      <summary>Aviso de privacidad</summary>
      <p><b>Responsable:</b> Factor-Gente, servicio de JC Florido, San Francisco del Rincón, Gto.</p>
      <p><b>Para qué usamos tus datos:</b> buscarte empleo, compararte con vacantes, compartir tu perfil sin tus datos de contacto con empresas que buscan personal y darte seguimiento si te contratan.</p>
      <p><b>Finalidad adicional, a la que puedes negarte:</b> ofrecerte otros servicios de la consultora. Solo lo hacemos si marcas la casilla.</p>
      <p><b>Datos sensibles:</b> si nos dices que tienes una discapacidad, solo lo usamos para vacantes incluyentes y no se comparte sin tu permiso.</p>
      <p><b>Tus derechos:</b> puedes pedir ver, corregir, cancelar u oponerte al uso de tus datos (derechos ARCO), y borrar tu cuenta desde esta misma pantalla. La autoridad en la materia es la Secretaría Anticorrupción y Buen Gobierno, conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares vigente desde el 21 de marzo de 2025.</p>
      <p><b>Seguimiento:</b> cada 60 días te preguntaremos si sigues buscando trabajo.</p>
    </details>
  );
}

export function RefCard({ refs }: { refs: { puesto: string; min: number; max: number; pago: string | null }[] }) {
  return (
    <section className="card">
      <div className="card-h"><h3>Sueldos de referencia en la zona</h3><p>Mensual aproximado</p></div>
      <div className="tbl"><table><thead><tr><th>Puesto</th><th>Rango</th><th>Pago común</th></tr></thead><tbody>
        {refs.map((r) => <tr key={r.puesto}><td>{r.puesto}</td><td className="mono">${r.min.toLocaleString('es-MX')}–${r.max.toLocaleString('es-MX')}</td><td>{r.pago}</td></tr>)}
      </tbody></table></div>
      <p className="hint">Referencia aproximada para SFR, Purísima y León. Se actualiza con las vacantes y colocaciones reales.</p>
    </section>
  );
}
