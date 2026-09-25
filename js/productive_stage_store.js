(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }
  root.productiveStageStore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const runtimeScope =
    typeof self !== "undefined"
      ? self
      : typeof window !== "undefined"
        ? window
        : typeof globalThis !== "undefined"
          ? globalThis
          : {};
  const LOCAL_KEY = "sena_portal_admin_productive_stage_v1";
  const SCOPE_KEY = "admin:productive-stage";
  const FILE_NAME = "productive-stage-catalog";
  // Bloque C.2 (cierre de "syncDocumentDeliveryToCloud falla en silencio"):
  // doc PROPIO de cada aprendiz para sus entregas de documentos base. A
  // diferencia de SCOPE_KEY/FILE_NAME arriba (doc admin agregado, donde
  // NINGUN aprendiz es dueño segun ninguna regla), este usa el mismo esquema
  // "student:{usernameKey}" (y, cuando el uid ya se resolvio, "uid:{uid}")
  // que YA usan las respuestas de guia -- Firestore Rules
  // (isOwnerOfComposedStudentDoc/isOwnerOfComposedUidDoc) y el fallback de
  // Apps Script (docIdHasKeySegment/isOwnerOfComposedUidDoc en
  // respaldo_firestore.gs) YA autorizan este patron sin ningun cambio. Ver
  // loadOwnDocumentDeliveries/saveOwnDocumentDelivery mas abajo.
  const OWN_DELIVERIES_FILE_NAME = "productive-stage-own-deliveries";

  function readJson(raw, fallback) {
    if (!raw) {
      return fallback;
    }
    try {
      return JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  }

  function snapshotTime(snapshot) {
    const parsed = Date.parse((snapshot && snapshot.updatedAt) || "");
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function buildStudentIndex(projects) {
    const index = {};
    (Array.isArray(projects) ? projects : []).forEach(function (project) {
      (project.studentUsernameKeys || []).forEach(function (usernameKey) {
        if (!index[usernameKey]) {
          index[usernameKey] = [];
        }
        if (index[usernameKey].indexOf(project.id) === -1) {
          index[usernameKey].push(project.id);
        }
      });
    });
    return index;
  }

  function createEmptySnapshot() {
    return {
      schemaVersion: 2,
      updatedAt: "",
      projects: [],
      reports: [],
      imports: [],
      deliveries: [],
      // Entregas de "documentos base" de Etapa Productiva (ficha de inscripcion,
      // acuerdo, pantallazo Sofia Plus, bitacoras GFPI-F-147...). A diferencia de
      // `deliveries` (avance del proyecto, keyed por projectId) estas no siempre
      // tienen un proyecto vinculado -- se identifican por usernameKey + docId.
      // Ver appendDocumentDeliveryToSnapshot / getDocumentDeliveriesByUsername.
      documentDeliveries: [],
      // Fechas limite admin-editables de esos mismos "documentos base"
      // (bitacoras, Sofia Plus): { [docId]: { dueAt, updatedAt, updatedBy } }
      // o { [docId]: { cleared: true, updatedAt, updatedBy } } si el admin
      // quito explicitamente la fecha (ver js/productive_stage_deadlines.js,
      // resolveEffectiveDeadline, para la precedencia admin > cleared >
      // legacy hardcodeado). Un docId AUSENTE de este mapa significa "nunca
      // configurado" -- distinto de "cleared" a proposito.
      documentDeadlines: {},
      studentIndex: {},
      lastImportSummary: null,
    };
  }

  function getStudentProjectIds(snapshot, usernameKey) {
    const key = String(usernameKey || "").trim().toLowerCase();
    if (!key) {
      return [];
    }

    const normalizedSnapshot = Object.assign(createEmptySnapshot(), snapshot || {});
    const index =
      normalizedSnapshot.studentIndex && typeof normalizedSnapshot.studentIndex === "object"
        ? normalizedSnapshot.studentIndex
        : {};

    return Array.isArray(index[key]) ? index[key].slice() : [];
  }

  function getStudentProjects(snapshot, usernameKey) {
    const normalizedSnapshot = Object.assign(createEmptySnapshot(), snapshot || {});
    const projectIds = getStudentProjectIds(normalizedSnapshot, usernameKey);
    if (!projectIds.length) {
      return [];
    }

    return normalizedSnapshot.projects.filter(function (project) {
      return projectIds.indexOf(project.id) >= 0;
    });
  }

  function getProjectReports(snapshot, projectId) {
    const normalizedSnapshot = Object.assign(createEmptySnapshot(), snapshot || {});
    if (!projectId) {
      return [];
    }

    return normalizedSnapshot.reports
      .filter(function (report) {
        return report.projectId === projectId;
      })
      .sort(function (left, right) {
        const rightTime = Date.parse(
          (right && (right.importedAt || right.reportDate || right.updatedAt)) || ""
        );
        const leftTime = Date.parse(
          (left && (left.importedAt || left.reportDate || left.updatedAt)) || ""
        );
        return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
      });
  }

  function getProjectDeliveries(snapshot, projectId) {
    const normalizedSnapshot = Object.assign(createEmptySnapshot(), snapshot || {});
    if (!projectId) {
      return [];
    }

    return (Array.isArray(normalizedSnapshot.deliveries) ? normalizedSnapshot.deliveries : [])
      .filter(function (delivery) {
        return delivery.projectId === projectId;
      })
      .sort(function (left, right) {
        const rightTime = Date.parse((right && (right.uploadedAt || right.createdAt)) || "");
        const leftTime = Date.parse((left && (left.uploadedAt || left.createdAt)) || "");
        return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
      });
  }

  function readLocalSnapshot() {
    if (typeof localStorage === "undefined") {
      return createEmptySnapshot();
    }
    return readJson(localStorage.getItem(LOCAL_KEY), createEmptySnapshot());
  }

  function writeLocalSnapshot(snapshot) {
    if (typeof localStorage === "undefined") {
      return false;
    }
    localStorage.setItem(LOCAL_KEY, JSON.stringify(snapshot));
    return true;
  }

  async function readCloudSnapshot() {
    if (
      !runtimeScope._firebaseDb ||
      typeof runtimeScope._firebaseDb.cloudGetGuideData !== "function"
    ) {
      return null;
    }

    try {
      return await runtimeScope._firebaseDb.cloudGetGuideData(SCOPE_KEY, FILE_NAME);
    } catch (error) {
      return null;
    }
  }

  async function writeCloudSnapshot(snapshot) {
    if (
      !runtimeScope._firebaseDb ||
      typeof runtimeScope._firebaseDb.cloudSaveGuideData !== "function"
    ) {
      return false;
    }

    try {
      return await runtimeScope._firebaseDb.cloudSaveGuideData(SCOPE_KEY, FILE_NAME, snapshot);
    } catch (error) {
      return false;
    }
  }

  function mergeImportIntoSnapshot(previousSnapshot, importResult) {
    const base = Object.assign(createEmptySnapshot(), previousSnapshot || {});
    const nextProjects = Array.isArray(base.projects) ? base.projects.slice() : [];
    const nextReports = Array.isArray(base.reports) ? base.reports.slice() : [];
    const nextImports = Array.isArray(base.imports) ? base.imports.slice() : [];
    const nextDeliveries = Array.isArray(base.deliveries) ? base.deliveries.slice() : [];
    const nextDocumentDeliveries = Array.isArray(base.documentDeliveries) ? base.documentDeliveries.slice() : [];
    // Un import de Excel (avance del proyecto) no debe tocar las fechas
    // limite admin-editables: se preservan tal cual, igual que ya se hace
    // con documentDeliveries arriba.
    const nextDocumentDeadlines = Object.assign({}, base.documentDeadlines || {});

    (importResult.projects || []).forEach(function (project) {
      const index = nextProjects.findIndex(function (item) {
        return item.id === project.id;
      });
      if (index >= 0) {
        nextProjects[index] = Object.assign({}, nextProjects[index], project, {
          createdAt: nextProjects[index].createdAt || project.createdAt,
          updatedAt: importResult.importedAt,
        });
      } else {
        nextProjects.push(project);
      }
    });

    (importResult.reports || []).forEach(function (report) {
      const exists = nextReports.some(function (item) {
        return item.reportId === report.reportId;
      });
      if (!exists) {
        nextReports.push(report);
      }
    });

    nextImports.push({
      importBatchId: importResult.importBatchId,
      sourceFileName: importResult.sourceFileName,
      importedAt: importResult.importedAt,
      summary: importResult.summary,
      alerts: importResult.alerts || [],
    });

    return {
      schemaVersion: 2,
      updatedAt: importResult.importedAt,
      projects: nextProjects,
      reports: nextReports,
      imports: nextImports,
      deliveries: nextDeliveries,
      documentDeliveries: nextDocumentDeliveries,
      documentDeadlines: nextDocumentDeadlines,
      studentIndex: buildStudentIndex(nextProjects),
      lastImportSummary: {
        importBatchId: importResult.importBatchId,
        sourceFileName: importResult.sourceFileName,
        importedAt: importResult.importedAt,
        summary: importResult.summary,
        alerts: importResult.alerts || [],
      },
    };
  }

  function appendProjectDeliveryToSnapshot(previousSnapshot, deliveryRecord) {
    const base = Object.assign(createEmptySnapshot(), previousSnapshot || {});
    const nextDeliveries = Array.isArray(base.deliveries) ? base.deliveries.slice() : [];
    const normalizedRecord = Object.assign(
      {
        deliveryId: "",
        projectId: "",
        projectTitle: "",
        uploadedAt: new Date().toISOString(),
        uploadedByName: "",
        uploadedByUsernameKey: "",
        driveUrl: "",
        savedFileName: "",
      },
      deliveryRecord || {}
    );

    if (!normalizedRecord.deliveryId || !normalizedRecord.projectId) {
      return base;
    }

    const index = nextDeliveries.findIndex(function (item) {
      return item.deliveryId === normalizedRecord.deliveryId;
    });

    if (index >= 0) {
      nextDeliveries[index] = Object.assign({}, nextDeliveries[index], normalizedRecord);
    } else {
      nextDeliveries.push(normalizedRecord);
    }

    return Object.assign({}, base, {
      schemaVersion: 2,
      updatedAt: normalizedRecord.uploadedAt || base.updatedAt,
      deliveries: nextDeliveries,
    });
  }

  // Entrega de un "documento base" de Etapa Productiva (ficha de inscripcion,
  // acuerdo, pantallazo Sofia Plus, bitacora GFPI-F-147...). Se identifica por
  // usernameKey + docId (no por projectId -- estos documentos se entregan antes
  // de que exista, o sin que exista, un proyecto vinculado). Idempotente: una
  // segunda entrega del mismo doc actualiza el registro en vez de duplicarlo.
  function appendDocumentDeliveryToSnapshot(previousSnapshot, deliveryRecord) {
    const base = Object.assign(createEmptySnapshot(), previousSnapshot || {});
    const nextDocumentDeliveries = Array.isArray(base.documentDeliveries)
      ? base.documentDeliveries.slice()
      : [];
    const normalizedRecord = Object.assign(
      {
        usernameKey: "",
        docId: "",
        docLabel: "",
        fullName: "",
        ficha: "",
        grupo: "",
        institucion: "",
        submittedAt: new Date().toISOString(),
        savedFileName: "",
        driveUrl: "",
      },
      deliveryRecord || {}
    );
    normalizedRecord.usernameKey = String(normalizedRecord.usernameKey || "").trim().toLowerCase();
    normalizedRecord.docId = String(normalizedRecord.docId || "").trim();

    if (!normalizedRecord.usernameKey || !normalizedRecord.docId) {
      return base;
    }

    const recordKey = normalizedRecord.usernameKey + "::" + normalizedRecord.docId;
    const index = nextDocumentDeliveries.findIndex(function (item) {
      return String(item && item.usernameKey || "").trim().toLowerCase() +
        "::" +
        String(item && item.docId || "").trim() === recordKey;
    });

    if (index >= 0) {
      nextDocumentDeliveries[index] = Object.assign({}, nextDocumentDeliveries[index], normalizedRecord);
    } else {
      nextDocumentDeliveries.push(normalizedRecord);
    }

    return Object.assign({}, base, {
      schemaVersion: 2,
      updatedAt: normalizedRecord.submittedAt || base.updatedAt,
      documentDeliveries: nextDocumentDeliveries,
    });
  }

  // Escribe/reemplaza el registro de fecha limite de UN documento base
  // (docId). `record` es { dueAt, updatedAt, updatedBy } (fecha real) o
  // { cleared: true, updatedAt, updatedBy } (el admin la quito a proposito).
  // Pura/inmutable, igual que el resto de este archivo: quien la llama debe
  // pasar el resultado a saveSnapshot() para persistirlo.
  function setDocumentDeadlineInSnapshot(previousSnapshot, docId, record) {
    const base = Object.assign(createEmptySnapshot(), previousSnapshot || {});
    const cleanDocId = String(docId || "").trim();
    if (!cleanDocId || !record) {
      return base;
    }
    const nextDeadlines = Object.assign({}, base.documentDeadlines || {});
    nextDeadlines[cleanDocId] = record;
    return Object.assign({}, base, {
      schemaVersion: 2,
      updatedAt: record.updatedAt || base.updatedAt,
      documentDeadlines: nextDeadlines,
    });
  }

  // Agrupa las entregas de documentos base por aprendiz: { [usernameKey]: { [docId]: record } }.
  // Uso tipico del panel admin: cruzar contra el roster + catalogo de documentos
  // para saber que falta por cada aprendiz.
  function getDocumentDeliveriesByUsername(snapshot) {
    const normalizedSnapshot = Object.assign(createEmptySnapshot(), snapshot || {});
    const byUsername = {};
    (Array.isArray(normalizedSnapshot.documentDeliveries) ? normalizedSnapshot.documentDeliveries : []).forEach(
      function (record) {
        const usernameKey = String((record && record.usernameKey) || "").trim().toLowerCase();
        const docId = record && record.docId;
        if (!usernameKey || !docId) {
          return;
        }
        if (!byUsername[usernameKey]) {
          byUsername[usernameKey] = {};
        }
        byUsername[usernameKey][docId] = record;
      }
    );
    return byUsername;
  }

  async function loadSnapshot() {
    const localSnapshot = readLocalSnapshot();
    const cloudSnapshot = await readCloudSnapshot();
    if (!cloudSnapshot) {
      return Object.assign(createEmptySnapshot(), localSnapshot);
    }
    return snapshotTime(cloudSnapshot) >= snapshotTime(localSnapshot)
      ? Object.assign(createEmptySnapshot(), cloudSnapshot)
      : Object.assign(createEmptySnapshot(), localSnapshot);
  }

  // Bloque C.1 (cierre de hallazgo de privacidad): vista PROPIA para un
  // aprendiz. A diferencia de loadSnapshot() (doc admin completo, correcto
  // SOLO para admin), esta funcion NUNCA intenta Firestore directo -- las
  // reglas de Firestore son binarias por documento (todo o nada) y este doc
  // es agregado de TODOS los aprendices con Etapa Productiva, asi que
  // "leerlo directo pero solo para mi" no es algo que Firestore Rules pueda
  // expresar sin partir el documento (fuera de alcance de esta fase). El
  // filtrado real ocurre SERVER-SIDE en Apps Script
  // (handleStudentProductiveStageView) -- ver js/drive_db.js. Sin cache
  // local propia a proposito: cachear esto en la MISMA clave que usa el
  // snapshot completo del admin (LOCAL_KEY) en un equipo compartido
  // mezclaria una vista acotada de aprendiz con una vista completa de admin.
  //
  // Bloque C.2: ademas de la vista server-side de arriba, se fusiona el doc
  // PROPIO de entregas del aprendiz (ver loadOwnDocumentDeliveries) -- ese es
  // el unico lugar donde syncDocumentDeliveryToCloud (productive_stage_project_delivery.js)
  // ahora escribe. Sin esta fusion, un aprendiz que entrego un documento base
  // nunca veria esa entrega reflejada en su propia vista (ni en esta pagina
  // ni en el resumen de Home) porque el doc admin agregado nunca recibe esas
  // escrituras (autorizacion correcta: ver el hallazgo original). Si la
  // fusion falla por cualquier razon, se devuelve la vista server-side tal
  // cual -- nunca peor que el comportamiento anterior.
  // A8 (2026-09-25): el resultado lleva `viewStatus` ("ok" | "error") para
  // que la pagina NUNCA convierta una falla tecnica (Apps Script caido, sin
  // red, token vencido) en "el instructor todavia no te vinculo". Un catalogo
  // que de verdad no existe o no incluye al aprendiz sigue siendo "ok" con
  // projects vacio.
  async function loadStudentSnapshot() {
    let scoped = createEmptySnapshot();
    let viewStatus = "error";
    const driveDb = runtimeScope.driveDb;
    if (driveDb && typeof driveDb.getStudentProductiveStageViewDetailed === "function") {
      try {
        const detailed = await driveDb.getStudentProductiveStageViewDetailed();
        if (detailed && detailed.status === "found") {
          scoped = Object.assign(createEmptySnapshot(), detailed.data || {});
          viewStatus = "ok";
        } else if (detailed && detailed.status === "missing") {
          viewStatus = "ok";
        }
      } catch (error) {
        viewStatus = "error";
      }
    } else if (driveDb && typeof driveDb.getStudentProductiveStageView === "function") {
      // drive_db.js viejo en cache: sin forma de distinguir, se asume error
      // solo si lanza (comportamiento previo).
      try {
        const raw = await driveDb.getStudentProductiveStageView();
        scoped = raw ? Object.assign(createEmptySnapshot(), raw) : createEmptySnapshot();
        viewStatus = "ok";
      } catch (error) {
        viewStatus = "error";
      }
    }
    const usernameKey = currentUsernameKey();
    let result = scoped;
    if (usernameKey) {
      try {
        const own = await loadOwnDocumentDeliveries(usernameKey);
        result = mergeOwnDeliveriesIntoSnapshot(scoped, own, usernameKey);
      } catch (error) {
        result = scoped;
      }
    }
    return Object.assign(result, { viewStatus: viewStatus });
  }

  // Resuelve la usernameKey de la sesion ACTUAL (nunca la de un parametro
  // externo) -- mismo patron que currentSessionUsernameKey() en
  // firebase_db.js. Si portalAuth no esta disponible (tests, o algun orden
  // de carga atipico), devuelve "" y el llamador simplemente omite la
  // fusion/escritura propia (no revienta).
  function currentUsernameKey() {
    try {
      const auth = runtimeScope.portalAuth;
      const session = auth && typeof auth.getCurrentSession === "function" ? auth.getCurrentSession() : null;
      const key = session && session.user && session.user.usernameKey;
      return key ? String(key).trim().toLowerCase() : "";
    } catch (error) {
      return "";
    }
  }

  function ownDeliveriesScopeKey(usernameKey) {
    return "student:" + String(usernameKey || "").trim().toLowerCase();
  }

  // Lee el doc PROPIO de entregas de un aprendiz. Reutiliza
  // _firebaseDb.cloudGetGuideData (la MISMA funcion generica que ya usa
  // cada guia para sus respuestas), asi que hereda gratis el mismo ruteo
  // Firestore-primero/Drive-de-respaldo que protege todo lo demas -- nada de
  // eso se reimplementa aqui.
  async function loadOwnDocumentDeliveries(usernameKey) {
    const key = String(usernameKey || "").trim().toLowerCase();
    if (!key || !runtimeScope._firebaseDb || typeof runtimeScope._firebaseDb.cloudGetGuideData !== "function") {
      return createEmptySnapshot();
    }
    try {
      const cloudSnapshot = await runtimeScope._firebaseDb.cloudGetGuideData(
        ownDeliveriesScopeKey(key),
        OWN_DELIVERIES_FILE_NAME
      );
      return cloudSnapshot ? Object.assign(createEmptySnapshot(), cloudSnapshot) : createEmptySnapshot();
    } catch (error) {
      return createEmptySnapshot();
    }
  }

  // Guarda la entrega de UN documento base en el doc PROPIO del aprendiz
  // (cierre de "syncDocumentDeliveryToCloud falla en silencio"). El campo
  // `usernameKey` de `deliveryRecord` (si trajera uno) se IGNORA a proposito:
  // la identidad que decide DONDE se escribe es siempre el parametro
  // `usernameKey` (la sesion ya autenticada de quien llama), nunca un campo
  // que viajo en el propio registro -- lo mismo que ya garantiza
  // handleStudentProductiveStageView del lado de lectura. Nunca traga el
  // error: devuelve {ok:false} para que el llamador pueda avisar de forma
  // visible en vez de fallar en silencio.
  //
  // 2026-09-25: escribe con cloudUpdateGuideDataStrict (leer -> agregar por
  // id -> escribir con precondicion). Antes leia con loadOwnDocumentDeliveries,
  // que ante una lectura fallida devolvia un snapshot VACIO y el guardado
  // reemplazaba el doc: se perdian las entregas anteriores del aprendiz.
  // Ahora: lectura fallida = cero escrituras ({ok:false, status:"read-failed"})
  // y dos dispositivos a la vez nunca se pisan (conflicto -> releer).
  async function updateOwnDeliveries(usernameKey, mutate) {
    const key = String(usernameKey || "").trim().toLowerCase();
    const dbApi = runtimeScope._firebaseDb;
    if (!key || !dbApi || typeof dbApi.cloudUpdateGuideDataStrict !== "function") {
      return { ok: false, savedCloud: false, status: "unavailable" };
    }
    try {
      const result = await dbApi.cloudUpdateGuideDataStrict(
        ownDeliveriesScopeKey(key),
        OWN_DELIVERIES_FILE_NAME,
        function (current) { return mutate(Object.assign(createEmptySnapshot(), current || {}), key); }
      );
      return { ok: Boolean(result && result.ok), savedCloud: Boolean(result && result.ok), status: (result && result.status) || "write-failed" };
    } catch (error) {
      return { ok: false, savedCloud: false, status: "write-failed" };
    }
  }

  async function saveOwnDocumentDelivery(usernameKey, deliveryRecord) {
    return updateOwnDeliveries(usernameKey, function (current, key) {
      return appendDocumentDeliveryToSnapshot(current, Object.assign({}, deliveryRecord || {}, { usernameKey: key }));
    });
  }

  // ── Avance del proyecto registrado por el propio aprendiz (A3/A4/A5) ────
  // El archivo vive en Drive; aqui solo metadatos, en el doc PROPIO del
  // aprendiz (nunca en el catalogo admin, que un aprendiz no puede escribir).
  // `submissionId` identifica UNA entrega real: el mismo evento repetido, un
  // refresh o un reintento producen el mismo id (no duplica); una reentrega
  // nueva trae otro archivo/fecha y por tanto otro id.
  function buildProjectSubmissionId(usernameKey, record) {
    const r = record || {};
    const key = String(usernameKey || "").trim().toLowerCase();
    const unique = String(r.fileId || "").trim() ||
      (String(r.submittedAt || r.uploadedAt || "").trim() + "|" + String(r.savedFileName || "").trim());
    return "student:" + key + ":" + String(r.projectId || "").trim() + ":" + unique;
  }

  function appendOwnProjectDelivery(previousSnapshot, usernameKey, record) {
    const base = Object.assign(createEmptySnapshot(), previousSnapshot || {});
    const list = Array.isArray(base.projectDeliveries) ? base.projectDeliveries.slice() : [];
    const key = String(usernameKey || "").trim().toLowerCase();
    const r = record || {};
    const projectId = String(r.projectId || "").trim();
    if (!key || !projectId) return base;
    const submissionId = String(r.submissionId || "").trim() || buildProjectSubmissionId(key, r);
    if (list.some(function (item) { return item && item.submissionId === submissionId; })) {
      return base; // idempotente: ya registrada
    }
    list.push({
      submissionId: submissionId,
      deliveryId: submissionId,
      projectId: projectId,
      projectTitle: String(r.projectTitle || ""),
      usernameKey: key,
      uploadedByUsernameKey: key,
      uploadedByName: String(r.fullName || r.uploadedByName || ""),
      ficha: String(r.ficha || ""),
      grupo: String(r.grupo || ""),
      uploadedAt: String(r.submittedAt || r.uploadedAt || new Date().toISOString()),
      savedFileName: String(r.savedFileName || ""),
      driveUrl: String(r.driveUrl || ""),
      fileId: String(r.fileId || ""),
      status: "delivered",
      source: "student",
    });
    return Object.assign({}, base, { projectDeliveries: list });
  }

  async function saveOwnProjectDelivery(usernameKey, record) {
    return updateOwnDeliveries(usernameKey, function (current, key) {
      return appendOwnProjectDelivery(current, key, record);
    });
  }

  // Avances propios -> formato de `deliveries` (el mismo que ya pintan el
  // historial del aprendiz y el del admin), sin duplicar por deliveryId.
  function mergeProjectDeliveriesInto(base, records) {
    const deliveries = Array.isArray(base.deliveries) ? base.deliveries.slice() : [];
    (Array.isArray(records) ? records : []).forEach(function (record) {
      if (!record || !record.projectId || !record.deliveryId) return;
      if (deliveries.some(function (d) { return d && d.deliveryId === record.deliveryId; })) return;
      deliveries.push(Object.assign({}, record));
    });
    return Object.assign({}, base, { deliveries: deliveries });
  }

  // Fusiona las entregas PROPIAS (doc por aprendiz) dentro de la vista ya
  // acotada server-side que devuelve loadStudentSnapshot(). Defensa en
  // profundidad: solo se toma cada registro si su propio usernameKey
  // coincide con el aprendiz actual, aunque el esquema de propiedad del doc
  // (uno por aprendiz) ya lo garantiza por si solo -- nunca puede introducir
  // un registro de OTRO aprendiz.
  function mergeOwnDeliveriesIntoSnapshot(scopedSnapshot, ownSnapshot, usernameKey) {
    const base = Object.assign(createEmptySnapshot(), scopedSnapshot || {});
    const key = String(usernameKey || "").trim().toLowerCase();
    const ownDeliveries = Array.isArray(ownSnapshot && ownSnapshot.documentDeliveries)
      ? ownSnapshot.documentDeliveries
      : [];
    const merged = ownDeliveries.reduce(function (acc, record) {
      if (String((record && record.usernameKey) || "").trim().toLowerCase() !== key) {
        return acc;
      }
      return appendDocumentDeliveryToSnapshot(acc, record);
    }, base);
    const ownProjectDeliveries = (Array.isArray(ownSnapshot && ownSnapshot.projectDeliveries) ? ownSnapshot.projectDeliveries : [])
      .filter(function (record) { return String((record && record.usernameKey) || "").trim().toLowerCase() === key; });
    return mergeProjectDeliveriesInto(merged, ownProjectDeliveries);
  }

  // A7 (vista del instructor): fusiona, SOLO PARA MOSTRAR, los docs propios
  // de los aprendices dentro del catalogo admin. Nunca modifica el snapshot
  // admin recibido (el panel sigue guardando exactamente sus propios datos):
  //   * documentos base: el registro del aprendiz se usa si el admin no
  //     tiene uno para ese aprendiz+documento, o si el del aprendiz es mas
  //     reciente (una reentrega real);
  //   * avances: se agregan por deliveryId sin tocar los manuales del admin.
  // `ownByUser` = { [usernameKey]: snapshotPropio }.
  function mergeStudentOwnRecordsIntoView(adminSnapshot, ownByUser) {
    let view = Object.assign(createEmptySnapshot(), adminSnapshot || {});
    view = Object.assign({}, view, {
      documentDeliveries: (Array.isArray(view.documentDeliveries) ? view.documentDeliveries : []).slice(),
      deliveries: (Array.isArray(view.deliveries) ? view.deliveries : []).slice(),
    });
    Object.keys(ownByUser || {}).forEach(function (rawKey) {
      const key = String(rawKey || "").trim().toLowerCase();
      const own = ownByUser[rawKey] || {};
      (Array.isArray(own.documentDeliveries) ? own.documentDeliveries : []).forEach(function (record) {
        if (!record || String(record.usernameKey || "").trim().toLowerCase() !== key || !record.docId) return;
        const existing = view.documentDeliveries.find(function (item) {
          return item && String(item.usernameKey || "").trim().toLowerCase() === key && item.docId === record.docId;
        });
        const existingTime = Date.parse((existing && existing.submittedAt) || "") || 0;
        const recordTime = Date.parse(record.submittedAt || "") || 0;
        if (!existing || recordTime > existingTime) {
          view = appendDocumentDeliveryToSnapshot(view, record);
        }
      });
      const projectRecords = (Array.isArray(own.projectDeliveries) ? own.projectDeliveries : [])
        .filter(function (record) { return record && String(record.usernameKey || "").trim().toLowerCase() === key; });
      view = mergeProjectDeliveriesInto(view, projectRecords);
    });
    return view;
  }

  async function saveSnapshot(snapshot) {
    const normalized = Object.assign(createEmptySnapshot(), snapshot || {});
    const savedLocal = writeLocalSnapshot(normalized);
    const savedCloud = await writeCloudSnapshot(normalized);
    return {
      ok: savedLocal || savedCloud,
      savedLocal: savedLocal,
      savedCloud: savedCloud,
    };
  }

  return {
    LOCAL_KEY: LOCAL_KEY,
    SCOPE_KEY: SCOPE_KEY,
    FILE_NAME: FILE_NAME,
    createEmptySnapshot: createEmptySnapshot,
    mergeImportIntoSnapshot: mergeImportIntoSnapshot,
    loadSnapshot: loadSnapshot,
    loadStudentSnapshot: loadStudentSnapshot,
    saveSnapshot: saveSnapshot,
    buildStudentIndex: buildStudentIndex,
    getStudentProjectIds: getStudentProjectIds,
    getStudentProjects: getStudentProjects,
    getProjectReports: getProjectReports,
    getProjectDeliveries: getProjectDeliveries,
    appendProjectDeliveryToSnapshot: appendProjectDeliveryToSnapshot,
    appendDocumentDeliveryToSnapshot: appendDocumentDeliveryToSnapshot,
    getDocumentDeliveriesByUsername: getDocumentDeliveriesByUsername,
    setDocumentDeadlineInSnapshot: setDocumentDeadlineInSnapshot,
    OWN_DELIVERIES_FILE_NAME: OWN_DELIVERIES_FILE_NAME,
    loadOwnDocumentDeliveries: loadOwnDocumentDeliveries,
    saveOwnDocumentDelivery: saveOwnDocumentDelivery,
    saveOwnProjectDelivery: saveOwnProjectDelivery,
    appendOwnProjectDelivery: appendOwnProjectDelivery,
    buildProjectSubmissionId: buildProjectSubmissionId,
    mergeOwnDeliveriesIntoSnapshot: mergeOwnDeliveriesIntoSnapshot,
    mergeStudentOwnRecordsIntoView: mergeStudentOwnRecordsIntoView,
  };
});
