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
const CLOUD_REFRESH_MS = 8000;
const SUPPORT_BASE_PATH = "assets/materiales/guia2/";
const DRIVE_FOLDERS = {
  "3441939": "https://drive.google.com/drive/folders/1SLkk986REOKGEFaCyWV7rSeudj7lnUMs?usp=drive_link",
  "3441942": "https://drive.google.com/drive/folders/1cv0DkFXhkMw22AddqIgC354DhUUHcQck?usp=drive_link",
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
    phase: "An?lisis",
    project:
      "Diagnosticar necesidades digitales, t?cnicas y de seguridad inform?tica en actores productivos locales (Proyecto 3478260).",
    learning:
      "Actividades 1, 2 y 3: sopa de letras, relaci?n herramienta-funci?n y situaci?n problema de fallo de arranque.",
    evidence:
      "Sopa de letras resuelta, tabla de coincidencias completada y bit?cora de diagn?stico inicial con s?ntomas, causas probables, plan de revisi?n, herramientas digitales propuestas y acci?n que no se realizar?a.",
    criteria:
      "Reconoce terminolog?a b?sica de sistemas operativos, restauraci?n y formateo. Clasifica herramientas digitales seg?n su funci?n. Identifica causas probables de fallos de arranque y propone un plan de revisi?n ordenado.",
    methods:
      "T?cnica: valoraci?n de conocimiento aplicado. Instrumento: Lista de chequeo LC-01.",
  },
  {
    phase: "An?lisis",
    project:
      "Diagnosticar necesidades digitales, t?cnicas y de seguridad inform?tica en actores productivos locales (Proyecto 3478260).",
    learning:
      "Actividad 4: diagn?stico inicial del contexto digital local.",
    evidence:
      "Cuestionario de conocimientos previos resuelto, an?lisis de fichas de casos locales y matriz de diagn?stico digital diligenciada.",
    criteria:
      "Identifica herramientas TIC y su funci?n en contextos reales. Reconoce necesidades digitales de actores productivos locales y propone herramientas pertinentes seg?n el caso.",
    methods:
      "T?cnica: taller diagn?stico. Instrumento: Lista de chequeo LC-01.",
  },
  {
    phase: "An?lisis",
    project:
      "Diagnosticar necesidades digitales, t?cnicas y de seguridad inform?tica en actores productivos locales (Proyecto 3478260).",
    learning:
      "Actividades 5, 6, 7, 8 y 9: extensiones de archivo, requerimientos de sistemas operativos, suite ofim?tica, herramientas colaborativas y ciberseguridad b?sica.",
    evidence:
      "Tabla de extensiones organizada con riesgos identificados, matriz de requerimientos m?nimos con fuentes, productos ofim?ticos funcionales, pr?ctica colaborativa y gu?a b?sica de ciberseguridad con lista de verificaci?n.",
    criteria:
      "Clasifica extensiones de archivo e identifica riesgos de seguridad. Determina requerimientos m?nimos de sistemas operativos. Elabora productos ofim?ticos funcionales, usa herramientas colaborativas y orienta en buenas pr?cticas de ciberseguridad adaptadas al contexto local.",
    methods:
      "T?cnica: desempe?o en taller pr?ctico y revisi?n documental. Instrumento: Lista de chequeo LC-02.",
  },
  {
    phase: "An?lisis",
    project:
      "Diagnosticar necesidades digitales, t?cnicas y de seguridad inform?tica en actores productivos locales (Proyecto 3478260).",
    learning:
      "Actividad 10: dise?o y construcci?n de soluci?n digital para actor productivo local.",
    evidence:
      "Perfil digital del actor productivo, herramienta digital personalizada funcional, gu?a de uso r?pido, presentaci?n oral y portafolio digital organizado en Google Drive.",
    criteria:
      "Caracteriza herramientas inform?ticas seg?n el contexto tecnol?gico del actor productivo. Selecciona herramientas pertinentes, construye una soluci?n digital funcional y presenta el proceso con claridad t?cnica y enfoque de usuario.",
    methods:
      "T?cnica: verificaci?n de producto y sustentaci?n. Instrumento: Lista de chequeo LC-03.",
  },
];

