const PAGE_FILE = window.location.pathname.split("/").pop().toLowerCase() || "guia.html";
const STORAGE_FILE_ALIASES = {
  "grupo-10a-guia-02-herramientas-informaticas-digitales.html": "10a_guia2.html",
  "grupo-10b-guia-02-herramientas-informaticas-digitales.html": "10b_guia2.html",
  "grupo-11a-guia-05-herramientas-informaticas-digitales.html": "11a_guia.html",
  "grupo-11b-guia-05-herramientas-informaticas-digitales.html": "11b_guia.html",
  "plantilla-grado-11-guia-05-herramientas-informaticas-digitales.html": "grado_guia.html",
};
const GUIDE_DATA_FILE = STORAGE_FILE_ALIASES[PAGE_FILE] || PAGE_FILE;
const PAGE_KEY = GUIDE_DATA_FILE.replace(/[^a-z0-9]+/g, "_") || "guia";
const portalAuth = window.portalAuth || null;
const LEGACY_STORAGE_KEY = `guia_interactiva_${PAGE_KEY}`;
const STORAGE_KEY = portalAuth
  ? portalAuth.getScopedStorageKey(LEGACY_STORAGE_KEY, { area: "guide-data" })
  : LEGACY_STORAGE_KEY;
const STORAGE_META_KEY = `${STORAGE_KEY}__meta`;
const SCOPED_STORAGE_ENABLED = STORAGE_KEY !== LEGACY_STORAGE_KEY;
const CLOUD_SYNC_DELAY_MS = 1200;
const CLOUD_REFRESH_MS = 60000;
const SUPPORT_BASE_PATH = "assets/materiales/guia5/";
const DRIVE_FOLDERS = {
  "3168850": "https://drive.google.com/drive/folders/1fBPzXHU0OHDmKa18Y6V2tnomLyYWgiLp?usp=drive_link",
  "3168852": "https://drive.google.com/drive/folders/1p9HdGinK1me8PsbaLHYio_OC-idAmorR?usp=drive_link",
};

const wordList = [
  "RESTAURACION",
  "VIRUS",
  "ROOT",
  "MEDIO",
  "PORTABLE",
  "PANTALLA AZUL",
  "BACKUP",
  "BIOS",
  "CONSOLA",
  "TERMINAL",
  "COMANDOS",
  "SETUP",
  "ISO",
  "WINDOWS",
  "LINUX",
  "ANDROID",
  "PROGRAMAS",
  "MAC OS",
  "HYPERVISOR",
  "CAPACIDAD",
  "SISTEMA",
  "MS DOS",
  "USUARIO",
  "SUPERUSUARIO",
  "FORMATEO",
];

const conceptOptions = [
  {
    id: "diseno",
    label: "Diseno grafico",
    text: "Plataforma para crear afiches, infografias, presentaciones y piezas visuales con plantillas.",
  },
  {
    id: "analytics",
    label: "Analitica web",
    text: "Herramienta para medir trafico, comportamiento de usuarios y rendimiento de sitios web.",
  },
  {
    id: "cms",
    label: "Gestion de sitios",
    text: "Sistema para crear y administrar sitios web o blogs sin partir de cero.",
  },
  {
    id: "documental",
    label: "Gestion documental",
    text: "Plataforma de Microsoft para organizar archivos, procesos y colaboracion institucional.",
  },
  {
    id: "colaboracion",
    label: "Reuniones y colaboracion",
    text: "Servicios para clases, reuniones virtuales, chat, videollamadas y trabajo en equipo.",
  },
  {
    id: "videoconferencia",
    label: "Videoconferencias avanzadas",
    text: "Plataforma con salas, grabacion y comparticion de pantalla para reuniones remotas.",
  },
  {
    id: "transferencia",
    label: "Envio de archivos",
    text: "Servicio para compartir archivos pesados mediante enlaces temporales.",
  },
  {
    id: "nube",
    label: "Nube colaborativa",
    text: "Almacenamiento en linea para guardar, sincronizar y compartir documentos.",
  },
  {
    id: "email",
    label: "Email marketing",
    text: "Herramienta para crear campanas de correo, listas de contactos y reportes.",
  },
  {
    id: "agenda",
    label: "Agenda digital",
    text: "Calendario para programar eventos, reuniones, recordatorios y tareas.",
  },
];

const matchingTools = [
  { id: "canva", name: "Canva", answer: "diseno" },
  { id: "analytics", name: "Google Analytics", answer: "analytics" },
  { id: "wordpress", name: "WordPress", answer: "cms" },
  { id: "sharepoint", name: "SharePoint", answer: "documental" },
  { id: "meet-teams", name: "Google Meet y Teams", answer: "colaboracion" },
  { id: "zoom", name: "Zoom", answer: "videoconferencia" },
  { id: "wetransfer", name: "WeTransfer", answer: "transferencia" },
  { id: "drive", name: "Google Drive", answer: "nube" },
  { id: "mailchimp", name: "MailChimp", answer: "email" },
  { id: "calendar", name: "Calendar", answer: "agenda" },
];

