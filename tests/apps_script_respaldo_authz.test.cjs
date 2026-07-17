"use strict";
// Prueba de la decision PURA de autorizacion de apps-script/respaldo_firestore.gs
// (cierra el IDOR C1). Carga el .gs y ejercita authorizeRequest sin tocar Drive.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const gs = fs.readFileSync(
  path.join(__dirname, "..", "apps-script", "respaldo_firestore.gs"),
  "utf8"
);
// Exponer las funciones puras. Los cuerpos que usan DriveApp/PropertiesService
// no se ejecutan al solo definirse, asi que no hace falta stub.
const api = new Function(
  gs + "\nreturn { authorizeRequest, usernameKeyFromEmail, docIdHasKeySegment, splitVersionedEmail };"
)();
const { authorizeRequest } = api;

const ADMINS = ["dubier@sena-portal.local"];
function as(user) { return user + "@sena-portal.local"; }
function authz(o) {
  return authorizeRequest(Object.assign({ adminEmails: ADMINS }, o));
}

test("admin (por email) accede a todo, incluso user_auth y list", () => {
  for (const action of ["get", "set", "updatefield", "delete", "list"]) {
    const r = authz({ action, collection: "sena_portal_user_auth", docId: "maria", email: as("dubier"), uid: "adminuid" });
    assert.strictEqual(r.ok, true, "admin debe poder " + action);
    assert.strictEqual(r.admin, true);
  }
});

test("aprendiz: acceso a SU propio documento (varias colecciones)", () => {
  assert.strictEqual(authz({ action: "get", collection: "sena_portal_progress", docId: "juan", email: as("juan") }).ok, true);
  assert.strictEqual(authz({ action: "set", collection: "sena_portal_progress", docId: "juan", email: as("juan") }).ok, true);
  assert.strictEqual(authz({ action: "get", collection: "sena_portal_user_auth", docId: "juan", email: as("juan") }).ok, true);
  assert.strictEqual(authz({ action: "get", collection: "sena_portal_user_meta", docId: "juan", email: as("juan") }).ok, true);
  assert.strictEqual(authz({ action: "get", collection: "sena_portal_guide_state", docId: "__guide_data__:student:juan:grupo_10b_guia3_html", email: as("juan") }).ok, true);
});

test("IDOR cerrado: aprendiz NO accede a documentos de otro", () => {
  assert.strictEqual(authz({ action: "get", collection: "sena_portal_progress", docId: "maria", email: as("juan") }).ok, false);
  // hash de contrasena de otro -> denegado (la fuga mas grave)
  assert.strictEqual(authz({ action: "get", collection: "sena_portal_user_auth", docId: "maria", email: as("juan") }).ok, false);
  assert.strictEqual(authz({ action: "delete", collection: "sena_portal_progress", docId: "maria", email: as("juan") }).ok, false);
  assert.strictEqual(authz({ action: "get", collection: "sena_portal_guide_state", docId: "__guide_data__:student:maria:grupo_10b_guia3_html", email: as("juan") }).ok, false);
});

test("limite de segmento: 'juan' NO calza con 'juana'", () => {
  assert.strictEqual(authz({ action: "get", collection: "sena_portal_progress", docId: "juana", email: as("juan") }).ok, false);
  assert.strictEqual(authz({ action: "get", collection: "sena_portal_guide_state", docId: "__guide_data__:student:juana:f", email: as("juan") }).ok, false);
  // y 'juana' SI accede al suyo
  assert.strictEqual(authz({ action: "get", collection: "sena_portal_progress", docId: "juana", email: as("juana") }).ok, true);
});

test("calendario: lectura compartida, escritura solo admin", () => {
  assert.strictEqual(authz({ action: "get", collection: "sena_portal_calendar", docId: "academico-2026", email: as("juan") }).ok, true);
  assert.strictEqual(authz({ action: "set", collection: "sena_portal_calendar", docId: "academico-2026", email: as("juan") }).ok, false);
  // respaldo del calendario dentro de progress
  assert.strictEqual(authz({ action: "get", collection: "sena_portal_progress", docId: "__calendar__:academico-2026", email: as("juan") }).ok, true);
  assert.strictEqual(authz({ action: "set", collection: "sena_portal_progress", docId: "__calendar__:academico-2026", email: as("juan") }).ok, false);
});

test("list: admin-only en colecciones sensibles, compartido en el resto", () => {
  assert.strictEqual(authz({ action: "list", collection: "sena_portal_users", email: as("juan") }).ok, false);
  assert.strictEqual(authz({ action: "list", collection: "sena_portal_user_auth", email: as("juan") }).ok, false);
  assert.strictEqual(authz({ action: "list", collection: "sena_portal_progress", email: as("juan") }).ok, false);
  assert.strictEqual(authz({ action: "list", collection: "sena_portal_guide_state", email: as("juan") }).ok, false);
  // compartidas (los aprendices ven citas/grupos de su contexto)
  assert.strictEqual(authz({ action: "list", collection: "sena_portal_tutoring_bookings", email: as("juan") }).ok, true);
  assert.strictEqual(authz({ action: "list", collection: "sena_portal_groups", email: as("juan") }).ok, true);
});

