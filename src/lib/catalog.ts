import type { Candidate, RefSalary, Res, Tarifas, Vacancy } from './types';

export const TARIFAS_BASE: Tarifas = { cuota_operativo: 2500, meses_admin: 1, anticipo_pct: 30, plazo_dias: 7, garantia_dias: 30 };

// Cuota por persona colocada: fija en operativo; en administrativo y supervisión, meses del sueldo ofrecido (punto medio del rango)
export function cuota(v: Pick<Vacancy, 'area' | 'smin' | 'smax'>, t: Tarifas): number {
  if (v.area === 'Operativo') return t.cuota_operativo;
  const lo = v.smin ?? v.smax ?? 0, hi = v.smax ?? v.smin ?? 0;
  return Math.round((t.meses_admin * (lo + hi)) / 2);
}
export const anticipoDe = (v: Pick<Vacancy, 'area' | 'smin' | 'smax' | 'n'>, t: Tarifas) => Math.round((cuota(v, t) * v.n * t.anticipo_pct) / 100);
export const fmtCita = (iso: string) => new Date(iso).toLocaleString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
export const plusDays = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };

export const HAB: Record<string, string[]> = {
  Operativo: ['Corte', 'Preparado', 'Pespunte', 'Montado', 'Adorno', 'Acabado', 'Empaque', 'Máquina de coser', 'Inyección de suela', 'Control de calidad', 'Almacén', 'Montacargas', 'Mantenimiento', 'Chofer / reparto', 'Limpieza'],
  Administrativo: ['Excel', 'Facturación', 'CONTPAQi', 'Contabilidad general', 'Nómina', 'Cobranza', 'Compras', 'Ventas', 'Atención a clientes', 'Inventarios', 'Logística', 'Recursos humanos', 'Redes sociales', 'Diseño gráfico'],
  'Supervisión': ['Manejo de personal', 'Planeación de producción', 'Indicadores de producción', 'Control de calidad', 'Seguridad e higiene', 'Capacitación', 'Mejora continua / 5S', 'Solución de problemas', 'Reportes en Excel', 'Manejo de turnos'],
};
export const AREAS = Object.keys(HAB);
export const AREA_HINT = 'Operativo: producción, almacén, mantenimiento, limpieza. Administrativo: oficina, contabilidad, ventas, RH. Supervisión: jefe de línea, supervisor, encargado de turno o de área.';
export const MUNI = ['San Francisco del Rincón', 'Purísima del Rincón', 'León', 'Manuel Doblado', 'Romita', 'Silao'];
export const ESCO = ['Primaria', 'Secundaria', 'Preparatoria / bachillerato', 'Carrera técnica', 'Licenciatura', 'Posgrado'];
export const SALIDA = ['Terminó contrato', 'Mejor oferta', 'Horario', 'Distancia / transporte', 'Problemas con jefe', 'Cierre o recorte', 'Motivos personales'];
export const PAGO = ['Semanal fijo', 'Destajo', 'Mixto (base + destajo)', 'Quincenal o mensual'];
export const TRANSP = ['No', 'Bicicleta', 'Moto', 'Auto'];
export const TIEMPO = ['Menos de 6 meses', '6 a 12 meses', '1 a 3 años', '3 años o más'];
export const HORARIO = ['Matutino', 'Vespertino', 'Mixto', 'Cualquiera'];
export const DISP = ['Inmediata', '15 días', '1 mes'];
export const PREST = ['IMSS', 'Aguinaldo superior a ley', 'Vales de despensa', 'Bono de puntualidad', 'Caja de ahorro'];
export const SERVICIOS = ['Legal', 'Fiscal', 'Contable', 'Organizacional'];
export const ESTADOS = ['Disponible', 'En proceso', 'Colocado', 'Inactivo'];

