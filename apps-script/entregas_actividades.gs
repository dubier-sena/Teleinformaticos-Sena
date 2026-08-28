/**
 * entregas_actividades.gs — Recibe las entregas de archivos del portal y las
 * guarda en Drive bajo Ficha / Guia / Actividad (+ copia de respaldo en
 * carpeta exclusiva del instructor, sin acceso para aprendices).
 *
 * Seguridad: doPost exige un idToken de Firebase Auth valido (verificado contra
 * Identity Toolkit) antes de escribir nada en Drive. Sin token, se rechaza.
 *
 * ─── Despliegue (OBLIGATORIO tras esta version) ────────────────────────────
 *   1. Project Settings -> Script properties: agrega:
 *        FIREBASE_API_KEY   → la Firebase Web API key del proyecto
 *        ADMIN_BACKUP_FOLDER_ID → (opcional) ID alternativo de carpeta Drive
 *            para respaldos. Si no se define, se usa el ID hardcodeado en
 *            el script (1TTl7KclP_GXEcIdq7tIwpK4T7PXyIO-r).
 *        REGISTRATION_CODE_SECRET → (Fase 6, OBLIGATORIO para que el
 *            registro con codigo de invitacion funcione) cualquier cadena
 *            larga aleatoria, generada UNA vez y jamas commiteada. Sin esto,
 *            verifyRegistrationCode/setRegistrationCode responden error.
 *        ADMIN_EMAILS → (opcional, csv) solo si el admin no es
 *            dubier@sena-portal.local; usado por setRegistrationCode.
 *   2. Deploy -> Manage deployments -> edita el deployment Web App existente
 *      y publica una nueva version (Execute as: Me / Access: Anyone).
 *   3. Orden seguro: primero publica el cliente (git push), luego redeploy aqui.
 *      Si redeployas el servidor antes que el cliente, las entregas fallaran
 *      con "falta token de seguridad" hasta que el cliente nuevo este en linea.
 * ─────────────────────────────────────────────────────────────────────────
 */