test("grupos: miembros si, ajenos no", () => {
  assert.strictEqual(authz({ action: "updatefield", collection: "sena_portal_groups", docId: "juan-maria", email: as("juan") }).ok, true);
  assert.strictEqual(authz({ action: "updatefield", collection: "sena_portal_groups", docId: "juan-maria", email: as("maria") }).ok, true);
  assert.strictEqual(authz({ action: "updatefield", collection: "sena_portal_groups", docId: "juan-maria", email: as("pedro") }).ok, false);
});

test("tutoring: el dueno de la cita si, otro no", () => {
  assert.strictEqual(authz({ action: "delete", collection: "sena_portal_tutoring_bookings", docId: "2026-06-04_3441942_juan", email: as("juan") }).ok, true);
  assert.strictEqual(authz({ action: "delete", collection: "sena_portal_tutoring_bookings", docId: "2026-06-04_3441942_juan", email: as("pedro") }).ok, false);
});

test("user_index: propiedad por uid del token", () => {
  assert.strictEqual(authz({ action: "get", collection: "sena_portal_user_index", docId: "uid-abc", email: as("juan"), uid: "uid-abc" }).ok, true);
  assert.strictEqual(authz({ action: "get", collection: "sena_portal_user_index", docId: "uid-otro", email: as("juan"), uid: "uid-abc" }).ok, false);
});

test("sin email valido en token -> denegado", () => {
  assert.strictEqual(authz({ action: "get", collection: "sena_portal_progress", docId: "juan", email: "" }).ok, false);
});

// ── Emails versionados (reset de password: "{key}.vN@sena-portal.local") ──────

test("splitVersionedEmail separa base y version", () => {
  assert.deepStrictEqual(api.splitVersionedEmail("juan@sena-portal.local"), { base: "juan", version: 1 });
  assert.deepStrictEqual(api.splitVersionedEmail("juan.v2@sena-portal.local"), { base: "juan", version: 2 });
  assert.deepStrictEqual(api.splitVersionedEmail("maria.perez.v10@sena-portal.local"), { base: "maria.perez", version: 10 });
});

test("aprendiz reseteado (v2 ATESTADA) accede a sus propios docs", () => {
  const r = authz({
    action: "set",
    collection: "sena_portal_progress",
    docId: "__guide_data__:student:juan:grupo-10a-guia-01_html",
    email: as("juan.v2"),
    attestedVersion: 2,
  });
  assert.strictEqual(r.ok, true, "v2 atestada debe autorizar la clave base");
});

test("email versionado SIN atestacion (o con otra version) -> denegado", () => {
  // Sin atestacion: nadie confirmo que 'juan' este en v2 -> podria ser un
  // suplantador que creo la cuenta juan.v2 por su lado.
  assert.strictEqual(
    authz({ action: "get", collection: "sena_portal_progress", docId: "juan", email: as("juan.v2"), attestedVersion: 0 }).ok,
    false
  );
  assert.strictEqual(
    authz({ action: "get", collection: "sena_portal_progress", docId: "juan", email: as("juan.v3"), attestedVersion: 2 }).ok,
    false
  );
});

test("aprendiz reseteado atestado NO gana acceso a docs ajenos", () => {
  assert.strictEqual(
    authz({ action: "get", collection: "sena_portal_progress", docId: "maria", email: as("juan.v2"), attestedVersion: 2 }).ok,
    false
  );
});

test("admin con email versionado atestado sigue siendo admin", () => {
  const r = authz({ action: "list", collection: "sena_portal_users", email: as("dubier.v2"), attestedVersion: 2 });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.admin, true);
});

test("usuario con punto accede a su docId compuesto SANEADO (eimy.alvarez -> eimy_alvarez)", () => {
  const r = authz({
    action: "set",
    collection: "sena_portal_progress",
    docId: "__guide_data__:student:eimy_alvarez:grupo-10b-guia-01_html",
    email: as("eimy.alvarez"),
  });
  assert.strictEqual(r.ok, true, "el segmento saneado debe reconocerse como propio");
  // y sigue sin poder tocar docs de otros
  assert.strictEqual(
    authz({ action: "set", collection: "sena_portal_progress", docId: "__guide_data__:student:maria:g1", email: as("eimy.alvarez") }).ok,
    false
  );
});

test("email v1 sin sufijo no exige atestacion (comportamiento previo intacto)", () => {
  assert.strictEqual(
    authz({ action: "get", collection: "sena_portal_progress", docId: "juan", email: as("juan") }).ok,
    true
  );
});
