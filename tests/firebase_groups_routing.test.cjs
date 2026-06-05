"use strict";
// Garantiza que sena_portal_groups NO se enrute a Drive como colección
// primaria. Sus docId son hashes deterministas (g2act10_/g6_/g7_<ficha>_<hash>)
// que no contienen la usernameKey del miembro, así que la autorización por
// segmento de docId del Apps Script (docIdHasKeySegment en
// respaldo_firestore.gs) no puede mapearlos a un dueño y denegaría al propio
// integrante en cuanto se despliegue el fix C1. Los equipos deben leerse desde
// Firestore, donde las reglas autorizan por memberEmails. Las colecciones de
// alto volumen (progress, guide_state, tutoring) sí permanecen en Drive.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.join(__dirname, "..");
const db = fs.readFileSync(path.join(REPO_ROOT, "js", "firebase_db.js"), "utf8");

test("sena_portal_groups no se enruta a Drive como colección primaria", () => {
  assert.match(db, /var COL_GROUPS = "sena_portal_groups";/);
  assert.doesNotMatch(
    db,
    /DRIVE_PRIMARY_COLLECTIONS\[COL_GROUPS\]\s*=\s*true/,
    "los equipos deben leerse desde Firestore, no desde Drive (docId hash sin usernameKey)"
  );
});

test("las colecciones de alto volumen sí permanecen en Drive primario", () => {
  for (const col of ["COL_PROGRESS", "COL_GUIDE_STATE", "COL_TUTORING"]) {
    assert.match(
      db,
      new RegExp(`DRIVE_PRIMARY_COLLECTIONS\\[${col}\\]\\s*=\\s*true`),
      `${col} debe seguir enrutándose a Drive`
    );
  }
});
