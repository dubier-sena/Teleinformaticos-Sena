const PAGE_FILE = window.location.pathname.split("/").pop().toLowerCase() || "guia6.html";
const STORAGE_FILE_ALIASES = {
  "grupo-11a-guia-06-planificar-informacion.html": "11a_guia6.html",
  "grupo-11b-guia-06-planificar-informacion.html": "11b_guia6.html",
  "plantilla-grado-11-guia-06-planificar-informacion.html": "grado_guia6.html",
};
const GUIDE_DATA_FILE = STORAGE_FILE_ALIASES[PAGE_FILE] || PAGE_FILE;
const PAGE_KEY = GUIDE_DATA_FILE.replace(/[^a-z0-9]+/g, "_") || "guia6";
const portalAuth = window.portalAuth || null;
const LEGACY_STORAGE_KEY = `guia_interactiva_${PAGE_KEY}`;
const STORAGE_KEY = portalAuth
  ? portalAuth.getScopedStorageKey(LEGACY_STORAGE_KEY, { area: "guide-data" })
  : LEGACY_STORAGE_KEY;
const STORAGE_META_KEY = `${STORAGE_KEY}__meta`;
const SCOPED_STORAGE_ENABLED = STORAGE_KEY !== LEGACY_STORAGE_KEY;
const CLOUD_SYNC_DELAY_MS = 1200;
const CLOUD_REFRESH_MS = 60000;
const SUPPORT_BASE_PATH =
  "assets/materiales/guia6/";
const DRIVE_FOLDERS = {
  "3168850": "https://drive.google.com/drive/folders/1fBPzXHU0OHDmKa18Y6V2tnomLyYWgiLp?usp=drive_link",
  "3168852": "https://drive.google.com/drive/folders/1p9HdGinK1me8PsbaLHYio_OC-idAmorR?usp=drive_link",
  "31688502": "https://drive.google.com/drive/folders/1p9HdGinK1me8PsbaLHYio_OC-idAmorR?usp=drive_link",
};

const installationTools = [
  {
    id: "suite",
    name: "Suite ofimatica",
    suggested: "LibreOffice o Microsoft 365",
    verification:
      "Procesador de texto, hoja de calculo y presentaciones abriendo correctamente.",
  },
  {
    id: "browser",
    name: "Navegador web actualizado",
    suggested: "Firefox, Chrome o Edge",
    verification:
      "Extensiones basicas de seguridad y configuracion general verificadas.",
  },
  {
    id: "email",
    name: "Cliente de correo configurado",
    suggested: "Thunderbird, Outlook o cuenta institucional",
    verification:
      "Cuenta de prueba configurada y envio/recepcion de mensaje exitosos.",
  },
  {
    id: "zip",
    name: "Compresion y descompresion",
    suggested: "7-Zip",
    verification:
      "Compresion y descompresion de un archivo de prueba con evidencia.",
  },
  {
    id: "antivirus",
    name: "Proteccion antivirus",
    suggested: "Windows Defender u otra solucion validada",
    verification:
      "Estado protegido, definiciones actualizadas y analisis rapido ejecutado.",
  },
  {
    id: "diagnostic",
    name: "Herramienta de diagnostico",
    suggested: "CPU-Z o CrystalDiskInfo",
    verification:
      "Herramienta instalada y mostrando reporte del hardware o del disco.",
  },
];

const diagnosticSections = [
  { id: "hardware", name: "Hardware", prompt: "Procesador, RAM, almacenamiento, tarjeta de red." },
  { id: "so", name: "Sistema operativo", prompt: "Version, licenciamiento, actualizaciones pendientes." },
  { id: "disk", name: "Estado del disco", prompt: "Salud, espacio disponible, alertas." },
  { id: "software", name: "Inventario de software", prompt: "Nombre, version, licencia, fecha de instalacion." },
  { id: "network", name: "Conectividad de red", prompt: "IP, mascara, puerta de enlace, DNS y prueba de ping." },
];

const budgetItems = [
  { id: "suite", name: "Software y licencias (suite ofimatica)", license: "Libre / Propietaria / Suscripcion" },
  { id: "diagnostic", name: "Herramientas de diagnostico y soporte", license: "Libre (gratuita)" },
  { id: "security", name: "Proteccion antivirus / seguridad", license: "Libre / Propietaria" },
  { id: "cloud", name: "Servicios en la nube (correo / almacenamiento)", license: "Suscripcion / Libre" },
  { id: "backup", name: "Software de respaldo (copias de seguridad)", license: "Libre / Propietaria" },
];

const evidenceRows = [
  {
    phase: "Ejecucion",
    project:
      "Implementar procesos para el mantenimiento fisico, logico y herramientas tecnologicas de los equipos de computo y redes de datos.",
    learning: "Act. 3.2.2 - Mapa conceptual de herramientas tecnologicas (RAP 02).",
    evidence:
      "CONOCIMIENTO: mapa conceptual digital integrador sobre herramientas tecnologicas para soporte tecnico, presentado oralmente al grupo.",
    criteria:
      "Diferencia herramientas TIC, tipos de software y servicios segun necesidades de la organizacion.",
    methods: "Tecnica: Exposicion oral. Instrumento: Lista de chequeo IE-01.",
  },
  {
    phase: "Ejecucion",
    project:
      "Implementar procesos para el mantenimiento fisico, logico y herramientas tecnologicas de los equipos de computo y redes de datos.",
    learning: "Act. 3.3.1 - Instalacion y configuracion de herramientas tecnologicas (RAP 02).",
    evidence:
      "DESEMPENO: checklist de instalacion diligenciado con evidencias y capturas de pantalla.",
    criteria:
      "Instala sistemas operativos, aplicaciones, herramientas ofimaticas y software utilitario de acuerdo con manuales y necesidades de la organizacion.",
    methods: "Tecnica: Observacion directa. Instrumento: Lista de chequeo IE-02.",
  },
  {
    phase: "Ejecucion",
    project:
      "Implementar procesos para el mantenimiento fisico, logico y herramientas tecnologicas de los equipos de computo y redes de datos.",
    learning: "Act. 3.4.1 - Presupuesto de implementacion tecnologica para MiPyme (RAP 02).",
    evidence:
      "PRODUCTO: documento PDF con presupuesto detallado, tabla de elementos con precios de sitios oficiales, justificacion tecnica por herramienta y conclusion.",
    criteria:
      "Adapta herramientas TIC de acuerdo con las necesidades de la entidad y utiliza motores de busqueda considerando requerimientos tecnicos de los dispositivos.",
    methods: "Tecnica: Valoracion de producto. Instrumento: Lista de chequeo IE-03.",
  },
];