const extensions = [
  {
    id: "doc",
    ext: ".doc",
    program: "Microsoft Word",
    description:
      "Hace referencia a documentos con contenido tipo texto, puede contener imagenes e hipervinculos.",
  },
  { id: "xlsx", ext: ".xlsx", program: "", description: "" },
  { id: "accdb", ext: ".accdb", program: "", description: "" },
  { id: "mpp", ext: ".mpp", program: "", description: "" },
  { id: "ppt", ext: ".ppt", program: "", description: "" },
  { id: "pub", ext: ".pub", program: "", description: "" },
  { id: "cda", ext: ".cda", program: "", description: "" },
  { id: "ogv", ext: ".ogv", program: "", description: "" },
  { id: "tar", ext: ".tar", program: "", description: "" },
  { id: "exe", ext: ".exe", program: "", description: "", risk: "Revisar seguridad" },
  { id: "pdf", ext: ".pdf", program: "", description: "" },
  { id: "rar", ext: ".rar", program: "", description: "" },
  { id: "wma", ext: ".wma", program: "", description: "" },
  { id: "vssm", ext: ".vssm", program: "", description: "" },
  { id: "txt", ext: ".txt", program: "", description: "" },
  { id: "sys", ext: ".sys", program: "", description: "", risk: "Archivo sensible del sistema" },
  { id: "png", ext: ".png", program: "", description: "" },
  { id: "html", ext: ".html", program: "", description: "" },
];

const systems = [
  {
    id: "linux-lite",
    name: "Linux Lite",
    processor: "Intel Centrino o superior",
    ram: "1 GB",
    disk: "100 GB",
    source: "",
  },
  { id: "arcaos", name: "ArcaOS", processor: "", ram: "", disk: "", source: "" },
  { id: "windows-10", name: "Windows 10", processor: "", ram: "", disk: "", source: "" },
  { id: "ubuntu", name: "Ubuntu", processor: "", ram: "", disk: "", source: "" },
  { id: "macos-mojave", name: "macOS Mojave", processor: "", ram: "", disk: "", source: "" },
  { id: "windows-11", name: "Windows 11", processor: "", ram: "", disk: "", source: "" },
  { id: "chromium-os", name: "Chromium OS", processor: "", ram: "", disk: "", source: "" },
  { id: "mac-os-x-leopard", name: "Mac OS X Leopard", processor: "", ram: "", disk: "", source: "" },
];

const evidenceRows = [
  {
    phase: "Evaluacion",
    project:
      "Diagnostico inicial de necesidades y uso de herramientas digitales en el contexto educativo.",
    learning: "3.1 Actividades de reflexion inicial",
    evidence: "Bitacora de diagnostico inicial diligenciada.",
    criteria:
      "Identifica causas probables y propone un plan de revision ordenado. Relaciona herramientas digitales con su funcion.",
    methods: "Tecnicas: revision de producto. Instrumentos: lista de chequeo y lista de cotejo.",
  },
  {
    phase: "Evaluacion",
    project:
      "Reconocimiento de conceptos clave sobre sistemas operativos y herramientas digitales.",
    learning:
      "3.2 Actividades de contextualizacion e identificacion de conocimientos necesarios para el aprendizaje",
    evidence: "Sopa de letras resuelta y tabla de coincidencias completada.",
    criteria:
      "Reconoce terminologia basica de restauracion y formateo. Relaciona herramientas digitales con su proposito y uso.",
    methods: "Tecnicas: taller practico. Instrumentos: lista de cotejo y revision de producto.",
  },
  {
    phase: "Evaluacion",
    project:
      "Caracterizacion tecnica de herramientas informaticas, archivos, software y requerimientos minimos.",
    learning: "3.3 Actividades de apropiacion",
    evidence:
      "Tabla de extensiones diligenciada y matriz de requerimientos minimos con fuentes consultadas.",
    criteria:
      "Clasifica extensiones segun tipo y programa asociado. Reconoce riesgos de archivos como .exe y .sys. Sustenta requisitos minimos con fuente.",
    methods:
      "Tecnicas: taller practico y revision documental. Instrumentos: lista de chequeo y rubrica corta.",
  },
  {
    phase: "Evaluacion",
    project:
      "Implementacion y verificacion en ambiente controlado siguiendo procedimientos.",
    learning: "3.4 Actividades de transferencia del conocimiento",
    evidence:
      "Guia de instalacion con capturas, Taller 1_guia5 resuelto e informe tecnico IEEE con evidencias.",
    criteria:
      "Sigue procedimientos, configura particiones, verifica el sistema instalado y presenta un informe con estructura IEEE.",
    methods:
      "Tecnicas: observacion y revision de producto final. Instrumentos: lista de chequeo de instalacion, rubrica IEEE y verificacion de evidencias.",
  },
];

