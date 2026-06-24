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

window.improvementActivitiesBank = {
  "guia-01-induccion": {
    "arbol312": "Vuelve a elaborar 'El Árbol de la Vida' (Actividad 3.1.2): incluye raíces (valores y origen), tronco (habilidades), ramas (metas) y frutos (logros). Entrega la evidencia corregida y completa.",
    "sena331": "Repite el análisis de los logo-símbolos del SENA (Actividad 3.3.1): explica el significado de cada símbolo y color del logo. Entrega el documento corregido.",
    "programa332": "Vuelve a responder el cuestionario del diseño curricular del programa (Actividad 3.3.2) de forma completa, con tus propias palabras. Entrega las respuestas corregidas.",
  },

  "guia-02-herramientas": {
    "analisis313": "Vuelve a realizar la bitácora de análisis (Actividad 3.1.3): describe el caso, los síntomas, las posibles causas y el plan de acción. Mantén el mismo caso de la guía. Entrega la bitácora corregida.",
    "matriz322": "Repite la Matriz de Diagnóstico Digital (Actividad 3.2.2) con los mismos criterios de la guía: completa cada fila con su valoración y justificación. Entrega la matriz corregida y completa.",
    "fichaCaso": "Vuelve a diligenciar la Ficha de caso (Actividad 3.2.1) con todos sus campos sobre el mismo caso de la guía. Entrega la ficha corregida.",
    "extensiones331": "Vuelve a completar el cuadro de extensiones de archivo (Actividad 3.3.1): para cada extensión indica el programa con que se abre y una breve descripción, y señala las de riesgo (.exe, .sys). Usa la misma tabla de la guía. Entrega el cuadro corregido y completo.",
    "sistemas332": "Repite el cuadro de requerimientos mínimos de los sistemas operativos (Actividad 3.3.2): procesador, RAM, disco y fuente, para los mismos sistemas de la guía. Entrega la tabla corregida.",
    "suite333": "Vuelve a realizar la actividad 'Suite ofimática en acción' (Actividad 3.3.3) usando el mismo programa de la guía (Word/Excel): aplica el formato y las fórmulas solicitadas. Entrega el archivo corregido.",
    "colaborativas334": "Repite el cuadro de herramientas colaborativas (Actividad 3.3.4): función, ventaja, limitación y licencia, para las mismas herramientas de la guía. Entrega el cuadro corregido y completo.",
    "transferReto341": "Vuelve a desarrollar el reto final de transferencia (Actividad 3.4.1) sobre la misma herramienta elegida: explica qué responde la guía y cómo se usa, con evidencias. Entrega el reto corregido.",
  },

  "guia-05-herramientas": {
    "guia5-311": "Vuelve a elaborar la bitácora de análisis del caso (Actividad 3.1.1): síntomas, mensaje observado, causas, herramientas, plan de acción, qué no hacer y conclusión. Mantén el mismo caso de la guía. Entrega la bitácora corregida.",
  },

  "guia-06-planificar": {
    "bitacora311": "Vuelve a realizar la bitácora individual de análisis (Actividad 3.1.1): herramientas, registro, consecuencias y una experiencia propia. Sobre el mismo caso de la guía. Entrega la bitácora corregida.",
    "socializacion312": "Repite la socialización del análisis (Actividad 3.1.2): formula la pregunta central y la conclusión del equipo sobre el mismo tema de la guía. Entrega el documento corregido.",
  },

  "guia-redes-rap01": {
    "reflexion311": "Vuelve a desarrollar la reflexión individual (Actividad 3.1.1) sobre el mismo caso de la guía: qué es una red, beneficios, ejemplos, elementos y un problema observado. Entrega la reflexión corregida.",
    "ip1": "Repite el bloque de direccionamiento IP (Actividad 3.2.1): octeto y sus valores, uso de la máscara de subred y conflicto de IP. Con los mismos ejercicios de la guía. Entrega las respuestas corregidas.",
    "ip3": "Vuelve a resolver el bloque de conectividad (Actividad 3.2.3): conectividad local vs. internet, DNS y qué funciona sin internet. Con los mismos ejercicios de la guía. Entrega las respuestas corregidas.",
  },
};