const glossaryTerms = [
  ["Activo de informacion", "Dato, software, equipo o proceso que tiene valor para la organizacion y debe ser protegido y gestionado."],
  ["Checklist", "Lista estructurada que permite verificar paso a paso si un procedimiento tecnico se ejecuto correctamente."],
  ["Compatibilidad", "Capacidad de un software o hardware para funcionar con otros sistemas o configuraciones sin generar conflictos."],
  ["Convencion de nombres", "Reglas para nombrar archivos y carpetas de manera coherente, identificando contenido, version y fecha."],
  ["Documentacion tecnica", "Registros escritos que describen caracteristicas, procedimientos y estado de equipos y sistemas tecnologicos."],
  ["Ficha tecnica", "Documento con caracteristicas tecnicas de un equipo o software: marca, modelo, serie, configuracion y fechas."],
  ["Gestion de la informacion", "Procesos que garantizan la recoleccion, organizacion, almacenamiento, recuperacion y proteccion de la informacion."],
  ["Hardening", "Proceso de configuracion para reducir vulnerabilidades y mejorar la seguridad de un sistema."],
  ["Herramienta de diagnostico", "Software que analiza hardware y software para detectar fallas y generar reportes tecnicos."],
  ["Inventario tecnologico", "Registro actualizado de activos de hardware y software con caracteristicas, ubicacion, estado y responsable."],
  ["Licenciamiento", "Acuerdo legal que autoriza el uso de un software bajo determinadas condiciones."],
  ["Manual tecnico", "Documento oficial con procedimientos para instalar, configurar, operar y mantener un equipo o software."],
  ["Protocolo", "Conjunto de reglas o procedimientos establecidos para realizar una tarea de manera estandarizada."],
  ["Software utilitario", "Programas de apoyo para compresion, seguridad, diagnostico, copias de seguridad y tareas del sistema."],
  ["Versionado", "Sistema para controlar y registrar cambios realizados a un documento o archivo."],
];

const supportBundle = [
  {
    title: "Paquete completo de materiales",
    file: "materiales_apoyo_guia6_PDFs_y_enlaces.zip",
    type: "ZIP local",
    description:
      "Compilado de documentos y recursos complementarios de la Guia 6 para consulta o respaldo.",
    cta: "Abrir paquete ZIP",
  },
];

const supportDocuments = [
  {
    title: "Formato de inscripcion de proyecto",
    file: "GFPI-F-165FormatoSeleccionModificacionAlternativaEtapaProductiva.xlsx",
    type: "XLSX local",
    description:
      "Formato complementario para diligenciar la inscripcion o seleccion solicitada por el instructor.",
    cta: "Abrir formato",
  },
  {
    title: "Conceptos de seguridad",
    file: "Conceptos Seguridad.pdf",
    type: "PDF local",
    description:
      "Material base de consulta para repasar principios de seguridad aplicados al trabajo tecnico.",
  },
  {
    title: "IT Essentials - Capitulo 13 Seguridad",
    file: "ITE7_Chp13 - Seguridad.pdf",
    type: "PDF local",
    description:
      "Lectura de apoyo sobre seguridad, amenazas y buenas practicas relacionadas con el soporte tecnico.",
  },
  {
    title: "Guia Accountability y Habeas Data",
    file: "Guia-Accountability - Habeas Data.pdf",
    type: "PDF local",
    description:
      "Documento de consulta para tratamiento responsable de datos y cumplimiento de buenas practicas.",
  },
  {
    title: "Ley 1581 de 2012",
    file: "Ley_1581_de_2012.pdf",
    type: "PDF local",
    description:
      "Normativa colombiana de referencia para proteccion de datos personales.",
  },
  {
    title: "Presentacion Ley 1581 de 2012",
    file: "PRESENTACION LEY 1581 de 2012.pptx",
    type: "PPTX local",
    description:
      "Apoyo visual para socializar la proteccion de datos y su aplicacion en contextos reales.",
  },
  {
    title: "NTC-ISO-IEC 27001:2013",
    file: "NTC-ISO-IEC 27001_2013.pdf",
    type: "PDF local",
    description:
      "Referencia tecnica sobre sistemas de gestion de seguridad de la informacion.",
  },
  {
    title: "Guia de copias de seguridad",
    file: "guia-copias-de-seguridad.pdf",
    type: "PDF local",
    description:
      "Material para fortalecer practicas de respaldo, continuidad y proteccion de informacion.",
  },
  {
    title: "INCIBE - Proteccion de la informacion",
    file: "INCIBE_Proteccion_de_la_informacion_mirror_uv.pdf",
    type: "PDF local",
    description:
      "Guia practica para mejorar el manejo seguro de la informacion en equipos y organizaciones.",
  },
  {
    title: "INCIBE - Ciberseguridad para todos",
    file: "INCIBE_guia_ciberseguridad_para_todos.pdf",
    type: "PDF local",
    description:
      "Lectura complementaria con recomendaciones de ciberseguridad aplicables al aula y a la empresa.",
  },
  {
    title: "INCIBE - Copias y borrado seguro",
    file: "INCIBE_Copias_borrado_seguro_12_consejos.pdf",
    type: "PDF local",
    description:
      "Consejos concretos sobre respaldo, recuperacion y eliminacion segura de archivos.",
  },
  {
    title: "MinTIC - Gestion y clasificacion de incidentes",
    file: "MinTIC_Guia_Gestion_Clasificacion_Incidentes.pdf",
    type: "PDF local",
    description:
      "Apoyo para reconocer incidentes, documentarlos y responderlos desde el rol tecnico.",
  },
  {
    title: "MinEducacion - Politica de seguridad digital",
    file: "MinEducacion_Guia_Implementacion_Politica_Seguridad_Digital.pdf",
    type: "PDF local",
    description:
      "Orientacion institucional sobre seguridad digital y medidas de implementacion.",
  },
  {
    title: "Cisco Networking Academy - IT Essentials",
    href: "https://www.netacad.com",
    type: "Recurso web oficial",
    description:
      "Material de referencia principal para estudiar herramientas de soporte, instalacion y diagnostico.",
    cta: "Abrir NetAcad",
  },
  {
    title: "Biblioteca Virtual SENA",
    href: "https://biblioteca.sena.edu.co",
    type: "Recurso institucional",
    description:
      "Acceso a colecciones, guias y consultas tecnicas recomendadas por el programa.",
    cta: "Abrir biblioteca",
  },
  {
    title: "Documentacion LibreOffice",
    href: "https://documentation.libreoffice.org/es/",
    type: "Recurso web oficial",
    description:
      "Manual y ayudas para instalacion, uso basico y exportacion de productos en la suite ofimatica.",
    cta: "Abrir documentacion",
  },
  {
    title: "Soporte Microsoft 365",
    href: "https://support.microsoft.com/es-es/microsoft-365",
    type: "Recurso web oficial",
    description:
      "Guia oficial para instalacion y configuracion de herramientas de productividad.",
    cta: "Abrir soporte",
  },
  {
    title: "Belarc Advisor",
    href: "https://www.belarc.com/products/belarc-advisor",
    type: "Recurso web oficial",
    description:
      "Herramienta recomendada para inventario y diagnostico adicional del equipo.",
    cta: "Abrir sitio oficial",
  },
  {
    title: "CrystalDiskInfo",
    href: "https://crystalmark.info/en/software/crystaldiskinfo/",
    type: "Recurso web oficial",
    description:
      "Recurso oficial para revisar salud del disco y complementar el diagnostico tecnico.",
    cta: "Abrir sitio oficial",
  },
];

