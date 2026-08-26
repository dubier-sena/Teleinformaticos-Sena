/**
 * respaldo_firestore.gs — Respaldo de Firestore en Drive (fase 1 + fase 2).
 *
 * Fase 1 (set): cada `fsPatch` exitoso del portal copia el documento aqui.
 * Fase 2 (get/updateField/delete): cuando Firestore no responde, el portal
 * usa este Web App como respaldo de lectura/escritura.
 *
 * El cliente envia un body JSON con:
 *   {
 *     action: "set" | "get" | "updateField" | "delete",
 *     idToken: <Firebase Auth idToken>,
 *     collection: <string>,
 *     docId: <string>,
 *     ...campos especificos de cada accion...
 *   }
 *
 * Si `action` no viene, se asume "set" (compat con fase 1).
 *
 * Cada documento se guarda como:
 *   {BACKUP_ROOT_FOLDER}/{collection}/{docId}.json
 *
 * Seguridad:
 *   1) idToken se verifica contra Identity Toolkit antes de cualquier accion.
 *   2) AUTORIZACION por propiedad/rol (cierra IDOR C1): un aprendiz solo puede
 *      leer/escribir SUS documentos (su usernameKey aparece como segmento del
 *      docId); el admin (por email, sin leer Firestore → cero cuota) accede a
 *      todo. El calendario se lee compartido pero solo el admin lo modifica, y
 *      `list` en colecciones sensibles (user_auth con hashes, user_meta, users,
 *      progress, guide_state) queda restringido al admin. Ver authorizeRequest()
 *      y la prueba tests/apps_script_respaldo_authz.test.cjs.
 *
 * ─── Setup ────────────────────────────────────────────────────────────────
 *   1. Crea carpeta Drive de respaldo, copia su ID.
 *   2. En Project Settings -> Script properties configura:
 *      - BACKUP_ROOT_FOLDER_ID
 *      - FIREBASE_API_KEY
 *      - ADMIN_EMAILS (opcional, csv; por defecto dubier@sena-portal.local)
 *   3. Deploy → New deployment → Web app → Execute as: Me / Access: Anyone.
 *   4. Pega la URL en js/project_integrations.js como `respaldoFirestoreUrl`.
 *
 * ─── IMPORTANTE al actualizar la autorizacion ──────────────────────────────
 *   El /exec sirve la VERSION desplegada, NO el HEAD del editor. Para activar
 *   este cambio: Gestionar implementaciones → Editar → Version nueva → Implementar.
 *   Verificar en produccion (el admin debe tener sesion Firebase fresca):
 *     - Aprendiz A logueado lee/escribe SUS datos: OK.
 *     - Aprendiz A intenta leer progress/user_auth de B: rechazado.
 *     - Admin lista usuarios y abre datos de cualquiera: OK.
 *   Si algun flujo legitimo se bloquea, revisar el docId real de esa coleccion.
 * ─────────────────────────────────────────────────────────────────────────
 */

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const action = String(payload.action || "set").toLowerCase();
    const idToken = String(payload.idToken || "");

    if (!idToken) {
      return jsonResponse({ ok: false, message: "Falta idToken." });
    }
    const userInfo = verifyFirebaseIdToken(idToken);
    if (!userInfo.ok) {
      return jsonResponse({ ok: false, message: "Token invalido o expirado." });
    }
    if (!getBackupRootFolderId()) {
      return jsonResponse({ ok: false, message: "BACKUP_ROOT_FOLDER_ID no configurado." });
    }

    var actorParts = splitVersionedEmail(userInfo.email);

    // Bloque C.1 (cierre de hallazgo de privacidad): vista PROPIA del
    // catalogo de Etapa Productiva. No pasa por authorizeRequest() de abajo
    // porque esa funcion decide por (collection, docId) que el cliente
    // manda -- aqui el cliente NO manda ni docId ni usernameKey; la
    // identidad sale UNICAMENTE del idToken ya verificado arriba, y el
    // filtrado (solo los documentDeliveries del propio actor) ocurre DENTRO
    // del handler, nunca en el cliente. Ver handleStudentProductiveStageView.
    if (action === "studentproductivestageview") {
      return handleStudentProductiveStageView(actorParts);
    }

    // Autorizacion por propiedad/rol (cierra IDOR C1). El admin (por email)
    // accede a todo; el aprendiz solo a SUS documentos. Si el email viene
    // versionado (.vN, cuenta re-creada tras reset de password), se consulta
    // la version atestada en user_meta para confiar en la clave base.
    var authz = authorizeRequest({
      action: action,
      collection: payload.collection,
      docId: payload.docId,
      email: userInfo.email,
      uid: userInfo.uid,
      adminEmails: getAdminEmails(),
      attestedVersion: actorParts.version > 1 ? getAttestedAuthVersion(actorParts.base) : 1,
    });
    if (!authz.ok) {
      return jsonResponse({ ok: false, message: authz.message || "No autorizado." });
    }

    if (action === "set") return handleSet(payload, userInfo);
    if (action === "get") return handleGet(payload);
    if (action === "updatefield") return handleUpdateField(payload, userInfo);
    if (action === "delete") return handleDelete(payload);
    if (action === "list") return handleList(payload);

    return jsonResponse({ ok: false, message: "Action desconocida: " + action });
  } catch (error) {
    return jsonResponse({
      ok: false,
      message: String((error && error.message) || error || "Error desconocido"),
    });
  }
}