const FICHA_ROOT_FOLDERS = {
  "3441939": "1SLkk986REOKGEFaCyWV7rSeudj7lnUMs",
  "3441942": "1cv0DkFXhkMw22AddqIgC354DhUUHcQck",
  "3441944": "1fZ7atqeSym9ayQylRG47HqKm2xdBbFOf",
  "3441950": "1N49ulJRgbF7ySD3JDRJzFE5czCKFO1KM",
  "3168850": "1fBPzXHU0OHDmKa18Y6V2tnomLyYWgiLp",
  "3168852": "1p9HdGinK1me8PsbaLHYio_OC-idAmorR",
};
// Fase 2 (auditoria profunda, 2026-08-23): IDs de los acuerdos de Etapa
// Productiva por ficha (contienen cedula y datos de TODO el grupo). Antes
// vivian como URL publica "cualquiera con el enlace" incrustada en
// project_integrations.js (repo publico) -- cualquiera en internet podia
// descargarlos sin ser aprendiz. Ahora el ID nunca sale del servidor: el
// cliente solo recibe los bytes del archivo (accion "agreement" abajo), y
// SOLO para la ficha verificada del propio idToken. Si cambias un archivo,
// actualiza el ID aqui; no hace falta tocar el cliente.
const FICHA_AGREEMENT_FILE_IDS = {
  "3441939": "1Gs67a5LUc0Alv1kqe3Yla3ryosCeBH0k",
  "3441942": "17Ou96W5e5uWnvVvqAzPq2J1oc8qOYxyd",
  "3441944": "1carTO0eulPdNLmoyUWpoBdzktDPRccTX",
  "3441950": "1S1PKiIPDUwCmbZTuDtWzaWe78NXIXJr3",
  "3168850": "11nEbEacehK3DmAbnQT2moAdsTR3I6t7P",
  "3168852": "1AFGFI-buGhMeL41oSaYVDgaFFr1QTjLT",
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
  ".py",
];

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");

    // ───── Fase 6 (auditoria profunda, cierre de hallazgo de seguridad) ────
    // Verificar un codigo de invitacion de ficha corre ANTES de exigir
    // idToken: ocurre durante el REGISTRO, cuando el aprendiz todavia no
    // tiene ninguna sesion. No toca Drive ni datos de ningun aprendiz. El
    // hallazgo que esto cierra: el diseno anterior guardaba el codigo en
    // Firestore con lectura publica (sena_portal_ficha_codes, "allow get:
    // if true") para poder leerlo antes del login -- eso significaba que
    // CUALQUIERA que conociera una ficha podia leer el codigo real por
    // Firestore REST sin sesion alguna. Ahora el codigo NUNCA viaja al
    // cliente en ninguna direccion: se compara un hash server-side (ver
    // handleVerifyRegistrationCode) y el servidor responde unicamente
    // valido/no-valido.
    const earlyAction = String(payload.action || "").toLowerCase();
    if (earlyAction === "verifyregistrationcode") {
      return handleVerifyRegistrationCode(payload);
    }

    // ───── Seguridad: solo usuarios autenticados del portal ────────────────
    // El cliente (shared_apps_script_delivery.js) adjunta el idToken de
    // Firebase Auth. Se verifica contra Identity Toolkit ANTES de tocar Drive,
    // igual que respaldo_firestore.gs. Sin token valido se rechaza: esto cierra
    // la subida anonima de archivos por cualquiera que conozca la URL del /exec.
    // Requisito de despliegue: configurar la Script Property FIREBASE_API_KEY.
    const idToken = String(payload.idToken || "");
    if (!idToken) {
      return jsonResponse({
        ok: false,
        message: "Debes iniciar sesion en el portal para entregar archivos (falta token de seguridad).",
      });
    }
    const auth = verifyFirebaseIdToken(idToken);
    if (!auth.ok) {
      // DIAGNOSTICO TEMPORAL: se incluye la causa exacta en el mensaje para
      // resolver el rechazo en vivo. Quitar el "(diag: ...)" una vez corregido.
      return jsonResponse({
        ok: false,
        message:
          "Tu sesion de seguridad expiro o no es valida. Vuelve a iniciar sesion e intenta de nuevo. (diag: " +
          (auth.reason || "unknown") +
          (auth.detail ? " | " + auth.detail : "") +
          ")",
        diag: auth.reason || "unknown",
        diagDetail: auth.detail || "",
      });
    }

    // ───── Fase 6: configurar/regenerar el codigo de una ficha exige ser ───
    // admin -- verificado aqui mismo, server-side, contra auth.email (ya
    // verificado arriba por Identity Toolkit). Modificar localStorage o
    // alterar el payload del cliente no cambia auth.email en absoluto, asi
    // que no hay forma de que un aprendiz se autorice a si mismo por esta
    // via. El codigo en texto plano jamas se persiste (ver
    // handleSetRegistrationCode): solo se guarda su hash.
    if (String(payload.action || "").toLowerCase() === "setregistrationcode") {
      return handleSetRegistrationCode(payload, auth);
    }

    // ───── Seguridad (cierre de auditoria 2026-08-22, endurecido en la ─────
    // auditoria profunda posterior -- Fase 1): ficha/fullName no se toman
    // NUNCA "de confianza" del payload del cliente. Un idToken valido solo
    // prueba que quien llama es UN aprendiz autenticado, no que la ficha o
    // el nombre que puso en el payload sean los suyos. Se resuelve el
    // perfil real leyendo sena_portal_users/{usernameKey} en Firestore,
    // autenticado con el MISMO idToken ya verificado arriba (igual que hace
    // el cliente en firebase_db.js: Authorization Bearer). La regla de esa
    // coleccion permite "get" al propio dueno o al admin (Fase 7, ver
    // firestore.rules linea ~124); usernameKey aqui SIEMPRE se deriva del
    // mismo auth.email ya verificado arriba, asi que este GET es siempre
    // sobre el propio perfil del llamador y sigue funcionando sin cambios.
    //
    // FAIL-CLOSED (antes era fail-open): si el perfil no se puede leer o
    // llega incompleto (Firestore caido, doc inexistente, o con ficha/
    // fullName vacios), la operacion se RECHAZA con un error transitorio en
    // vez de usar el valor del payload como respaldo. La version anterior
    // degradaba a los datos del cliente "para no bloquear una entrega real
    // por una falla ajena al aprendiz" -- pero eso reabria exactamente el
    // hueco que este mismo bloque cierra: bastaba una caida de Firestore (o
    // cualquier fallo transitorio de fetchVerifiedProfile) para que ficha/
    // fullName manipulados en devtools volvieran a decidir la carpeta
    // destino. El cliente (shared_apps_script_delivery.js) ya trata
    // cualquier mensaje que no contenga las palabras clave de error
    // permanente (ver isPermanentDeliveryError) como transitorio: lo
    // reintenta con backoff y, si se agotan los intentos en sesion, lo deja
    // en la cola durable (IndexedDB) para reintentar en cargas posteriores
    // -- el archivo nunca se pierde, solo queda pendiente.
    const verifiedProfile = fetchVerifiedProfile(idToken, auth.email);
    if (!verifiedProfile || !verifiedProfile.ficha || !verifiedProfile.fullName) {
      return jsonResponse({
        ok: false,
        transient: true,
        diag: "profile-unverified",
        message:
          "No fue posible verificar tu perfil en este momento. La entrega se conservara pendiente y se reintentara automaticamente.",
      });
    }
    payload.ficha = verifiedProfile.ficha;
    payload.fullName = verifiedProfile.fullName;

    // Dispatch por accion (mismo patron ya usado en respaldo_firestore.gs).
    // Sin `action` (o accion desconocida) se asume "upload": compatibilidad
    // con el cliente actualmente desplegado, que todavia no envia `action`.
    const action = String(payload.action || "upload").toLowerCase();
    if (action === "verify") {
      return handleVerifyDelivery(payload);
    }
    if (action === "agreement") {
      // Fase 2: ni siquiera lee payload.ficha -- el destino sale UNICAMENTE
      // del perfil ya verificado arriba, nunca de lo que reclame el cliente.
      return handleFetchAgreementDocument(verifiedProfile.ficha);
    }
    return handleUploadDelivery(payload);
  } catch (error) {
    return jsonResponse({
      ok: false,
      message: error && error.message ? error.message : "Error no controlado en el Apps Script.",
    });
  }
}