const supportTools = [
  {
    title: "7-Zip",
    href: "https://drive.google.com/drive/folders/19AY6LsSHM--2VVXp4_Bzzjz2SVyAiSMc?usp=sharing",
    type: "Drive",
    description:
      "Utilidad de compresion y descompresion para organizar evidencias y paquetes de trabajo.",
    cta: "Abrir en Drive ↗",
  },
  {
    title: "CPU-Z",
    href: "https://drive.google.com/drive/folders/19AY6LsSHM--2VVXp4_Bzzjz2SVyAiSMc?usp=sharing",
    type: "Drive",
    description:
      "Herramienta de diagnostico para identificar procesador, memoria y componentes del sistema.",
    cta: "Abrir en Drive ↗",
  },
  {
    title: "CrystalDiskInfo",
    file: "CrystalDiskInfo9_8_0.zip",
    type: "ZIP local",
    description:
      "Utilidad para revisar el estado de salud y alertas del disco de almacenamiento.",
  },
  {
    title: "LibreOffice",
    file: "LibreOffice_26.2.1_Win_x86-64.msi",
    type: "MSI local",
    description:
      "Suite ofimatica para elaborar documentos tecnicos, tablas y presentaciones de evidencia.",
  },
  {
    title: "CmapTools",
    href: "https://drive.google.com/drive/folders/19AY6LsSHM--2VVXp4_Bzzjz2SVyAiSMc?usp=sharing",
    type: "Drive",
    description:
      "Aplicacion recomendada para el mapa conceptual solicitado en la guia.",
    cta: "Abrir en Drive ↗",
  },
];

const GUIDE6_DRIVE_ACTIVITY_TARGETS = [
  {
    activityNumber: "3.1.1",
    panelKey: "guide6-3-1-1",
    description:
      "Cuando termines la bitacora individual de analisis, subela a la carpeta de Drive correspondiente a tu ficha.",
    note: "Entrega sugerida: bitacora individual exportada a Word o version final del analisis.",
    activityContext: {
      activityTitle: "Estudio de caso - Bitacora individual de analisis",
      fileNamePrefix: "Bitacora_Guia6_EstudioCaso",
      learnerNameMode: "full",
    },
  },
  {
    activityNumber: "3.2.1",
    panelKey: "guide6-3-2-1",
    description:
      "Sube a Drive la tabla resumen, el PDF o la evidencia final construida por el equipo para esta actividad.",
    note: "Entrega sugerida: tabla resumen del bloque tematico en PDF o archivo editable.",
    activityContext: {
      activityTitle: "Tabla resumen del bloque tematico",
      fileNamePrefix: "TablaResumen_Guia6_Bloque",
      learnerNameMode: "full",
    },
  },
  {
    activityNumber: "3.2.2",
    panelKey: "guide6-3-2-2",
    description:
      "Sube a Drive el mapa conceptual exportado a PDF y la evidencia que sustenta la socializacion del equipo.",
    note: "Entrega sugerida: mapa conceptual en PDF y soporte del producto presentado.",
    activityContext: {
      activityTitle: "Mapa conceptual de herramientas tecnologicas",
      fileNamePrefix: "MapaConceptual_Guia6",
      learnerNameMode: "full",
    },
  },
  {
    activityNumber: "3.3.1",
    panelKey: "guide6-3-3-1",
    description:
      "Sube a Drive el checklist de instalacion, capturas y evidencias tecnicas de la configuracion realizada.",
    note: "Entrega sugerida: checklist diligenciado, capturas y registro de instalacion.",
    activityContext: {
      activityTitle: "Checklist de instalacion y configuracion de herramientas",
      fileNamePrefix: "Checklist_Guia6_Instalacion",
      learnerNameMode: "full",
    },
  },
  {
    activityNumber: "3.3.2",
    panelKey: "guide6-3-3-2",
    description:
      "Sube a Drive el diagnostico tecnico con hallazgos, recomendaciones y soporte de las herramientas usadas.",
    note: "Entrega sugerida: diagnostico final del equipo y carpeta de evidencias.",
    activityContext: {
      activityTitle: "Diagnostico tecnico del equipo",
      fileNamePrefix: "Diagnostico_Guia6",
      learnerNameMode: "full",
    },
  },
  {
    activityNumber: "3.4.1",
    panelKey: "guide6-3-4-1",
    description:
      "Sube a Drive el presupuesto en PDF junto con el archivo editable y la justificacion tecnica final.",
    note: "Entrega sugerida: presupuesto PDF, archivo fuente y conclusion tecnica.",
    activityContext: {
      activityTitle: "Presupuesto de implementacion tecnologica",
      fileNamePrefix: "Presupuesto_Guia6",
      learnerNameMode: "full",
    },
  },
];