const glossaryTerms = [
  ["Arranque (Boot)", "Proceso que realiza el computador al encender para cargar el sistema operativo desde el dispositivo de almacenamiento."],
  ["BIOS / UEFI", "Software b?sico de la placa base que inicia el hardware al encender el equipo. UEFI es su versi?n moderna, m?s segura y r?pida."],
  ["Orden de arranque (Boot Order)", "Prioridad de dispositivos desde los que el equipo intenta iniciar el sistema operativo: disco duro, USB, DVD o red."],
  ["Sistema operativo (SO)", "Software principal que administra el hardware del computador y permite ejecutar aplicaciones. Ejemplos: Windows, Linux y macOS."],
  ["Distribuci?n Linux", "Versi?n de Linux empaquetada con programas y configuraciones propias. Ejemplos: Ubuntu, Linux Lite, Fedora y Debian."],
  ["Imagen ISO", "Archivo que contiene una copia completa de instalaci?n de un sistema operativo, listo para grabar o montar en una m?quina virtual."],
  ["Partici?n", "Divisi?n l?gica del disco duro o SSD para organizar el almacenamiento como si fueran discos independientes."],
  ["/ (ra?z) | /home | /boot | swap", "Particiones est?ndar de Linux: ra?z para archivos esenciales del sistema, home para archivos de usuario, boot para archivos de arranque y swap como memoria virtual en disco."],
  ["M?quina virtual (VM)", "Entorno de computador simulado dentro del equipo real, que permite instalar y probar sistemas operativos sin afectar el sistema anfitri?n."],
  ["VirtualBox", "Programa gratuito de Oracle para crear y administrar m?quinas virtuales en Windows, Linux y macOS."],
  ["Hipervisor", "Software que administra las m?quinas virtuales y controla el acceso a recursos f?sicos como CPU, RAM y disco del equipo anfitri?n."],
  ["Requisitos m?nimos de SO", "Caracter?sticas b?sicas de hardware necesarias para que un sistema operativo funcione: procesador, RAM y espacio en disco."],
  ["Extensi?n de archivo", "Parte final del nombre de un archivo que indica su tipo y el programa con que se abre. Ejemplos: .pdf, .docx, .xlsx, .exe y .png."],
  ["Controlador (Driver)", "Software que permite al sistema operativo comunicarse correctamente con un dispositivo de hardware."],
  ["Suite ofim?tica", "Conjunto de programas para tareas de oficina: procesador de texto, hoja de c?lculo y presentaciones. Ejemplos: Microsoft Office, LibreOffice y Google Workspace."],
  ["Herramienta colaborativa", "Aplicaci?n que permite trabajar simult?neamente con otras personas en documentos o proyectos desde cualquier ubicaci?n. Ejemplos: Google Docs, Teams y Zoom."],
  ["Nube (Cloud)", "Infraestructura de servidores en internet para guardar, acceder y compartir archivos desde cualquier dispositivo conectado."],
  ["Ciberseguridad", "Conjunto de pr?cticas y tecnolog?as para proteger redes, equipos y datos de ataques o accesos no autorizados."],
  ["Malware / Phishing", "Malware es software malicioso que da?a equipos o roba informaci?n. Phishing es un enga?o por correo o enlace falso para obtener contrase?as."],
  ["Copia de seguridad (Backup)", "Duplicado de archivos importantes guardado en lugar seguro para recuperarlos ante p?rdida, da?o o error del sistema."],
  ["Formateo", "Proceso de preparar un disco o partici?n; puede borrar toda la informaci?n si no hay respaldo previo."],
  ["Restauraci?n", "Acci?n de recuperar el sistema o archivos a un estado funcional anterior usando copias de seguridad o puntos de restauraci?n."],
  ["Normas IEEE", "Est?ndares del Instituto de Ingenieros El?ctricos y Electr?nicos para documentar informes t?cnicos con estructura, citas y referencias uniformes."],
  ["Actor productivo", "Persona o grupo que desarrolla actividades econ?micas en una comunidad: comerciante, emprendedor, agricultor, artesano o prestador de servicios."],
];

const supportTemplates = [
  {
    title: "Gu?a 2 base de aprendizaje",
    file: "Guia_2_OperarHerramientas.docx",
    type: "DOCX local",
    description:
      "Documento oficial actualizado con la estructura, actividades y evidencias de la Gu?a 2.",
    cta: "Abrir gu?a",
  },
  {
    title: "Bit?cora para el caso",
    file: "Bitacora_Para_Caso.docx",
    type: "DOCX local",
    description:
      "Plantilla de apoyo para registrar s?ntomas, causas probables y pasos de revisi?n del caso.",
    cta: "Abrir bit?cora",
  },
  {
    title: "Taller 1_Guia2",
    file: "Taller_1_Guia2.docx",
    type: "DOCX local",
    description:
      "Documento complementario de pr?ctica asociado a la Gu?a 2 para reforzar el trabajo del aprendiz.",
    cta: "Abrir taller",
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
    title: "Guia rapida para el uso de las normas IEEE",
    file: "Gu\u00eda+r\u00e1pida+para+el+uso+de+las+normas+IEEE.pdf",
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
    file: "VirtualBox-7.2.6a-172322-Win.exe",
    type: "EXE local",
    description:
      "Instalador del hipervisor usado para practicar virtualizacion e instalaciones controladas.",
    cta: "Abrir instalador",
  },
];

