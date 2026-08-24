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

test("list: admin-only en colecciones sensibles", () => {
  assert.strictEqual(authz({ action: "list", collection: "sena_portal_users", email: as("juan") }).ok, false);
  assert.strictEqual(authz({ action: "list", collection: "sena_portal_user_auth", email: as("juan") }).ok, false);
  assert.strictEqual(authz({ action: "list", collection: "sena_portal_progress", email: as("juan") }).ok, false);
  assert.strictEqual(authz({ action: "list", collection: "sena_portal_guide_state", email: as("juan") }).ok, false);
});

// Fase 7 (auditoria profunda): antes estas dos eran "compartidas" (cualquier
// aprendiz podia listar), pero action:"list" vuelca hasta 300 documentos
// COMPLETOS sin filtro -- tutoring_bookings expone nombre completo/tema/
// horario de TODAS las fichas, groups expone memberEmails de TODOS los
// equipos. El aprendiz SI ve sus citas/grupos propios via "get"/"updatefield"
// por docId conocido (ya probado en otros tests de este archivo) o via
// Firestore directo con filtro de ficha (sena_portal_groups ya filtraba por
// membresia en las reglas; sena_portal_tutoring_bookings se corrigio aparte,
// ver requesterFicha() en firestore.rules) -- pero el volcado sin filtro de
// esta accion queda restringido al admin.
test("Fase 7 -- tutoring_bookings y groups: list es admin-only (fuga de datos entre fichas/equipos cerrada)", () => {
  assert.strictEqual(authz({ action: "list", collection: "sena_portal_tutoring_bookings", email: as("juan") }).ok, false);
  assert.strictEqual(authz({ action: "list", collection: "sena_portal_groups", email: as("juan") }).ok, false);
  assert.strictEqual(authz({ action: "list", collection: "sena_portal_tutoring_bookings", email: as("dubier") }).ok, true);
  assert.strictEqual(authz({ action: "list", collection: "sena_portal_groups", email: as("dubier") }).ok, true);
});