let state = loadState();
let cloudStateSyncTimer = null;
let cloudStateRetryTimer = null;
let pendingCloudStateSnapshot = null;
let guia6Booted = false;

function initGuia6() {
  if (guia6Booted) {
    return;
  }

  guia6Booted = true;
  renderStatefulSections();
  renderEvidenceTable();
  renderGlossary();
  renderSupportMaterials();
  renderDriveDeliveryPanel();
  hydrateFields();
  applyBitacoraLock();
  applyBitacoraSocializacionLock();
  updateBudgetSummary();
  bindEvents();
  updateProgress();
  setupScrollSpy();
  initializeCloudStateSync();
}

window.initGuia6 = initGuia6;

if (!window.__PAGE_CONTEXT__) {
  document.addEventListener("DOMContentLoaded", initGuia6);
}

document.addEventListener("guide-activity-check-change", () => {
  window.requestAnimationFrame(() => updateProgress());
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeBitacoraExportModal();
  }
});

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved) || {};
    }

    if (SCOPED_STORAGE_ENABLED) {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        const parsed = JSON.parse(legacy) || {};
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        return parsed;
      }
    }

    return {};
  } catch {
    return {};
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  saveStateMeta({
    updatedAt: new Date().toISOString(),
    updatedBy: getCloudActor(),
  });
  updateBudgetSummary();
  updateProgress();
  pendingCloudStateSnapshot = buildCloudStateSnapshot();
  scheduleCloudStateSync();
}

function renderStatefulSections() {
  renderInstallationTable();
  renderDiagnosticTable();
  renderBudgetTable();
}

function readStateMeta() {
  try {
    const saved = localStorage.getItem(STORAGE_META_KEY);
    return saved ? JSON.parse(saved) || {} : {};
  } catch {
    return {};
  }
}

function saveStateMeta(meta) {
  try {
    if (!meta) {
      localStorage.removeItem(STORAGE_META_KEY);
      return;
    }
    localStorage.setItem(STORAGE_META_KEY, JSON.stringify(meta));
  } catch {
  }
}

function getCloudScopeKey() {
  const session = portalAuth?.getCurrentSession?.();
  if (!session) {
    return "";
  }

  if (session.role === "admin") {
    return `admin:${session.usernameKey || session.user?.usernameKey || "admin"}`;
  }

  if (session.role === "student") {
    return `student:${session.user?.usernameKey || session.usernameKey || ""}`;
  }

  return "";
}

function getCloudActor() {
  const session = portalAuth?.getCurrentSession?.();
  return session?.user?.fullName || session?.user?.username || "Administrador";
}

function hasMeaningfulState(source) {
  return Object.values(source || {}).some((value) => {
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "number") {
      return !Number.isNaN(value);
    }
    return String(value ?? "").trim().length > 0;
  });
}

