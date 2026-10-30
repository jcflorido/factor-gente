import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isConfigured, supabase } from './lib/supabase';
import { CandidatoHome } from './Candidato';
import { EmpresaHome } from './Empresa';
import { Panel } from './Panel';
import { F, Logo, toast } from './ui';

type Role = 'candidato' | 'empresa' | 'admin';

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [recovery, setRecovery] = useState(false);
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    if (!isConfigured) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Quién es: anónimo = candidato; con correo = administrador o empresa
  useEffect(() => {
    setRole(null);
    const u = session?.user;
    if (!u) return;
    if (u.is_anonymous) { setRole('candidato'); return; }
    supabase.from('admins').select('user_id').eq('user_id', u.id).maybeSingle()
      .then(({ data }) => setRole(data ? 'admin' : 'empresa'));
  }, [session?.user?.id, session?.user?.is_anonymous]);

  if (!isConfigured) return <Shell><div className="intro"><h2>Falta conectar la base de datos</h2><p>Configura la URL y la llave pública de Supabase.</p></div></Shell>;
  if (session === undefined) return <Shell><p className="empty">Cargando…</p></Shell>;
  if (recovery && session) return <Shell><NewPassword done={() => setRecovery(false)} /></Shell>;
  if (!session) return <Shell><Landing /></Shell>;
  if (!role) return <Shell><p className="empty">Cargando…</p></Shell>;

  const salir = async () => { await supabase.auth.signOut(); };
  const label = role === 'admin' ? 'Panel JC' : role === 'empresa' ? 'Empresa' : 'Candidato';
  return (
    <Shell right={<>
      <span className="role-tag">{label}</span>
      {role !== 'candidato' && <button type="button" className="btn sm ghost" onClick={salir}>Salir</button>}
    </>}>
      {role === 'admin' && <Panel />}
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
          <b>Soy empresa</b><span>Solicita personal y recibe una terna de candidatos filtrados. Solo pagas si contratas.</span></button>
      </div>
      <p className="hint center">¿Ya tienes cuenta de empresa o eres administrador? <button type="button" className="link" onClick={() => setModo('correo')}>Entrar con correo</button></p>
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