function doGet() {
  return jsonResponse({
    ok: true,
    service: "respaldo_firestore",
    time: new Date().toISOString(),
  });
}

// ─── Acciones ─────────────────────────────────────────────────────────────

function handleSet(payload, userInfo) {
  const validation = validatePathParams(payload);
  if (!validation.ok) return jsonResponse({ ok: false, message: validation.message });
  if (payload.data === undefined) {
    return jsonResponse({ ok: false, message: "Falta el campo `data`." });
  }

  const collectionFolder = ensureCollectionFolder(validation.collection);
  const fileName = validation.safeDocId + ".json";
  const existingIt = collectionFolder.getFilesByName(fileName);

  if (existingIt.hasNext()) {
    const file = existingIt.next();
    var dataToWrite = payload.data;
    // Fase 10 (auditoria profunda): antes esto era un reemplazo COMPLETO y
    // ciego del archivo. Si dos dispositivos caian a este respaldo casi al
    // mismo tiempo (cada uno fusiono su guardado SOLO contra lo que EL
    // leyo, sin ver el cambio del otro), el segundo en escribir aqui
    // borraba en silencio el campo que el primero ya habia guardado.
    // Para snapshots de guia (con snapshotJson: progress/guide_state
    // compuestos), se relee el contenido ACTUAL del archivo y se combina
    // con el mismo merge por timestamp/campo que ya protege el guardado
    // online normal (mergeGuideDataSnapshotForSave en firebase_db.js;
    // puerto exacto abajo) antes de sobrescribir. Otras colecciones sin
    // snapshotJson mantienen el comportamiento anterior (reemplazo directo).
    try {
      const existingParsed = JSON.parse(file.getBlob().getDataAsString());
      const existingData = existingParsed && existingParsed.data;
      if (
        existingData && typeof existingData.snapshotJson === "string" &&
        payload.data && typeof payload.data.snapshotJson === "string"
      ) {
        const existingSnapshot = JSON.parse(existingData.snapshotJson);
        const incomingSnapshot = JSON.parse(payload.data.snapshotJson);
        const mergedSnapshot = gsMergeGuideDataSnapshotForSave(existingSnapshot, incomingSnapshot);
        dataToWrite = Object.assign({}, payload.data, {
          snapshotJson: JSON.stringify(mergedSnapshot),
          updatedAt: mergedSnapshot.updatedAt || payload.data.updatedAt,
        });
      }
    } catch (mergeError) {
      // JSON corrupto o forma inesperada: se sigue con el data original tal
      // cual llego -- mejor guardar algo que fallar la entrega completa.
    }

    const jsonContent = JSON.stringify(
      {
        collection: validation.collection,
        docId: validation.docId,
        data: dataToWrite,
        savedAt: new Date().toISOString(),
        savedBy: userInfo.email || userInfo.uid || "",
      },
      null,
      2
    );
    file.setContent(jsonContent);
    return jsonResponse({ ok: true, action: "updated", fileId: file.getId() });
  }

  const jsonContent = JSON.stringify(
    {
      collection: validation.collection,
      docId: validation.docId,
      data: payload.data,
      savedAt: new Date().toISOString(),
      savedBy: userInfo.email || userInfo.uid || "",
    },
    null,
    2
  );
  const blob = Utilities.newBlob(jsonContent, "application/json", fileName);
  const created = collectionFolder.createFile(blob);
  return jsonResponse({ ok: true, action: "created", fileId: created.getId() });
}