function handleUploadDelivery(payload) {
  try {
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

    // Idempotencia (Bloque G, PENDIENTE DE REDEPLOY -- ver informe): el
    // cliente genera un submissionId UNA vez por intento de entrega y lo
    // conserva intacto a traves de retryWithBackoff y de la cola durable
    // (IndexedDB guarda el payload completo). Si esta MISMA entrega logica ya
    // creo un archivo antes -- por ejemplo la respuesta se perdio en la red,
    // pero Drive SI llego a crear el archivo, y el cliente reintento -- se
    // devuelve el archivo YA EXISTENTE en vez de crear un duplicado. Antes no
    // existia ningun chequeo: createFile() se llamaba sin condicion alguna.
    const submissionId = String(payload.submissionId || "").trim();
    if (submissionId) {
      const existing = findFileBySubmissionId(destination.folder, submissionId);
      if (existing) {
        return jsonResponse({
          ok: true,
          message: "Entrega ya registrada previamente (idempotente, sin crear un archivo duplicado).",
          driveUrl: existing.getUrl(),
          folderPath: destination.folderPath,
          savedFileName: existing.getName(),
          confirmedAt: existing.getDateCreated().toISOString(),
          fileId: existing.getId(),
          idempotentReplay: true,
        });
      }
    }

    const blob = Utilities.newBlob(
      fileBytes,
      mimeType,
      finalFileName
    );
    const uploaded = destination.folder.createFile(blob);
    if (submissionId) {
      // Best-effort: si setDescription fallara por algun motivo, la entrega
      // ya se completo (el archivo real es lo que importa) -- no debe
      // reportarse como fallo por esto.
      try { uploaded.setDescription("submissionId:" + submissionId); } catch (descriptionError) { /* noop */ }
    }

    // Copia de respaldo en carpeta exclusiva del instructor (ADMIN_BACKUP_FOLDER_ID).
    // Esta carpeta NO es accesible por los aprendices; solo el instructor la ve.
    // La jerarquía interna replica Ficha / Guia / Actividad para trazabilidad.
    // Si el ID no está configurado o la copia falla, NO se aborta la entrega:
    // el archivo principal ya quedó subido y el error queda en backupError.
    let backupInfo = { url: "", folderPath: "", fileName: "", error: "" };
    try {
      // ID de la carpeta exclusiva del instructor para respaldos (sin acceso de aprendices).
      // Si se necesita cambiar la carpeta, actualice esta constante y redeploy el script.
      const adminBackupFolderId = getScriptProperty("ADMIN_BACKUP_FOLDER_ID") || "1TTl7KclP_GXEcIdq7tIwpK4T7PXyIO-r";
      if (!adminBackupFolderId) {
        backupInfo.error = "ADMIN_BACKUP_FOLDER_ID no configurado — respaldo omitido.";
      } else {
        const adminBackupRoot = DriveApp.getFolderById(adminBackupFolderId);
        const backupDestination = resolveBackupTargetFolder(adminBackupRoot, ficha, payload);
        const backupCopy = uploaded.makeCopy(finalFileName, backupDestination.folder);
        backupInfo = {
          url: backupCopy.getUrl(),
          folderPath: backupDestination.folderPath,
          fileName: finalFileName,
          error: "",
        };
      }
    } catch (backupError) {
      backupInfo.error = backupError && backupError.message ? backupError.message : "Backup error";
    }

    return jsonResponse({
      ok: true,
      message: "Entrega registrada correctamente en Drive en la carpeta correspondiente.",
      driveUrl: uploaded.getUrl(),
      folderPath: destination.folderPath,
      savedFileName: finalFileName,
      // Fecha CONFIRMADA por Drive (creacion real del archivo), no el reloj
      // del navegador del aprendiz. Auditoria 2026-08-22, Fase 9: separa
      // "cuando el aprendiz intento entregar" de "cuando Drive confirmo que
      // el archivo existe" -- si la entrega tardo varios reintentos (cola
      // durable en segundo plano), estas dos fechas pueden diferir.
      confirmedAt: uploaded.getDateCreated().toISOString(),
      fileId: uploaded.getId(),
      backupDriveUrl: backupInfo.url,
      backupFolderPath: backupInfo.folderPath,
      backupSavedFileName: backupInfo.fileName,
      backupError: backupInfo.error,
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      message: error && error.message ? error.message : "Error no controlado en el Apps Script.",
    });
  }
}

