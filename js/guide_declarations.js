/**
 * guide_declarations.js
 *
 * Registra la configuración de cada guía en ActivityStandard.
 * Este archivo se carga tanto en el panel admin como en cada página de guía,
 * para que las fechas límite y el panel de habilitación detecten las actividades
 * sin depender de los scripts específicos de cada guía.
 *
 * Cada nueva guía que use activity_standard.js debe agregar aquí su llamada a
 * ActivityStandard.registerGuide({ files, guideNumber, guideTitle, stateKey,
 *   program, competencia, resultado, activities }).
 *
 * Los scripts de guía (script_guiaN.js) pueden omitir la llamada a registerGuide()
 * si ya está aquí, o repetirla de forma idempotente (el registro sobrescribe
 * con los mismos datos, sin efectos negativos).
 */

(function () {
  "use strict";

  function register(config) {
    if (window.ActivityStandard && typeof window.ActivityStandard.registerGuide === "function") {
      window.ActivityStandard.registerGuide(config);
    }
  }

  // ── Guías registradas ─────────────────────────────────────────────────────
  // Agregar aquí cada nueva guía que use ActivityStandard.registerGuide().

  // Ejemplo (descomenta y adapta al agregar una nueva guía):
  //
  // register({
  //   files: ["grupo-10a-guia-04-nombre.html", "grupo-10b-guia-04-nombre.html"],
  //   guideNumber: "4",
  //   guideTitle: "Guia 4 - Nombre de la guia",
  //   stateKey: "guia_interactiva_10a_guia4",
  //   program: "Sistemas Teleinformaticos",
  //   competencia: "220501121 - Descripcion de la competencia.",
  //   resultado: "RAP 0X - Descripcion del resultado de aprendizaje.",
  //   activities: [
  //     {
  //       id: "actividad411",
  //       number: "4.1.1",
  //       label: "Nombre completo de la actividad",
  //       shortName: "NombreBreve",
  //       type: "form",
  //       formFields: ["campo_a", "campo_b"],
  //       buttonIds: { save: "btnGuardar411", status: "status411" },
  //       wordExport: {
  //         sections: [
  //           { label: "1. Pregunta uno", storeKey: "campo_a" },
  //           { label: "2. Pregunta dos", storeKey: "campo_b" },
  //         ],
  //       },
  //     },
  //   ],
  // });

})();