const glossaryTerms = [
  ["Arranque (Boot)", "Proceso que realiza el computador al encender para cargar el sistema operativo."],
  ["BIOS", "Programa basico de la placa base que inicia el hardware y permite configurar el arranque del equipo."],
  ["UEFI", "Version moderna del BIOS que permite un arranque mas seguro y rapido."],
  ["Orden de arranque (Boot Order)", "Prioridad de dispositivos desde donde el equipo intenta iniciar."],
  ["Sistema operativo (SO)", "Software principal que administra el computador y permite usar programas."],
  ["Distribucion Linux", "Version de Linux con programas y configuraciones propias, como Ubuntu o Linux Lite."],
  ["Imagen ISO", "Archivo que contiene una copia completa de instalacion de un sistema operativo o software."],
  ["Particion", "Division logica del disco duro o SSD para organizar el almacenamiento."],
  ["/ (raiz)", "Particion principal en Linux donde se instalan los archivos esenciales del sistema."],
  ["/home", "Particion o carpeta donde se guardan los archivos de los usuarios en Linux."],
  ["/boot", "Particion o carpeta de Linux con los archivos necesarios para iniciar el sistema."],
  ["swap", "Espacio en disco que Linux usa como memoria adicional cuando la RAM no alcanza."],
  ["Particion primaria", "Particion principal desde la cual puede arrancar un sistema operativo."],
  ["Particion extendida", "Particion especial que permite crear varias particiones dentro de ella."],
  ["Particion logica", "Particion creada dentro de una extendida para datos o instalaciones."],
  ["Maquina virtual (VM)", "Computador virtual que corre un sistema operativo sin afectar el sistema real."],
  ["VirtualBox", "Programa que permite crear y administrar maquinas virtuales."],
  ["Hipervisor", "Software que administra las maquinas virtuales y el uso de recursos."],
  ["Requisitos minimos", "Caracteristicas basicas de hardware necesarias para que un sistema operativo funcione."],
  ["CPU (Procesador)", "Componente que ejecuta instrucciones y actua como cerebro del computador."],
  ["RAM", "Memoria temporal usada por el equipo para trabajar; mas RAM permite mas tareas simultaneas."],
  ["Almacenamiento (Disco/SSD)", "Espacio donde se guardan archivos, sistemas operativos y programas."],
  ["Extension de archivo", "Parte final del nombre de un archivo que indica su tipo, por ejemplo .pdf o .jpg."],
  ["Controlador (Driver)", "Software que permite que un dispositivo funcione correctamente."],
  ["Copia de seguridad (Backup)", "Copia de archivos importantes para evitar perdida de informacion."],
  ["Formateo", "Proceso de preparar un disco o particion; puede borrar informacion si no hay respaldo."],
  ["Restauracion", "Accion de recuperar el sistema o archivos a un estado anterior."],
  ["Nube (Cloud)", "Servicio en internet para guardar, compartir y acceder a archivos desde cualquier dispositivo."],
  ["Antivirus", "Programa que ayuda a detectar y eliminar software malicioso."],
  ["Firewall (Cortafuegos)", "Sistema que controla conexiones de red para bloquear accesos no autorizados."],
  ["Malware", "Software malicioso que puede danar el equipo o robar informacion."],
  ["Phishing", "Engano para obtener datos mediante correos o enlaces falsos."],
  ["Herramienta digital", "Aplicacion o servicio que facilita comunicacion, colaboracion y gestion de informacion."],
];

const supportTemplates = [
  {
    title: "Taller 1 de la guia 5",
    file: "taller 1_guia5.docx",
    type: "DOCX local",
    description:
      "Documento base para desarrollar la actividad practica principal y organizar la entrega.",
    cta: "Abrir taller",
  },
  {
    title: "Bitacora para el caso",
    file: "Bitacora_Para_Caso.docx",
    type: "DOCX local",
    description:
      "Plantilla de apoyo para registrar sintomas, causas probables y pasos de revision del caso.",
    cta: "Abrir bitacora",
  },
  {
    title: "Formato de inscripcion de proyecto",
    file: "GFPI-F-165FormatoSeleccionModificacionAlternativaEtapaProductiva.xlsx",
    type: "XLSX local",
    description:
      "Formato complementario para diligenciar la inscripcion o seleccion solicitada por el instructor.",
    cta: "Abrir formato",
  },
];