// ── Verificacion de entrega manual (Fase 10, auditoria 2026-08-22) ──────────
// El aprendiz que subio el archivo el mismo directamente a Drive (porque la
// subida automatica fallo) puede pedirle al portal "ya subi el archivo,
// verificar entrega". Esta accion NUNCA sube nada: solo lista la carpeta
// exacta de ficha/guia/actividad que le corresponde a ESE aprendiz y busca un
// archivo cuyo nombre coincida con el nombre estandar esperado (ignorando la
// extension, para tolerar que el aprendiz haya guardado en un formato
// distinto al sugerido). No asume que "cualquier archivo de la carpeta"
// sirve: solo cuenta un nombre que coincide con ficha+aprendiz+guia+actividad.
function handleVerifyDelivery(payload) {
  try {
    const ficha = String(payload.ficha || "").trim();
    const fullName = sanitizeLabel(payload.fullName, "Aprendiz");
    const activityLabel = sanitizeLabel(payload.activityLabel, "Actividad");

    if (!ficha || !fullName || !activityLabel) {
      return jsonResponse({ ok: false, message: "Faltan datos para verificar la entrega." });
    }

    const rootFolderId = FICHA_ROOT_FOLDERS[ficha];
    if (!rootFolderId || rootFolderId.indexOf("PEGAR_FOLDER_ID_") === 0) {
      return jsonResponse({ ok: false, message: "La ficha no tiene carpeta base configurada en el Apps Script." });
    }

    const rootFolder = DriveApp.getFolderById(rootFolderId);
    const destination = resolveTargetFolder(rootFolder, ficha, payload);
    const expectedStem = buildDeliveryFileNameStem(fullName, ficha, activityLabel, payload);

    const files = destination.folder.getFiles();
    let bestMatch = null;
    while (files.hasNext()) {
      const file = files.next();
      const name = file.getName();
      // Coincidencia exacta del nombre (sin extension) o que empiece EXACTO
      // igual seguido SOLO de: otra extension (el aprendiz cambio el
      // formato al guardar) o el sufijo "(1)"/"(2)" que Drive agrega solo
      // cuando ya existe un archivo con ese nombre en la misma carpeta (otra
      // reentrega manual). NO se acepta cualquier texto pegado despues del
      // stem: un nombre como "..._Ana_Torresborrador.pdf" tecnicamente
      // "empieza igual" como texto plano pero NO es una variante tolerable
      // de este archivo -- confirmado con un test que antes de este cambio
      // SI calzaba por error (ver tests/entregas_actividades_verify_matching.test.cjs).
      const nameStem = name.replace(/\.[a-z0-9]+$/i, "");
      const remainder = name.slice(expectedStem.length);
      const isTolerableVariant = name.indexOf(expectedStem) === 0 && /^(\.[a-z0-9]+|\s*\(\d+\)(\.[a-z0-9]+)?)$/i.test(remainder);
      if (nameStem === expectedStem || isTolerableVariant) {
        // Si hay mas de una coincidencia (reentregas manuales previas), toma
        // la mas reciente por fecha de creacion.
        if (!bestMatch || file.getDateCreated().getTime() > bestMatch.getDateCreated().getTime()) {
          bestMatch = file;
        }
      }
    }

    if (!bestMatch) {
      return jsonResponse({
        ok: true,
        found: false,
        message:
          "Todavia no encontramos tu archivo en la carpeta de Drive de esta actividad. " +
          "Verifica que lo hayas subido con el nombre sugerido y a la carpeta correcta, y vuelve a intentar en unos segundos.",
        folderPath: destination.folderPath,
        expectedName: expectedStem,
      });
    }

    return jsonResponse({
      ok: true,
      found: true,
      message: "Entrega manual verificada: encontramos tu archivo en Drive.",
      driveUrl: bestMatch.getUrl(),
      savedFileName: bestMatch.getName(),
      folderPath: destination.folderPath,
      confirmedAt: bestMatch.getDateCreated().toISOString(),
      fileId: bestMatch.getId(),
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      message: error && error.message ? error.message : "Error no controlado al verificar la entrega.",
    });
  }
}

