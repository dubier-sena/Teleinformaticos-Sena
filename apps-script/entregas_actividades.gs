const FICHA_ROOT_FOLDERS = {
  "3441939": "1SLkk986REOKGEFaCyWV7rSeudj7lnUMs",
  "3441942": "1cv0DkFXhkMw22AddqIgC354DhUUHcQck",
  "3441944": "1fZ7atqeSym9ayQylRG47HqKm2xdBbFOf",
  "3441950": "1N49ulJRgbF7ySD3JDRJzFE5czCKFO1KM",
  "3168850": "1fBPzXHU0OHDmKa18Y6V2tnomLyYWgiLp",
  "3168852": "1p9HdGinK1me8PsbaLHYio_OC-idAmorR",
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
  ".pkt",
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

    validateUploadExtension(fileName, payload.allowedExtensions);
    const fileBytes = Utilities.base64Decode(fileBase64);
    if (!fileBytes.length || fileBytes.length > MAX_UPLOAD_BYTES) {
      return jsonResponse({
        ok: false,
        message: "El archivo supera el tamano maximo permitido o no pudo decodificarse.",
      });
    }

    const rootFolder = DriveApp.getFolderById(rootFolderId);
    const finalFileName = buildDeliveryFileName(fullName, ficha, activityLabel, fileName, payload);
    const destination = resolveTargetFolder(rootFolder, ficha, payload);

    const blob = Utilities.newBlob(
      fileBytes,
      mimeType,
      finalFileName
    );
    const uploaded = destination.folder.createFile(blob);

    return jsonResponse({
      ok: true,
      message: "Entrega registrada correctamente en Drive en la carpeta correspondiente.",
      driveUrl: uploaded.getUrl(),
      folderPath: destination.folderPath,
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

function sanitizeFileSegment(value, fallback) {
  return sanitizeLabel(value, fallback)
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "") || fallback || "";
}

function ensureFolderByName(parentFolder, folderName) {
  const cleanName = sanitizeLabel(folderName, "");
  if (!cleanName) {
    return parentFolder;
  }

  const folders = parentFolder.getFoldersByName(cleanName);
  return folders.hasNext() ? folders.next() : parentFolder.createFolder(cleanName);
}

function buildGuideFolderName(payload) {
  return sanitizeLabel(payload.guideLabel, "");
}

function buildActivityFolderName(payload) {
  const activityNumber = sanitizeLabel(payload.activityNumber, "");
  const titleSource = sanitizeLabel(
    payload.activityTitle || payload.activityLabel,
    "Actividad"
  );

  if (activityNumber && titleSource) {
    const normalizedLabel = `Actividad ${activityNumber}`.toLowerCase();
    const normalizedTitle = titleSource.toLowerCase();
    if (normalizedTitle === normalizedLabel || normalizedTitle === activityNumber.toLowerCase()) {
      return activityNumber;
    }
    return `${activityNumber} - ${titleSource}`;
  }

  return activityNumber || titleSource;
}

function resolveTargetFolder(rootFolder, ficha, payload) {
  let currentFolder = rootFolder;
  const pathSegments = [`Ficha ${sanitizeLabel(ficha, "SIN_FICHA")}`];

  const guideFolderName = buildGuideFolderName(payload);
  if (guideFolderName) {
    currentFolder = ensureFolderByName(currentFolder, guideFolderName);
    pathSegments.push(guideFolderName);
  }

  const activityFolderName = buildActivityFolderName(payload);
  if (activityFolderName) {
    currentFolder = ensureFolderByName(currentFolder, activityFolderName);
    pathSegments.push(activityFolderName);
  }

  return {
    folder: currentFolder,
    folderPath: pathSegments.join(" / "),
  };
}

function buildDeliveryFileName(fullName, ficha, activityLabel, originalFileName, payload) {
  const extension = getFileExtension(originalFileName);
  // Formato estándar OBLIGATORIO cuando el cliente envía guideNumber + activityNumber:
  //   Guia_{N}_Actividad_{ActNum}_{NombreBreve}_{Ficha}_{Aprendiz}.{ext}
  const guideNumber = sanitizeFileSegment(payload.guideNumber, "");
  const activityNumber = sanitizeFileSegment(String(payload.activityNumber || "").replace(/\./g, ""), "");
  if (guideNumber && activityNumber) {
    const shortName = sanitizeFileSegment(
      payload.shortName || payload.activityTitle || activityLabel,
      "Actividad"
    );
    const fichaLabel = sanitizeFileSegment(ficha, "SIN_FICHA");
    const learnerFull = normalizeLearnerLabel(fullName, "full");
    return `Guia_${guideNumber}_Actividad_${activityNumber}_${shortName}_${fichaLabel}_${learnerFull}${extension}`;
  }
  // Fallback legado para guías que aún no envíen guideNumber/activityNumber.
  const prefix = sanitizeFileSegment(payload.fileNamePrefix, "");
  const learnerLabel = normalizeLearnerLabel(fullName, payload.learnerNameMode);
  if (prefix) {
    const fichaLabel = sanitizeFileSegment(ficha, "SIN_FICHA");
    return `${prefix}_${learnerLabel}_${fichaLabel}${extension}`;
  }
  const activitySegment = normalizeActivitySegment(activityLabel);
  return `${learnerLabel}_${activitySegment}${extension}`;
}

function getFileExtension(value) {
  const source = String(value || "").trim();
  const extensionMatch = source.match(/(\.[a-z0-9]+)$/i);
  return extensionMatch ? extensionMatch[1].toLowerCase() : "";
}

function normalizeLearnerLabel(value, mode) {
  const normalized = String(value || "").trim();
  const source = mode === "full"
    ? normalized
    : normalized.split(/\s+/).filter(Boolean)[0] || "Aprendiz";

  return sanitizeFileSegment(source, "Aprendiz") || "Aprendiz";
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

function normalizeAllowedExtensions(values) {
  return Array.isArray(values)
    ? values
        .map((extension) => String(extension || "").trim().toLowerCase())
        .filter((extension, index, list) =>
          /^\.[a-z0-9]+$/.test(extension) && list.indexOf(extension) === index
        )
    : [];
}

function validateUploadExtension(fileName, allowedExtensions) {
  const lowerName = String(fileName || "").toLowerCase();
  const activityAllowed = normalizeAllowedExtensions(allowedExtensions).filter((extension) =>
    ALLOWED_EXTENSIONS.includes(extension)
  );
  const effectiveAllowed = activityAllowed.length ? activityAllowed : ALLOWED_EXTENSIONS;
  const isAllowed = effectiveAllowed.some((extension) => lowerName.endsWith(extension));
  if (!isAllowed) {
    throw new Error("La extension del archivo no esta permitida para esta entrega.");
  }
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}
