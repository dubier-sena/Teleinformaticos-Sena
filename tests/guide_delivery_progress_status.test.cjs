const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");
}

const ACTIVE_GUIDE_PARTIALS = [
  "partials/guia-01-induccion-content.html",
  "partials/guia-02-herramientas-content.html",
  "partials/guia-05-herramientas-content.html",
  "partials/guia-06-planificar-content.html",
  "partials/guia-redes-rap01-content.html",
];

test("las entregas compartidas muestran un estado visible en la actividad", () => {
  const sharedDrive = read("js/shared_drive_delivery.js");

  assert.match(sharedDrive, /data-drive-delivery-status/);
  assert.match(sharedDrive, /function renderDeliveryStatus/);
  assert.match(sharedDrive, /Entrega registrada/);
  assert.match(sharedDrive, /document\.addEventListener\("guide-delivery-registered"/);
  assert.match(sharedDrive, /delivery-deadline-admin-slot/);
  assert.match(sharedDrive, /delivery-deadline-note-slot/);
  assert.match(sharedDrive, /applyDeliveryDeadlineState/);
});

test("la entrega segura notifica a la guia cuando el archivo queda registrado", () => {
  const sharedApps = read("js/shared_apps_script_delivery.js");

  assert.match(sharedApps, /function notifyDeliveryRegistered/);
  assert.match(sharedApps, /guide-delivery-registered/);
  assert.match(sharedApps, /response\.savedFileName/);
  assert.match(sharedApps, /response\.driveUrl/);
});

test("la plantilla de guia expone una forma compartida de marcar actividades completadas", () => {
  const template = read("js/guia_template.js");

  assert.match(template, /window\.setGuideActivitySeen = function \(activity, seen\)/);
  assert.match(template, /localStorage\.setItem\(activityStorageKey\(activityKey\), seen \? "1" : "0"\)/);
  assert.match(template, /notifyGuideProgressChanged\(\);/);
});

test("la guia de redes separa la entrega de la reflexion en un bloque propio para no deformar la fila de botones", () => {
  const partial = read("partials/guia-redes-rap01-content.html");
  const redesScript = read("js/script_guia_redes.js");

  assert.match(partial, /id="reflexion311DeliveryControls"/);
  assert.match(partial, /id="btnSubirReflexion311"/);
  assert.match(
    partial,
    /<div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">[\s\S]*Guardar respuestas[\s\S]*Exportar a Word[\s\S]*<\/div>\s*<div id="reflexion311DeliveryControls"/
  );
  assert.match(redesScript, /noticeMount:\s*\{\s*mountSelector:\s*"#reflexion311DeliveryControls"/);
  assert.match(redesScript, /wrapAction\("subirReflexion311AlDrive", "reflexion311"\)/);
});

test("las guias con fecha opcional reservan un bloque propio para el control admin", () => {
  const guide2 = read("partials/guia-02-herramientas-content.html");
  const guide6 = read("partials/guia-06-planificar-content.html");

  assert.match(guide2, /id="extensiones331DeadlineControls"/);
  assert.match(guide2, /id="sistemas332DeadlineControls"/);
  assert.match(guide2, /id="colaborativas334DeadlineControls"/);
  assert.match(guide2, /id="transferReto341DeadlineControls"/);
  assert.match(guide6, /id="bitacora311DeadlineControls"/);
  assert.match(guide6, /id="socializacion312DeadlineControls"/);
});

test("las guias activas no mezclan guardar exportar y entrega en la misma fila de acciones", () => {
  for (const partialPath of ACTIVE_GUIDE_PARTIALS) {
    const lines = read(partialPath).split(/\r?\n/);
    lines.forEach((line, index) => {
      if (!/Subir al Drive|Subir al portafolio de Drive/i.test(line)) {
        return;
      }
      const windowStart = Math.max(0, index - 12);
      const snippet = lines.slice(windowStart, index + 1).join("\n");
      const hasInlineContainer = /display:flex/.test(snippet);
      const hasSaveOrSend = /Guardar respuestas|Guardar respuestas del laboratorio|Enviar/.test(snippet);
      const hasWordExport = /Exportar[^<]*Word/.test(snippet);
      assert.equal(
        hasInlineContainer && hasSaveOrSend && hasWordExport,
        false,
        `${partialPath} no debe mezclar guardar/exportar/entrega en la misma fila`
      );
    });
  }
});

test("las guias activas conservan la edicion de fechas dentro de la guia para admin", () => {
  const deadlineScript = read("js/activity_deadlines.js");
  const inductionPartial = read("partials/guia-01-induccion-content.html");
  const inductionScript = read("js/script_induccion.js");
  const sharedDrive = read("js/shared_drive_delivery.js");
  const redesScript = read("js/script_guia_redes.js");

  const guia5Partial = read("partials/guia-05-herramientas-content.html");
  const guia5Script = read("js/script_guia5.js");

  assert.match(deadlineScript, /activity-deadline-admin-inline/);
  assert.match(deadlineScript, /Guardar fecha/);
  assert.match(inductionPartial, /id="arbol312DeadlineControls"/);
  assert.match(inductionPartial, /data-induccion-delivery="arbol312"/);
  assert.match(inductionScript, /installInduccionDeadlineControls/);
  assert.match(sharedDrive, /delivery-deadline-admin-slot/);
  assert.match(redesScript, /adminMount:\s*\{\s*mountSelector:\s*"#reflexion311DeliveryControls"/);
  assert.match(redesScript, /adminMount:\s*\{\s*mountSelector:\s*"#socializacion311DeadlineControls"/);
  assert.match(guia5Partial, /id="guia5311DeadlineControls"/);
  assert.match(guia5Partial, /id="guia5331DeadlineControls"/);
  assert.match(guia5Partial, /id="guia5341DeadlineControls"/);
  assert.match(guia5Script, /installGuia5DeadlineControls/);
  assert.match(guia5Script, /guia5-311/);
  assert.match(guia5Script, /guia5-331/);
  assert.match(guia5Script, /guia5-341/);
});

test("la guia de induccion ya no muestra el boton visible de guardar progreso", () => {
  const partial = read("partials/guia-01-induccion-content.html");

  assert.doesNotMatch(partial, /💾\s*Guardar progreso/);
});
