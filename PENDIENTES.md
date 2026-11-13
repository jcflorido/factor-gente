# Factor-Gente · Pendientes

## Próximo combo

### 1. Pruebas psicométricas pagadas (servicio extra, opcional para la empresa)
Plataforma: Psicotest. Acordado con JC el 11/11.

**Catálogo** (a la empresa se le muestra el nombre sencillo; el de Psicotest queda interno):
| Nombre para la empresa | Psicotest | Para qué sirve |
|---|---|---|
| Personalidad laboral | CIBAIN | Cómo trabaja la persona y si encaja con el puesto y el equipo |
| Comportamiento en el trabajo | CACTER | Responsabilidad, empeño, constancia y reacción bajo presión |
| Confianza y honestidad | INCEVAL | Reduce el riesgo en puestos que manejan dinero, material o inventario |
| Inteligencia y aprendizaje | CIESMAN | Capacidad para razonar, aprender y crecer |
| Competencias laborales | COMPETIAN | Compara a la persona con lo que pide el puesto y muestra qué le falta |
| Competencias por puesto | COLEIBOR | Habilidades específicas del puesto, con nivel principiante / competente / experto |
| Liderazgo | GENLÍDER | Estilo para dirigir gente, en el día a día y bajo presión |
| Ventas | COEFIV | Habilidad comercial, negociación y tolerancia al rechazo |

**Paquetes recomendados** (la empresa puede marcar otras):
- Operativo: Comportamiento + Confianza.
- Administrativo: Personalidad + Inteligencia + Confianza.
- Supervisor: Liderazgo + Comportamiento + Confianza.
- Ventas: Ventas + Personalidad.

**Costo y precios** (todo editable en Tarifas):
- Costo de JC: paquete de 10 personas = $2,485 con IVA, o sea $248.50 por persona ($214.22 + IVA). A cada persona se le pueden aplicar todas las pruebas o solo algunas: el costo es por persona, no por prueba.
- Precio por candidato evaluado, en 3 niveles:
  - Una prueba: $350 + IVA (pensado para operativos).
  - Paquete del puesto (hasta 3 pruebas): $550 + IVA.
  - Evaluación completa (las 8): $850 + IVA.
- "Me cuesta por persona" es privado (solo el jefe) y la app muestra el margen. Si un nivel no tiene precio, no se muestra. Cada prueba tiene "Activa sí/no".
- Idea opcional: durante la tarifa de lanzamiento, incluir sin costo la prueba de Confianza en ternas de administrativos y supervisores. Lo decide JC.

**Cómo funciona:**
- En la vacante, sección opcional "Pruebas adicionales": la empresa elige nivel y pruebas, y ve el estimado ("3 candidatos × $X = $Y + IVA").
- Se aplican solo a los finalistas de la terna.
- Se cobran por adelantado (se suman al anticipo o se pagan al pedirlas), porque el crédito se gasta aunque la empresa no contrate. No se aplica ninguna prueba hasta que esté pagada. El cobro aparece en "Mis pagos".
- JC sube el PDF del reporte a la ficha del candidato; la empresa lo descarga solo para los de su terna.
- Nuevo permiso del candidato para compartir el reporte completo (hoy solo autoriza un resumen).
- Control de créditos (solo jefe): saldo, fecha de vencimiento (los créditos vencen al año) y aviso cuando queden 2 o falten 30 días. Cada prueba aplicada descuenta 1.
- Recomendación de compra: paquetes de 10 al principio; crecer cuando se vea la demanda real.

### 2. Chat dentro de la app con notificaciones: HECHO (2026-11-12, migración 0006), falta activar el envío push (SETUP 1b)
- Una conversación por empresa y por candidato con Factor-Gente; JC contesta desde el panel.
- Mensajes en tiempo real (Supabase Realtime).
- Notificaciones push (como en JC-Kayzen): "Factor-Gente te respondió" y aviso a JC cuando alguien escribe.
- En iPhone requiere instalar la app en la pantalla de inicio.
- WhatsApp queda como respaldo.

