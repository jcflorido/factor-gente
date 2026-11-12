import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isConfigured, supabase } from './lib/supabase';
import { CandidatoHome } from './Candidato';
import { EmpresaHome } from './Empresa';
import { Panel } from './Panel';
import { money } from './lib/catalog';
import type { PublicVacancy } from './lib/types';
import { F, Logo, toast } from './ui';

type Role = 'candidato' | 'empresa' | 'admin' | 'reclutador';
type Vista = 'panel' | 'candidato' | 'empresa';

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [recovery, setRecovery] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const [vista, setVista] = useState<Vista>('panel');

  useEffect(() => {
    if (!isConfigured) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Quién es: anónimo = candidato; con correo = equipo (administrador o reclutador) o empresa
  useEffect(() => {
    setRole(null);
    setVista('panel');
    const u = session?.user;
    if (!u) return;
    if (u.is_anonymous) { setRole('candidato'); return; }
    supabase.from('admins').select('rol').eq('user_id', u.id).maybeSingle()
      .then(({ data }) => {
        const r = (data as { rol: string } | null)?.rol;
        setRole(r === 'reclutador' ? 'reclutador' : r ? 'admin' : 'empresa');
      });
  }, [session?.user?.id, session?.user?.is_anonymous]);

  if (!isConfigured) return <Shell><div className="intro"><h2>Falta conectar la base de datos</h2><p>Configura la URL y la llave pública de Supabase.</p></div></Shell>;
  if (session === undefined) return <Shell><p className="empty">Cargando…</p></Shell>;
  if (recovery && session) return <Shell><NewPassword done={() => setRecovery(false)} /></Shell>;
  if (!session) return <Shell><Landing /></Shell>;
  if (!role) return <Shell><p className="empty">Cargando…</p></Shell>;

  const salir = async () => { await supabase.auth.signOut(); };
  const equipo = role === 'admin' || role === 'reclutador';
  const label = role === 'admin' ? 'Panel JC' : role === 'reclutador' ? 'Reclutador' : role === 'empresa' ? 'Empresa' : 'Candidato';
  return (
    <Shell right={<>
      {equipo && (
        <nav className="seg" aria-label="Ver pantalla">
          {([['panel', label], ['candidato', 'Candidato'], ['empresa', 'Empresa']] as [Vista, string][]).map(([v, t]) => (
            <button type="button" key={v} aria-pressed={vista === v} onClick={() => setVista(v)}>{t}</button>
          ))}
        </nav>
      )}
      {!equipo && <span className="role-tag">{label}</span>}
      {role !== 'candidato' && <button type="button" className="btn sm ghost" onClick={salir}>Salir</button>}
    </>}>
      {equipo && vista !== 'panel' && (
        <div className="banner"><span><b>Vista previa.</b> Así ve la app {vista === 'candidato' ? 'un candidato' : 'una empresa'}. Los datos son de ejemplo y nada de lo que hagas aquí se guarda.</span>
          <button type="button" className="btn sm" onClick={() => setVista('panel')}>Volver a mi panel</button></div>
      )}
      {equipo && vista === 'panel' && <Panel rol={role} userId={session.user.id} />}
      {equipo && vista === 'candidato' && <CandidatoHome userId={session.user.id} preview onDeleted={() => setVista('panel')} />}
      {equipo && vista === 'empresa' && <EmpresaHome userId={session.user.id} preview />}
      {role === 'empresa' && <EmpresaHome userId={session.user.id} />}
      {role === 'candidato' && <CandidatoHome userId={session.user.id} onDeleted={() => setSession(null)} />}
    </Shell>
  );
}

function Shell({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <>
      <header><div className="wrap bar">
        <div className="brand"><Logo /><h1>Factor<b>·</b>Gente</h1><small>Bolsa de trabajo con filtro</small></div>
        {right && <div className="bar-right">{right}</div>}
      </div></header>
      <main className="wrap">{children}</main>
    </>
  );
}

function Landing() {
  const [modo, setModo] = useState<'inicio' | 'correo'>('inicio');
  const [busy, setBusy] = useState(false);
  const [vacs, setVacs] = useState<PublicVacancy[]>([]);
  useEffect(() => { supabase.rpc('public_vacancies').then(({ data }) => setVacs((data as PublicVacancy[]) ?? [])); }, []);
  const empezar = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInAnonymously();
    setBusy(false);
    if (error) toast('No se pudo iniciar: ' + error.message, true);
  };
  if (modo === 'correo') return <EmailAuth onBack={() => setModo('inicio')} />;
  return (
    <div className="landing">
      <div className="hero">
        <span className="eyebrow">San Francisco del Rincón · Purísima · León</span>
        <h2>La persona correcta en el trabajo correcto</h2>
        <p>Factor-Gente revisa cada perfil y le presenta a las empresas solo a quien encaja. Así hay menos rotación y mejores trabajos.</p>
      </div>
      <div className="choices">
        <button type="button" className="choice" disabled={busy} onClick={empezar}>
          <b>Busco trabajo</b><span>Regístrate gratis desde tu celular en unos 5 minutos. No necesitas correo.</span></button>
        <button type="button" className="choice alt" onClick={() => setModo('correo')}>
          <b>Soy empresa</b><span>Solicita personal y recibe una terna de candidatos filtrados. Registrarte y publicar vacantes no tiene costo.</span></button>
      </div>
      <p className="hint center">¿Ya tienes cuenta de empresa o eres administrador? <button type="button" className="link" onClick={() => setModo('correo')}>Entrar con correo</button></p>

      {vacs.length > 0 && (
        <section className="card">
          <div className="card-h"><h3>Vacantes disponibles</h3><p>{vacs.length} {vacs.length === 1 ? 'publicada' : 'publicadas'}</p></div>
          <div className="list">
            {vacs.slice(0, 8).map((v) => (
              <div className="item" key={v.id}>
                <div className="item-h"><strong>{v.puesto}</strong><span className="pill info">{v.area}</span></div>
                <div className="meta"><span>{v.zona}</span><span className="mono">{money(v.smin)}–{money(v.smax)}/mes</span><span>{v.tipo}</span><span>{v.horario}</span></div>
                {v.incluyente && <div className="meta"><span className="pill lea">Vacante incluyente</span></div>}
              </div>
            ))}
          </div>
          {vacs.length > 8 && <p className="hint">Y {vacs.length - 8} más dentro de la app.</p>}
          <div className="actions"><button type="button" className="btn primary" disabled={busy} onClick={empezar}>Regístrate gratis para postularte</button></div>
          <p className="hint">El nombre de la empresa se da a conocer cuando avanzas en el proceso.</p>
        </section>
      )}

      <p className="hint center"><a href="/aviso-de-privacidad.pdf" target="_blank" rel="noopener">Aviso de privacidad</a></p>
    </div>
  );
}

