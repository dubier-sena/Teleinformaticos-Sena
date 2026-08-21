// reinforcement_workshops_catalog.js — Catalogo de Talleres de Refuerzo
// disponibles para asignar desde el panel admin. Cubre TODAS las guias
// (actuales y futuras): agregar un taller nuevo es solo agregar una entrada
// aqui, sin tocar el modulo admin. Las llaves son las mismas familias de
// GUIDE_FAMILY_BY_FILE (js/activity_grades.js) para reusar ese vocabulario.
// Se carga SOLO en el panel admin: title/fileUrl quedan snapshoteados dentro
// de cada asignacion (reinforcement_workshops.js: makeWorkshop), asi que el
// aprendiz y el Home nunca necesitan cargar este catalogo.
window.reinforcementWorkshopsCatalog = {
  "guia-01-induccion": {
    title: "Taller de Refuerzo — Guía de Inducción",
    fileUrl: "assets/materiales/talleres_refuerzo/induccion/TALLER_REFUERZO_Guia_Induccion.pdf",
    defaultDays: 15,
  },
};