const supportDocuments = [
  {
    title: "Manual de usuario de VirtualBox 7.2.6",
    file: "VirtualBox_UserManual_7.2.6.pdf",
    type: "PDF local",
    description:
      "Guia oficial para crear maquinas virtuales, configurar hardware y gestionar discos e imagenes ISO.",
  },
  {
    title: "Diapositivas sobre virtualizacion",
    file: "Virtualization_Lecture_Slides.ppt",
    type: "PPT local",
    description:
      "Presentacion de apoyo para comprender conceptos de hipervisor, maquinas virtuales y escenarios de uso.",
  },
  {
    title: "Notas del proceso de arranque en Linux",
    file: "Linux_Boot_Process_Presentation_Notes.pdf",
    type: "PDF local",
    description:
      "Material para reforzar la secuencia de arranque, particiones y componentes del sistema.",
  },
  {
    title: "Filesystem Hierarchy Standard 3.0",
    file: "FHS_3.0_Filesystem_Hierarchy_Standard.pdf",
    type: "PDF local",
    description:
      "Referencia tecnica sobre la organizacion de directorios y rutas del sistema de archivos en Linux.",
  },
  {
    title: "IEEE Editorial Style Manual",
    file: "IEEE_Editorial_Style_Manual.pdf",
    type: "PDF local",
    description:
      "Guia oficial para estructurar documentos tecnicos y presentar referencias en formato IEEE.",
  },
  {
    title: "Guia rapida para normas IEEE",
    file: "Guía+rápida+para+el+uso+de+las+normas+IEEE.pdf",
    type: "PDF local",
    description:
      "Resumen practico para citar, ordenar bibliografia y presentar el informe tecnico final.",
  },
  {
    title: "CISA - Guia de phishing",
    file: "CISA_Phishing_Guidance.pdf",
    type: "PDF local",
    description:
      "Lectura complementaria para reconocer riesgos de seguridad y fortalecer criterios de prevencion.",
  },
  {
    title: "NIST SP 800-83r1 Malware Incident",
    file: "NIST_SP800-83r1_Malware_Incident.pdf",
    type: "PDF local",
    description:
      "Documento de consulta para respuesta basica ante incidentes relacionados con malware.",
  },
  {
    title: "Cybersecurity Awareness Slides",
    file: "Cybersecurity_Awareness_Slides.pdf",
    type: "PDF local",
    description:
      "Presentacion de sensibilizacion sobre buenas practicas de seguridad digital en el trabajo tecnico.",
  },
  {
    title: "Guia rapida de Microsoft Teams",
    file: "Teams_Quick_Start_Guide.pdf",
    type: "PDF local",
    description:
      "Apoyo para colaboracion, reuniones y comunicacion del equipo durante el desarrollo de evidencias.",
  },
  {
    title: "Guia rapida de SharePoint",
    file: "SharePoint_Quick_Start_Guide.pdf",
    type: "PDF local",
    description:
      "Referencia para gestion documental, organizacion de archivos y trabajo compartido.",
  },
];

const supportTools = [
  {
    title: "VirtualBox 7.2.6a para Windows",
    href: "https://drive.google.com/drive/folders/19AY6LsSHM--2VVXp4_Bzzjz2SVyAiSMc?usp=sharing",
    type: "Drive",
    description:
      "Instalador del hipervisor usado para practicar virtualizacion e instalaciones controladas.",
    cta: "Abrir en Drive ↗",
  },
];

const GUIDE5_DRIVE_ACTIVITY_TARGETS = [
  {
    activityNumber: "3.1.1",
    panelKey: "guide5-3-1-1",
    description:
      "Cuando termines la bitacora o el documento final de analisis, subelo a la carpeta de Drive correspondiente a tu ficha.",
    note: "Entrega sugerida: bitacora individual o informe final de analisis del caso.",
  },
  {
    activityNumber: "3.3.1",
    panelKey: "guide5-3-3-1",
    description:
      "Sube a Drive los archivos exportados a Word o la version final consolidada de las actividades de extensiones y requerimientos minimos.",
    note: "Entrega sugerida: Actividad 1, Actividad 2 o un archivo consolidado de ambas evidencias.",
  },
  {
    activityNumber: "3.4.1",
    panelKey: "guide5-3-4-1",
    description:
      "Sube a Drive la guia de instalacion, las capturas y el informe tecnico final de esta actividad integradora.",
    note: "Entrega sugerida: guia de instalacion, evidencias tecnicas e informe en formato IEEE.",
  },
];

let state = loadState();
let cloudStateSyncTimer = null;
let cloudStateRetryTimer = null;
let pendingCloudStateSnapshot = null;
let guia5Booted = false;

function initGuia5() {
  if (guia5Booted) {
    return;
  }

  guia5Booted = true;
  renderStatefulSections();
  renderConceptLegend();
  renderEvidenceTable();
  renderGlossary();
  renderSupportMaterials();
  renderDriveDeliveryPanel();
  hydrateFields();
  bindEvents();
  updateProgress();
  setupScrollSpy();
  initializeCloudStateSync();
}

window.initGuia5 = initGuia5;

if (!window.__PAGE_CONTEXT__) {
  document.addEventListener("DOMContentLoaded", initGuia5);
}

document.addEventListener("guide-activity-check-change", () => {
  window.requestAnimationFrame(() => updateProgress());
});

window.switchTab = function (button, panelId) {
  const tabs = button.closest(".game-tabs");
  const activity = button.closest(".activity-body");
  if (!tabs || !activity) {
    return;
  }

  tabs.querySelectorAll(".game-tab").forEach((tab) => tab.classList.remove("active"));
  button.classList.add("active");
  activity.querySelectorAll(".game-panel").forEach((panel) => {
    panel.style.display = panel.id === panelId ? "block" : "none";
  });
};

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
  updateProgress();
  pendingCloudStateSnapshot = buildCloudStateSnapshot();
  scheduleCloudStateSync();
}

