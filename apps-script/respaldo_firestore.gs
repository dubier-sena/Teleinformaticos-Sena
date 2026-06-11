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

    // Autorizacion por propiedad/rol (cierra IDOR C1). El admin (por email)
    // accede a todo; el aprendiz solo a SUS documentos.
    var authz = authorizeRequest({
      action: action,
      collection: payload.collection,
      docId: payload.docId,
      email: userInfo.email,
      uid: userInfo.uid,
      adminEmails: getAdminEmails(),
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

  const existingIt = collectionFolder.getFilesByName(fileName);
  if (existingIt.hasNext()) {
    const file = existingIt.next();
    file.setContent(jsonContent);
    return jsonResponse({ ok: true, action: "updated", fileId: file.getId() });
  }
  const blob = Utilities.newBlob(jsonContent, "application/json", fileName);
  const created = collectionFolder.createFile(blob);
  return jsonResponse({ ok: true, action: "created", fileId: created.getId() });
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
    return { ok: true, email: u.email || "", uid: u.localId || "" };
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
var LIST_ADMIN_ONLY_COLLECTIONS = {
  "sena_portal_users": true,
  "sena_portal_user_auth": true,
  "sena_portal_user_meta": true,
  "sena_portal_user_index": true,
  "sena_portal_progress": true,
  "sena_portal_guide_state": true
};

function isSharedReadDoc(collection, docId) {
  if (collection === "sena_portal_calendar") return true;
  // El calendario academico tambien se respalda dentro de progress.
  if (collection === "sena_portal_progress" && String(docId || "").indexOf("__calendar__:") === 0) return true;
  return false;
}

function actorOwnsDoc(collection, docId, actorKey, uid) {
  if (collection === "sena_portal_user_index") {
    return String(docId || "").trim().toLowerCase() === String(uid || "").trim().toLowerCase();
  }
  return docIdHasKeySegment(docId, actorKey);
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

  if (email && adminEmails.indexOf(email) !== -1) return { ok: true, admin: true };

  var actorKey = usernameKeyFromEmail(email);
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