// Mini-IPIP (Donnellan et al., 2006), reactivos IPIP de dominio público. Traducción de trabajo al español.
// La calificación se hace en el servidor (función submit_test).
export const ITEMS = [
  'Soy el alma de la fiesta.',
  'Me pongo en el lugar de los demás y comprendo lo que sienten.',
  'Hago mis pendientes en cuanto puedo.',
  'Mi estado de ánimo cambia con frecuencia.',
  'Tengo una imaginación muy viva.',
  'No hablo mucho.',
  'No me interesan los problemas de otras personas.',
  'Seguido olvido regresar las cosas a su lugar.',
  'Estoy tranquilo(a) la mayor parte del tiempo.',
  'No me interesan las ideas abstractas.',
  'En reuniones platico con muchas personas distintas.',
  'Siento las emociones de los demás.',
  'Me gusta el orden.',
  'Me altero con facilidad.',
  'Me cuesta entender ideas abstractas.',
  'Prefiero pasar desapercibido(a).',
  'Realmente no me intereso por los demás.',
  'Suelo hacer las cosas con desorden.',
  'Rara vez me siento triste.',
  'No tengo mucha imaginación.',
];
export const SCALE = ['Muy en desacuerdo', 'En desacuerdo', 'Ni sí ni no', 'De acuerdo', 'Muy de acuerdo'];
export const TRAITS: [keyof Res, string][] = [['C', 'Responsabilidad'], ['S', 'Estabilidad emocional'], ['A', 'Amabilidad'], ['E', 'Extroversión'], ['I', 'Apertura / imaginación']];

export function perfilTexto(r: Res | null | undefined): string {
  if (!r) return '';
  const t: string[] = [];
  if (r.C >= 70) t.push('constante y ordenado'); else if (r.C < 40) t.push('le cuesta la constancia');
  if (r.S >= 65) t.push('mantiene la calma');
  if (r.A >= 70) t.push('buen trato');
  if (r.E >= 65) t.push('sociable'); else if (r.E < 35) t.push('reservado');
  if (r.I >= 70) t.push('propone ideas');
  return t.length ? t.join(' · ') : 'perfil equilibrado';
}

export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
export const money = (n: number | null | undefined) => (n ? '$' + Number(n).toLocaleString('es-MX') : '—');
export const fmtDate = (s: string) => new Date(s.length === 10 ? s + 'T00:00:00' : s).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
export const todayIso = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
export const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso + 'T00:00:00').getTime()) / 864e5);

export const refFor = (puesto: string, refs: RefSalary[]) => refs.find((r) => r.kw.some((k) => norm(puesto).includes(norm(k))));
export const llega = (c: Candidate, v: Vacancy) => c.mov.includes(v.zona);
export const isInc = (c: Candidate) => c.inclusion || c.edad >= 60;

export function match(c: Candidate, v: Vacancy, res: Res | null | undefined): number {
  if (c.area !== v.area) return 0;
  let s = 35;
  const ch = c.habilidades.map(norm);
  const ov = v.habilidades.filter((h) => ch.includes(norm(h))).length;
  s += v.habilidades.length ? (25 * ov) / v.habilidades.length : 25;
  const pmin = c.pmin ?? 0, pmax = c.pmax ?? pmin, smin = v.smin ?? 0, smax = v.smax ?? Infinity;
  if (pmin <= smax && pmax >= smin) s += 20; else if (pmin <= smax * 1.1) s += 8;
  if (v.horario === 'Cualquiera' || c.horario === 'Cualquiera' || c.horario === v.horario) s += 10;
  if (res) s += (10 * res.C) / 100;
  if (!llega(c, v)) s -= v.transporte || (c.transp && c.transp !== 'No') ? 8 : 20;
  if (v.incluyente && isInc(c)) s += 5;
  return Math.max(1, Math.round(Math.min(s, 100)));
}

export function pasaInterno(c: Candidate, v: Vacancy): boolean {
  if (v.sexo !== 'Indistinto' && c.sexo !== v.sexo) return false;
  if (v.edad_min && c.edad < v.edad_min) return false;
  if (v.edad_max && c.edad > v.edad_max) return false;
  return true;
}
