# Factor-Gente · Pendientes

## Próximo combo

### 1. Pruebas psicométricas pagadas (servicio extra)
- Casilla opcional en la vacante: "Aplicar pruebas psicométricas profesionales (+$X por candidato)".
- Precio editable en Tarifas (inicial $500).
- Se cobra por candidato evaluado, aunque la empresa no contrate.
- El cobro se genera cuando JC marca en el panel que ya aplicó la prueba; aparece en "Mis pagos" de la empresa.
- JC sube el PDF del reporte; la empresa lo descarga solo para los candidatos de su terna.
- Nuevo permiso del candidato para compartir el reporte completo (hoy solo autoriza un resumen).
- Por definir: qué plataforma usará JC (PsicoSmart, Psicotest u otra) y su costo por evaluación, para cuidar el margen.

### 2. Chat dentro de la app con notificaciones
- Una conversación por empresa y por candidato con Factor-Gente; JC contesta desde el panel.
- Mensajes en tiempo real (Supabase Realtime).
- Notificaciones push (como en JC-Kayzen): "Factor-Gente te respondió" y aviso a JC cuando alguien escribe.
- En iPhone requiere instalar la app en la pantalla de inicio.
- WhatsApp queda como respaldo.

### 3. Vacantes más visibles: HECHO (2026-11-11), salvo el aviso de vacante nueva
- Falta: avisar al candidato cuando salga una vacante que le queda (usa las notificaciones del punto 2).

### 4. "¿Cómo nos conociste?": HECHO (2026-11-11, migración 0005)

### 4b. Recordatorio cada 60 días
- El aviso de privacidad dice "cada 60 días le preguntaremos si sigue buscando empleo": hoy se hace a mano. Automatizarlo (lista en el panel de perfiles sin actualizar en 60 días, o aviso push con el punto 2).

### 5. Manual de onboarding: HECHO (borrador listo, 2026-11-11)
- `diseno/onboarding/Factor-Gente-manual-integracion-empresa.pdf` (3 págs., con Constancia de integración firmable) y `Factor-Gente-guia-primer-mes.pdf` (1 pág. para el colaborador). Fuente HTML en la misma carpeta.
- Falta: que la app los entregue al marcar "contratado" (enlaces de descarga en "Mis solicitudes" de la empresa y aviso al candidato), y alinear el requisito de la garantía en la app con "envió la Constancia de integración".

### 6. Aviso de privacidad en PDF: HECHO (factorgente.jcflorido.me/aviso-de-privacidad.pdf; fuente en diseno/aviso/)
- Falta el domicilio completo del responsable (hoy solo "San Francisco del Rincón, Gto."): lo da JC o su abogado.

## Antes de cobrar la primera colocación
- Cláusula: los honorarios nunca se descuentan del salario del trabajador.
- Revisión de un abogado del aviso de privacidad y de las condiciones del servicio (incluye los requisitos de la garantía; se decidió NO pedir alta en IMSS como requisito).
- (Registro STPS: pospuesto por decisión de JC, 2026-11-11.)

## Otros
- Después de diciembre, definir la tarifa normal (la de lanzamiento ya está capturada en el panel).
- Versión en español validada del Mini-IPIP; pedir permiso a los autores de ICAR si se quiere prueba de razonamiento.
