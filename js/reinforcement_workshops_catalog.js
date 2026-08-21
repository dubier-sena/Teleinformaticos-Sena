// reinforcement_workshops_catalog.js — Catalogo de Talleres de Refuerzo
// disponibles para asignar desde el panel admin. Cubre TODAS las guias
// (actuales y futuras): agregar un taller nuevo es solo agregar una entrada
// aqui, sin tocar el modulo admin. Las llaves son las mismas familias de
// GUIDE_FAMILY_BY_FILE (js/activity_grades.js) para reusar ese vocabulario.
//
// Cada actividad se completa EN LINEA (igual que una guia): objetivo +
// instrucciones numeradas (texto fijo, igual que cualquier guia real) y
// campos de respuesta guardados con ActivityStandard.mountFormActivity
// (Guardar respuestas -> bloquea -> Exportar a Word), mas un panel de
// entrega a Drive SOLO para la actividad 3 (mapa conceptual: es visual, no
// se puede escribir como texto), mismo patron que "Arbol de la Vida" en la
// Guia de Induccion. Se carga en el panel admin Y en la pagina del
// aprendiz (reinforcement_workshops_student.js necesita objetivo/
// instrucciones/fields completos para poder pintar la actividad).
window.reinforcementWorkshopsCatalog = {
  "guia-01-induccion": {
    title: "Taller de Refuerzo — Guía de Inducción",
    fileUrl: "assets/materiales/talleres_refuerzo/induccion/TALLER_REFUERZO_Guia_Induccion.pdf",
    defaultDays: 15,
    program: "Técnico en Sistemas Teleinformáticos (233108 V1)",
    guideNumber: "Taller Refuerzo",
    guideTitle: "Taller de Refuerzo - Guía de Inducción",
    // Campos de "documento" (introduccion/conclusiones/referencias): se
    // autoguardan sin boton propio, no se bloquean (el aprendiz puede
    // ajustarlos hasta la fecha limite), y entran en el Word final.
    docFields: [
      { key: "intro", label: "Introducción", placeholder: "Explica brevemente el propósito de este trabajo." },
      { key: "conclusiones", label: "Conclusiones", placeholder: "¿Qué aprendiste? ¿Qué conocimientos reforzaste? ¿Qué aspectos consideras importantes del proceso de Inducción?" },
      { key: "referencias", label: "Referencias", placeholder: "Fuentes utilizadas para desarrollar las actividades (incluida la Guía de Aprendizaje de Inducción)." },
    ],
    activities: [
      {
        id: "act1", number: "1", shortName: "IdentidadFPI",
        label: "Identidad institucional del SENA y fundamentos de la Formación Profesional Integral",
        type: "form",
        objetivo: "Identificar y explicar con tus propias palabras los elementos que conforman la identidad institucional del SENA y los conceptos fundamentales de la Formación Profesional Integral.",
        instrucciones: [
          "Observa el logo del SENA e identifica los elementos que representan su identidad institucional (colores, formas, símbolos).",
          "Explica con tus propias palabras qué son la misión, la visión y los valores del SENA, y menciona dos servicios que ofrece a la comunidad.",
          "Del glosario de la Guía de Inducción, selecciona 5 términos relacionados con la Formación Profesional Integral y defínelos con tus propias palabras.",
          "Redacta un párrafo corto en el que relaciones la identidad institucional del SENA con el significado de la Formación Profesional Integral.",
        ],
        fields: [
          { key: "act1_identidad", label: "1-2. Identidad institucional del SENA", placeholder: "Elementos que representan la identidad institucional del SENA (colores, formas, símbolos) y qué son la misión, la visión y los valores del SENA, con dos servicios que ofrece." },
          { key: "act1_glosario", label: "3. Cinco (5) términos del glosario de la guía", placeholder: "Selecciona 5 términos relacionados con la Formación Profesional Integral del glosario de la Guía de Inducción y defínelos con tus propias palabras." },
          { key: "act1_relacion", label: "4. Párrafo de relación", placeholder: "Relaciona la identidad institucional del SENA con el significado de la Formación Profesional Integral." },
        ],
        recursos: [
          { label: "Formato de análisis del logo y símbolos SENA", url: "assets/materiales/induccion/T1_Analisis_Logo_Simbolos_SENA.docx" },
        ],
        // El termino 3 pide el glosario de la Guia de Induccion -- ese glosario
        // vive DENTRO de la guia (seccion #glosario), no en un PDF aparte; el
        // enlace se arma en tiempo de render segun la ficha del aprendiz (ver
        // linkToInductionGlossary en reinforcement_workshops_student.js).
        linkToInductionGlossary: true,
      },
      {
        id: "act2", number: "2", shortName: "RutaFormacion",
        label: "Mi ruta de formación: diseño curricular y proyecto de vida",
        type: "form",
        objetivo: "Relacionar los elementos del diseño curricular de tu programa con tus metas personales de formación.",
        instrucciones: [
          "Elabora un cuadro comparativo (tabla) con las columnas: Elemento del diseño curricular, Descripción según tu programa, y Relación con una meta de tu Árbol de la Vida.",
          "Diligencia el cuadro con al menos 4 elementos del diseño curricular de tu programa (Técnico en Sistemas Teleinformáticos, 233108 V1): por ejemplo competencia, resultado de aprendizaje, duración y campo ocupacional.",
          "Para cada elemento, explica cómo aporta al logro de una de tus metas (frutos) o fortalezas (raíces) identificadas en tu Árbol de la Vida.",
          "Cierra con una conclusión de máximo 5 líneas sobre la importancia de conocer el diseño curricular para cumplir tu proyecto de vida.",
        ],
        fields: [
          { key: "act2_cuadro", label: "1-3. Cuadro comparativo (mínimo 4 elementos)", placeholder: "Para al menos 4 elementos del diseño curricular de tu programa (ej. competencia, resultado de aprendizaje, duración, campo ocupacional), describe cada uno y explica cómo se relaciona con una meta o fortaleza de tu Árbol de la Vida." },
          { key: "act2_conclusion", label: "4. Conclusión (máx. 5 líneas)", placeholder: "Importancia de conocer el diseño curricular para cumplir tu proyecto de vida." },
        ],
        recursos: [
          { label: "Diseño Curricular Sistemas Teleinformáticos (PDF)", url: "assets/materiales/induccion/Diseno_Curricular_Sistemas_Teleinformaticos.pdf" },
        ],
      },
      {
        id: "act3", number: "3", shortName: "MapaReglamento",
        label: "Mapa conceptual: Reglamento del Aprendiz y convivencia en el ambiente de formación",
        type: "both",
        objetivo: "Organizar gráficamente los elementos del Reglamento del Aprendiz y relacionarlos con la convivencia en el ambiente de formación.",
        instrucciones: [
          "Elabora un mapa conceptual o mental con idea central \"Reglamento del Aprendiz y convivencia SENA\".",
          "Incluye cuatro ramas: Derechos, Deberes, Faltas y Sanciones, con al menos dos ejemplos en cada una.",
          "Agrega una quinta rama llamada \"Convivencia\", en la que relaciones al menos dos normas de convivencia (respeto, comunicación, trabajo en equipo) con los deberes del Reglamento.",
          "Sube el mapa terminado (imagen o PDF legible) en el panel de entrega a Drive de esta actividad.",
        ],
        fields: [
          { key: "act3_parrafo", label: "Párrafo final", placeholder: "¿Por qué cumplir el Reglamento del Aprendiz contribuye a un buen ambiente de convivencia?" },
        ],
        recursos: [
          { label: "Acuerdo 009/2024 — Reglamento del Aprendiz SENA (PDF)", url: "assets/materiales/induccion/Acuerdo_009_2024_Reglamento_Aprendiz_SENA.pdf" },
          { label: "Anexos al Reglamento del Aprendiz (PDF)", url: "assets/materiales/induccion/Proyecto_Acuerdo_Reglamento_Aprendiz_Anexos.pdf" },
        ],
        driveTarget: {
          description: "Sube tu mapa conceptual o mental (idea central \"Reglamento del Aprendiz y convivencia SENA\", con las ramas Derechos, Deberes, Faltas y Sanciones, Convivencia).",
          note: "Entrega sugerida: imagen o PDF legible del mapa.",
        },
      },
      {
        id: "act4", number: "4", shortName: "SituacionProblema",
        label: "Situación problema: aplicar el Reglamento del Aprendiz en el uso de las plataformas tecnológicas",
        type: "form",
        objetivo: "Aplicar el Reglamento del Aprendiz y el conocimiento de las plataformas tecnológicas para resolver una situación real.",
        instrucciones: [
          "Lee la situación: \"Un aprendiz comparte su usuario y contraseña de SOFIA Plus con un compañero para que le resuelva una actividad, y además falta varias veces sin justificación a la formación.\"",
          "Identifica qué faltas se presentan en la situación, según el Reglamento del Aprendiz.",
          "Explica qué plataformas tecnológicas del SENA están involucradas (Territorium, SOFIA Plus u otras trabajadas en la guía) y cuál es el uso correcto y responsable que debió dar el aprendiz.",
          "Propón, con tus propias palabras, dos recomendaciones para que ese aprendiz corrija su comportamiento y use adecuadamente las plataformas institucionales.",
        ],
        fields: [
          { key: "act4_faltas", label: "2. Faltas presentes en la situación", placeholder: "¿Qué faltas se presentan, según el Reglamento del Aprendiz?" },
          { key: "act4_plataformas", label: "3. Plataformas involucradas y uso correcto", placeholder: "¿Qué plataformas tecnológicas del SENA están involucradas y cuál es el uso correcto y responsable que debió dar el aprendiz?" },
          { key: "act4_recomendaciones", label: "4. Dos (2) recomendaciones", placeholder: "Propón dos recomendaciones para que ese aprendiz corrija su comportamiento y use adecuadamente las plataformas institucionales." },
        ],
        recursos: [
          { label: "Manual Formación Virtual SOFIA Plus (PDF)", url: "assets/materiales/induccion/Manual_Formacion_Virtual_SOFIA.pdf" },
          { label: "Manual Aprendiz — Territorium (PDF)", url: "https://territorio.s3.amazonaws.com/archivos/sena/manuales/Manual%2BAprendiz%2B-%2BTerritorium_Version3.pdf" },
        ],
      },
      {
        id: "act5", number: "5", shortName: "EstudioCaso",
        label: "Estudio de caso: convivencia, compromiso y proyecto de vida",
        type: "form",
        objetivo: "Analizar una situación de convivencia y argumentar cómo tu compromiso y proyecto de vida orientan tu actuación como aprendiz.",
        instrucciones: [
          "Piensa en una situación real o hipotética de tu ambiente de formación relacionada con el respeto, la comunicación o el trabajo en equipo.",
          "Describe brevemente el caso (qué ocurrió, quiénes participaron, cómo se manejó).",
          "Analiza el caso: ¿qué normas de convivencia se cumplieron o se incumplieron?",
          "Argumenta, retomando tu Árbol de la Vida y tu compromiso como aprendiz SENA, cómo habrías actuado tú para manejar la situación de mejor manera y qué relación tiene esto con tus metas de formación.",
        ],
        fields: [
          { key: "act5_descripcion", label: "1-2. Descripción del caso", placeholder: "Qué ocurrió, quiénes participaron y cómo se manejó." },
          { key: "act5_analisis", label: "3. Análisis de convivencia", placeholder: "¿Qué normas de convivencia se cumplieron o se incumplieron?" },
          { key: "act5_argumento", label: "4. Argumento personal", placeholder: "Retomando tu Árbol de la Vida y tu compromiso como aprendiz SENA, ¿cómo habrías actuado tú? ¿Qué relación tiene con tus metas de formación?" },
        ],
      },
      {
        id: "act6", number: "6", shortName: "PortafolioCompromiso",
        label: "Actividad práctica integradora: mi portafolio de Inducción",
        type: "form",
        objetivo: "Organizar un portafolio de evidencias que demuestre, de manera integrada, la comprensión de los temas de Inducción, y formular tu compromiso final como aprendiz SENA.",
        instrucciones: [
          "Organiza una carpeta (física o en Drive) con la estructura de portafolio trabajada en la Guía de Inducción, e incluye las evidencias producidas en las Actividades 1 a 5 de este taller.",
          "Verifica que la carpeta tenga una nomenclatura clara y que las evidencias estén completas y sean legibles.",
          "Redacta tu compromiso final como aprendiz SENA, mencionando de manera integrada: tu identidad como aprendiz, tu programa de formación, tu compromiso con el Reglamento, tu uso responsable de las plataformas tecnológicas y tu proyecto de vida.",
          "Si organizas el portafolio en Drive, genera el enlace para compartirlo; si es físico, describe cómo está organizado.",
        ],
        fields: [
          { key: "act6_portafolio", label: "1-2, 4. Portafolio de evidencias", placeholder: "Describe cómo organizaste tu portafolio (carpeta física o en Drive) con las evidencias de las Actividades 1 a 5. Si lo hiciste en Drive, pega aquí el enlace para compartirlo; si es físico, describe cómo está organizado." },
          { key: "act6_compromiso", label: "3. Compromiso final", placeholder: "Redacta tu compromiso final como aprendiz SENA: tu identidad como aprendiz, tu programa de formación, tu compromiso con el Reglamento, tu uso responsable de las plataformas tecnológicas y tu proyecto de vida." },
        ],
        recursos: [
          { label: "Formato de uso de plataformas y portafolio", url: "assets/materiales/induccion/T2_Uso_Plataformas_Portafolio.docx" },
        ],
      },
    ],
  },
};
