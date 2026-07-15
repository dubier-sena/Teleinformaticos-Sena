// improvement_activities_bank.js — Banco de ACTIVIDADES de plan de mejoramiento.
//
// Para cada actividad de una guía, una tarea de RECUPERACIÓN redactada como base, pensada
// sobre la actividad original (mismo tema, mismo programa/herramienta). Cuando el instructor
// asigna un plan y elige la actividad, esta descripción se pre-rellena en el formulario y él
// la puede ajustar antes de asignar. NO es secreta (el aprendiz la ve en el banner del plan).
//
// Estructura:  familia -> activityId -> "texto de la actividad de recuperación"
//   - familia: la misma de activity_grades.js (guia-02-herramientas, ...).
//   - activityId: el id REAL de la actividad de la guía (ActivityStandard.getActivitiesForGuide).
// Cubre TODAS las guías, actuales y futuras: lo que NO tenga entrada aquí recibe una tarea
// por defecto generada a partir del nombre de la actividad (defaultRemedialTask en
// admin_usuarios.js), siempre editable. Este banco es solo para REDACTAR mejor las que valga
// la pena; agregar una guía nueva NO requiere tocar este archivo.
// La guía Python y el Taller Integrador no tienen entradas a propósito: sus actividades se
// describen bien con la tarea por defecto (ejercicios autoexplicativos / productos por equipo).

