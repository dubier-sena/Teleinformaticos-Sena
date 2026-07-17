"use strict";

// Guardas estaticas sobre firestore.rules (no hay emulador en este entorno):
// verifican que las clausulas que arreglaron el panel admin sigan presentes.
//
// Contexto (auditoria jul-2026): las respuestas de guia del aprendiz se
// guardan en sena_portal_progress con docId COMPUESTO
// "__guide_data__:student:{key}:{archivo}". La regla original solo comparaba
// el docId completo contra el email sintetico, asi que TODOS esos guardados
// devolvian 403 y quedaban unicamente en el respaldo de Drive — invisibles
// para el panel admin, que lee Firestore. Ademas, tras un reset de password
// el email pasa a "{key}.vN@..." y la igualdad exacta dejaba al aprendiz sin
// acceso a TODOS sus documentos. Si alguien borra estas clausulas, estos dos
// tests fallan antes de que el problema vuelva a produccion.

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const rules = fs.readFileSync(path.join(__dirname, "..", "firestore.rules"), "utf8");

test("propiedad por docId compuesto (__guide_data__/__guide_ui__) existe y se usa en progress", () => {
  assert.match(rules, /function isOwnerOfComposedStudentDoc\(/, "falta el helper isOwnerOfComposedStudentDoc");
  assert.match(rules, /__guide_\(data\|ui\)__:student:/, "el matcher debe cubrir __guide_data__ y __guide_ui__");
  assert.match(rules, /docId\.split\(':'\)\[2\]/, "el dueno es el segmento [2] del docId");
  const progressBlock = rules.split("match /sena_portal_progress/")[1] || "";
  assert.match(
    progressBlock.slice(0, 600),
    /isOwnerOfComposedStudentDoc\(/,
    "sena_portal_progress debe autorizar los docIds compuestos del aprendiz"
  );
});

test("emails versionados (.vN) se aceptan SOLO atestados por user_meta", () => {
  assert.match(rules, /function isOwnerByVersionedEmail\(/, "falta isOwnerByVersionedEmail");
  assert.match(
    rules,
    /sena_portal_user_meta\/\$\(usernameKey\)\)\.data\.authEmailVersion/,
    "la version valida debe salir de sena_portal_user_meta (atestada por admin)"
  );
  // isOwnerByUsernameKey debe aceptar el email exacto O el versionado atestado.
  const ownerFn = rules.split("function isOwnerByUsernameKey(")[1] || "";
  assert.match(ownerFn.slice(0, 300), /isOwnerByVersionedEmail\(usernameKey\)/);
});

test("usuarios con punto: el docId compuesto acepta el email SANEADO", () => {
  assert.match(rules, /function sanitizedTokenKey\(/, "falta sanitizedTokenKey");
  assert.match(rules, /replace\('\[\^a-z0-9_-\]', '_'\)/, "la sanitizacion debe replicar safeCloudKey del cliente");
  const composedFn = rules.split("function isOwnerOfComposedStudentDoc(")[1] || "";
  assert.match(composedFn.slice(0, 400), /sanitizedTokenKey\(\)/);
});

test("invariantes de seguridad intactas", () => {
  // Cierre total por defecto.
  assert.match(rules, /match \/\{document=\*\*\}[\s\S]{0,80}allow read, write: if false/);
  // El banco de soluciones sigue siendo solo-admin.
  const solutions = rules.split("match /sena_portal_grade_solutions/")[1] || "";
  assert.match(solutions.slice(0, 200), /allow read, write: if isAdmin\(\)/);
  // guide_state sigue validando pertenencia por campo usernameKey.
  const guideState = rules.split("match /sena_portal_guide_state/")[1] || "";
  assert.match(guideState.slice(0, 400), /resource\.data\.usernameKey/);
});

test("doc compartido de fechas de entrega: lectura para cualquier sesion, sin abrir escritura", () => {
  assert.match(rules, /function isSharedDeadlinesDoc\(/, "falta el helper isSharedDeadlinesDoc");
  assert.match(rules, /__guide_data__:admin:activity-deadlines:__activity_deadlines_v1/);
  const progressBlock = (rules.split("match /sena_portal_progress/")[1] || "").slice(0, 700);
  assert.match(
    progressBlock,
    /allow get: if signedIn\(\) && isSharedDeadlinesDoc\(usernameKey\)/,
    "progress debe permitir GET compartido del doc de fechas"
  );
  const guideStateBlock = (rules.split("match /sena_portal_guide_state/")[1] || "").slice(0, 700);
  assert.match(
    guideStateBlock,
    /allow get: if signedIn\(\) && isSharedDeadlinesDoc\(docId\)/,
    "guide_state (fallback del doc de fechas) debe permitir el mismo GET compartido"
  );
});