### 2b. "Filtro verificado"
- HECHO (2026-11-12): solicitar documentos (CV, INE, domicilio, IMSS + 3 "Otro"), subida de fotos/PDF con compresión, revisar / pedir otra vez / subirlo el equipo, referencias laborales con registro de llamada, recordatorio manual (resaltado a las 48 h), borrar archivos, aviso de privacidad actualizado.
- HECHO (2026-11-13, migración 0007): entrevista previa (agenda + guía de 6 preguntas 1–5 + resultado), confirmación de condiciones por vacante, sellos en la terna (entrevistado, referencias, IMSS, identidad, confirmó) y regla de no enviar terna sin entrevista (con opción de enviar de todos modos).
- Falta: historial de confiabilidad, evaluación de la empresa, prueba práctica, verificación del WhatsApp, CV automático en PDF, sellos en la terna, recordatorio automático a las 48 h y borrado automático a los 90 días (requieren tarea programada).
Objetivo: que "candidato filtrado" sea comprobable. En la terna la empresa ve sellos:
"Entrevistado ✓ · Referencias verificadas ✓ · Historial IMSS verificado ✓ · Confirmó condiciones ✓".
Prioridad sugerida:
1. Entrevista previa con JC: se agenda desde el chat (llamada, videollamada de WhatsApp, Zoom/Meet o presencial). Guía fija de 5–6 preguntas con calificación 1–5.
2. Referencias laborales: el candidato captura 2 (nombre, empresa, teléfono) y autoriza llamarlas. Guion de 4 preguntas, incluida "¿lo volvería a contratar?". Queda registrado quién llamó y qué dijeron.
3. Documentos: constancia de semanas cotizadas del IMSS (verifica el historial laboral real), INE y comprobante de domicilio. NO pedir antecedentes no penales salvo que el puesto lo justifique.
4. Confirmación de condiciones antes de la terna: el candidato ve sueldo, horario, zona y cómo llegaría, y acepta.
5. Historial de confiabilidad: asistió/faltó a la entrevista, confirmó un día antes, duró o no 30 días. Semáforo interno que baja en "Sugeridos" a quien falla.
6. Evaluación de la empresa después de la entrevista (¿llegó puntual?, ¿cumplió el perfil?).
7. Prueba práctica cuando aplique: cuestionario de oficio para calzado (máquinas, operaciones) o día de prueba pagado; ejercicio corto para administrativos.
8. Verificar el WhatsApp con un código al registrarse.
- Referencias y documentos SOLO a petición de Factor·Gente (decisión de JC, 11/11): nunca bloquean ni alargan el registro. Cuando la vacante avanza, JC abre "Solicitar documentos" en la ficha del candidato:
  - Casillas de cajón, marcadas por defecto: CV, INE, comprobante de domicilio, constancia de semanas del IMSS.
  - CV: muchos operativos no tienen. Si no lo sube, la app arma un "CV Factor·Gente" en PDF con los datos de su perfil (experiencia, último trabajo, habilidades), sin teléfono ni domicilio, listo para la terna.
  - 3 campos "Otro" de texto libre (ej. licencia de manejo, certificado de estudios, carta de recomendación).
  - Casilla "Referencias laborales" (cuántas: 1 a 3).
  - El candidato ve la solicitud en su panel y en el chat, sube lo que pueda; todo es opcional. Recordatorio a las 48 h.
  - Estado por documento en el panel: solicitado / recibido / revisado. El sello en la terna solo aparece si se entregó y JC lo revisó.
  - JC decide si alguien sin documentos entra o no a la terna (la app no lo impide).
- Regla propuesta: no se envía una terna sin al menos la entrevista previa hecha.
- Documentos: se suben a la app (almacenamiento privado de Supabase), no al correo. El plan gratuito incluye 1 GB de archivos (confirmar el límite vigente al construirlo). Con fotos comprimidas (~1 MB por candidato) alcanza para unos 1,000 candidatos; borrado automático 90 días después de la contratación o al cerrar la cuenta. Si algún día se rebasa, el plan Pro cuesta unos 25 USD al mes. Respaldo si no se quiere usar la app: que lo manden a contacto@jcflorido.me.
- Requiere: actualizar el aviso de privacidad (documentos, historial laboral, referencias) y definir el plazo de conservación.

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
