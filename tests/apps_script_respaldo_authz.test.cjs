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
  gs + "\nreturn { authorizeRequest, usernameKeyFromEmail, docIdHasKeySegment };"
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