// Fase 2 (auditoria profunda): sirve el acuerdo de Etapa Productiva de la
// ficha YA VERIFICADA del aprendiz -- este handler ni siquiera recibe el
// payload del cliente, solo la ficha resuelta en doPost. El archivo nunca se
// referencia por URL publica en el cliente: aqui se lee el blob real de
// Drive (el script tiene acceso directo como su propietario/editor, sin
// depender de que el archivo este compartido "cualquiera con el enlace") y
// se devuelve en base64 solo a quien ya demostro ser un aprendiz real de esa
// ficha.
function handleFetchAgreementDocument(ficha) {
  try {
    const fileId = FICHA_AGREEMENT_FILE_IDS[String(ficha || "")];
    if (!fileId) {
      return jsonResponse({
        ok: false,
        message: "Tu ficha no tiene un acuerdo de Etapa Productiva disponible. Consulta con tu instructor.",
      });
    }
    const file = DriveApp.getFileById(fileId);
    const blob = file.getBlob();
    return jsonResponse({
      ok: true,
      fileBase64: Utilities.base64Encode(blob.getBytes()),
      mimeType: blob.getContentType() || "application/octet-stream",
      fileName: file.getName(),
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      message: "No fue posible obtener el acuerdo en este momento. Intenta de nuevo en unos segundos.",
    });
  }
}

// ── Fase 6 (auditoria profunda, cierre de hallazgo): codigo de invitacion ──
// por ficha, requerido en el registro para que conocer una ficha valida no
// sea suficiente. Almacenamiento: PropertiesService (Script Properties),
// NUNCA Firestore -- no existe ningun endpoint publico que exponga Script
// Properties (ni REST, ni SDK, ni consola, ni fallback de Drive), a
// diferencia del diseno anterior (sena_portal_ficha_codes con lectura
// publica) que SI dejaba leer el codigo real a cualquiera que conociera la
// ficha. Se guarda solo un hash SHA-256(ficha + ":" + codigo + ":" +
// REGISTRATION_CODE_SECRET); el secreto vive UNICAMENTE en la Script
// Property REGISTRATION_CODE_SECRET de este despliegue -- nunca en git ni
// en JS publico. Requisito de despliegue adicional: configurar
// REGISTRATION_CODE_SECRET (cualquier cadena larga aleatoria) y, si el
// admin no es dubier@sena-portal.local, tambien ADMIN_EMAILS (csv).
function registrationCodePropertyKey(ficha) {
  return "FICHA_CODE_HASH_" + String(ficha || "").trim();
}

function getAdminEmailsForEntregas() {
  var raw = getScriptProperty("ADMIN_EMAILS");
  var list = raw ? raw.split(",") : ["dubier@sena-portal.local"];
  return list.map(function (s) { return String(s).trim().toLowerCase(); }).filter(function (s) { return !!s; });
}

function computeRegistrationCodeHash(ficha, code, secret) {
  var raw = String(ficha || "").trim() + ":" + String(code || "").trim() + ":" + secret;
  var digestBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
  return digestBytes.map(function (b) {
    var v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? "0" + v : v;
  }).join("");
}

