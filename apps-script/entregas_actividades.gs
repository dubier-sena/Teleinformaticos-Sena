const FICHA_ROOT_FOLDERS = {
  "3441939": "PEGAR_FOLDER_ID_3441939",
  "3441942": "PEGAR_FOLDER_ID_3441942",
  "3441944": "PEGAR_FOLDER_ID_3441944",
  "3441950": "PEGAR_FOLDER_ID_3441950",
  "3168850": "PEGAR_FOLDER_ID_3168850",
  "3168852": "PEGAR_FOLDER_ID_3168852",
};
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".jpg",
  ".jpeg",
  ".png",
  ".zip",
];

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");
    const ficha = String(payload.ficha || "").trim();
    const fullName = sanitizeLabel(payload.fullName, "Aprendiz");
    const activityLabel = sanitizeLabel(payload.activityLabel, "Actividad");
    const fileName = String(payload.fileName || "").trim();
    const mimeType = String(payload.mimeType || "application/octet-stream").trim();
    const fileBase64 = String(payload.fileBase64 || "").trim();

    if (!ficha || !fullName || !activityLabel || !fileName || !fileBase64) {
      return jsonResponse({
        ok: false,
        message: "Faltan datos obligatorios para registrar la entrega.",
      });
    }

    const rootFolderId = FICHA_ROOT_FOLDERS[ficha];
    if (!rootFolderId || rootFolderId.indexOf("PEGAR_FOLDER_ID_") === 0) {
      return jsonResponse({
        ok: false,
        message: "La ficha no tiene carpeta base configurada en el Apps Script.",
      });
    }

    validateUploadExtension(fileName);
    const fileBytes = Utilities.base64Decode(fileBase64);
    if (!fileBytes.length || fileBytes.length > MAX_UPLOAD_BYTES) {
      return jsonResponse({
        ok: false,
        message: "El archivo supera el tamano maximo permitido o no pudo decodificarse.",
      });
    }

    const rootFolder = DriveApp.getFolderById(rootFolderId);
    const finalFileName = buildDeliveryFileName(fullName, activityLabel, fileName);

    const blob = Utilities.newBlob(
      fileBytes,
      mimeType,
      finalFileName
    );
    const uploaded = rootFolder.createFile(blob);

    return jsonResponse({
      ok: true,
      message: "Entrega registrada correctamente en Drive.",
      driveUrl: uploaded.getUrl(),
      folderPath: `Ficha ${ficha}`,
      savedFileName: finalFileName,
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      message: error && error.message ? error.message : "Error no controlado en el Apps Script.",
    });
  }
}

function sanitizeLabel(value, fallback) {
  return String(value || "")
    .replace(/[\\/:*?"<>|#%{}~&]/g, " ")
    .replace(/\s+/g, " ")
    .trim() || fallback || "";
}

function buildDeliveryFileName(fullName, activityLabel, originalFileName) {
  const extension = getFileExtension(originalFileName);
  const learnerLabel = normalizeLearnerLabel(fullName);
  const activitySegment = normalizeActivitySegment(activityLabel);
  return `${learnerLabel}_${activitySegment}${extension}`;
}

function getFileExtension(value) {
  const source = String(value || "").trim();
  const extensionMatch = source.match(/(\.[a-z0-9]+)$/i);
  return extensionMatch ? extensionMatch[1].toLowerCase() : "";
}

function normalizeLearnerLabel(value) {
  const firstToken = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)[0] || "Aprendiz";

  return String(firstToken)
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "") || "Aprendiz";
}

function normalizeActivitySegment(value) {
  const clean = sanitizeLabel(value, "Actividad");
  const match = clean.match(/^Actividad\s*(.*)$/i);
  const suffix = match ? match[1] : clean;
  const normalizedSuffix = String(suffix || "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "");

  return normalizedSuffix ? `Actividad-${normalizedSuffix}` : "Actividad";
}

function validateUploadExtension(fileName) {
  const lowerName = String(fileName || "").toLowerCase();
  const isAllowed = ALLOWED_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
  if (!isAllowed) {
    throw new Error("La extension del archivo no esta permitida para esta entrega.");
  }
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}
