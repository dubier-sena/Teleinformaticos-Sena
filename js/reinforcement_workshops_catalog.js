// reinforcement_workshops_catalog.js — Catalogo de Talleres de Refuerzo
// disponibles para asignar desde el panel admin. Cubre TODAS las guias
// (actuales y futuras): agregar un taller nuevo es solo agregar una entrada
// aqui, sin tocar el modulo admin. Las llaves son las mismas familias de
// GUIDE_FAMILY_BY_FILE (js/activity_grades.js) para reusar ese vocabulario.
//
// Cada actividad se completa EN LINEA (igual que una guia): campos de texto
// guardados con ActivityStandard.mountFormActivity (Guardar respuestas ->
// bloquea -> Exportar a Word), mas un panel de entrega a Drive SOLO para la
// actividad 3 (mapa conceptual: es visual, no se puede escribir como texto),
// mismo patron que "Arbol de la Vida" en la Guia de Induccion.
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
        fields: [
          { key: "act1_identidad", label: "1-2. Identidad institucional del SENA", placeholder: "Elementos que representan la identidad institucional del SENA (colores, formas, símbolos) y qué son la misión, la visión y los valores del SENA, con dos servicios que ofrece." },
          { key: "act1_glosario", label: "3. Cinco (5) términos del glosario de la guía", placeholder: "Selecciona 5 términos relacionados con la Formación Profesional Integral del glosario de la Guía de Inducción y defínelos con tus propias palabras." },
          { key: "act1_relacion", label: "4. Párrafo de relación", placeholder: "Relaciona la identidad institucional del SENA con el significado de la Formación Profesional Integral." },
        ],
      },
      {
        id: "act2", number: "2", shortName: "RutaFormacion",
        label: "Mi ruta de formación: diseño curricular y proyecto de vida",
        type: "form",
        fields: [
          { key: "act2_cuadro", label: "1-3. Cuadro comparativo (mínimo 4 elementos)", placeholder: "Para al menos 4 elementos del diseño curricular de tu programa (ej. competencia, resultado de aprendizaje, duración, campo ocupacional), describe cada uno y explica cómo se relaciona con una meta o fortaleza de tu Árbol de la Vida." },
          { key: "act2_conclusion", label: "4. Conclusión (máx. 5 líneas)", placeholder: "Importancia de conocer el diseño curricular para cumplir tu proyecto de vida." },
        ],
      },
      {
        id: "act3", number: "3", shortName: "MapaReglamento",
        label: "Mapa conceptual: Reglamento del Aprendiz y convivencia en el ambiente de formación",
        type: "both",
        fields: [
          { key: "act3_parrafo", label: "4. Párrafo final", placeholder: "¿Por qué cumplir el Reglamento del Aprendiz contribuye a un buen ambiente de convivencia?" },
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
        fields: [
          { key: "act4_faltas", label: "2. Faltas presentes en la situación", placeholder: "Un aprendiz comparte su usuario y contraseña de SOFIA Plus con un compañero para que le resuelva una actividad, y además falta varias veces sin justificación a la formación. ¿Qué faltas se presentan, según el Reglamento del Aprendiz?" },
          { key: "act4_plataformas", label: "3. Plataformas involucradas y uso correcto", placeholder: "¿Qué plataformas tecnológicas del SENA están involucradas (Territorium, SOFIA Plus u otras) y cuál es el uso correcto y responsable que debió dar el aprendiz?" },
          { key: "act4_recomendaciones", label: "4. Dos (2) recomendaciones", placeholder: "Propón dos recomendaciones para que ese aprendiz corrija su comportamiento y use adecuadamente las plataformas institucionales." },
        ],
      },
      {
        id: "act5", number: "5", shortName: "EstudioCaso",
        label: "Estudio de caso: convivencia, compromiso y proyecto de vida",
        type: "form",
        fields: [
          { key: "act5_descripcion", label: "1-2. Descripción del caso", placeholder: "Piensa en una situación real o hipotética de tu ambiente de formación relacionada con el respeto, la comunicación o el trabajo en equipo. Describe brevemente qué ocurrió, quiénes participaron y cómo se manejó." },
          { key: "act5_analisis", label: "3. Análisis de convivencia", placeholder: "¿Qué normas de convivencia se cumplieron o se incumplieron?" },
          { key: "act5_argumento", label: "4. Argumento personal", placeholder: "Retomando tu Árbol de la Vida y tu compromiso como aprendiz SENA, ¿cómo habrías actuado tú para manejar la situación de mejor manera? ¿Qué relación tiene con tus metas de formación?" },
        ],
      },
      {
        id: "act6", number: "6", shortName: "PortafolioCompromiso",
        label: "Actividad práctica integradora: mi portafolio de Inducción",
        type: "form",
        fields: [
          { key: "act6_portafolio", label: "1-2, 4. Portafolio de evidencias", placeholder: "Describe cómo organizaste tu portafolio (carpeta física o en Drive) con las evidencias de las Actividades 1 a 5. Si lo hiciste en Drive, pega aquí el enlace para compartirlo; si es físico, describe cómo está organizado." },
          { key: "act6_compromiso", label: "3. Compromiso final", placeholder: "Redacta tu compromiso final como aprendiz SENA: tu identidad como aprendiz, tu programa de formación, tu compromiso con el Reglamento, tu uso responsable de las plataformas tecnológicas y tu proyecto de vida." },
        ],
      },
    ],
  },
};