// Rate limit BASICO por ficha (nunca bloqueo permanente): CacheService
// expira solo a los 5 minutos, asi que un aprendiz legitimo que se
// equivoca varias veces nunca queda bloqueado -- solo se le agrega un
// retraso corto (tope 3s) que encarece un intento de fuerza bruta.
function applyRegistrationCodeRateLimit(ficha) {
  try {
    var cache = CacheService.getScriptCache();
    var key = "regcode_attempts_" + String(ficha || "").trim();
    var count = Number(cache.get(key) || 0) + 1;
    cache.put(key, String(count), 300);
    if (count > 5) {
      Utilities.sleep(Math.min(3000, (count - 5) * 500));
    }
  } catch (rateLimitError) {
    // El rate limit nunca debe impedir que la verificacion real corra.
  }
}

// Respuesta SIEMPRE generica ante codigo invalido (Fase 6): nunca distingue
// "ficha sin codigo configurado" de "codigo incorrecto" de "ficha
// inexistente" -- toda esa informacion ayudaria a alguien a enumerar
// fichas/estado sin conocer el codigo real. `ok:false` (distinto de
// `ok:true, valid:false`) se reserva para cuando el chequeo NO pudo
// ejecutarse de verdad (falta configurar el secreto del lado servidor) --
// el cliente trata eso como "reintenta", nunca como "tu codigo esta mal".
function handleVerifyRegistrationCode(payload) {
  var ficha = String(payload.ficha || "").trim();
  var code = String(payload.code || "").trim();
  applyRegistrationCodeRateLimit(ficha);
  try {
    var secret = getScriptProperty("REGISTRATION_CODE_SECRET");
    if (!secret) {
      return jsonResponse({ ok: false, message: "No fue posible verificar el codigo de registro en este momento." });
    }
    if (!ficha || !code) {
      return jsonResponse({ ok: true, valid: false });
    }
    var expectedHash = getScriptProperty(registrationCodePropertyKey(ficha));
    var actualHash = computeRegistrationCodeHash(ficha, code, secret);
    var valid = !!expectedHash && expectedHash === actualHash;
    return jsonResponse({ ok: true, valid: valid });
  } catch (error) {
    return jsonResponse({ ok: false, message: "No fue posible verificar el codigo de registro en este momento." });
  }
}

// Solo admin (verificado server-side contra auth.email, ver doPost) puede
// crear/regenerar el codigo de una ficha. El codigo en texto plano llega
// UNA vez en este payload y nunca se persiste en ningun lado -- ni aqui, ni
// en logs, ni en Firestore: solo su hash queda en Script Properties. Por
// eso el admin no puede "recuperar" un codigo ya guardado, solo
// regenerarlo (mismo flujo, un codigo nuevo reemplaza el hash anterior).
function handleSetRegistrationCode(payload, auth) {
  var adminEmails = getAdminEmailsForEntregas();
  if (adminEmails.indexOf(String(auth.email || "").toLowerCase()) === -1) {
    return jsonResponse({ ok: false, message: "No autorizado." });
  }
  var ficha = String(payload.ficha || "").trim();
  var code = String(payload.code || "").trim();
  if (!ficha || !code) {
    return jsonResponse({ ok: false, message: "Faltan datos (ficha y codigo)." });
  }
  var secret = getScriptProperty("REGISTRATION_CODE_SECRET");
  if (!secret) {
    return jsonResponse({ ok: false, message: "El servidor no tiene configurado REGISTRATION_CODE_SECRET." });
  }
  var hash = computeRegistrationCodeHash(ficha, code, secret);
  PropertiesService.getScriptProperties().setProperty(registrationCodePropertyKey(ficha), hash);
  return jsonResponse({ ok: true });
}