// ── Merge de snapshots de guia (Fase 10, auditoria profunda) ────────────────
// Puerto EXACTO de mergeGuideDataSnapshotForSave/mergeGuideState/
// mergeGuideValue de js/firebase_db.js: misma logica en ambos lados para que
// el resultado de un merge sea identico entre el guardado online normal y el
// respaldo/promocion via Drive. Apps Script no puede importar el archivo del
// cliente, de ahi el puerto (prefijo gs* para no chocar con nada mas de este
// script).
function gsPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function gsHasMeaningfulGuideValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return !isNaN(value);
  if (typeof value === "boolean") return value === true;
  if (Array.isArray(value)) return value.length > 0;
  if (gsPlainObject(value)) return Object.keys(value).length > 0;
  return true;
}

function gsMergeGuideValue(previous, incoming) {
  if (gsPlainObject(previous) && gsPlainObject(incoming)) {
    var nested = {};
    Object.keys(previous).forEach(function (k) { nested[k] = previous[k]; });
    Object.keys(incoming).forEach(function (key) {
      nested[key] = gsMergeGuideValue(previous[key], incoming[key]);
    });
    return nested;
  }
  if (!gsHasMeaningfulGuideValue(incoming) && gsHasMeaningfulGuideValue(previous)) {
    return previous;
  }
  return incoming;
}

function gsMergeGuideState(previousState, incomingState, allowMissingLockRemoval) {
  var previous = gsPlainObject(previousState) ? previousState : {};
  var incoming = gsPlainObject(incomingState) ? incomingState : {};
  var next = {};
  Object.keys(previous).forEach(function (k) { next[k] = previous[k]; });

  if (allowMissingLockRemoval) {
    Object.keys(previous).forEach(function (key) {
      if (/-locked$/.test(key) && !Object.prototype.hasOwnProperty.call(incoming, key)) {
        delete next[key];
      }
    });
  }

  Object.keys(incoming).forEach(function (key) {
    if (/-locked$/.test(key)) {
      if (incoming[key]) next[key] = true;
      else delete next[key];
      return;
    }
    next[key] = gsMergeGuideValue(previous[key], incoming[key]);
  });

  return next;
}

function gsSnapshotState(snapshot) {
  if (gsPlainObject(snapshot) && gsPlainObject(snapshot.state)) return snapshot.state;
  if (gsPlainObject(snapshot) && gsPlainObject(snapshot.data)) return snapshot.data;
  return {};
}

function gsSnapshotTimestamp(snapshot) {
  if (!gsPlainObject(snapshot)) return NaN;
  var candidates = [snapshot.updatedAt, snapshot.lastModified, snapshot.savedAt, snapshot.timestamp];
  for (var i = 0; i < candidates.length; i++) {
    var parsed = Date.parse(candidates[i] || "");
    if (!isNaN(parsed)) return parsed;
  }
  return NaN;
}

function gsMergeGuideDataSnapshotForSave(existingSnapshot, incomingSnapshot) {
  var existing = gsPlainObject(existingSnapshot) ? existingSnapshot : {};
  var incoming = gsPlainObject(incomingSnapshot) ? incomingSnapshot : {};
  var updatedBy = String(incoming.updatedBy || "").toLowerCase();
  var isAdminOverride = Boolean(
    incoming.reabierta || incoming.permiteEdicion || /admin|unlock|habilit|reabiert/.test(updatedBy)
  );

  var existingTs = gsSnapshotTimestamp(existing);
  var incomingTs = gsSnapshotTimestamp(incoming);
  if (!isAdminOverride && !isNaN(existingTs) && !isNaN(incomingTs) && existingTs > incomingTs + 1000) {
    return existing;
  }

  var mergedState = gsMergeGuideState(gsSnapshotState(existing), gsSnapshotState(incoming), isAdminOverride);
  var merged = {};
  Object.keys(existing).forEach(function (k) { merged[k] = existing[k]; });
  Object.keys(incoming).forEach(function (k) { merged[k] = incoming[k]; });

  if (Object.prototype.hasOwnProperty.call(incoming, "data") || Object.prototype.hasOwnProperty.call(existing, "data")) {
    merged.data = mergedState;
  }
  if (Object.prototype.hasOwnProperty.call(incoming, "state") || Object.prototype.hasOwnProperty.call(existing, "state")) {
    merged.state = mergedState;
  }
  if (!Object.prototype.hasOwnProperty.call(merged, "state") && !Object.prototype.hasOwnProperty.call(merged, "data")) {
    merged.state = mergedState;
  }

  return merged;
}