const GUIDE5_DRIVE_ACTIVITY_TARGETS = [
  {
    activityNumber: "3.1.3",
    panelKey: "guide2-3-1-3",
    description:
      "Cuando termines la bit?cora o el documento final de an?lisis, s?belo a la carpeta de Drive correspondiente a tu ficha.",
    note: "Entrega sugerida: bit?cora individual o informe final de an?lisis del caso.",
  },
  {
    activityNumber: "3.3.3",
    panelKey: "guide2-3-3-3",
    description:
      "Sube a Drive el diagn?stico digital del negocio, el archivo de Excel, la carpeta compartida y las evidencias colaborativas de la actividad ofim?tica.",
    note:
      "Entrega sugerida: documento .docx, archivo .xlsx, enlace de Drive y correo formal de entrega.",
  },
  {
    activityNumber: "3.4.1",
    panelKey: "guide2-3-4-1",
    description:
      "Sube a Drive el perfil digital, la herramienta construida, la gu?a de uso r?pido y la presentaci?n final de la soluci?n digital.",
    note: "Entrega sugerida: portafolio final organizado en las carpetas 01 a 04 y compartido con el instructor.",
  },
];

const ACTIVITY_QR_DATA = {
  "guia2-sopa": {
    title: "ACTIVIDAD 1: Sopa de letras de conceptos b?sicos",
    url: "https://es.educaplay.com/juego/27988460-operar_herramientas_informaticas_y_digitales_de_acuerdo_con_protocolos_y_manuales_tecnicos.html",
    image: "assets/img/guia2-qr-sopa-de-letras.png",
    cta: "Abrir ACTIVIDAD 1 en Educaplay",
  },
  "guia2-relaciona": {
    title: "Actividad 2: Relaciona la herramienta con su funci?n",
    url: "https://es.educaplay.com/juego/27988974-operar_herramientas_informaticas_y_digitales_de_acuerdo_con_protocolos_y_manuales_tecnicos.html",
    image: "assets/img/guia2-qr-relaciona-concepto.png",
    cta: "Abrir ACTIVIDAD 2 en Educaplay",
  },
};

let state = loadState();
let cloudStateSyncTimer = null;
let cloudStateRetryTimer = null;
let pendingCloudStateSnapshot = null;

document.addEventListener("DOMContentLoaded", () => {
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
});

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

function ensureActivityQrModal() {
  let modal = document.getElementById("activity-qr-modal");
  if (modal) {
    return modal;
  }

  modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.id = "activity-qr-modal";
  modal.innerHTML = `
    <div class="modal-box" style="text-align:center;max-width:360px;padding:28px 28px 24px">
      <h3 id="activity-qr-title" style="font-size:16px;margin-bottom:4px">Abrir actividad en movil</h3>
      <p style="font-size:12px;color:var(--text-muted);margin-bottom:0">Escanea este codigo QR desde el celular.</p>
      <img id="activity-qr-img" class="qr-modal-img" src="" alt="Codigo QR de la actividad">
      <a id="activity-qr-link" class="activity-qr-link" href="#" target="_blank" rel="noopener noreferrer"></a>
      <div class="qr-url-text" id="activity-qr-url"></div>
      <button class="modal-btn-ok" type="button" style="width:100%" id="activity-qr-close">Cerrar</button>
    </div>
  `;

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeActivityQR();
    }
  });

  document.body.appendChild(modal);
  document.getElementById("activity-qr-close")?.addEventListener("click", closeActivityQR);
  return modal;
}

function showActivityQR(key) {
  const data = ACTIVITY_QR_DATA[key];
  if (!data) {
    return;
  }

  ensureActivityQrModal();
  document.getElementById("activity-qr-title").textContent = data.title;
  document.getElementById("activity-qr-url").textContent = data.url;
  document.getElementById("activity-qr-img").src = data.image;
  const link = document.getElementById("activity-qr-link");
  if (link) {
    link.textContent = data.cta;
    link.href = data.url;
  }
  document.getElementById("activity-qr-modal").classList.add("open");
}