function EmailAuth({ onBack }: { onBack: () => void }) {
  const [crear, setCrear] = useState(false);
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || pass.length < 6) return toast('Escribe tu correo y una contraseña de al menos 6 caracteres.', true);
    setBusy(true);
    const r = crear
      ? await supabase.auth.signUp({ email: email.trim(), password: pass })
      : await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
    setBusy(false);
    if (r.error) return toast(r.error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos.' : r.error.message, true);
    if (crear && !r.data.session) toast('Revisa tu correo para confirmar la cuenta.');
  };
  const olvide = async () => {
    if (!email.trim()) return toast('Escribe tu correo primero.', true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    if (error) return toast(error.message, true);
    toast('Te enviamos un correo para cambiar tu contraseña.');
  };
  return (
    <form className="card narrow" onSubmit={enviar} noValidate>
      <h2>{crear ? 'Crear cuenta de empresa' : 'Entrar con correo'}</h2>
      <F label="Correo"><input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></F>
      <F label="Contraseña" hint={crear ? 'Mínimo 6 caracteres.' : undefined}><input type="password" autoComplete={crear ? 'new-password' : 'current-password'} value={pass} onChange={(e) => setPass(e.target.value)} /></F>
      <div className="actions">
        <button type="submit" className="btn primary" disabled={busy}>{crear ? 'Crear cuenta' : 'Entrar'}</button>
        <button type="button" className="link" onClick={() => setCrear(!crear)}>{crear ? 'Ya tengo cuenta' : 'Crear cuenta de empresa'}</button>
        {!crear && <button type="button" className="link" onClick={olvide}>Olvidé mi contraseña</button>}
      </div>
      <button type="button" className="link" onClick={onBack}>← Volver</button>
    </form>
  );
}

function NewPassword({ done }: { done: () => void }) {
  const [pass, setPass] = useState('');
  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pass.length < 6) return toast('Mínimo 6 caracteres.', true);
    const { error } = await supabase.auth.updateUser({ password: pass });
    if (error) return toast(error.message, true);
    toast('Contraseña actualizada.');
    done();
  };
  return (
    <form className="card narrow" onSubmit={guardar} noValidate>
      <h2>Nueva contraseña</h2>
      <F label="Contraseña nueva"><input type="password" autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} /></F>
      <div className="actions"><button type="submit" className="btn primary">Guardar</button></div>
    </form>
  );
}