function handleGet(payload) {
  const validation = validatePathParams(payload);
  if (!validation.ok) return jsonResponse({ ok: false, message: validation.message });

  const collectionFolder = getCollectionFolderIfExists(validation.collection);
  if (!collectionFolder) {
    return jsonResponse({ ok: true, found: false, data: null });
  }
  const fileIt = collectionFolder.getFilesByName(validation.safeDocId + ".json");
  if (!fileIt.hasNext()) {
    return jsonResponse({ ok: true, found: false, data: null });
  }
  try {
    const file = fileIt.next();
    const parsed = JSON.parse(file.getBlob().getDataAsString());
    return jsonResponse({
      ok: true,
      found: true,
      data: parsed.data,
      savedAt: parsed.savedAt || "",
    });
  } catch (_) {
    return jsonResponse({ ok: false, message: "JSON corrupto en Drive." });
  }
}

// Doc real de Etapa Productiva (ver productive_stage_store.js SCOPE_KEY /
// FILE_NAME y firebase_db.js guideStateDocId): "sena_portal_guide_state" /
// "__guide_data__:admin:productive-stage:productive-stage-catalog". Fijo
// aqui (no viene del cliente) porque esta accion nunca debe poder apuntar a
// OTRO documento -- es exactamente lo que la vuelve segura pese a leer un
// doc que el aprendiz no "posee" segun authorizeRequest().
var PRODUCTIVE_STAGE_COLLECTION = "sena_portal_guide_state";
var PRODUCTIVE_STAGE_DOC_ID = "__guide_data__:admin:productive-stage:productive-stage-catalog";

// Bloque C.1: vista acotada del catalogo de Etapa Productiva para UN
// aprendiz. `actorParts` viene de splitVersionedEmail(userInfo.email) en
// doPost -- userInfo YA fue verificado contra Identity Toolkit, asi que
// actorParts.base es la identidad REAL del llamador, nunca un valor que el
// cliente pudo mandar en el payload (el payload de esta accion ni siquiera
// se lee para identidad). Lee el documento COMPLETO server-side (mismo
// camino que handleGet) y filtra documentDeliveries a SOLO los registros de
// ese usernameKey antes de responder -- los de otros aprendices nunca
// salen de este handler.
function handleStudentProductiveStageView(actorParts) {
  var usernameKey = String((actorParts && actorParts.base) || "").trim().toLowerCase();
  if (!usernameKey) {
    return jsonResponse({ ok: false, message: "Sin identidad valida en el token." });
  }

  var rawOutput = handleGet({ collection: PRODUCTIVE_STAGE_COLLECTION, docId: PRODUCTIVE_STAGE_DOC_ID });
  var parsed;
  try {
    parsed = JSON.parse(rawOutput.getContent());
  } catch (_) {
    return jsonResponse({ ok: false, message: "Error leyendo el catalogo de Etapa Productiva." });
  }
  if (!parsed.ok) return jsonResponse(parsed);
  if (!parsed.found || !parsed.data) {
    return jsonResponse({ ok: true, found: false, data: null });
  }

  var full = parsed.data;

  var documentDeliveries = Array.isArray(full.documentDeliveries) ? full.documentDeliveries : [];
  var ownDocumentDeliveries = documentDeliveries.filter(function (record) {
    return record && String(record.usernameKey || "").trim().toLowerCase() === usernameKey;
  });

  // "Resumen del proyecto" / "Avance del proyecto" / "Historial de informes"
  // (productive_stage_student.js) necesitan el/los proyecto(s) del EQUIPO de
  // este aprendiz (no solo documentDeliveries) -- un proyecto es compartido
  // por varios companeros de equipo, asi que se filtra por membresia
  // (studentUsernameKeys), no por igualdad exacta como documentDeliveries.
  var allProjects = Array.isArray(full.projects) ? full.projects : [];
  var ownProjects = allProjects.filter(function (project) {
    var members = (project && project.studentUsernameKeys) || [];
    return members.some(function (m) { return String(m || "").trim().toLowerCase() === usernameKey; });
  });
  var ownProjectIds = {};
  ownProjects.forEach(function (project) { ownProjectIds[project.id] = true; });

  var allReports = Array.isArray(full.reports) ? full.reports : [];
  var ownReports = allReports.filter(function (report) { return report && ownProjectIds[report.projectId]; });

  var allDeliveries = Array.isArray(full.deliveries) ? full.deliveries : [];
  var ownDeliveries = allDeliveries.filter(function (delivery) { return delivery && ownProjectIds[delivery.projectId]; });

  var studentIndex = {};
  studentIndex[usernameKey] = ownProjects.map(function (project) { return project.id; });

  return jsonResponse({
    ok: true,
    found: true,
    data: {
      schemaVersion: full.schemaVersion,
      updatedAt: full.updatedAt,
      documentDeadlines: (full.documentDeadlines && typeof full.documentDeadlines === "object") ? full.documentDeadlines : {},
      documentDeliveries: ownDocumentDeliveries,
      projects: ownProjects,
      reports: ownReports,
      deliveries: ownDeliveries,
      studentIndex: studentIndex,
    },
  });
}