// Igual que buildDeliveryFileName, pero SIN extension: para verificar una
// entrega manual no sabemos (ni nos importa) en que formato la guardo el
// aprendiz.
function buildDeliveryFileNameStem(fullName, ficha, activityLabel, payload) {
  const guideNumber = sanitizeFileSegment(payload.guideNumber, "");
  const activityNumber = sanitizeFileSegment(String(payload.activityNumber || "").replace(/\./g, ""), "");
  if (guideNumber && activityNumber) {
    const shortName = sanitizeFileSegment(payload.shortName || payload.activityTitle || activityLabel, "Actividad");
    const fichaLabel = sanitizeFileSegment(ficha, "SIN_FICHA");
    const learnerFull = normalizeLearnerLabel(fullName, "full");
    return `Guia_${guideNumber}_Actividad_${activityNumber}_${shortName}_${fichaLabel}_${learnerFull}`;
  }
  const prefix = sanitizeFileSegment(payload.fileNamePrefix, "");
  const learnerLabel = normalizeLearnerLabel(fullName, payload.learnerNameMode);
  if (prefix) {
    const fichaLabel = sanitizeFileSegment(ficha, "SIN_FICHA");
    return `${prefix}_${learnerLabel}_${fichaLabel}`;
  }
  const activitySegment = normalizeActivitySegment(activityLabel);
  return `${learnerLabel}_${activitySegment}`;
}