function snapshotTime(value) {
  const parsed = Date.parse(value?.updatedAt || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function localSnapshotTime() {
  return snapshotTime(readStateMeta());
}

function buildCloudStateSnapshot() {
  return {
    scopeKey: getCloudScopeKey(),
    fileName: GUIDE_DATA_FILE,
    updatedAt: new Date().toISOString(),
    updatedBy: getCloudActor(),
    state: { ...state },
  };
}

function applyCloudStateSnapshot(snapshot) {
  state = snapshot?.state && typeof snapshot.state === "object" ? { ...snapshot.state } : {};
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  saveStateMeta({
    updatedAt: snapshot?.updatedAt || new Date().toISOString(),
    updatedBy: snapshot?.updatedBy || getCloudActor(),
  });
  renderStatefulSections();
  hydrateFields();
  updateBudgetSummary();
  updateProgress();
}

async function loadCloudState(force) {
  const scopeKey = getCloudScopeKey();
  if (!scopeKey || !window._firebaseDb || typeof window._firebaseDb.cloudGetGuideData !== "function") {
    return null;
  }
  if (!force && window._firebaseDb?.shouldDeferCloudReads?.()) {
    return null;
  }

  if (force && typeof window._firebaseDb.resetCache === "function") {
    window._firebaseDb.resetCache();
  }

  try {
    return await window._firebaseDb.cloudGetGuideData(scopeKey, GUIDE_DATA_FILE);
  } catch {
    return null;
  }
}

function scheduleCloudStateSync() {
  if (!getCloudScopeKey()) {
    return;
  }

  window.clearTimeout(cloudStateSyncTimer);
  window.clearTimeout(cloudStateRetryTimer);
  cloudStateSyncTimer = window.setTimeout(() => {
    syncCloudState(false);
  }, CLOUD_SYNC_DELAY_MS);
}

function scheduleCloudStateRetry() {
  if (!getCloudScopeKey() || !pendingCloudStateSnapshot) {
    return;
  }

  window.clearTimeout(cloudStateRetryTimer);
  cloudStateRetryTimer = window.setTimeout(() => {
    syncCloudState(true);
  }, 3000);
}

async function syncCloudState(force) {
  const scopeKey = getCloudScopeKey();
  if (!scopeKey || !window._firebaseDb || typeof window._firebaseDb.cloudSaveGuideData !== "function") {
    return false;
  }

  const snapshot = pendingCloudStateSnapshot || buildCloudStateSnapshot();
  pendingCloudStateSnapshot = snapshot;

  try {
      const saved = await window._firebaseDb.cloudSaveGuideData(scopeKey, GUIDE_DATA_FILE, snapshot);
    if (!saved) {
      scheduleCloudStateRetry();
      return false;
    }

    pendingCloudStateSnapshot = null;
    window.clearTimeout(cloudStateRetryTimer);
    saveStateMeta({
      updatedAt: snapshot.updatedAt,
      updatedBy: snapshot.updatedBy,
    });
    return true;
  } catch {
    scheduleCloudStateRetry();
    return false;
  }
}

function flushCloudStateSync() {
  if (!getCloudScopeKey() || (!pendingCloudStateSnapshot && !hasMeaningfulState(state))) {
    return;
  }

  pendingCloudStateSnapshot = pendingCloudStateSnapshot || buildCloudStateSnapshot();
  syncCloudState(true);
}

async function initializeCloudStateSync() {
  const scopeKey = getCloudScopeKey();
  if (!scopeKey) {
    return;
  }

  const remoteSnapshot = await loadCloudState(true);
  const localHasData = hasMeaningfulState(state);
  const remoteIsNewer = snapshotTime(remoteSnapshot) > localSnapshotTime();

  if (remoteSnapshot && (!localHasData || remoteIsNewer)) {
    applyCloudStateSnapshot(remoteSnapshot);
  } else if (localHasData) {
    pendingCloudStateSnapshot = buildCloudStateSnapshot();
    scheduleCloudStateSync();
  }

  window.setInterval(async () => {
    if (document.hidden) {
      return;
    }

    if (pendingCloudStateSnapshot) {
      return;
    }

    const nextSnapshot = await loadCloudState(false);
    if (!nextSnapshot) {
      return;
    }

    if (snapshotTime(nextSnapshot) > localSnapshotTime()) {
      applyCloudStateSnapshot(nextSnapshot);
    }
  }, CLOUD_REFRESH_MS);
}

function fieldValue(key, fallback = "") {
  return key in state ? state[key] : fallback;
}

function isChecked(key) {
  return Boolean(state[key]);
}

function renderInstallationTable() {
  const tbody = document.getElementById("installationTable");
  if (!tbody) {
    return;
  }

  tbody.innerHTML = installationTools
    .map(
      (tool) => `
        <tr>
          <td><strong>${escapeHtml(tool.name)}</strong><br><span class="muted-inline">${escapeHtml(tool.suggested)}</span></td>
          <td><input type="text" data-store="inst_source_${tool.id}" data-track value="${escapeHtml(fieldValue(`inst_source_${tool.id}`))}" placeholder="Manual, web oficial o fuente consultada"></td>
          <td><input type="text" data-store="inst_version_${tool.id}" data-track value="${escapeHtml(fieldValue(`inst_version_${tool.id}`))}" placeholder="Version instalada"></td>
          <td><textarea rows="2" data-store="inst_verify_${tool.id}" data-track placeholder="Criterio de verificacion aplicado.">${escapeHtml(fieldValue(`inst_verify_${tool.id}`, tool.verification))}</textarea></td>
          <td class="center-cell"><input type="checkbox" data-store="inst_done_${tool.id}" data-track${isChecked(`inst_done_${tool.id}`) ? " checked" : ""}></td>
          <td><textarea rows="2" data-store="inst_notes_${tool.id}" data-track placeholder="Configuracion aplicada, evidencia o hallazgo.">${escapeHtml(fieldValue(`inst_notes_${tool.id}`))}</textarea></td>
        </tr>
      `
    )
    .join("");
}

function renderDiagnosticTable() {
  const tbody = document.getElementById("diagnosticTable");
  if (!tbody) {
    return;
  }

  tbody.innerHTML = diagnosticSections
    .map(
      (item) => `
        <tr>
          <td><strong>${escapeHtml(item.name)}</strong><br><span class="muted-inline">${escapeHtml(item.prompt)}</span></td>
          <td><textarea rows="3" data-store="diag_result_${item.id}" data-track placeholder="Registra hallazgos y datos tecnicos.">${escapeHtml(fieldValue(`diag_result_${item.id}`))}</textarea></td>
          <td><textarea rows="3" data-store="diag_action_${item.id}" data-track placeholder="Anota recomendaciones o acciones de mejora.">${escapeHtml(fieldValue(`diag_action_${item.id}`))}</textarea></td>
        </tr>
      `
    )
    .join("");
}

function renderBudgetTable() {
  const tbody = document.getElementById("budgetTable");
  if (!tbody) {
    return;
  }

  tbody.innerHTML = budgetItems
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.name)}</td>
          <td><input type="text" data-store="budget_license_${item.id}" data-track value="${escapeHtml(fieldValue(`budget_license_${item.id}`, item.license))}" placeholder="Tipo de licencia"></td>
          <td><input type="number" min="0" step="0.01" data-store="budget_price_${item.id}" data-track value="${escapeHtml(fieldValue(`budget_price_${item.id}`))}" placeholder="0"></td>
          <td><input type="number" min="0" step="1" data-store="budget_qty_${item.id}" data-track value="${escapeHtml(fieldValue(`budget_qty_${item.id}`))}" placeholder="0"></td>
          <td id="budget_total_${item.id}">$0</td>
          <td><textarea rows="2" data-store="budget_why_${item.id}" data-track placeholder="Justificacion tecnica.">${escapeHtml(fieldValue(`budget_why_${item.id}`))}</textarea></td>
        </tr>
      `
    )
    .join("");
}

function renderEvidenceTable() {
  const tbody = document.getElementById("evidenceTable");
  if (!tbody) {
    return;
  }

  tbody.innerHTML = evidenceRows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.phase)}</td>
          <td>${escapeHtml(row.project)}</td>
          <td>${escapeHtml(row.learning)}</td>
          <td>${escapeHtml(row.evidence)}</td>
          <td>${escapeHtml(row.criteria)}</td>
          <td>${escapeHtml(row.methods)}</td>
        </tr>
      `
    )
    .join("");
}

function renderGlossary() {
  const container = document.getElementById("glossaryGrid");
  if (!container) {
    return;
  }

  container.innerHTML = glossaryTerms
    .map(([term, definition]) => {
      const search = `${term} ${definition}`.toLowerCase();
      return `
        <article class="glossary-card" data-search="${escapeHtml(search)}">
          <h3>${escapeHtml(term)}</h3>
          <p>${escapeHtml(definition)}</p>
        </article>
      `;
    })
    .join("");
}