function handleUpdateField(payload, userInfo) {
  const validation = validatePathParams(payload);
  if (!validation.ok) return jsonResponse({ ok: false, message: validation.message });

  const fieldName = String(payload.fieldName || "");
  if (!fieldName || !/^[a-zA-Z0-9_-]+$/.test(fieldName)) {
    return jsonResponse({ ok: false, message: "fieldName invalido." });
  }

  const collectionFolder = ensureCollectionFolder(validation.collection);
  const fileName = validation.safeDocId + ".json";
  const fileIt = collectionFolder.getFilesByName(fileName);

  let currentData = {};
  let file = null;
  if (fileIt.hasNext()) {
    file = fileIt.next();
    try {
      const parsed = JSON.parse(file.getBlob().getDataAsString());
      currentData = parsed.data && typeof parsed.data === "object" ? parsed.data : {};
    } catch (_) {
      currentData = {};
    }
  }
  currentData[fieldName] = payload.fieldValue;

  const jsonContent = JSON.stringify(
    {
      collection: validation.collection,
      docId: validation.docId,
      data: currentData,
      savedAt: new Date().toISOString(),
      savedBy: userInfo.email || userInfo.uid || "",
    },
    null,
    2
  );

  if (file) {
    file.setContent(jsonContent);
    return jsonResponse({ ok: true, action: "updated", fileId: file.getId() });
  }
  const blob = Utilities.newBlob(jsonContent, "application/json", fileName);
  const created = collectionFolder.createFile(blob);
  return jsonResponse({ ok: true, action: "created", fileId: created.getId() });
}

function handleDelete(payload) {
  const validation = validatePathParams(payload);
  if (!validation.ok) return jsonResponse({ ok: false, message: validation.message });

  const collectionFolder = getCollectionFolderIfExists(validation.collection);
  if (!collectionFolder) {
    return jsonResponse({ ok: true, action: "noop" });
  }
  const fileIt = collectionFolder.getFilesByName(validation.safeDocId + ".json");
  if (!fileIt.hasNext()) {
    return jsonResponse({ ok: true, action: "noop" });
  }
  const file = fileIt.next();
  file.setTrashed(true);
  return jsonResponse({ ok: true, action: "deleted" });
}

// Lista hasta 300 documentos de una coleccion. Para usos admin (panel).
function handleList(payload) {
  const collection = String(payload.collection || "");
  if (!collection || !/^[a-zA-Z0-9_-]+$/.test(collection)) {
    return jsonResponse({ ok: false, message: "Coleccion invalida." });
  }
  const collectionFolder = getCollectionFolderIfExists(collection);
  if (!collectionFolder) {
    return jsonResponse({ ok: true, docs: [] });
  }
  const docs = [];
  const fileIt = collectionFolder.getFiles();
  let count = 0;
  while (fileIt.hasNext() && count < 300) {
    try {
      const file = fileIt.next();
      const name = file.getName();
      if (!/\.json$/i.test(name)) continue;
      const parsed = JSON.parse(file.getBlob().getDataAsString());
      docs.push({
        docId: parsed.docId || name.replace(/\.json$/i, ""),
        data: parsed.data,
        savedAt: parsed.savedAt || "",
      });
      count += 1;
    } catch (_) {
      // archivo corrupto: lo saltamos
    }
  }
  return jsonResponse({ ok: true, docs: docs });
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function validatePathParams(payload) {
  const collection = String(payload.collection || "");
  const docId = String(payload.docId || "");
  if (!collection || !/^[a-zA-Z0-9_-]+$/.test(collection)) {
    return { ok: false, message: "Coleccion invalida." };
  }
  const safeDocId = sanitizeDocId(docId);
  if (!safeDocId) {
    return { ok: false, message: "docId invalido." };
  }
  return { ok: true, collection: collection, docId: docId, safeDocId: safeDocId };
}

function ensureCollectionFolder(collection) {
  const root = DriveApp.getFolderById(getBackupRootFolderId());
  return ensureFolder(root, collection);
}

function getCollectionFolderIfExists(collection) {
  const root = DriveApp.getFolderById(getBackupRootFolderId());
  const it = root.getFoldersByName(collection);
  return it.hasNext() ? it.next() : null;
}

function getScriptProperty(name) {
  return String(PropertiesService.getScriptProperties().getProperty(name) || "").trim();
}

function getBackupRootFolderId() {
  return getScriptProperty("BACKUP_ROOT_FOLDER_ID");
}

function getFirebaseApiKey() {
  return getScriptProperty("FIREBASE_API_KEY");
}

function verifyFirebaseIdToken(idToken) {
  try {
    const apiKey = getFirebaseApiKey();
    if (!apiKey) return { ok: false };

    // Cache de verificacion: cada peticion verificaba el token con una llamada
    // UrlFetchApp a Identity Toolkit, consumiendo la cuota diaria (20k/dia en
    // cuentas Gmail, compartida con entregas_actividades.gs). El mismo idToken
    // vale ~1h, asi que cacheamos el resultado OK por token ~30 min.
    const cache = CacheService.getScriptCache();
    const cacheKey =
      "idtok_" +
      Utilities.base64EncodeWebSafe(
        Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, idToken)
      );
    const cached = cache.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (_) {}
    }

    const url =
      "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" +
      encodeURIComponent(apiKey);
    const response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ idToken: idToken }),
      muteHttpExceptions: true,
    });
    if (response.getResponseCode() !== 200) return { ok: false };
    const body = JSON.parse(response.getContentText() || "{}");
    if (!Array.isArray(body.users) || body.users.length === 0) return { ok: false };
    const u = body.users[0];
    const result = { ok: true, email: u.email || "", uid: u.localId || "" };
    cache.put(cacheKey, JSON.stringify(result), 1800); // 30 min
    return result;
  } catch (_) {
    return { ok: false };
  }
}

