'use strict';
// Preparation only: no network, deployment, account assignment or production writes.
const crypto = require('node:crypto');
const I = require('../js/academic_planner_integration.js');
const sessionRules = require('node:fs').readFileSync(require('node:path').join(__dirname,'../config/academic_calendar_sessions.rules'),'utf8');

const calendarRules = `
    // Calendar source documents contain multiple fichas: admin only.
    match /sena_portal_calendar/{calendarId} {
      allow read, write: if isAdmin();
    }
    // 2026-10-28: el calendario ya no usa documentos de asignación (cuentas actuales). Nadie puede crearlos;
    // el administrador solo puede leer los que existieran de ensayos anteriores.
    match /sena_portal_calendar_assignments/{uid} {
      allow get, list: if isAdmin();
      allow create, update, delete: if false;
    }
    // 2026-10-28 (cuentas actuales, sin asignaciones nuevas): la ficha del aprendiz sale de SU PERFIL
    // EXISTENTE. La identidad viene del correo verificado por Firebase Auth (con la versión .vN atestada,
    // la misma comprobación de isOwnerByUsernameKey) y el perfil solo cuenta si el administrador validó
    // el nombre. Es confiable porque las reglas de sena_portal_users ya no dejan al aprendiz cambiar su
    // ficha ni su validación (ver prepareRules).
    function calLearnerKey() {
      return request.auth.token.email.split('@')[0].replace('[.]v[0-9]+$', '');
    }
    function calendarAssigned(ficha) {
      let key = calLearnerKey();
      let p = get(/databases/$(database)/documents/sena_portal_users/$(key)).data;
      return isAdmin() || (isOwnerByUsernameKey(key) && p.ficha == ficha
        && p.get('validacionNombre', '') in ['oficial', 'duplicado_diferenciado']
        && p.get('active', true) != false && p.get('estado', 'activo') != 'inactivo');
    }
    match /sena_portal_calendar_fichas/{ficha}/years/{year} {
      allow get: if isAdmin() || (signedIn() && calEditor(ficha)
        && resource.data.ficha == ficha && resource.data.year == int(year));
      allow list: if isAdmin();
      // Materialized views are produced by a trusted backend/admin, never a student.
      allow create, update, delete: if isAdmin();
    }
`;

function prepareRules(base) {
  const source = base.replace(/\r\n/g, '\n');
  const pattern = /    match \/sena_portal_calendar\/\{calendarId\} \{\n      allow read: if signedIn\(\);\n      allow write: if isAdmin\(\);\n    \}/g;
  if ([...source.matchAll(pattern)].length !== 1) throw Error('Calendar rules baseline changed; review required.');
  // Prevent a specially named account from accessing the legacy fallback through ownership.
  const progress = /match \/sena_portal_progress\/\{usernameKey\} \{([\s\S]*?)\n    \}/;
  const m = source.match(progress);
  if (!m || !m[1].includes('allow read, write: if isAdmin()')) throw Error('Progress baseline changed.');
  const replacement = m[0].replace(
    /allow read, write: if isAdmin\(\)([\s\S]*?);/,
    (_, alternatives) => 'allow read, write: if isAdmin() || (!usernameKey.matches("^__calendar__:.*$") && (false' + alternatives + '));'
  );
  // Perfil del aprendiz: el dueño puede seguir creándolo y actualizándolo, pero NO cambiar su ficha ni su
  // validación (solo el administrador). Endurece la regla vigente; no modifica ninguna cuenta.
  const usersRule = '      allow create, update: if isAdmin() || isOwnerByUsernameKey(usernameKey);';
  const usersMatch = source.match(/match \/sena_portal_users\/\{usernameKey\} \{[\s\S]*?\n    \}/);
  if (!usersMatch || usersMatch[0].split(usersRule).length !== 2) throw Error('Users baseline changed; review required.');
  const usersLocked = usersMatch[0].replace(usersRule, [
    "      allow create: if isAdmin() || (isOwnerByUsernameKey(usernameKey)",
    "        && !(request.resource.data.get('validacionNombre', '') in ['oficial', 'duplicado_diferenciado']));",
    "      allow update: if isAdmin() || (isOwnerByUsernameKey(usernameKey)",
    "        && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['ficha', 'validacionNombre', 'nombreOficial', 'fuenteValidacion', 'active', 'estado', 'status']));"].join('\n'));
  return source.replace(pattern, () => calendarRules.trimEnd() + '\n' + sessionRules).replace(m[0], replacement).replace(usersMatch[0], usersLocked);
}

function prepareDrive(base) {
  const marker = '  if (action === "list") {';
  if (base.split(marker).length !== 2) throw Error('Drive authorization baseline changed; review required.');
  // Insert after existing verified admin handling, before generic list/ownership grants.
  return base.replace(marker, `  // Calendar reads use Firestore with attested ficha assignment. No Drive bypass.
  if (collection === "sena_portal_calendar" ||
      collection === "sena_portal_calendar_assignments" ||
      collection === "sena_portal_calendar_fichas" ||
      (collection === "sena_portal_progress" && docId.indexOf("__calendar__:") === 0)) {
    return { ok: false, message: "Calendario restringido: consultar la vista autorizada por ficha en Firestore." };
  }
` + marker);
}

function readModels({records, seed = {}, snapshot, mapping, year, readTime}) {
  if (!Number.isInteger(year) || !snapshot?.state || !readTime) throw Error('Incomplete source snapshot.');
  const raw = JSON.stringify(snapshot);
  const projection = I.legacy(records, seed, snapshot.state, mapping);
  if (projection.issues.length) throw Error('Unresolved historical identifiers; do not prepare publication.');
  const source = {readTime, updateTime: snapshot.updatedAt ?? null,
    sha256: crypto.createHash('sha256').update(raw).digest('hex')};
  const documents = {};
  for (const ficha of new Set(Object.values(mapping))) {
    if (!/^\d{6,9}$/.test(ficha)) throw Error('Invalid ficha.');
    const rows = projection.projected.filter(r => r.ficha === ficha && r.date.startsWith(year + '-'));
    documents[ficha] = {schemaVersion: 1, ficha, year, source, records: structuredClone(rows)};
  }
  const exposed = new Set(Object.values(documents).flatMap(d => d.records.map(r => r.sourceId)));
  // SENA/administrative/unmapped records remain in a complete admin-only archive.
  const adminOnly = projection.projected.filter(r => !exposed.has(r.sourceId));
  if (JSON.stringify(snapshot) !== raw) throw Error('Source changed.');
  return {documents, adminOnly: structuredClone(adminOnly), archive: structuredClone(snapshot), source};
}

module.exports = {prepareRules, prepareDrive, readModels};