function sanitizeLabel(value, fallback) {
  return String(value || "")
    .replace(/[\\/:*?"<>|#%{}~&]/g, " ")
    .replace(/\s+/g, " ")
    .trim() || fallback || "";
}

function sanitizeFileSegment(value, fallback) {
  // Bloque G (auditoria 2026-08-27, PENDIENTE DE REDEPLOY -- ver informe):
  // faltaba el paso NFD que SI tiene sanitizeSegment() en js/activity_standard.js.
  // Sin normalizar, una vocal acentuada (a,e,i,o,u con tilde) o la ñ se
  // eliminaba ENTERA por el filtro [^a-z0-9]+ de abajo -- "Sofia Avila" con
  // tildes reales quedaba "Sof_a_vila", no "Sofia_Avila". Efecto real
  // confirmado: (1) nombre de archivo final visualmente roto para cualquier
  // aprendiz con tilde/ñ en el nombre; (2) mas grave, buildDeliveryFileNameStem
  // usa esta misma funcion, asi que handleVerifyDelivery() buscaba un stem
  // DISTINTO al que buildDeliveryFileNamePreview() (cliente, que SI normaliza)
  // le habia sugerido subir manualmente -- el boton "Ya subi el archivo,
  // verificar entrega" nunca encontraba el archivo para estos aprendices.
  var normalized = sanitizeLabel(value, fallback).normalize("NFD").replace(/[̀-ͯ]/g, "");
  return normalized
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

// Crea la jerarquía Ficha / Guia / Actividad dentro de la carpeta de respaldo
// del instructor (adminBackupRoot). Los aprendices no tienen acceso a esa raíz.
function resolveBackupTargetFolder(adminBackupRoot, ficha, payload) {
  // Crear subcarpeta por ficha dentro de la raíz de respaldo del instructor.
  const fichaFolderName = `Ficha ${sanitizeLabel(ficha, "SIN_FICHA")}`;
  let currentFolder = ensureFolderByName(adminBackupRoot, fichaFolderName);
  const pathSegments = [fichaFolderName];

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

// Bloque G (PENDIENTE DE REDEPLOY): busca en `folder` un archivo cuya
// descripcion sea EXACTAMENTE "submissionId:{submissionId}" (marcador que
// handleUploadDelivery estampa al crear el archivo). Carpetas de
// ficha/guia/actividad son pequeñas (una por aprendiz+actividad), asi que
// recorrerla entera es barato. Nunca hace match por nombre: dos submissionId
// distintos jamas colisionan (son generados client-side, unicos por intento).
function findFileBySubmissionId(folder, submissionId) {
  const marker = "submissionId:" + submissionId;
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    let description = "";
    try { description = file.getDescription() || ""; } catch (descriptionReadError) { description = ""; }
    if (description === marker) return file;
  }
  return null;
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

function getScriptProperty(name) {
  return String(PropertiesService.getScriptProperties().getProperty(name) || "").trim();
}

function getFirebaseApiKey() {
  return getScriptProperty("FIREBASE_API_KEY");
}

// Verifica el idToken de Firebase Auth contra Identity Toolkit. Devuelve
// { ok, email, uid }. Mismo metodo probado en respaldo_firestore.gs: Google
// valida la firma/expiracion del token, no hay que verificar el JWT a mano.
function verifyFirebaseIdToken(idToken) {
  try {
    const apiKey = getFirebaseApiKey();
    if (!apiKey) return { ok: false, reason: "no-api-key" };

    // Cache de verificacion: la llamada a Identity Toolkit consume cuota diaria
    // de UrlFetchApp (20k/dia en cuentas Gmail, compartida entre todos los
    // scripts de la cuenta). El mismo idToken es valido ~1h y el aprendiz puede
    // entregar/reintentar varias veces, asi que cacheamos el resultado OK por
    // token ~30 min para no agotar la cuota (causa real del "sesion expiro").
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
    const code = response.getResponseCode();
    const text = String(response.getContentText() || "");
    if (code !== 200) {
      // Causas tipicas: 403 = la API key tiene restriccion de referente HTTP o
      // Identity Toolkit API deshabilitada; 400 = key de otro proyecto o token
      // realmente vencido. El detalle de Google ayuda a distinguirlas.
      Logger.log("verifyFirebaseIdToken lookup HTTP " + code + ": " + text);
      return { ok: false, reason: "lookup-http-" + code, detail: text.slice(0, 400) };
    }
    const body = JSON.parse(text || "{}");
    if (!Array.isArray(body.users) || body.users.length === 0) {
      return { ok: false, reason: "no-users" };
    }
    const u = body.users[0];
    const result = { ok: true, email: u.email || "", uid: u.localId || "" };
    cache.put(cacheKey, JSON.stringify(result), 1800); // 30 min
    return result;
  } catch (err) {
    Logger.log("verifyFirebaseIdToken exception: " + err);
    return { ok: false, reason: "exception", detail: String(err).slice(0, 400) };
  }
}

// Mismo project id publico que js/firebase-config.js (PORTAL_FIREBASE_CONFIG.projectId).
// No es un secreto: la seguridad real la da la verificacion del idToken + las
// Firestore Rules, igual que con la apiKey publica (ver Security Notes en CLAUDE.md).
const FIRESTORE_PROJECT_ID = "sena-portal";

// Deriva el usernameKey del email sintetico "{key}@sena-portal.local" o
// versionado "{key}.v{N}@sena-portal.local" (tras un reset de password admin
// via updateStudentPassword). Misma logica que splitVersionedEmail en
// respaldo_firestore.gs, simplificada aqui porque solo necesitamos la base.
function usernameKeyFromEmail(email) {
  var local = String(email || "").trim().toLowerCase().replace(/@.*$/, "");
  var m = local.match(/^(.+)\.v(\d+)$/);
  return m && m[1] ? m[1] : local;
}

// Lee sena_portal_users/{usernameKey} en Firestore usando el idToken YA
// verificado por verifyFirebaseIdToken como credencial (Authorization Bearer,
// igual que firebase_db.js). La regla de esa coleccion es "allow get: if
// signedIn()" (ver firestore.rules), asi que esto siempre funciona para un
// aprendiz real con sesion valida -- devuelve null solo si Firestore no
// responde 200 o el doc no tiene los campos esperados, y el llamador decide
// como degradar. Cache corta (10 min): ficha/fullName casi nunca cambian y
// evita gastar cuota de UrlFetchApp en cada entrega/verificacion.
function fetchVerifiedProfile(idToken, email) {
  try {
    var usernameKey = usernameKeyFromEmail(email);
    if (!usernameKey) return null;

    var cache = CacheService.getScriptCache();
    var cacheKey = "profile_" + usernameKey;
    var cached = cache.get(cacheKey);
    if (cached) {
      try { return JSON.parse(cached); } catch (_) {}
    }

    var url =
      "https://firestore.googleapis.com/v1/projects/" + FIRESTORE_PROJECT_ID +
      "/databases/(default)/documents/sena_portal_users/" + encodeURIComponent(usernameKey);
    var response = UrlFetchApp.fetch(url, {
      headers: { Authorization: "Bearer " + idToken },
      muteHttpExceptions: true,
    });
    if (response.getResponseCode() !== 200) return null;

    var body = JSON.parse(response.getContentText() || "{}");
    var fields = body.fields || {};
    var ficha = fields.ficha && typeof fields.ficha.stringValue === "string" ? fields.ficha.stringValue : "";
    var fullName = fields.fullName && typeof fields.fullName.stringValue === "string" ? fields.fullName.stringValue : "";
    var result = { usernameKey: usernameKey, ficha: ficha, fullName: fullName };
    if (ficha || fullName) {
      cache.put(cacheKey, JSON.stringify(result), 600); // 10 min
    }
    return result;
  } catch (err) {
    Logger.log("fetchVerifiedProfile exception: " + err);
    return null;
  }
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}