// ─── Autorizacion: propiedad / membresia / rol ────────────────────────────
// Cierra el IDOR (C1): un aprendiz autenticado solo puede leer/escribir SUS
// documentos; el admin (por email, sin leer Firestore → cero cuota) accede a
// todo. Las colecciones compartidas (calendario) se pueden leer por cualquier
// sesion valida pero solo el admin las modifica.
var ADMIN_EMAIL_DEFAULT = "dubier@sena-portal.local";

function getAdminEmails() {
  var raw = getScriptProperty("ADMIN_EMAILS");
  var list = raw ? raw.split(",") : [ADMIN_EMAIL_DEFAULT];
  return list
    .map(function (s) { return String(s).trim().toLowerCase(); })
    .filter(function (s) { return !!s; });
}

function usernameKeyFromEmail(email) {
  return String(email || "").trim().toLowerCase().replace(/@.*$/, "");
}

// Separa un email sintetico posiblemente VERSIONADO "{key}.v{N}@dominio" en su
// clave base y su version. Cuando el admin resetea la password de un aprendiz,
// el portal crea una cuenta Auth nueva con sufijo ".v{N}" (ver buildEmail en
// firebase_auth_bridge.js); sin esta separacion, el actor "pepito.v2" nunca
// coincidia con el segmento "pepito" de sus docIds y el aprendiz reseteado
// quedaba sin acceso a sus propios documentos tambien en Drive.
function splitVersionedEmail(email) {
  var local = usernameKeyFromEmail(email);
  var m = local.match(/^(.+)\.v(\d+)$/);
  if (m && m[1]) return { base: m[1], version: Number(m[2]) };
  return { base: local, version: 1 };
}

function getFirebaseProjectId() {
  return getScriptProperty("FIREBASE_PROJECT_ID");
}

// Version de email ATESTADA por el admin en sena_portal_user_meta/{key}.
// Las Firestore Rules permiten GET publico de esa coleccion (solo expone el
// numero de version, sin PII), asi que basta el API key. Se cachea 10 min:
// tras un reset, un aprendiz re-reseteado puede tardar hasta 10 min en ser
// aceptado con la version nueva (transitorio aceptable).
function getAttestedAuthVersion(usernameKey) {
  try {
    var projectId = getFirebaseProjectId();
    var apiKey = getFirebaseApiKey();
    if (!projectId || !apiKey || !usernameKey) return 0;
    var cache = CacheService.getScriptCache();
    var cacheKey = "authv_" + usernameKey;
    var cached = cache.get(cacheKey);
    if (cached) return Number(cached) || 0;
    var url =
      "https://firestore.googleapis.com/v1/projects/" + encodeURIComponent(projectId) +
      "/databases/(default)/documents/sena_portal_user_meta/" + encodeURIComponent(usernameKey) +
      "?key=" + encodeURIComponent(apiKey);
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) return 0;
    var body = JSON.parse(response.getContentText() || "{}");
    var field = body && body.fields && body.fields.authEmailVersion;
    var version = field ? Number(field.integerValue || field.doubleValue || 0) : 0;
    if (version > 0) cache.put(cacheKey, String(version), 600);
    return version;
  } catch (_) {
    return 0;
  }
}

