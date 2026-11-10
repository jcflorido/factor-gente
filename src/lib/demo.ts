// Datos de ejemplo para que el equipo vea las pantallas de candidato y empresa (no se guardan)
import { todayIso } from './catalog';
import type { Candidate, Cobro, Company, Terna, Vacancy } from './types';

const hoy = todayIso();

export const DEMO_CAND: Candidate = {
  id: 'demo-cand', user_id: null, asistido: false, nombre: 'Rosa Elena Muñoz (ejemplo)', edad: 31, sexo: 'Mujer',
  tel: '476 000 0000', correo: null, municipio: 'San Francisco del Rincón', colonia: 'Centro', esco: 'Secundaria',
  area: 'Operativo', puesto: 'Pespuntadora', funciones: 'Pespunte de cortes en máquina de poste y plana, revisión de costuras.',
  habilidades: ['Pespunte', 'Máquina de coser', 'Control de calidad'], carta: null,
  ult_puesto: 'Pespuntadora', ult_empresa: 'Taller familiar', ult_funciones: 'Pespunte de botín, 300 pares por semana.',
  ult_tiempo: '1 a 3 años', ult_sueldo: 9500, ult_salida: 'Horario', ult_tipo: 'Destajo',
  pmin: 10500, pmax: 12000, tipo_pref: 'Destajo', horario: 'Matutino', disp: 'Inmediata', transp: 'No',
  mov: ['San Francisco del Rincón', 'Purísima del Rincón'], inclusion: false, ajuste: null,
  consent_aviso: true, consent_compartir: true, consent_pruebas: true, consent_servicios: false,
  estado: 'Disponible', notas: null, created_at: hoy,
};

export const DEMO_CO: Company = {
  id: 'demo-co', user_id: 'demo', nombre: 'Calzado de Ejemplo', giro: 'Fabricante de calzado de dama',
  contacto: 'Lic. Gabriela Ruiz', tel: '476 000 0100', requiere_anticipo: true, created_at: hoy,
};

export const DEMO_VAC: Vacancy = {
  id: 'demo-vac', company_id: 'demo-co', puesto: 'Pespuntadora', area: 'Operativo', n: 2, zona: 'San Francisco del Rincón',
  funciones: 'Pespunte de bota y botín en máquina de poste.', esco: 'Primaria', exp: '1 año', habilidades: ['Pespunte', 'Máquina de coser'],
  tipo: 'Destajo', smin: 10000, smax: 12500, horario: 'Matutino', prest: ['IMSS', 'Bono de puntualidad'], transporte: false, comedor: true,
  incluyente: false, salidas: 3, motivo: 'Sueldo', sexo: 'Indistinto', edad_min: null, edad_max: null, just: null,
  pub: 'anonima', acepta: true, estado: 'Terna enviada', anticipo_pagado: true, created_at: hoy,
};

const res = { C: 82, S: 70, A: 74, E: 48, I: 55 };
export const DEMO_TERNAS: Terna[] = [
  {
    vacancy_id: 'demo-vac', candidate_id: 'demo-a', letra: 1, quiere: false, liberado: false, nombre: null, tel: null,
    ult_puesto: 'Pespuntadora', ult_tiempo: '1 a 3 años', esco: 'Secundaria', pmin: 10500, pmax: 12000, tipo_pref: 'Destajo',
    disp: 'Inmediata', mov: ['San Francisco del Rincón', 'Purísima del Rincón'], habilidades: ['Pespunte', 'Máquina de coser'],
    carta: null, res, cita: null, lugar: null,
  },
  {
    vacancy_id: 'demo-vac', candidate_id: 'demo-b', letra: 2, quiere: true, liberado: false, nombre: 'María López (ejemplo)', tel: null,
    ult_puesto: 'Pespuntadora', ult_tiempo: '3 años o más', esco: 'Primaria', pmin: 11000, pmax: 12500, tipo_pref: 'Cualquiera',
    disp: '15 días', mov: ['San Francisco del Rincón'], habilidades: ['Pespunte', 'Control de calidad'],
    carta: null, res: { C: 76, S: 66, A: 70, E: 60, I: 50 }, cita: new Date(Date.now() + 2 * 864e5).toISOString(), lugar: 'Recepción de la planta',
  },
];

export const DEMO_COBROS: Cobro[] = [
  { id: 'demo-cobro', company_id: 'demo-co', vacancy_id: 'demo-vac', candidate_id: null, concepto: 'Anticipo', monto: 1500, vence: hoy, pagado: hoy, created_at: hoy },
];
