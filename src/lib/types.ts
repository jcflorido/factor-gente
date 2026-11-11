export interface Res { C: number; S: number; A: number; E: number; I: number }

export interface Candidate {
  id: string; user_id: string | null; asistido: boolean;
  nombre: string; edad: number; sexo: string; tel: string; correo: string | null;
  municipio: string; colonia: string | null; esco: string | null;
  area: string; puesto: string | null; funciones: string | null; habilidades: string[]; carta: string | null;
  ult_puesto: string | null; ult_empresa: string | null; ult_funciones: string | null; ult_tiempo: string | null;
  ult_sueldo: number | null; ult_salida: string | null; ult_tipo: string | null;
  pmin: number | null; pmax: number | null; tipo_pref: string | null; horario: string | null; disp: string | null;
  transp: string | null; mov: string[]; inclusion: boolean; ajuste: string | null;
  consent_aviso: boolean; consent_compartir: boolean; consent_pruebas: boolean; consent_servicios: boolean;
  estado: string; notas: string | null; origen: string | null; created_at: string;
}

export interface Company { id: string; user_id: string; nombre: string; giro: string | null; contacto: string | null; tel: string | null; requiere_anticipo: boolean; origen: string | null; created_at: string }
export interface Mensaje {
  id: string; candidate_id: string | null; company_id: string | null; vacancy_id: string | null;
  tipo: string; nombre: string; tel: string; texto: string; atendido: boolean; created_at: string;
}
export interface Tarifas { cuota_operativo: number; meses_admin: number; anticipo_pct: number; plazo_dias: number; garantia_dias: number }
export interface Staff { user_id: string | null; email: string; rol: string; pendiente: boolean }
export interface Cobro {
  id: string; company_id: string; vacancy_id: string | null; candidate_id: string | null;
  concepto: string; monto: number; vence: string | null; pagado: string | null; created_at: string;
}

export interface Vacancy {
  id: string; company_id: string; puesto: string; area: string; n: number; zona: string; funciones: string;
  esco: string | null; exp: string | null; habilidades: string[]; tipo: string | null; smin: number | null; smax: number | null;
  horario: string | null; prest: string[]; transporte: boolean; comedor: boolean; incluyente: boolean;
  salidas: number; motivo: string | null; sexo: string; edad_min: number | null; edad_max: number | null; just: string | null;
  pub: string; acepta: boolean; estado: string; anticipo_pagado: boolean; created_at: string;
}

export interface Test { candidate_id: string; estado: string; res: Res | null; assigned_at: string; completed_at: string | null }
export interface Shortlist { vacancy_id: string; candidate_id: string; enviado: boolean; quiere: boolean; liberado: boolean; cita: string | null; lugar: string | null; created_at: string }
export interface Placement { candidate_id: string; vacancy_id: string; ingreso: string; c30: boolean | null; c60: boolean | null; c90: boolean | null }
export interface Interest { candidate_id: string; vacancy_id: string }
export interface Lead { id: string; nombre: string; tipo: string; servicios: string[]; via: string | null; tel: string; created_at: string }
export interface RefSalary { id: number; puesto: string; kw: string[]; min: number; max: number; pago: string | null; orden: number }

export interface PublicVacancy {
  id: string; puesto: string; area: string; zona: string; smin: number | null; smax: number | null; tipo: string | null;
  horario: string | null; prest: string[]; comedor: boolean; transporte: boolean; incluyente: boolean; created_at: string;
}

export interface Terna {
  vacancy_id: string; candidate_id: string; letra: number; quiere: boolean; liberado: boolean;
  nombre: string | null; tel: string | null; ult_puesto: string | null; ult_tiempo: string | null; esco: string | null;
  pmin: number | null; pmax: number | null; tipo_pref: string | null; disp: string | null;
  mov: string[]; habilidades: string[]; carta: string | null; res: Res | null;
  cita: string | null; lugar: string | null;
}