function escapeRegExpLiteral(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
}

// True si `key` aparece como segmento delimitado dentro de docId (los limites
// no-alfanumericos evitan que "juan" calce con "juana"). El docId propio de un
// aprendiz siempre contiene su usernameKey (progress=clave exacta;
// guide_state=...student:clave:...; groups=clave-clave; tutoring=...:clave).
function docIdHasKeySegment(docId, key) {
  if (!key) return false;
  var re = new RegExp("(^|[^a-z0-9])" + escapeRegExpLiteral(key) + "([^a-z0-9]|$)", "i");
  return re.test(String(docId || ""));
}

// `list` vuelca hasta 300 docs: en colecciones con datos privados/sensibles
// (incluye hashes en user_auth) solo lo permite el admin.
//
// "integrity_evidence" (auditoria profunda, Fase 8) agregada aqui: guarda
// nombre completo, ficha e institucion de CADA aprendiz junto a sus senales
// de integridad (pegados, tiempo fuera de pestana, etc.). Antes de este
// cambio NO estaba en esta lista, asi que cualquier aprendiz autenticado
// podia ejecutar action:"list" sobre ella (p.ej. window.driveDb.list(...)
// desde la consola) y recibir hasta 300 documentos con esos datos de TODOS
// los demas aprendices -- una fuga de privacidad entre companeros, no solo
// falta de aviso. Ver tests/apps_script_respaldo_authz.test.cjs.
// "sena_portal_tutoring_bookings" y "sena_portal_groups" agregadas (auditoria
// profunda, Fase 7): igual que integrity_evidence, cualquier aprendiz
// autenticado podia ejecutar action:"list" sobre ellas (p.ej.
// window.driveDb.list(...) desde la consola) y recibir hasta 300 documentos
// de TODAS las fichas/equipos -- nombre completo, ficha, tema y horario en
// tutoring_bookings; lista completa de memberEmails en groups. El lado
// Firestore de sena_portal_groups YA filtraba por membresia
// (isGroupMemberOfResource); el de tutoring_bookings se corrigio aparte (ver
// requesterFicha() en firestore.rules). Este mapa es la unica proteccion del
// lado Drive para ambas.
var LIST_ADMIN_ONLY_COLLECTIONS = {
  "sena_portal_users": true,
  "sena_portal_user_auth": true,
  "sena_portal_user_meta": true,
  "sena_portal_user_index": true,
  "sena_portal_progress": true,
  "sena_portal_guide_state": true,
  "integrity_evidence": true,
  "sena_portal_tutoring_bookings": true,
  "sena_portal_groups": true
};

function isSharedReadDoc(collection, docId) {
  if (collection === "sena_portal_calendar") return true;
  // El calendario academico tambien se respalda dentro de progress.
  if (collection === "sena_portal_progress" && String(docId || "").indexOf("__calendar__:") === 0) return true;
  // Fechas de entrega (activity_deadlines.js): doc unico que escribe SOLO el
  // admin pero que TODOS los aprendices leen para saber si una actividad esta
  // cerrada (o si el admin quito/movio la fecha). Vive en progress con
  // fallback en guide_state (ver saveGuideStateDoc en firebase_db.js).
  if (
    (collection === "sena_portal_progress" || collection === "sena_portal_guide_state") &&
    String(docId || "") === "__guide_data__:admin:activity-deadlines:__activity_deadlines_v1"
  ) return true;
  return false;
}

// Replica del safeCloudKey del cliente (firebase_db.js): en los docIds
// compuestos LEGADOS, todo caracter fuera de [a-z0-9:_-] se convierte en
// "_". Un aprendiz con punto en su usuario (eimy.alvarez) aparece en sus
// docIds legados como "eimy_alvarez", asi que la propiedad se verifica con
// AMBAS formas -- riesgo CONFIRMADO (auditoria profunda, Fase 5): un
// aprendiz real "eimy_alvarez" (guion bajo real) colisiona con "eimy.alvarez"
// por este camino. Se conserva SOLO para los docIds del esquema LEGADO
// ("student:..."), nunca para el esquema nuevo por UID (ver
// composedUidDocSegment/isOwnerOfComposedUidDoc abajo, que se revisa PRIMERO
// y de forma EXCLUYENTE).
function sanitizeKeyLikeClient(key) {
  return String(key || "").replace(/[^a-z0-9:_-]/gi, "_");
}