window.improvementActivitiesBank = {
  "guia-01-induccion": {
    "arbol312": "Vuelve a elaborar 'El Árbol de la Vida' (Actividad 3.1.2): incluye raíces (valores y origen), tronco (habilidades), ramas (metas) y frutos (logros). Entrega la evidencia corregida y completa.",
    "sopaletras321": "Repite la sopa de letras y el crucigrama SENA (Actividad 3.2.1): encuentra y marca todos los términos institucionales solicitados en la guía. Entrega la evidencia completa.",
    "sena331": "Repite el análisis de los logo-símbolos del SENA (Actividad 3.3.1): explica el significado de cada símbolo y color del logo. Entrega el documento corregido.",
    "programa332": "Vuelve a responder el cuestionario del diseño curricular del programa (Actividad 3.3.2) de forma completa, con tus propias palabras. Entrega las respuestas corregidas.",
    "reglamento333": "Vuelve a desarrollar la actividad del Reglamento del Aprendiz SENA (Actividad 3.3.3): responde sobre derechos, deberes y faltas con tus propias palabras, según el mismo reglamento de la guía. Entrega las respuestas corregidas.",
    "plataformas334": "Repite el taller de plataformas tecnológicas del SENA (Actividad 3.3.4): describe el uso de cada plataforma solicitada en la guía (Sofia Plus, Territorium, correo institucional). Entrega el taller corregido y completo.",
    "compromiso341": "Vuelve a redactar 'Mi Compromiso como Aprendiz SENA' (Actividad 3.4.1): escribe tu compromiso personal con el programa de formación, con tus propias palabras. Entrega el documento corregido.",
    "portafolio342": "Vuelve a organizar el portafolio de evidencias (Actividad 3.4.2): incluye todas las evidencias de la guía en el orden solicitado. Entrega el portafolio corregido y completo.",
  },

  "guia-02-herramientas": {
    "sopaletras311": "Repite la sopa de letras de conceptos básicos (Actividad 3.1.1): encuentra todos los términos de herramientas informáticas indicados en la guía. Entrega la evidencia completa.",
    "relaciona311": "Vuelve a realizar el ejercicio de relacionar cada herramienta con su función (Actividad 3.1.1), con las mismas herramientas de la guía. Entrega el ejercicio corregido.",
    "analisis313": "Vuelve a realizar la bitácora de análisis (Actividad 3.1.3): describe el caso, los síntomas, las posibles causas y el plan de acción. Mantén el mismo caso de la guía. Entrega la bitácora corregida.",
    "matriz322": "Repite la Matriz de Diagnóstico Digital (Actividad 3.2.2) con los mismos criterios de la guía: completa cada fila con su valoración y justificación. Entrega la matriz corregida y completa.",
    "fichaCaso": "Vuelve a diligenciar la Ficha de caso (Actividad 3.2.1) con todos sus campos sobre el mismo caso de la guía. Entrega la ficha corregida.",
    "diagnostico323": "Vuelve a realizar el diagnóstico individual del contexto digital (Actividad 3.2.3): responde todas las preguntas sobre tu propio contexto, de forma completa y honesta. Entrega el diagnóstico corregido.",
    "extensiones331": "Vuelve a completar el cuadro de extensiones de archivo (Actividad 3.3.1): para cada extensión indica el programa con que se abre y una breve descripción, y señala las de riesgo (.exe, .sys). Usa la misma tabla de la guía. Entrega el cuadro corregido y completo.",
    "sistemas332": "Repite el cuadro de requerimientos mínimos de los sistemas operativos (Actividad 3.3.2): procesador, RAM, disco y fuente, para los mismos sistemas de la guía. Entrega la tabla corregida.",
    "suite333": "Vuelve a realizar la actividad 'Suite ofimática en acción' (Actividad 3.3.3) usando el mismo programa de la guía (Word/Excel): aplica el formato y las fórmulas solicitadas. Entrega el archivo corregido.",
    "colaborativas334": "Repite el cuadro de herramientas colaborativas (Actividad 3.3.4): función, ventaja, limitación y licencia, para las mismas herramientas de la guía. Entrega el cuadro corregido y completo.",
    "cibersegAmenazas335": "Vuelve a completar la sección de amenazas digitales (Actividad 3.3.5): identifica cada amenaza (virus, phishing, ransomware) y cómo protegerte de ella, según la misma tabla de la guía. Entrega la sección corregida.",
    "cibersegGuia335": "Repite la sección de la guía de ciberseguridad (Actividad 3.3.5): responde las preguntas sobre buenas prácticas de protección de la información con tus propias palabras. Entrega las respuestas corregidas.",
    "cibersegPhishing335": "Vuelve a desarrollar la sección de phishing (Actividad 3.3.5): analiza el mensaje sospechoso de la guía, señala las señales de alerta y cómo actuar. Entrega el análisis corregido.",
    "cibersegChecklist335": "Repite la lista de verificación de ciberseguridad (Actividad 3.3.5): marca cada práctica y justifica tu nivel de cumplimiento, sobre tu propio equipo. Entrega el checklist corregido y completo.",
    "ciberseguridad335": "Vuelve a preparar y entregar el documento de ciberseguridad (Actividad 3.3.5) con todas las secciones trabajadas en la guía (amenazas, phishing, checklist). Entrega el documento corregido a Drive.",
    "transferReto341": "Vuelve a desarrollar el reto final de transferencia (Actividad 3.4.1) sobre la misma herramienta elegida: explica qué responde la guía y cómo se usa, con evidencias. Entrega el reto corregido.",
  },

  "guia-03-planificar-10": {
    "bitacora311": "Vuelve a elaborar la bitácora individual de análisis (Actividad 3.1.1): describe el caso de la guía, las herramientas implicadas y tus conclusiones. Mantén el mismo caso. Entrega la bitácora corregida.",
    "socializacion312": "Repite la socialización del análisis (Actividad 3.1.2): registra la pregunta central y la conclusión del equipo sobre el mismo tema de la guía. Entrega el documento corregido.",
    "tabla321": "Vuelve a completar la tabla resumen (Actividad 3.2.1) con los mismos contenidos de la guía: cada concepto con su descripción y ejemplo. Entrega la tabla corregida y completa.",
    "mapa322": "Repite el mapa conceptual (Actividad 3.2.2) con los conceptos solicitados en la guía, conectados con palabras de enlace. Puedes usar la misma herramienta (CmapTools o similar). Entrega el mapa corregido.",
    "checklist331": "Vuelve a diligenciar el checklist de instalación (Actividad 3.3.1): verifica cada paso sobre el mismo programa de la guía y marca su cumplimiento con evidencia. Entrega el checklist corregido y completo.",
    "diagnostico332": "Repite el diagnóstico técnico (Actividad 3.3.2) sobre el mismo equipo: registra los datos solicitados por la guía con la misma herramienta de diagnóstico. Entrega el informe corregido.",
    "documento333": "Vuelve a elaborar el documento técnico de gestión de información (Actividad 3.3.3) con todas las secciones que pide la guía, sobre el mismo caso. Entrega el documento corregido y completo.",
    "presupuesto341": "Repite el presupuesto final (Actividad 3.4.1): cotiza los mismos elementos de la guía con valores reales y justifica cada elección. Entrega el presupuesto corregido.",
    "sustentacion342": "Prepara nuevamente la presentación y sustentación oral (Actividad 3.4.2) sobre el mismo trabajo de la guía, y acuerda con tu instructor la fecha para sustentarla. Entrega la presentación corregida.",
  },

  "guia-04-ciberseguridad": {
    "caso311": "Vuelve a desarrollar el análisis del caso ElectroBoycá (Actividad 3.1.1): responde las preguntas de reflexión sobre el mismo incidente de la guía, con tus propias palabras. Entrega el análisis corregido.",
    "plenaria312": "Repite tu aporte de la socialización en plenaria (Actividad 3.1.2): registra tu participación y las conclusiones del grupo sobre el mismo caso de la guía. Entrega el registro corregido.",
    "bloques321": "Vuelve a estudiar los bloques temáticos A y B (Actividad 3.2.1) y completa el registro solicitado por la guía sobre los mismos contenidos de ciberseguridad. Entrega la evidencia corregida y completa.",
    "mapa322": "Repite el mapa conceptual integrador (Actividad 3.2.2) con los conceptos de ciberseguridad solicitados por la guía, conectados con palabras de enlace. Entrega el mapa corregido.",
    "diagnostico331": "Vuelve a realizar el diagnóstico del estado de seguridad del equipo (Actividad 3.3.1) sobre el mismo equipo, con las mismas herramientas de la guía, y registra los hallazgos. Entrega el diagnóstico corregido.",
    "hardening332": "Repite la implementación de controles de hardening (Actividad 3.3.2) sobre el mismo equipo: aplica los controles de la guía y documenta cada uno con su evidencia. Entrega el informe corregido.",
    "documentos333": "Vuelve a elaborar la documentación técnica (Actividad 3.3.3): los documentos A-D completos, organizados en las carpetas que indica la guía, sobre el mismo caso. Entrega el paquete corregido y completo.",
    "plan341": "Vuelve a construir el Plan Integral de Ciberseguridad para la MiPyme (Actividad 3.4.1) con todas las secciones que pide la guía, y acuerda con tu instructor la fecha de la sustentación oral. Entrega el plan corregido.",
  },

  "guia-05-herramientas": {
    "guia5-311": "Vuelve a elaborar la bitácora de análisis del caso (Actividad 3.1.1): síntomas, mensaje observado, causas, herramientas, plan de acción, qué no hacer y conclusión. Mantén el mismo caso de la guía. Entrega la bitácora corregida.",
    "guia5-331": "Repite las evidencias de herramientas (Actividad 3.3.1): realiza los ejercicios con los mismos programas de la guía y captura las evidencias solicitadas. Entrega las evidencias corregidas y completas.",
    "guia5-341": "Vuelve a elaborar el informe final integrador (Actividad 3.4.1) con todas las secciones que pide la guía, sobre el mismo caso trabajado. Entrega el informe corregido.",
  },

  "guia-06-planificar": {
    "bitacora311": "Vuelve a realizar la bitácora individual de análisis (Actividad 3.1.1): herramientas, registro, consecuencias y una experiencia propia. Sobre el mismo caso de la guía. Entrega la bitácora corregida.",
    "socializacion312": "Repite la socialización del análisis (Actividad 3.1.2): formula la pregunta central y la conclusión del equipo sobre el mismo tema de la guía. Entrega el documento corregido.",
    "tabla321": "Vuelve a completar la tabla resumen (Actividad 3.2.1) con los mismos contenidos de la guía: cada concepto con su descripción y ejemplo. Entrega la tabla corregida y completa.",
    "mapa322": "Repite el mapa conceptual (Actividad 3.2.2) con los conceptos solicitados en la guía, conectados con palabras de enlace. Puedes usar la misma herramienta (CmapTools o similar). Entrega el mapa corregido.",
    "checklist331": "Vuelve a diligenciar el checklist de instalación (Actividad 3.3.1): verifica cada paso sobre el mismo programa de la guía y marca su cumplimiento con evidencia. Entrega el checklist corregido y completo.",
    "diagnostico332": "Repite el diagnóstico técnico (Actividad 3.3.2) sobre el mismo equipo: registra los datos solicitados por la guía con la misma herramienta de diagnóstico. Entrega el informe corregido.",
    "presupuesto341": "Repite el presupuesto final (Actividad 3.4.1): cotiza los mismos elementos de la guía con valores reales y justifica cada elección. Entrega el presupuesto corregido.",
  },

  "guia-07-ciberseguridad": {
    "caso311": "Vuelve a desarrollar el análisis del caso ElectroBoycá (Actividad 3.1.1): responde las preguntas de reflexión sobre el mismo incidente de la guía, con tus propias palabras. Entrega el análisis corregido.",
    "plenaria312": "Repite tu aporte de la socialización en plenaria (Actividad 3.1.2): registra tu participación y las conclusiones sobre el mismo caso de la guía. Entrega el registro corregido.",
    "bloqueAB321": "Vuelve a completar la tabla resumen de los bloques A y B (Actividad 3.2.1) con los mismos contenidos de ciberseguridad de la guía. Entrega la tabla corregida y completa.",
    "mapa322": "Repite el mapa conceptual de ciberseguridad (Actividad 3.2.2) con los conceptos solicitados por la guía, conectados con palabras de enlace. Entrega el mapa corregido.",
    "diagnostico331": "Vuelve a realizar el diagnóstico del estado de seguridad del equipo (Actividad 3.3.1) sobre el mismo equipo, con las mismas herramientas de la guía, y registra los hallazgos. Entrega el diagnóstico corregido.",
    "hardening332": "Repite la implementación de controles de hardening (Actividad 3.3.2) sobre el mismo equipo: aplica los controles de la guía y documenta cada uno con su evidencia. Entrega el informe corregido.",
    "plan341": "Vuelve a construir el Plan de Ciberseguridad para la MiPyme (Actividad 3.4.1) con todas las secciones que pide la guía, y acuerda con tu instructor la fecha de la sustentación oral. Entrega el plan corregido.",
  },

  "guia-redes-rap01": {
    "reflexion311": "Vuelve a desarrollar la reflexión individual (Actividad 3.1.1) sobre el mismo caso de la guía: qué es una red, beneficios, ejemplos, elementos y un problema observado. Entrega la reflexión corregida.",
    "socializacion311": "Repite el registro de la socialización (Actividad 3.1.1): anota los aportes y la conclusión del grupo sobre el mismo tema de la guía. Entrega el registro corregido.",
    "ip1": "Repite el bloque de direccionamiento IP (Actividad 3.2.1): octeto y sus valores, uso de la máscara de subred y conflicto de IP. Con los mismos ejercicios de la guía. Entrega las respuestas corregidas.",
    "ip3": "Vuelve a resolver el bloque de conectividad (Actividad 3.2.3): conectividad local vs. internet, DNS y qué funciona sin internet. Con los mismos ejercicios de la guía. Entrega las respuestas corregidas.",
    "taller-ip-ej1": "Vuelve a resolver el Ejercicio 1 del Taller IP con los mismos datos de la guía: desarrolla el procedimiento completo y verifica el resultado. Entrega el ejercicio corregido.",
    "taller-ip-ej2": "Vuelve a resolver el Ejercicio 2 del Taller IP con los mismos datos de la guía: desarrolla el procedimiento completo y verifica el resultado. Entrega el ejercicio corregido.",
    "taller-ip-ej3": "Vuelve a resolver el Ejercicio 3 del Taller IP con los mismos datos de la guía: desarrolla el procedimiento completo y verifica el resultado. Entrega el ejercicio corregido.",
    "taller-ip-ej4": "Vuelve a resolver el Ejercicio 4 del Taller IP con los mismos datos de la guía: desarrolla el procedimiento completo y verifica el resultado. Entrega el ejercicio corregido.",
    "taller-ip-ej5": "Vuelve a resolver el Ejercicio 5 del Taller IP con los mismos datos de la guía: desarrolla el procedimiento completo y verifica el resultado. Entrega el ejercicio corregido.",
    "lab1": "Repite el Laboratorio 1 (topología en estrella) en Packet Tracer con la misma configuración de la guía: arma la red, asigna las IP y verifica la conectividad. Entrega la evidencia corregida (archivo y capturas).",
    "lab2": "Repite el Laboratorio 2 (topología en árbol) en Packet Tracer con la misma configuración de la guía: arma la red, asigna las IP y verifica la conectividad. Entrega la evidencia corregida (archivo y capturas).",
    "lab3": "Repite el Laboratorio 3 (red híbrida) en Packet Tracer con la misma configuración de la guía: arma la red, asigna las IP y verifica la conectividad. Entrega la evidencia corregida (archivo y capturas).",
    "social": "Prepara nuevamente tu socialización final (Actividad 3.5.1) sobre el mismo trabajo de la guía y acuerda con tu instructor la fecha para presentarla. Entrega el material corregido.",
  },

  "guia-redes-rap02": {
    "reflexion311": "Vuelve a desarrollar la reflexión inicial del caso Ferretería Don Misael (Actividad 3.1.1): responde las preguntas sobre el mismo caso de la guía, con tus propias palabras. Entrega la reflexión corregida.",
    "bloqueA321": "Repite el Bloque A (Actividad 3.2.1): funciones y diferencias de router, switch y access point, según los mismos contenidos de la guía. Entrega las respuestas corregidas.",
    "bloqueB322": "Repite el Bloque B (Actividad 3.2.2): protocolo TCP/IP y modelo de capas, según los mismos contenidos de la guía. Entrega las respuestas corregidas.",
    "bloqueC323": "Repite el Bloque C (Actividad 3.2.3): servicios DHCP, DNS y Firewall, qué hace cada uno y cuándo se usa, según la guía. Entrega las respuestas corregidas.",
    "bloqueD324": "Repite el Bloque D (Actividad 3.2.4): IP pública vs. privada y NAT, con los mismos ejemplos de la guía. Entrega las respuestas corregidas.",
    "exportBloques321a324": "Vuelve a exportar a Word los bloques A-D (Actividad 3.2.x) con todas las respuestas completas y corregidas. Entrega el documento actualizado.",
    "entregaContexto325": "Vuelve a preparar y entregar el PDF con los productos de contextualización (Actividad 3.2.5): incluye los bloques A-D corregidos y completos. Entrega el PDF a Drive.",
    "comandos331": "Repite la práctica de comandos de diagnóstico CLI (Actividad 3.3.1): ejecuta los mismos comandos de la guía en tu equipo, captura la evidencia y explica qué muestra cada uno. Entrega el informe corregido.",
    "presentacion332": "Vuelve a elaborar la presentación técnica de averías (Actividad 3.3.2) con los mismos 5 escenarios de la guía: causa probable, comando de diagnóstico y solución para cada uno. Entrega la presentación corregida.",
    "laboratorio341": "Repite el laboratorio de Packet Tracer de la red de 2 plantas (Actividad 3.4.1) con la misma configuración de la guía y realiza las 10 pruebas de verificación. Entrega el archivo y las capturas corregidas.",
    "caso342": "Repite el laboratorio integral (Actividad 3.4.2) en Packet Tracer: red con DHCP, DNS, access point y NAT, con la misma configuración de la guía, y verifica los servicios. Entrega el archivo y las capturas corregidas.",
  },
};