function renderStatefulSections() {
  renderWordBank();
  renderMatchingTable();
  renderExtensionTable();
  renderSystemTable();
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

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[char];
  });
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function renderWordBank() {
  const bank = document.getElementById("wordBank");
  if (!bank) {
    return;
  }
  bank.innerHTML = wordList
    .map((word) => {
      const key = `word:${slugify(word)}`;
      const active = Boolean(state[key]);
      return `
        <button
          type="button"
          class="chip ${active ? "is-active" : ""}"
          data-word-key="${key}"
          data-track-button="${active}"
        >
          ${escapeHtml(word)}
        </button>
      `;
    })
    .join("");
}

function renderConceptLegend() {
  const legend = document.getElementById("conceptLegend");
  if (!legend) {
    return;
  }
  legend.innerHTML = conceptOptions
    .map(
      (option) => `
        <article class="concept-card">
          <strong>${escapeHtml(option.label)}</strong>
          <p>${escapeHtml(option.text)}</p>
        </article>
      `
    )
    .join("");
}

function renderMatchingTable() {
  const tbody = document.getElementById("matchingTable");
  if (!tbody) {
    return;
  }
  tbody.innerHTML = matchingTools
    .map((tool) => {
      const storeKey = `matching:${tool.id}`;
      const value = state[storeKey] || "";
      return `
        <tr class="match-row">
          <th scope="row">${escapeHtml(tool.name)}</th>
          <td>
            <select data-store="${storeKey}" data-track data-match="${tool.id}">
              <option value="">Selecciona un concepto</option>
              ${conceptOptions
                .map(
                  (option) => `
                    <option value="${option.id}" ${value === option.id ? "selected" : ""}>
                      ${escapeHtml(option.label)}
                    </option>
                  `
                )
                .join("")}
            </select>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderExtensionTable() {
  const tbody = document.getElementById("extensionTable");
  tbody.innerHTML = extensions
    .map((row) => {
      const programKey = `extension:${row.id}:program`;
      const descriptionKey = `extension:${row.id}:description`;
      const program = state[programKey] ?? row.program;
      const description = state[descriptionKey] ?? row.description;

      return `
        <tr>
          <th scope="row">
            <span class="extension-tag">${escapeHtml(row.ext)}</span>
            ${row.risk ? `<span class="risk-tag">${escapeHtml(row.risk)}</span>` : ""}
          </th>
          <td>
            <input
              type="text"
              list="programSuggestions"
              data-store="${programKey}"
              data-track
              placeholder="Programa asociado"
              value="${escapeHtml(program)}"
            >
          </td>
          <td>
            <textarea
              rows="3"
              data-store="${descriptionKey}"
              data-track
              placeholder="Describe el tipo de archivo o su uso principal."
            >${escapeHtml(description)}</textarea>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderSystemTable() {
  const tbody = document.getElementById("systemTable");
  tbody.innerHTML = systems
    .map((row) => {
      const processorKey = `system:${row.id}:processor`;
      const ramKey = `system:${row.id}:ram`;
      const diskKey = `system:${row.id}:disk`;
      const sourceKey = `system:${row.id}:source`;

      return `
        <tr>
          <th scope="row">${escapeHtml(row.name)}</th>
          <td>
            <input
              type="text"
              data-store="${processorKey}"
              data-track
              placeholder="Procesador minimo"
              value="${escapeHtml(state[processorKey] ?? row.processor)}"
            >
          </td>
          <td>
            <input
              type="text"
              data-store="${ramKey}"
              data-track
              placeholder="Memoria RAM"
              value="${escapeHtml(state[ramKey] ?? row.ram)}"
            >
          </td>
          <td>
            <input
              type="text"
              data-store="${diskKey}"
              data-track
              placeholder="Espacio en disco"
              value="${escapeHtml(state[diskKey] ?? row.disk)}"
            >
          </td>
          <td class="source-cell">
            <input
              type="text"
              data-store="${sourceKey}"
              data-track
              placeholder="Fuente consultada"
              value="${escapeHtml(state[sourceKey] ?? row.source)}"
            >
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderEvidenceTable() {
  const tbody = document.getElementById("evidenceTable");
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

function renderSupportMaterials() {
  renderMaterialGroup("supportTemplatesGrid", supportTemplates);
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
    targets: GUIDE5_DRIVE_ACTIVITY_TARGETS,
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

const guide5ExportConfig = {
  extensions: {
    title: "Actividad 1: Extensiones de archivo",
    filePrefix: "Actividad1_Extensiones_Archivo",
    description: "Exporta la tabla diligenciada de extensiones de archivo a un documento Word.",
  },
  systems: {
    title: "Actividad 2: Requerimientos minimos de sistemas operativos",
    filePrefix: "Actividad2_Requerimientos_Minimos",
    description:
      "Exporta la matriz diligenciada de requerimientos minimos de sistemas operativos a un documento Word.",
  },
};

let guide5ExportMode = "extensions";

function getGuideSelection() {
  const body = document.body;
  const defaults = {
    ficha: body.dataset.defaultFicha || "",
    inst: body.dataset.defaultInst || "",
    grupo: body.dataset.defaultGrupo || "",
  };

  return portalAuth ? portalAuth.getCurrentSelection(defaults) : defaults;
}

function getCurrentLearnerName() {
  const session = portalAuth?.getCurrentSession?.();
  return String(session?.user?.fullName || session?.user?.username || "").trim();
}

function sanitizeFileName(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9\u00C0-\u024F\s_-]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

function getGuide5ExportConfig(mode) {
  return guide5ExportConfig[mode] || guide5ExportConfig.extensions;
}

function buildGuide5ExportFileName(mode, learnerName, ficha) {
  const config = getGuide5ExportConfig(mode);
  const safeName = sanitizeFileName(learnerName) || "Nombre";
  const safeFicha = sanitizeFileName(ficha) || "SinFicha";
  return `${config.filePrefix}_${safeName}_${safeFicha}.doc`;
}

function updateGuide5ExportFilenamePreview() {
  const input = document.getElementById("guide5-export-name");
  const preview = document.getElementById("guide5-export-filename");
  if (!input || !preview) {
    return;
  }

  input.classList.remove("error");
  document.getElementById("guide5-export-error")?.classList.remove("visible");

  const selection = getGuideSelection();
  preview.textContent = buildGuide5ExportFileName(
    guide5ExportMode,
    input.value,
    selection.ficha
  );
}

function setGuide5ExportModalState() {
  const selection = getGuideSelection();
  const warn = document.getElementById("guide5-export-warn");
  const ok = document.getElementById("guide5-export-ok");
  const button = document.getElementById("guide5-export-ok-btn");
  const hasFicha = Boolean(selection.ficha);

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

function escapeWordValue(value) {
  const text = String(value || "").trim();
  return escapeHtml(text || "(Sin respuesta)");
}

const GUIDE5_WORD_METADATA = {
  guideName: "Guia 5 - Operar Herramientas Informaticas y Digitales",
  program: "Sistemas Teleinformaticos",
  competencia:
    "Operar herramientas informaticas y digitales de acuerdo con protocolos y manuales tecnicos.",
  resultado:
    "RAP 1 - Caracterizar herramientas informaticas segun el contexto tecnologico de la organizacion.",
};

function getSenaLogoUrl() {
  try {
    return new URL("assets/img/sena-logo.png", window.location.href).href;
  } catch (_) {
    return "assets/img/sena-logo.png";
  }
}

function buildInstitutionalWordHeader(title, learnerName, selection, today) {
  return `
  <table class="institutional-header" width="100%" align="left" style="width:100%;margin-left:0;margin-right:0;">
    <tr>
      <td class="logo-cell" width="52" style="width:52pt;">
        <img src="${escapeHtml(getSenaLogoUrl())}" alt="Logo SENA" width="42" height="42" style="width:42pt;height:42pt;" />
      </td>
      <td colspan="3"><strong>Servicio Nacional de Aprendizaje - SENA</strong><br>${escapeWordValue(GUIDE5_WORD_METADATA.program)}</td>
    </tr>
    <tr><td class="label">Guia / actividad</td><td colspan="3">${escapeWordValue(`${GUIDE5_WORD_METADATA.guideName} - ${title}`)}</td></tr>
    <tr><td class="label">Competencia</td><td colspan="3">${escapeWordValue(GUIDE5_WORD_METADATA.competencia)}</td></tr>
    <tr><td class="label">Resultado de Aprendizaje</td><td colspan="3">${escapeWordValue(GUIDE5_WORD_METADATA.resultado)}</td></tr>
  </table>

  <table class="meta" width="100%" align="left" style="width:100%;margin-left:0;margin-right:0;">
    <tr>
      <td class="label">Nombre completo del aprendiz</td>
      <td>${escapeWordValue(learnerName)}</td>
      <td class="label">Fecha de elaboracion</td>
      <td>${escapeWordValue(today)}</td>
    </tr>
    <tr>
      <td class="label">Numero de ficha</td>
      <td>${escapeWordValue(selection.ficha)}</td>
      <td class="label">Grado</td>
      <td>${escapeWordValue(selection.grupo)}</td>
    </tr>
    <tr>
      <td class="label">Institucion</td>
      <td colspan="3">${escapeWordValue(selection.inst)}</td>
    </tr>
  </table>`;
}

function buildGuide5ExtensionsRows() {
  return extensions
    .map((row) => {
      const program =
        document.querySelector(`[data-store="extension:${row.id}:program"]`)?.value ?? row.program;
      const description =
        document.querySelector(`[data-store="extension:${row.id}:description"]`)?.value ??
        row.description;
      const extensionLabel = row.risk ? `${row.ext} (${row.risk})` : row.ext;

      return `
        <tr>
          <td>${escapeWordValue(extensionLabel)}</td>
          <td>${escapeWordValue(program)}</td>
          <td>${escapeWordValue(description)}</td>
        </tr>
      `;
    })
    .join("");
}

function buildGuide5SystemsRows() {
  return systems
    .map((row) => {
      const processor =
        document.querySelector(`[data-store="system:${row.id}:processor"]`)?.value ?? row.processor;
      const ram = document.querySelector(`[data-store="system:${row.id}:ram"]`)?.value ?? row.ram;
      const disk =
        document.querySelector(`[data-store="system:${row.id}:disk"]`)?.value ?? row.disk;
      const source =
        document.querySelector(`[data-store="system:${row.id}:source"]`)?.value ?? row.source;

      return `
        <tr>
          <td>${escapeWordValue(row.name)}</td>
          <td>${escapeWordValue(processor)}</td>
          <td>${escapeWordValue(ram)}</td>
          <td>${escapeWordValue(disk)}</td>
          <td>${escapeWordValue(source)}</td>
        </tr>
      `;
    })
    .join("");
}

function buildGuide5ExportDocument(mode, learnerName) {
  const config = getGuide5ExportConfig(mode);
  const selection = getGuideSelection();
  const today = new Date().toLocaleDateString("es-CO");
  const tableHead =
    mode === "systems"
      ? `
        <tr>
          <th>Sistema operativo</th>
          <th>Procesador</th>
          <th>RAM</th>
          <th>Espacio en disco</th>
          <th>Fuente</th>
        </tr>
      `
      : `
        <tr>
          <th>Extension</th>
          <th>Programa / referencia</th>
          <th>Descripcion o tipo de archivo</th>
        </tr>
      `;
  const tableRows =
    mode === "systems" ? buildGuide5SystemsRows() : buildGuide5ExtensionsRows();

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>${escapeHtml(config.title)} - ${escapeHtml(learnerName)}</title>
<!--[if gte mso 9]><xml>
<w:WordDocument>
  <w:View>Print</w:View>
  <w:Zoom>90</w:Zoom>
  <w:DoNotOptimizeForBrowser/>
</w:WordDocument>
</xml><![endif]-->
<style>
  @page { margin: 2.54cm; }
  body { font-family: "Times New Roman", Times, serif; font-size: 12pt; line-height: 2; color: #1a1a1a; }
  .header { text-align: center; border-bottom: 2px solid #007934; padding-bottom: 8pt; margin-bottom: 14pt; }
  .header h1 { margin: 0 0 4pt; font-size: 18pt; color: #007934; }
  .header p { margin: 2pt 0; }
  table { max-width: 100%; table-layout: fixed; overflow-wrap: break-word; word-break: break-word; }
  .institutional-header { width: 100%; max-width: 100%; table-layout: fixed; border-collapse: collapse; margin: 0 0 12pt; }
  .institutional-header td { border: 1px solid #b7c9bc; padding: 7pt; vertical-align: middle; font-size: 10pt; line-height: 1.35; }
  .institutional-header .logo-cell { width: 52pt; text-align: center; background: #f7fbf8; }
  .institutional-header img { width: 42pt; max-width: 42pt; height: 42pt; max-height: 42pt; }
  .meta { width: 100%; border-collapse: collapse; margin: 0 0 16pt; }
  .meta td { border: 1px solid #d1d5db; padding: 8pt; vertical-align: top; font-size: 10.5pt; line-height: 1.35; }
  .meta .label { font-weight: 700; background: #f3f4f6; width: 28%; }
  .data { width: 100%; border-collapse: collapse; }
  .data th, .data td { border: 1px solid #9ca3af; padding: 6pt; vertical-align: top; font-size: 10pt; line-height: 1.35; }
  .data th { background: #e8f5e9; text-align: left; }
  .note { margin-top: 12pt; font-size: 10pt; color: #4b5563; }
</style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(config.title)}</h1>
    <p>${escapeWordValue(GUIDE5_WORD_METADATA.guideName)}</p>
  </div>

  ${buildInstitutionalWordHeader(config.title, learnerName, selection, today)}

  <table class="data">
    <thead>
      ${tableHead}
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  <p class="note">Documento exportado desde la guia interactiva. Verifica y complementa la informacion antes de la entrega final.</p>
</body>
</html>`;
}

function openGuide5ExportModal(mode) {
  const modal = document.getElementById("guide5-export-modal");
  const title = document.getElementById("guide5-export-title");
  const description = document.getElementById("guide5-export-description");
  const input = document.getElementById("guide5-export-name");
  const error = document.getElementById("guide5-export-error");
  if (!modal || !title || !description || !input || !error) {
    return;
  }

  const config = getGuide5ExportConfig(mode);
  guide5ExportMode = mode;
  title.textContent = `📄 Exportar ${config.title}`;
  description.textContent = config.description;
  input.value = getCurrentLearnerName();
  input.classList.remove("error");
  error.classList.remove("visible");
  modal.classList.add("open");
  setGuide5ExportModalState();
  updateGuide5ExportFilenamePreview();

  if (!document.getElementById("guide5-export-ok-btn")?.disabled) {
    setTimeout(() => input.focus(), 80);
  }
}

function closeGuide5ExportModal() {
  document.getElementById("guide5-export-modal")?.classList.remove("open");
}

function doGuide5ExportWord() {
  const input = document.getElementById("guide5-export-name");
  const error = document.getElementById("guide5-export-error");
  if (!input || !error) {
    return;
  }

  const learnerName = input.value.trim() || getCurrentLearnerName();
  if (!learnerName) {
    input.classList.add("error");
    error.classList.add("visible");
    input.focus();
    return;
  }

  const selection = getGuideSelection();
  const html = buildGuide5ExportDocument(guide5ExportMode, learnerName);
  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  input.classList.remove("error");
  error.classList.remove("visible");

  a.href = url;
  a.download = buildGuide5ExportFileName(guide5ExportMode, learnerName, selection.ficha);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  closeGuide5ExportModal();
}

function renderGlossary() {
  const grid = document.getElementById("glossaryGrid");
  grid.innerHTML = glossaryTerms
    .map(
      ([term, definition]) => `
        <article class="glossary-card" data-search="${escapeHtml(
          `${term} ${definition}`.toLowerCase()
        )}">
          <strong>${escapeHtml(term)}</strong>
          <p>${escapeHtml(definition)}</p>
        </article>
      `
    )
    .join("");
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
    if (field.matches("[data-match]")) {
      field.closest("tr")?.classList.remove("is-correct", "is-wrong");
      const matchingFeedback = document.getElementById("matchingFeedback");
      if (matchingFeedback) {
        matchingFeedback.textContent = "";
      }
    }
    saveState();
  });

  const wordBank = document.getElementById("wordBank");
  if (wordBank) {
    wordBank.addEventListener("click", (event) => {
      const button = event.target.closest("[data-word-key]");
      if (!button) {
        return;
      }

      const key = button.dataset.wordKey;
      const active = !button.classList.contains("is-active");
      button.classList.toggle("is-active", active);
      button.dataset.trackButton = String(active);
      state[key] = active;
      saveState();
    });
  }

  document.getElementById("checkMatching")?.addEventListener("click", verifyMatching);

  const glossarySearch = document.getElementById("glossarySearch");
  if (glossarySearch) {
    glossarySearch.addEventListener("input", (event) => {
      const query = event.target.value.trim().toLowerCase();
      document.querySelectorAll(".glossary-card").forEach((card) => {
        card.classList.toggle("is-hidden", !card.dataset.search.includes(query));
      });
    });
  }

  const printButton = document.querySelector("[data-print]");
  if (printButton) {
    printButton.addEventListener("click", () => {
      window.print();
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeGuide5ExportModal();
    }
  });

  const resetProgress = document.getElementById("resetProgress");
  if (resetProgress) {
    resetProgress.addEventListener("click", async () => {
      const confirmed = window.confirm(
        "Se borraran las respuestas guardadas localmente. Deseas continuar?"
      );
      if (!confirmed) {
        return;
      }

      window.clearGuideActivityChecks?.();
      window.clearGuideLayoutState?.();
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      localStorage.removeItem(STORAGE_META_KEY);
      state = {};
      pendingCloudStateSnapshot = buildCloudStateSnapshot();
      await window.syncGuideUiStateImmediately?.();
      await syncCloudState(true);
      window.location.reload();
    });
  }
}

function verifyMatching() {
  const feedback = document.getElementById("matchingFeedback");
  if (!feedback) {
    return;
  }

  let correct = 0;

  matchingTools.forEach((tool) => {
    const select = document.querySelector(`[data-match="${tool.id}"]`);
    if (!select) {
      return;
    }
    const row = select.closest("tr");
    const isCorrect = select.value === tool.answer;
    row.classList.toggle("is-correct", isCorrect);
    row.classList.toggle("is-wrong", !isCorrect && select.value !== "");
    if (isCorrect) {
      correct += 1;
    }
  });

  feedback.textContent =
    correct === matchingTools.length
      ? "Excelente: todas las relaciones son correctas."
      : `Llevas ${correct} de ${matchingTools.length} relaciones correctas. Ajusta las filas marcadas y vuelve a verificar.`;
}

function updateProgress() {
  const trackedFields = Array.from(document.querySelectorAll("[data-track]"));
  const trackedButtons = Array.from(document.querySelectorAll("[data-track-button]"));
  const activityChecks = Array.from(document.querySelectorAll(".activity-check"));

  const completedFields = trackedFields.filter((field) => {
    if (field.type === "checkbox") {
      return field.checked;
    }
    return field.value.trim().length > 0;
  }).length;

  const completedButtons = trackedButtons.filter(
    (button) => button.dataset.trackButton === "true"
  ).length;
  const completedChecks = activityChecks.filter((button) =>
    button.classList.contains("checked")
  ).length;

  const total = trackedFields.length + trackedButtons.length + activityChecks.length;
  const completed = completedFields + completedButtons + completedChecks;
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
  const wordCount = document.getElementById("wordCount");
  if (wordCount) {
    wordCount.textContent = `${completedButtons} / ${wordList.length}`;
  }
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
        links.forEach((link) => link.classList.toggle("is-current", link.getAttribute("href") === id));
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