// Fase 5 (auditoria profunda, cierre del fallback Drive): extrae el
// segmento UID de un docId con el esquema NUEVO
// ("__guide_data__:uid:{uid}:{archivo}" / "__guide_ui__:uid:{uid}:{archivo}").
// Replica exacta del matcher usado en firestore.rules
// (isOwnerOfComposedUidDoc) para que Firestore arriba y el respaldo de Drive
// abajo apliquen el MISMO modelo de identidad. Devuelve null si el docId no
// es de este esquema (para no confundir "no es un doc UID" con "uid vacio").
function composedUidDocSegment(docId) {
  var m = String(docId || "").match(/^__guide_(?:data|ui)__:uid:([^:]+):.+$/);
  return m ? m[1] : null;
}

// Propiedad para el esquema NUEVO: igualdad EXACTA contra el uid verificado
// del actor (Identity Toolkit, ver doPost -> verifyFirebaseIdToken). Sin
// saneo, sin derivarlo del username, sin equivalencias -- el UID de Firebase
// nunca colisiona entre cuentas reales, a diferencia del username saneado.
function isOwnerOfComposedUidDoc(docId, uid) {
  var segment = composedUidDocSegment(docId);
  return segment !== null && !!uid && segment === uid;
}

function actorOwnsDoc(collection, docId, actorKey, uid) {
  if (collection === "sena_portal_user_index") {
    return String(docId || "").trim().toLowerCase() === String(uid || "").trim().toLowerCase();
  }
  // Fase 5: si el docId es del esquema nuevo por UID, su propiedad se decide
  // UNICA y EXCLUSIVAMENTE por esta via -- JAMAS cae al camino legado por
  // username (ni exacto ni saneado) aunque el uid no coincida. Mezclar
  // ambos caminos para un mismo docId reabriria exactamente la ambiguedad
  // que este esquema reemplaza.
  var uidSegment = composedUidDocSegment(docId);
  if (uidSegment !== null) {
    return isOwnerOfComposedUidDoc(docId, uid);
  }
  if (docIdHasKeySegment(docId, actorKey)) return true;
  var sanitized = sanitizeKeyLikeClient(actorKey);
  if (sanitized !== actorKey && docIdHasKeySegment(docId, sanitized)) return true;
  return false;
}

// Decision PURA de autorizacion (sin Drive/Properties) para poder probarla.
// action: get | set | updatefield | delete | list
function authorizeRequest(opts) {
  opts = opts || {};
  var action = String(opts.action || "").toLowerCase();
  var collection = String(opts.collection || "");
  var docId = String(opts.docId || "");
  var email = String(opts.email || "").trim().toLowerCase();
  var uid = String(opts.uid || "");
  var adminEmails = opts.adminEmails || [];
  // Version atestada en sena_portal_user_meta (la obtiene el caller impuro,
  // getAttestedAuthVersion). 0/undefined = sin atestacion disponible.
  var attestedVersion = Number(opts.attestedVersion || 0);

  if (email && adminEmails.indexOf(email) !== -1) return { ok: true, admin: true };

  var actor = splitVersionedEmail(email);

  // Email versionado: SOLO se confia en la clave base si la version del email
  // coincide con la atestada por el admin. Sin esta comprobacion, cualquiera
  // podria crear una cuenta Auth "victima.v2@..." y suplantar a la victima.
  if (actor.version > 1) {
    if (actor.version !== attestedVersion) {
      return { ok: false, message: "Version de cuenta no atestada. Pide al instructor resetear tu password de nuevo." };
    }
    // Admin con email versionado (reset de su propia password).
    if (adminEmails.indexOf(actor.base + "@sena-portal.local") !== -1) {
      return { ok: true, admin: true };
    }
  }

  var actorKey = actor.base;
  if (!actorKey) return { ok: false, message: "Sin identidad valida en el token." };

  if (action === "list") {
    if (LIST_ADMIN_ONLY_COLLECTIONS[collection]) {
      return { ok: false, message: "Listado restringido al administrador." };
    }
    return { ok: true };
  }
  if (action === "get") {
    if (isSharedReadDoc(collection, docId)) return { ok: true };
    return actorOwnsDoc(collection, docId, actorKey, uid)
      ? { ok: true }
      : { ok: false, message: "No autorizado para este documento." };
  }
  // Escrituras: set | updatefield | delete
  if (isSharedReadDoc(collection, docId)) {
    return { ok: false, message: "Solo el administrador modifica datos compartidos." };
  }
  return actorOwnsDoc(collection, docId, actorKey, uid)
    ? { ok: true }
    : { ok: false, message: "No autorizado para este documento." };
}

function sanitizeDocId(docId) {
  return String(docId)
    .replace(/[^a-zA-Z0-9_.:-]/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 200);
}

function ensureFolder(parent, name) {
  const it = parent.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return parent.createFolder(name);
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}