function closeActivityQR() {
  const modal = document.getElementById("activity-qr-modal");
  if (!modal) {
    return;
  }

  modal.classList.remove("open");
  const image = document.getElementById("activity-qr-img");
  if (image) {
    image.src = "";
  }
}

function createDriveDeliveryPanel(config) {
  const wrapper = document.createElement("div");
  wrapper.className = "info-box drive-submit-box";
  wrapper.setAttribute("data-drive-panel", config.panelKey);
  wrapper.style.marginTop = "16px";
  wrapper.innerHTML = `
    <div class="label">Entrega de esta actividad en Drive</div>
    <p>${escapeHtml(config.description)}</p>
    <div class="drive-action-group">
      <button class="btn-drive" type="button">Subir al portafolio de Drive</button>
      <button class="btn-qr" type="button">Abrir en movil - Ver QR</button>
    </div>
    <div class="drive-helper-note">${escapeHtml(config.note)} La carpeta se define automaticamente segun la ficha activa del grupo 11.</div>
  `;

  const [driveButton, qrButton] = wrapper.querySelectorAll("button");
  driveButton?.addEventListener("click", openDriveFolder);
  qrButton?.addEventListener("click", showDriveFolderQR);
  return wrapper;
}

function findActivityBodyByNumber(activityNumber) {
  const activity = Array.from(document.querySelectorAll(".activity")).find((item) => {
    const number = item.querySelector(".activity-num")?.textContent?.trim() || "";
    return number === activityNumber;
  });

  return activity?.querySelector(".activity-body") || null;
}

function renderDriveDeliveryPanel() {
  GUIDE5_DRIVE_ACTIVITY_TARGETS.forEach((config) => {
    const activityBody = findActivityBodyByNumber(config.activityNumber);
    if (!activityBody || activityBody.querySelector(`[data-drive-panel='${config.panelKey}']`)) {
      return;
    }

    activityBody.appendChild(createDriveDeliveryPanel(config));
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
    title: "Actividad 5: Extensiones de archivo",
    filePrefix: "Guia2_Actividad5_Extensiones_Archivo",
    description: "Exporta la tabla diligenciada de extensiones de archivo a un documento Word.",
  },
  systems: {
    title: "Actividad 6: Requerimientos m?nimos de sistemas operativos",
    filePrefix: "Guia2_Actividad6_Requerimientos_Minimos",
    description:
      "Exporta la matriz diligenciada de requerimientos m?nimos de sistemas operativos a un documento Word.",
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
  @page { margin: 2.5cm; }
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #1a1a1a; }
  .header { text-align: center; border-bottom: 2px solid #007934; padding-bottom: 8pt; margin-bottom: 14pt; }
  .header h1 { margin: 0 0 4pt; font-size: 18pt; color: #007934; }
  .header p { margin: 2pt 0; }
  .meta { width: 100%; border-collapse: collapse; margin: 0 0 16pt; }
  .meta td { border: 1px solid #d1d5db; padding: 8pt; vertical-align: top; }
  .meta .label { font-weight: 700; background: #f3f4f6; width: 28%; }
  .data { width: 100%; border-collapse: collapse; }
  .data th, .data td { border: 1px solid #9ca3af; padding: 7pt; vertical-align: top; }
  .data th { background: #e8f5e9; text-align: left; }
  .note { margin-top: 12pt; font-size: 10pt; color: #4b5563; }
</style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(config.title)}</h1>
    <p>Guia 2 - Operar Herramientas Informaticas y Digitales</p>
    <p>Sistemas Teleinformaticos</p>
  </div>

  <table class="meta">
    <tr>
      <td class="label">Aprendiz</td>
      <td>${escapeWordValue(learnerName)}</td>
    </tr>
    <tr>
      <td class="label">Institucion</td>
      <td>${escapeWordValue(selection.inst)}</td>
    </tr>
    <tr>
      <td class="label">Grupo</td>
      <td>${escapeWordValue(selection.grupo)}</td>
    </tr>
    <tr>
      <td class="label">Ficha</td>
      <td>${escapeWordValue(selection.ficha)}</td>
    </tr>
    <tr>
      <td class="label">Fecha de exportacion</td>
      <td>${escapeWordValue(today)}</td>
    </tr>
  </table>

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
  input.value = "";
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

  const learnerName = input.value.trim();
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

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-activity-qr]");
    if (!button) {
      return;
    }

    showActivityQR(button.dataset.activityQr);
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

  const printButton = document.querySelector("[data-print]");
  if (printButton) {
    printButton.addEventListener("click", () => {
      window.print();
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeGuide5ExportModal();
      closeDriveFolderQR();
      closeActivityQR();
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


