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

// ───── sanitizedTokenKey(): CONFIRMADO con ejecucion real (2026-09-07) ──────
// Cerrado el caso limite que dejo pendiente la auditoria profunda. Se probo
// contra las reglas REALMENTE desplegadas (Firebase Console > Firestore >
// Rules > Playground, version activa 23-ago-2026 -- confirmado antes que el
// codigo del editor coincidia byte a byte con firestore.rules local alrededor
// de esta funcion, incluida la linea del .replace()), 4 casos con auth real:
//   1. get sena_portal_progress/__guide_data__:student:ana_maria_lopez:archivo
//      con auth.token.email=ana.maria.lopez@sena-portal.local -> ALLOW.
//      El panel de evaluacion de Firebase mostro sanitizedTokenKey() ==
//      "ana_maria_lopez" (las DOS coincidencias reemplazadas): descarta el
//      caso (2) "solo la primera coincidencia" y el caso (3) "substring
//      literal, no-op" -- el motor SI trata el patron string como regex
//      GLOBAL, igual que el safeCloudKey() del cliente.
//   2. Mismo docId, auth.token.email=otro.estudiante@sena-portal.local (un
//      tercero sin relacion) -> DENY. No hay fuga entre aprendices distintos
//      a traves de esta funcion.
//   3. get .../student:eimy_alvarez:archivo con email=eimy.alvarez@... ->
//      ALLOW. Confirma que la colision YA documentada arriba (lineas ~53-55)
//      se sigue comportando exactamente como esta descrita -- no es un
//      hallazgo nuevo, sigue siendo el riesgo aceptado de siempre.
//   4. Mismo docId del caso 1, sin autenticacion -> DENY.
// No hay emulador de Firestore en este entorno para ejecutar el motor de
// reglas real dentro de la suite, asi que este test fija en codigo el
// comportamiento EQUIVALENTE ya confirmado arriba (reemplazo global vía
// regex) como guarda de regresion: si alguien cambia el patron, el caracter
// de reemplazo, o quita la semantica global, este test debe fallar.
test("sanitizedTokenKey(): el patron string de .replace() se comporta como regex GLOBAL (confirmado en Firebase Console Rules Playground contra las reglas desplegadas, no solo la primera coincidencia ni substring literal)", () => {
  const fnBody = (rules.split("function sanitizedTokenKey()")[1] || "").split("}")[0];
  const call = fnBody.match(/\.replace\('([^']+)',\s*'([^']+)'\)/);
  assert.ok(call, "no se encontro la llamada a .replace() dentro de sanitizedTokenKey()");
  const [, pattern, replacement] = call;
  // Firestore aplica este patron como regex GLOBAL (confirmado en vivo en el
  // Playground, ver comentario arriba) -- reproducimos esa semantica exacta
  // en Node (que por defecto con un string SOLO reemplaza la primera
  // coincidencia) para fijar el comportamiento real ya verificado.
  const sanitizeLikeFirestoreRules = (input) => input.replace(new RegExp(pattern, "g"), replacement);
  assert.strictEqual(
    sanitizeLikeFirestoreRules("ana.maria.lopez"),
    "ana_maria_lopez",
    "con 2+ caracteres especiales, TODAS las coincidencias deben reemplazarse (no solo la primera) -- verificado ALLOW real en Playground"
  );
  assert.strictEqual(
    sanitizeLikeFirestoreRules("eimy.alvarez"),
    "eimy_alvarez",
    "debe coincidir con el segmento que el cliente (safeCloudKey) ya genero para este mismo usuario"
  );
});

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
