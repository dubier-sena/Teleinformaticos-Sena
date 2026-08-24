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
  // guide_state sigue validando pertenencia (Fase 5: ahora por docId
  // compuesto -- student/uid -- con el campo usernameKey/_usernameKey como
  // camino de compatibilidad adicional, ver isOwnerOfGuideStateDoc).
  const guideState = rules.split("match /sena_portal_guide_state/")[1] || "";
  assert.match(guideState.slice(0, 400), /isOwnerOfGuideStateDoc\(/);
});

test("Fase 7 (auditoria profunda) -- sena_portal_users: get puntual restringido al dueno o admin", () => {
  // Antes: `allow get: if signedIn();` dejaba leer el perfil COMPLETO
  // (nombre + ficha) de CUALQUIER otro aprendiz con solo conocer su
  // usernameKey (visible en URLs/REST), sin pasar por "list" (que si esta
  // acotado a la misma ficha). Verificado que ningun uso real (cloudGetUser
  // en firebase_db.js) necesitaba leer el perfil de un companero antes de
  // aplicar este cambio.
  const usersBlock = (rules.split("match /sena_portal_users/")[1] || "").slice(0, 1600);
  assert.match(
    usersBlock,
    /allow get: if isOwnerByUsernameKey\(usernameKey\) \|\| isAdmin\(\)/,
    "get debe exigir ser el propio dueno o admin"
  );
  assert.doesNotMatch(
    usersBlock,
    /allow get: if signedIn\(\);/,
    "no debe quedar la version antigua (cualquier sesion autenticada leia el perfil de cualquier otro aprendiz)"
  );
  // La lectura en lote (list) sigue acotada a la misma ficha: invariante que
  // este cambio de Fase 7 no debe tocar.
  assert.match(
    usersBlock,
    /allow list: if isAdmin\(\)\s*\n\s*\|\| \(signedIn\(\) && resource\.data\.ficha == requesterFicha\(\)\)/,
    "list debe seguir acotada a la ficha del solicitante"
  );
});

// ───── Fase 5 (auditoria profunda): migracion a UID en sena_portal_progress ─

test("isOwnerOfComposedUidDoc existe y usa request.auth.uid directamente (no usernameKey)", () => {
  assert.match(rules, /function isOwnerOfComposedUidDoc\(/, "falta el helper isOwnerOfComposedUidDoc");
  const fnBody = rules.split("function isOwnerOfComposedUidDoc(")[1] || "";
  assert.match(
    fnBody.slice(0, 300),
    /__guide_\(data\|ui\)__:uid:/,
    "el matcher debe cubrir el esquema __guide_data__:uid: / __guide_ui__:uid:"
  );
  assert.match(
    fnBody.slice(0, 300),
    /docId\.split\(':'\)\[2\]\s*==\s*request\.auth\.uid/,
    "la propiedad debe compararse directamente contra request.auth.uid, sin pasar por usernameKey"
  );
});

test("sena_portal_progress: la autorizacion por UID se agrega, la legada NO se retira (aditivo)", () => {
  const progressBlock = (rules.split("match /sena_portal_progress/")[1] || "").slice(0, 500);
  assert.match(progressBlock, /isOwnerByUsernameKey\(usernameKey\)/, "el camino legado por usernameKey exacto debe seguir presente");
  assert.match(progressBlock, /isOwnerOfComposedStudentDoc\(usernameKey\)/, "el camino legado por docId compuesto (student) debe seguir presente");
  assert.match(progressBlock, /isOwnerOfComposedUidDoc\(usernameKey\)/, "debe agregarse el camino nuevo por UID");
});

test("sena_portal_guide_state: acepta usernameKey O _usernameKey (compatibilidad con docs antiguos)", () => {
  assert.match(rules, /function guideStateOwnerKey\(/, "falta el helper guideStateOwnerKey");
  const fnBody = rules.split("function guideStateOwnerKey(")[1] || "";
  assert.match(fnBody.slice(0, 200), /data\.usernameKey\s*!=\s*null\s*\?\s*data\.usernameKey\s*:\s*data\._usernameKey/);
});

test("sena_portal_guide_state: create/read/update usan isOwnerOfGuideStateDoc con docId compuesto (student Y uid) mas fallback por campo", () => {
  assert.match(rules, /function isOwnerOfGuideStateDoc\(/, "falta el helper isOwnerOfGuideStateDoc");
  const fnBody = rules.split("function isOwnerOfGuideStateDoc(")[1] || "";
  const body = fnBody.slice(0, 400);
  assert.match(body, /isOwnerOfComposedStudentDoc\(docId\)/);
  assert.match(body, /isOwnerOfComposedUidDoc\(docId\)/);
  assert.match(body, /guideStateOwnerKey\(data\)/);

  const guideStateBlock = (rules.split("match /sena_portal_guide_state/")[1] || "").slice(0, 700);
  assert.match(guideStateBlock, /allow create: if isAdmin\(\)\s*\n\s*\|\| \(signedIn\(\) && isOwnerOfGuideStateDoc\(docId, request\.resource\.data\)\)/);
  assert.match(guideStateBlock, /allow read: if isAdmin\(\)\s*\n\s*\|\| \(signedIn\(\) && isOwnerOfGuideStateDoc\(docId, resource\.data\)\)/);
});

// ───── sanitizedTokenKey(): PENDIENTE DE CONFIRMACION (auditoria profunda) ──
// No se modifico la funcion (instruccion explicita del usuario: sin emulador
// de Firestore disponible en este entorno, no hay como confirmar el
// comportamiento real de .replace() con un patron pasado como string). Este
// test.todo es el recordatorio permanente en la suite -- ver el comentario
// "PENDIENTE DE CONFIRMACION" junto a sanitizedTokenKey() en firestore.rules
// para la estrategia de validacion concreta (Firebase Console Rules
// Playground, sin instalar nada).
test.todo(
  "PENDIENTE DE CONFIRMACION: sanitizedTokenKey() puede no reemplazar TODAS las coincidencias " +
  "(o ninguna, si .replace() trata el patron como substring literal) -- validar con Firebase " +
  "Console > Firestore > Rules > Playground: get sobre " +
  "sena_portal_progress/__guide_data__:student:ana_maria_lopez:archivo con " +
  "auth.token.email=ana.maria.lopez@sena-portal.local. Si el resultado es Deny, corregir la funcion."
);

test("Fase 7 (auditoria profunda) -- sena_portal_tutoring_bookings: read acotado a dueno o misma ficha, nunca cualquier ficha", () => {
  const block = (rules.split("match /sena_portal_tutoring_bookings/")[1] || "").slice(0, 3500);
  assert.doesNotMatch(block, /allow read: if signedIn\(\);/, "no debe quedar la version antigua (cualquier sesion leia cualquier reserva)");
  assert.match(block, /allow read: if isAdmin\(\)\s*\n\s*\|\| isTutoringOwnerOfResource\(\)\s*\n\s*\|\| \(signedIn\(\) && resource\.data\.ficha == requesterFicha\(\)\)/);
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