function renderSupportMaterials() {
  renderMaterialGroup("supportBundleGrid", supportBundle);
  renderMaterialGroup("supportDocsGrid", supportDocuments);
  renderMaterialGroup("supportToolsGrid", supportTools);
}

function getDriveFolderUrl() {
  const selection = getGuideSelection();
  const ficha = selection.ficha || localStorage.getItem("sena_ficha") || "";
  return ficha ? DRIVE_FOLDERS[ficha] || "" : "";
}

function showDriveSelectionAlert() {
  window.alert(
    "No se encontro la carpeta de Drive para esta ficha. Regresa al portal y verifica que el grupo seleccionado sea el correcto."
  );
}

function ensureDriveQrModal() {
  let modal = document.getElementById("drive-qr-modal");
  if (modal) {
    return modal;
  }

  modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.id = "drive-qr-modal";
  modal.innerHTML = `
    <div class="modal-box" style="text-align:center;max-width:320px;padding:28px 28px 24px">
      <h3 id="drive-qr-title" style="font-size:16px;margin-bottom:4px">Abrir carpeta de Drive</h3>
      <p style="font-size:12px;color:var(--text-muted);margin-bottom:0">Escanea este codigo QR desde el celular.</p>
      <img id="drive-qr-img" class="qr-modal-img" src="" alt="Codigo QR de la carpeta de Drive">
      <div class="qr-url-text" id="drive-qr-url"></div>
      <button class="modal-btn-ok" type="button" style="width:100%" id="drive-qr-close">Cerrar</button>
    </div>
  `;

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeDriveFolderQR();
    }
  });

  document.body.appendChild(modal);
  document.getElementById("drive-qr-close")?.addEventListener("click", closeDriveFolderQR);
  return modal;
}