// Fase 8 (auditoria profunda): "integrity_evidence" guarda nombre completo,
// ficha e institucion de CADA aprendiz junto a sus senales de integridad.
// Antes de este fix NO estaba en LIST_ADMIN_ONLY_COLLECTIONS: cualquier
// aprendiz autenticado podia listar hasta 300 documentos con esos datos de
// TODOS los demas aprendices (p.ej. window.driveDb.list("integrity_evidence")
// desde la consola del navegador) -- una fuga de privacidad real entre
// companeros, no solo falta de aviso.
test("Fase 8 -- integrity_evidence: list es admin-only (fuga de privacidad entre companeros cerrada)", () => {
  assert.strictEqual(
    authz({ action: "list", collection: "integrity_evidence", email: as("juan") }).ok,
    false,
    "un aprendiz NUNCA debe poder listar las senales de integridad de otros aprendices"
  );
  assert.strictEqual(
    authz({ action: "list", collection: "integrity_evidence", email: as("dubier") }).ok,
    true,
    "el admin si debe poder listarlas"
  );
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

// ───── Fase 5 (auditoria profunda): cierre del fallback Drive por UID ──────
// El respaldo de Drive (este script) tenia la MISMA ambiguedad que las
// reglas de Firestore antes del fix: actorOwnsDoc solo comparaba
// username exacto/saneado, sin usar el uid verificado del actor para nada
// (salvo el caso especial de user_index). Estas pruebas demuestran que, con
// el esquema nuevo por UID, Firestore arriba y el fallback de Drive abajo
// aplican el MISMO modelo de identidad -- sin colision, incluso con
// Firestore caido.

test("Fase 5 -- eimy_alvarez y eimy.alvarez (UIDs reales distintos): aislamiento COMPLETO en el fallback de Drive", () => {
  const UID_UNDERSCORE = "uid-real-underscore";
  const UID_DOT = "uid-real-dot";
  const fileKey = "grupo10a_guia1_html";
  const docIdOfUnderscore = `__guide_data__:uid:${UID_UNDERSCORE}:${fileKey}`;
  const docIdOfDot = `__guide_data__:uid:${UID_DOT}:${fileKey}`;

  // Usuario A (eimy_alvarez) sobre SU propio doc UID: PASA.
  ["get", "set"].forEach((action) => {
    assert.strictEqual(
      authz({ action, collection: "sena_portal_progress", docId: docIdOfUnderscore, email: as("eimy_alvarez"), uid: UID_UNDERSCORE }).ok,
      true,
      `A debe poder ${action} su propio doc UID`
    );
  });
  // Usuario B (eimy.alvarez) sobre el doc UID de A: FALLA.
  ["get", "set"].forEach((action) => {
    assert.strictEqual(
      authz({ action, collection: "sena_portal_progress", docId: docIdOfUnderscore, email: as("eimy.alvarez"), uid: UID_DOT }).ok,
      false,
      `B NO debe poder ${action} el doc UID de A`
    );
  });

  // Invertido: B sobre SU propio doc UID: PASA. A sobre el de B: FALLA.
  ["get", "set"].forEach((action) => {
    assert.strictEqual(
      authz({ action, collection: "sena_portal_progress", docId: docIdOfDot, email: as("eimy.alvarez"), uid: UID_DOT }).ok,
      true,
      `B debe poder ${action} su propio doc UID`
    );
    assert.strictEqual(
      authz({ action, collection: "sena_portal_progress", docId: docIdOfDot, email: as("eimy_alvarez"), uid: UID_UNDERSCORE }).ok,
      false,
      `A NO debe poder ${action} el doc UID de B`
    );
  });
});

test("Fase 5 -- documento LEGADO sigue accesible por su dueno legitimo (compatibilidad temporal)", () => {
  const legacyDocId = "__guide_data__:student:eimy_alvarez:grupo10a_guia1_html";
  assert.strictEqual(
    authz({ action: "get", collection: "sena_portal_progress", docId: legacyDocId, email: as("eimy_alvarez"), uid: "cualquier-uid-no-importa-aqui" }).ok,
    true,
    "el dueno legitimo de un doc legado real debe seguir accediendo (via username, el uid no interviene en este esquema)"
  );
});

test("Fase 5 -- una colision de USERNAME nunca da acceso a un doc del esquema UID", () => {
  // "eimy.alvarez" sanea al mismo segmento que el docId LEGADO de
  // "eimy_alvarez" (riesgo aceptado y documentado para el esquema viejo).
  // Confirma que esa MISMA colision de username no se filtra al esquema
  // nuevo: solo el uid exacto autoriza un doc UID.
  const uidDocIdDeEimyAlvarezReal = "__guide_data__:uid:uid-de-eimy-alvarez-real:grupo10a_guia1_html";
  assert.strictEqual(
    authz({
      action: "get",
      collection: "sena_portal_progress",
      docId: uidDocIdDeEimyAlvarezReal,
      email: as("eimy.alvarez"),
      uid: "uid-de-eimy-punto-alvarez-real",
    }).ok,
    false,
    "la colision de username no debe alcanzar el esquema UID -- solo el uid exacto autoriza"
  );
});

test("Fase 5 -- un doc UID es EXCLUYENTE: nunca cae al camino legado aunque el username aparezca como substring del docId", () => {
  const docId = "__guide_data__:uid:contiene-a-juan-por-coincidencia:archivo";
  assert.strictEqual(
    authz({ action: "get", collection: "sena_portal_progress", docId, email: as("juan"), uid: "uid-de-juan-real" }).ok,
    false,
    "sin el uid EXACTO, debe denegarse aunque el username del actor aparezca dentro del docId"
  );
});

test("fechas de entrega: lectura compartida, escritura solo admin", () => {
  const DL = "__guide_data__:admin:activity-deadlines:__activity_deadlines_v1";
  for (const collection of ["sena_portal_progress", "sena_portal_guide_state"]) {
    assert.strictEqual(authz({ action: "get", collection, docId: DL, email: as("juan") }).ok, true, "aprendiz debe LEER las fechas en " + collection);
    assert.strictEqual(authz({ action: "set", collection, docId: DL, email: as("juan") }).ok, false, "aprendiz NO debe escribir las fechas");
    assert.strictEqual(authz({ action: "delete", collection, docId: DL, email: as("juan") }).ok, false);
    assert.strictEqual(authz({ action: "set", collection, docId: DL, email: as("dubier"), uid: "adminuid" }).ok, true, "el admin si escribe las fechas");
  }
});