function openDriveFolder() {
  const url = getDriveFolderUrl();
  if (!url) {
    showDriveSelectionAlert();
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

function showDriveFolderQR() {
  const url = getDriveFolderUrl();
  if (!url) {
    showDriveSelectionAlert();
    return;
  }

  const selection = getGuideSelection();
  ensureDriveQrModal();
  document.getElementById("drive-qr-title").textContent = selection.grupo
    ? `Portafolio Drive - Grupo ${selection.grupo}`
    : "Portafolio de evidencias en Drive";
  document.getElementById("drive-qr-url").textContent = url;
  document.getElementById("drive-qr-img").src =
    "https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=" +
    encodeURIComponent(url);
  document.getElementById("drive-qr-modal").classList.add("open");
}

function closeDriveFolderQR() {
  const modal = document.getElementById("drive-qr-modal");
  if (!modal) {
    return;
  }

  modal.classList.remove("open");
  const image = document.getElementById("drive-qr-img");
  if (image) {
    image.src = "";
  }
}

function renderDriveDeliveryPanel() {
  window.sharedDriveDelivery?.appendDriveDeliveryPanels({
    targets: GUIDE6_DRIVE_ACTIVITY_TARGETS,
    helperSuffix: "La carpeta se define automaticamente segun la ficha activa.",
    onDriveClick: openDriveFolder,
    onQrClick: showDriveFolderQR,
  });
}

function renderMaterialGroup(containerId, items) {
  const container = document.getElementById(containerId);
  if (!container) {
    return;
  }

  container.innerHTML = items.map(renderMaterialCard).join("");
}

function renderMaterialCard(item) {
  const href = buildMaterialHref(item);
  const cta = item.cta || "Abrir archivo";

  return `
    <article class="resource-card">
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.description)}</p>
      <p class="resource-meta">${escapeHtml(item.type)}</p>
      <a href="${href}" target="_blank" rel="noopener noreferrer">${escapeHtml(cta)}</a>
    </article>
  `;
}

function buildMaterialHref(item) {
  if (item.href) {
    return item.href;
  }

  return encodeURI(`${SUPPORT_BASE_PATH}${item.file}`);
}

function hydrateFields() {
  document.querySelectorAll("[data-store]").forEach((field) => {
    const key = field.dataset.store;
    if (!(key in state)) {
      return;
    }

    if (field.type === "checkbox") {
      field.checked = Boolean(state[key]);
      return;
    }

    field.value = state[key];
  });
}

function bindEvents() {
  document.addEventListener("input", (event) => {
    const field = event.target.closest("[data-store]");
    if (!field) {
      return;
    }

    state[field.dataset.store] = field.type === "checkbox" ? field.checked : field.value;
    saveState();
  });

  document.addEventListener("change", (event) => {
    const field = event.target.closest("[data-store]");
    if (!field) {
      return;
    }

    state[field.dataset.store] = field.type === "checkbox" ? field.checked : field.value;
    saveState();
  });

  const glossarySearch = document.getElementById("glossarySearch");
  if (glossarySearch) {
    glossarySearch.addEventListener("input", (event) => {
      const query = event.target.value.trim().toLowerCase();
      document.querySelectorAll(".glossary-card").forEach((card) => {
        card.classList.toggle("is-hidden", !card.dataset.search.includes(query));
      });
    });
  }

  document.getElementById("resetProgress")?.addEventListener("click", async () => {
    const confirmed = window.confirm(
      "Se borraran las respuestas guardadas localmente. Deseas continuar?"
    );
    if (!confirmed) {
      return;
    }

    window.clearGuideActivityChecks?.();
    window.clearGuideLayoutState?.();
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_META_KEY);
    state = {};
    pendingCloudStateSnapshot = buildCloudStateSnapshot();
    await window.syncGuideUiStateImmediately?.();
    await syncCloudState(true);
    window.location.reload();
  });
}

function getGuideSelection() {
  const body = document.body;
  const defaults = {
    ficha: body.dataset.defaultFicha || "",
    inst: body.dataset.defaultInst || "",
    grupo: body.dataset.defaultGrupo || "",
  };

  return portalAuth ? portalAuth.getCurrentSelection(defaults) : defaults;
}

function sanitizeFileName(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9\u00C0-\u024F\s_-]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

function escapeWordText(value) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function buildBitacoraFileName(nombre, ficha) {
  const safeName = sanitizeFileName(nombre) || "Nombre";
  const safeFicha = sanitizeFileName(ficha) || "SinFicha";
  return `Bitacora_Analisis_${safeName}_${safeFicha}.doc`;
}

function setBitacoraModalState() {
  const selection = getGuideSelection();
  const hasFicha = Boolean(selection.ficha);
  const warn = document.getElementById("bitacora-modal-warn");
  const ok = document.getElementById("bitacora-modal-ok");
  const button = document.getElementById("bitacora-modal-btn");

  if (warn) {
    warn.style.display = hasFicha ? "none" : "";
  }
  if (ok) {
    ok.style.display = hasFicha ? "" : "none";
  }
  if (button) {
    button.disabled = !hasFicha;
  }
}

function updateBitacoraFilenamePreview() {
  const input = document.getElementById("bitacora-nombre");
  const preview = document.getElementById("bitacora-filename-preview");
  if (!input || !preview) {
    return;
  }

  const selection = getGuideSelection();
  preview.textContent = buildBitacoraFileName(input.value, selection.ficha);
}

function openBitacoraExportModal() {
  const modal = document.getElementById("bitacora-export-modal");
  const input = document.getElementById("bitacora-nombre");
  const error = document.getElementById("bitacora-modal-error");

  if (!modal || !input || !error) {
    return;
  }

  modal.classList.add("open");
  input.value = "";
  input.classList.remove("error");
  error.classList.remove("visible");
  setBitacoraModalState();
  updateBitacoraFilenamePreview();

  if (!document.getElementById("bitacora-modal-btn")?.disabled) {
    window.setTimeout(() => input.focus(), 80);
  }
}

function closeBitacoraExportModal() {
  document.getElementById("bitacora-export-modal")?.classList.remove("open");
}

function doExportBitacoraWord() {
  const input = document.getElementById("bitacora-nombre");
  const error = document.getElementById("bitacora-modal-error");
  if (!input || !error) {
    return;
  }

  const nombre = input.value.trim();
  if (!nombre) {
    input.classList.add("error");
    error.classList.add("visible");
    input.focus();
    return;
  }

  input.classList.remove("error");
  error.classList.remove("visible");

  const selection = getGuideSelection();
  if (!selection.ficha) {
    setBitacoraModalState();
    return;
  }

  const fecha = new Date().toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const answers = [
    {
      title: "1. Que herramientas informaticas deberia instalar el tecnico y por que",
      value: fieldValue("reflexion_herramientas", "(Sin respuesta)"),
    },
    {
      title: "2. Que informacion deberia registrar en una ficha tecnica o inventario",
      value: fieldValue("reflexion_registro", "(Sin respuesta)"),
    },
    {
      title: "3. Consecuencias de no documentar procesos tecnologicos",
      value: fieldValue("reflexion_consecuencias", "(Sin respuesta)"),
    },
    {
      title: "4. Situacion parecida vivida en casa, colegio o empresa",
      value: fieldValue("reflexion_experiencia", "(Sin respuesta)"),
    },
  ];

  const sections = answers
    .map(
      (item) => `
        <div class="sec-title">${escapeWordText(item.title)}</div>
        <div class="sec-body">${escapeWordText(item.value || "(Sin respuesta)")}</div>
      `
    )
    .join("");

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>Bitacora de analisis - ${escapeWordText(nombre)}</title>
<!--[if gte mso 9]><xml>
<w:WordDocument>
  <w:View>Print</w:View>
  <w:Zoom>90</w:Zoom>
  <w:DoNotOptimizeForBrowser/>
</w:WordDocument>
</xml><![endif]-->
<style>
  @page { margin: 2.5cm; }
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #1a1a1a; }
  .header { text-align: center; border-bottom: 2px solid #007934; padding-bottom: 8pt; margin-bottom: 14pt; }
  .header p { margin: 2pt 0; }
  .meta { width: 100%; border-collapse: collapse; margin: 12pt 0 16pt; }
  .meta td { border: 1pt solid #cfd8dc; padding: 6pt 10pt; }
  .meta .label { width: 120pt; font-weight: bold; background: #f0faf4; color: #007934; }
  h1 { text-align: center; color: #007934; font-size: 18pt; margin: 12pt 0 6pt; }
  .lead { font-size: 10pt; color: #4b5563; line-height: 1.6; margin-bottom: 10pt; }
  .case-box { background: #f9fef9; border-left: 4pt solid #39b54a; padding: 10pt 12pt; margin-bottom: 14pt; }
  .sec-title { font-size: 12pt; font-weight: bold; color: #007934; margin: 16pt 0 6pt; }
  .sec-body { border: 1pt solid #dfe7df; background: #ffffff; padding: 10pt 12pt; line-height: 1.7; min-height: 24pt; }
  .footer { margin-top: 28pt; text-align: center; font-size: 9pt; color: #6b7280; border-top: 1pt solid #e5e7eb; padding-top: 8pt; }
</style>
</head>
<body>
  <div class="header">
    <p><strong>SERVICIO NACIONAL DE APRENDIZAJE - SENA</strong></p>
    <p>Tecnico en Sistemas Teleinformaticos - Codigo 233108 V1</p>
    <p>Guia 6 - Planificar la informacion</p>
  </div>

  <h1>Bitacora individual de analisis</h1>
  <p class="lead">
    Actividad 3.1.1 de reflexion inicial. Documento exportado desde la guia interactiva para registrar
    el analisis del caso empresarial y las respuestas del aprendiz.
  </p>

  <table class="meta">
    <tr><td class="label">Aprendiz</td><td>${escapeWordText(nombre)}</td></tr>
    <tr><td class="label">Institucion</td><td>${escapeWordText(selection.inst || "Sin institucion")}</td></tr>
    <tr><td class="label">Grupo</td><td>${escapeWordText(selection.grupo || "Sin grupo")}</td></tr>
    <tr><td class="label">Ficha</td><td>${escapeWordText(selection.ficha)}</td></tr>
    <tr><td class="label">Fecha</td><td>${escapeWordText(fecha)}</td></tr>
    <tr><td class="label">Instructor</td><td>Dubier Orlando Millan Barbosa</td></tr>
  </table>

  <div class="case-box">
    <strong>Escenario de trabajo:</strong><br>
    La empresa TechBoyCa S.A.S. adquiere 20 equipos de computo nuevos para el area administrativa.
    El tecnico debe dejarlos listos en dos dias habiles, pero encuentra ausencia de suite ofimatica,
    antivirus desactualizado y falta de herramientas configuradas para la operacion diaria.
  </div>

  ${sections}

  <div class="footer">Documento generado el ${escapeWordText(fecha)} - SENA CIAS Puerto Boyaca</div>
</body>
</html>`;

  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = buildBitacoraFileName(nombre, selection.ficha);
  a.click();
  URL.revokeObjectURL(url);
  closeBitacoraExportModal();
}

window.openBitacoraExportModal = openBitacoraExportModal;
window.closeBitacoraExportModal = closeBitacoraExportModal;
window.updateBitacoraFilenamePreview = updateBitacoraFilenamePreview;
window.doExportBitacoraWord = doExportBitacoraWord;

function updateBudgetSummary() {
  let grandTotal = 0;

  budgetItems.forEach((item) => {
    const price = parseFloat(fieldValue(`budget_price_${item.id}`, "0")) || 0;
    const qty = parseFloat(fieldValue(`budget_qty_${item.id}`, "0")) || 0;
    const total = price * qty;
    grandTotal += total;

    const cell = document.getElementById(`budget_total_${item.id}`);
    if (cell) {
      cell.textContent = formatCurrency(total);
    }
  });

  const overall = document.getElementById("budgetGrandTotal");
  if (overall) {
    overall.textContent = formatCurrency(grandTotal);
  }
}

function updateProgress() {
  const trackedFields = Array.from(document.querySelectorAll("[data-track]"));
  const activityChecks = Array.from(document.querySelectorAll(".activity-check"));
  const completedFields = trackedFields.filter((field) => {
    if (field.type === "checkbox") {
      return field.checked;
    }
    if (field.tagName === "SELECT") {
      return field.value.trim().length > 0;
    }
    return field.value.trim().length > 0;
  }).length;
  const completedChecks = activityChecks.filter((button) =>
    button.classList.contains("checked")
  ).length;

  const total = trackedFields.length + activityChecks.length;
  const completed = completedFields + completedChecks;
  const rawPercent = total ? Math.round((completed / total) * 100) : 0;
  const percent = completed > 0 && rawPercent === 0 ? 1 : rawPercent;
  const label = `${percent}%`;

  const value = document.getElementById("progressValue");
  const bar = document.getElementById("progressBar");
  if (value) {
    value.textContent = label;
  }
  if (bar) {
    bar.style.width = label;
  }
  portalAuth?.writeGuideProgress?.(PAGE_FILE, { completed, total, percent });
}

window.updateGuideProgress = updateProgress;
window.addEventListener("pageshow", () => updateProgress());
window.addEventListener("pagehide", flushCloudStateSync);
window.addEventListener("beforeunload", flushCloudStateSync);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    flushCloudStateSync();
    return;
  }

  updateProgress();
});

function setupScrollSpy() {
  const links = Array.from(document.querySelectorAll(".sidebar a[href^='#']"));
  const sectionMap = new Map(
    links.map((link) => [link.getAttribute("href"), document.querySelector(link.getAttribute("href"))])
  );

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        const id = `#${entry.target.id}`;
        links.forEach((link) =>
          link.classList.toggle("is-current", link.getAttribute("href") === id)
        );
      });
    },
    {
      threshold: 0.15,
      rootMargin: "-20% 0px -55% 0px",
    }
  );

  sectionMap.forEach((section) => {
    if (section) {
      observer.observe(section);
    }
  });
}

function formatCurrency(value) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const BITACORA_311_STORES = ["reflexion_herramientas", "reflexion_registro", "reflexion_consecuencias", "reflexion_experiencia"];
const SOCIALIZACION_312_STORES = ["socializacion_conclusion", "socializacion_pregunta_central"];

function applyBitacoraLock() {
  const locked = Boolean(state["bitacora311-locked"]);
  BITACORA_311_STORES.forEach((key) => {
    const el = document.querySelector(`[data-store="${key}"]`);
    if (!el) return;
    el.disabled = locked;
    el.style.opacity = locked ? "0.75" : "";
  });
  const btn = document.getElementById("btnGuardarBitacora");
  if (btn) {
    btn.disabled = locked;
    btn.textContent = locked ? "✅ Respuestas enviadas" : "💾 Guardar respuestas";
  }
  const status = document.getElementById("bitacoraStatus311");
  if (status) status.style.display = locked ? "block" : "none";
}

function applyBitacoraSocializacionLock() {
  const locked = Boolean(state["socializacion312-locked"]);
  SOCIALIZACION_312_STORES.forEach((key) => {
    const el = document.querySelector(`[data-store="${key}"]`);
    if (!el) return;
    el.disabled = locked;
    el.style.opacity = locked ? "0.75" : "";
  });
  const btn = document.getElementById("btnGuardarSocializacion");
  if (btn) {
    btn.disabled = locked;
    btn.textContent = locked ? "✅ Respuestas enviadas" : "💾 Guardar respuestas";
  }
  const status = document.getElementById("socializacionStatus312");
  if (status) status.style.display = locked ? "block" : "none";
}

function guardarBitacora311() {
  const empty = BITACORA_311_STORES.filter((k) => !String(state[k] || "").trim());
  if (empty.length > 0) {
    alert("Por favor responde todas las preguntas antes de guardar.");
    return;
  }
  state["bitacora311-locked"] = true;
  saveState();
  applyBitacoraLock();
}

function guardarSocializacion312() {
  const empty = SOCIALIZACION_312_STORES.filter((k) => !String(state[k] || "").trim());
  if (empty.length > 0) {
    alert("Por favor completa los campos antes de guardar.");
    return;
  }
  state["socializacion312-locked"] = true;
  saveState();
  applyBitacoraSocializacionLock();
}

window.guardarBitacora311 = guardarBitacora311;
window.guardarSocializacion312 = guardarSocializacion312;


