/* script_guia_redes.js — Guia 2 Redes RAP01 | Santa Barbara 10A/10B */
const PAGE_FILE_REDES = window.location.pathname.split("/").pop().toLowerCase() || "guia.html";
const STORAGE_FILE_ALIASES_REDES = {
  "santa-barbara-10a-guia-02-redes-rap01.html": "sb_10a_redes.html",
  "santa-barbara-10b-guia-02-redes-rap01.html": "sb_10b_redes.html",
};
const GUIDE_DATA_FILE_REDES = STORAGE_FILE_ALIASES_REDES[PAGE_FILE_REDES] || PAGE_FILE_REDES;
const PAGE_KEY_REDES = GUIDE_DATA_FILE_REDES.replace(/[^a-z0-9]+/g, "_");
const _portalAuth = window.portalAuth || null;
const _redesLockSync = window.redesLockSync || null;
const LEGACY_STORAGE_KEY_REDES = "guia_interactiva_" + PAGE_KEY_REDES;
const STORAGE_KEY_REDES = _portalAuth
  ? _portalAuth.getScopedStorageKey(LEGACY_STORAGE_KEY_REDES, { area: "guide-data" })
  : LEGACY_STORAGE_KEY_REDES;
const STORAGE_META_KEY_REDES = STORAGE_KEY_REDES + "__meta";
const SCOPED_STORAGE_ENABLED_REDES = STORAGE_KEY_REDES !== LEGACY_STORAGE_KEY_REDES;
const CLOUD_SYNC_DELAY_REDES = 1200;
const CLOUD_REFRESH_REDES = 60000;

const DRIVE_FOLDERS_REDES = {};
const DRIVE_LINK_REFLEXION_311 = ""; // TODO: reemplazar con el enlace del Drive

// ---------------------------------------------------------------------------
// Evidence rows
// ---------------------------------------------------------------------------
const evidenceRows = [
  {
    phase: "Analisis",
    project: "Diagnosticar el estado de la infraestructura de redes y equipos informaticos y solicitudes de servicio tecnico presente en el entorno de trabajo.",
    learning: "3.1 Reflexion individual escrita + Socializacion (plenaria).",
    evidence: "Respuestas en cuaderno o documento digital. Desempeno: participacion en socializacion (2-3 min).",
    criteria: "Explica con claridad que es una red y sus beneficios en un contexto MiPyme. Identifica elementos basicos para el funcionamiento de una red (dispositivos, medio, direccionamiento).",
    methods: "Tecnica: Observacion y revision. Instrumento: Lista de cotejo (participacion y respuestas).",
  },
  {
    phase: "Analisis",
    project: "Diagnosticar el estado de la infraestructura de redes y equipos informaticos y solicitudes de servicio tecnico presente en el entorno de trabajo.",
    learning: "Exploracion visual Bloques A-E (LAN/MAN/WAN, topologias, medios, dispositivos, OSI/TCP-IP).",
    evidence: "Producto: Exploracion_Contextual_NombreAprendiz_FICHA.docx (5 productos compilados).",
    criteria: "Clasifica tipos de redes y topologias segun el caso. Selecciona medios y dispositivos de interconexion segun necesidad. Relaciona capas OSI con dispositivos y protocolos.",
    methods: "Tecnica: Evaluacion de producto. Instrumento: Rubrica analitica (calidad tecnica, completitud y presentacion).",
  },
  {
    phase: "Analisis",
    project: "Diagnosticar el estado de la infraestructura de redes y equipos informaticos y solicitudes de servicio tecnico presente en el entorno de trabajo.",
    learning: "Mapa mental integrador de fundamentos de redes.",
    evidence: "Producto: MapaMental_Redes_NombreAprendiz_FICHA.png o .pdf.",
    criteria: "Integra conceptos en una representacion visual coherente. Incluye conexiones cruzadas y ejemplos aplicados a MiPymes. Presenta claridad visual y vocabulario tecnico apropiado.",
    methods: "Tecnica: Evaluacion de producto. Instrumento: Rubrica (integracion, exactitud y diseno).",
  },
  {
    phase: "Analisis",
    project: "Diagnosticar el estado de la infraestructura de redes y equipos informaticos y solicitudes de servicio tecnico presente en el entorno de trabajo.",
    learning: "Quiz individual de fundamentos de redes (3.2.1.H).",
    evidence: "Resultado registrado en plataforma con puntaje sobre 100 y evidencia de advertencias por cambio de pestana.",
    criteria: "Reconoce conceptos clave sobre tipos de redes, topologias, medios de transmision, dispositivos de interconexion y modelo OSI/TCP-IP.",
    methods: "Tecnica: Prueba objetiva. Instrumento: Quiz de seleccion multiple con control de integridad por visibilidad.",
  },
  {
    phase: "Analisis",
    project: "Diagnosticar el estado de la infraestructura de redes y equipos informaticos y solicitudes de servicio tecnico presente en el entorno de trabajo.",
    learning: "Taller de direccionamiento IP (Ejercicios 1-5) + verificacion ipconfig /all.",
    evidence: "Producto: Taller_IP_NombreAprendiz_FICHA.pdf + captura de pantalla ipconfig (Ejercicio 4).",
    criteria: "Identifica clase y mascara por defecto de IPv4. Determina red/host y asigna IPs validas evitando red/broadcast. Explica funcion de IP, mascara, gateway y DNS. Muestra procedimiento y justifica decisiones.",
    methods: "Tecnica: Prueba escrita/ejercicios. Instrumento: Lista de chequeo + guia de respuestas.",
  },
  {
    phase: "Analisis",
    project: "Diagnosticar el estado de la infraestructura de redes y equipos informaticos y solicitudes de servicio tecnico presente en el entorno de trabajo.",
    learning: "Laboratorio 1 (Packet Tracer): topologia estrella + direccionamiento + pruebas ping/broadcast.",
    evidence: "Producto: Lab1_EstrellaCarmen_NombreAprendiz_FICHA.pkt + capturas de pings + analisis breve.",
    criteria: "Disena topologia solicitada y nombra equipos correctamente. Configura direccionamiento IP segun tabla. Realiza pruebas de conectividad y analiza resultados incluyendo broadcast.",
    methods: "Tecnica: Observacion y revision de producto. Instrumento: Lista de chequeo de laboratorio + rubrica de desempeno.",
  },
  {
    phase: "Analisis",
    project: "Diagnosticar el estado de la infraestructura de redes y equipos informaticos y solicitudes de servicio tecnico presente en el entorno de trabajo.",
    learning: "Laboratorio 2 (autonomo): topologia arbol + pruebas ping/tracert + analisis.",
    evidence: "Producto: Lab2_ArbolBoycaTech_NombreAprendiz_FICHA.pkt + capturas + documento de analisis (min. 1 pagina).",
    criteria: "Implementa topologia arbol con segmentos y direccionamiento definido. Evidencia conectividad intra e interdepartamental. Interpreta resultados de tracert y justifica los saltos. Presenta analisis tecnico escrito y ordenado.",
    methods: "Tecnica: Evaluacion de desempeno y producto. Instrumento: Rubrica de laboratorio + lista de cotejo.",
  },
];

// ---------------------------------------------------------------------------
// Glossary
// ---------------------------------------------------------------------------
const glossaryTerms = [
  ["LAN (Local Area Network)", "Red de area local que interconecta dispositivos en un espacio limitado (hogar, oficina, sede)."],
  ["MAN (Metropolitan Area Network)", "Red que cubre una ciudad o zona metropolitana, normalmente interconectando multiples LAN."],
  ["WAN (Wide Area Network)", "Red de area amplia que interconecta redes separadas geograficamente, como ciudades o paises. Ejemplo: Internet."],
  ["Topologia de red", "Forma fisica o logica en la que se conectan los dispositivos (estrella, arbol, bus, anillo), afectando desempeno y tolerancia a fallos."],
  ["UTP (Unshielded Twisted Pair)", "Cable de par trenzado no blindado usado en redes Ethernet. Su desempeno depende de la categoria (Cat5e, Cat6) y los estandares de cableado."],
  ["Fibra optica", "Medio de transmision por luz que ofrece alta velocidad y largas distancias con baja interferencia electromagnetica."],
  ["Wi-Fi (IEEE 802.11)", "Familia de estandares para redes inalambricas de area local basadas en radiofrecuencia."],
  ["Ethernet (IEEE 802.3)", "Tecnologia estandar para redes cableadas LAN; define la capa fisica y de enlace de datos para transmision en redes locales."],
  ["Switch", "Dispositivo de capa 2 que conmuta tramas usando direcciones MAC, segmentando dominios de colision."],
  ["Router", "Dispositivo de capa 3 que enruta paquetes entre redes IP distintas y suele actuar como puerta de enlace hacia Internet."],
  ["Access Point (AP)", "Dispositivo que provee conectividad inalambrica y conecta clientes Wi-Fi a una red cableada."],
  ["Direccion IPv4", "Identificador logico de 32 bits para un host o interfaz en redes IP (ejemplo: 192.168.1.10)."],
  ["Mascara de subred", "Valor que define que parte de una direccion IP corresponde a red y cual a host, determinando el tamano de la subred."],
  ["Gateway (Puerta de enlace)", "Direccion del router que permite enviar trafico fuera de la red local hacia otras redes. Ejemplo: 192.168.1.1."],
  ["DNS (Domain Name System)", "Sistema distribuido que traduce nombres de dominio (ej. www.sena.edu.co) a direcciones IP numericas."],
  ["ICMP", "Protocolo de control usado para mensajes de diagnostico y error en redes IP. Las herramientas ping y tracert se basan en ICMP."],
  ["Ping", "Herramienta de diagnostico que verifica conectividad entre dos dispositivos enviando mensajes ICMP Echo y midiendo el tiempo de respuesta."],
  ["Tracert / Traceroute", "Herramienta que muestra la ruta (saltos) que siguen los paquetes a traves de routers mediante mecanismos ICMP/TTL."],
  ["Broadcast", "Trafico enviado a todos los hosts de una red local. En IPv4 la direccion de difusion es la ultima de la subred (p. ej., 192.168.1.255 en /24)."],
  ["Modelo OSI", "Modelo de referencia de 7 capas (Fisica, Enlace, Red, Transporte, Sesion, Presentacion, Aplicacion) que estandariza las funciones de comunicacion en red."],
];

// ---------------------------------------------------------------------------
// Support materials
// ---------------------------------------------------------------------------
const supportTemplates = [
  { icon: "&#128196;", title: "Plantilla mapa mental de redes", desc: "Estructura base para el mapa mental integrador de los 5 bloques.", file: "" },
  { icon: "&#128196;", title: "Taller IP — hoja de trabajo", desc: "Plantilla para resolver los 5 ejercicios de direccionamiento IP.", file: "" },
];

const supportDocuments = [
  { icon: "&#128214;", title: "Estandar TIA/EIA-568 — categorias UTP", desc: "Referencia tecnica de categorias de cable UTP y distancias maximas.", file: "" },
  { icon: "&#128214;", title: "Tabla de clases IPv4 y rangos privados", desc: "Rangos de Clase A, B y C con mascaras por defecto y rango privado.", file: "" },
];

const supportTools = [
  { icon: "&#127918;", title: "Cisco Packet Tracer", desc: "Simulador de redes gratuito requerido para los laboratorios. Requiere registro en NetAcad.", file: "" },
  { icon: "&#127918;", title: "Draw.io", desc: "Herramienta en linea para diagramar topologias de red. No requiere instalacion.", file: "" },
  { icon: "&#127918;", title: "Subnet Calculator", desc: "Calculadora de subredes IP para verificar ejercicios de direccionamiento.", file: "" },
];

// ---------------------------------------------------------------------------
// State management
// ---------------------------------------------------------------------------
let state = {};
let redesBooted = false;

function loadStateRedes() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_REDES);
    if (saved) return JSON.parse(saved) || {};
    if (SCOPED_STORAGE_ENABLED_REDES) {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY_REDES);
      if (legacy) {
        const parsed = JSON.parse(legacy) || {};
        localStorage.setItem(STORAGE_KEY_REDES, JSON.stringify(parsed));
        return parsed;
      }
    }
    return {};
  } catch {
    return {};
  }
}

function readStateMetaRedes() {
  try {
    const saved = localStorage.getItem(STORAGE_META_KEY_REDES);
    if (!saved) return {};

    try {
      const parsed = JSON.parse(saved);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      const numeric = Number(saved);
      return Number.isFinite(numeric) && numeric > 0
        ? { updatedAt: new Date(numeric).toISOString() }
        : {};
    }
  } catch {
    return {};
  }
}

function saveStateMetaRedes(meta) {
  try {
    if (!meta) {
      localStorage.removeItem(STORAGE_META_KEY_REDES);
      return;
    }
    localStorage.setItem(STORAGE_META_KEY_REDES, JSON.stringify(meta));
  } catch {}
}

function saveStateRedes(options) {
  try {
    localStorage.setItem(STORAGE_KEY_REDES, JSON.stringify(state));
    if (options && options.updatedAt) {
      saveStateMetaRedes({ updatedAt: options.updatedAt });
    } else {
      saveStateMetaRedes({ updatedAt: new Date().toISOString() });
    }
    scheduleCloudSyncRedes();
  } catch {}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const REDES_WORD_METADATA = {
  guideName: "Guia 2 - Redes RAP01",
  program: "Sistemas Teleinformaticos",
  competencia:
    "280102129 - Evaluar red de acuerdo con procedimientos de telecomunicaciones y normativa tecnica.",
  resultado:
    "RAP 01 - Definir los parametros y recursos de la red de acuerdo con normativa de telecomunicaciones.",
};

function getSenaLogoUrlRedes() {
  try {
    return new URL("assets/img/sena-logo.png", window.location.href).href;
  } catch (_) {
    return "assets/img/sena-logo.png";
  }
}

function getWordIdentityValueRedes(identity, key) {
  if (!identity) return "";
  if (key === "inst") return identity.inst || identity.institucion || "";
  return identity[key] || "";
}

function buildInstitutionalWordStylesRedes() {
  return `
table{max-width:100%;table-layout:fixed;overflow-wrap:break-word;word-break:break-word}
.institutional-header{width:100%;border-collapse:collapse;margin:0 0 12pt}
.institutional-header td{border:1px solid #b7c9bc;padding:7pt;vertical-align:middle;font-size:10pt;line-height:1.35}
.institutional-header .logo-cell{width:80pt;text-align:center;background:#f7fbf8}
.institutional-header img{width:62pt;height:auto}
.institutional-header .label,.meta .label{font-weight:700;background:#f3f4f6;color:#1b5e20}
.meta{width:100%;border-collapse:collapse;margin:0 0 16pt}
.meta td{border:1px solid #d1d5db;padding:8pt;vertical-align:top;font-size:10.5pt;line-height:1.35}`;
}

function buildInstitutionalWordHeaderRedes(title, fullName, identity, fecha) {
  return `
<table class="institutional-header">
  <tr>
    <td class="logo-cell" rowspan="4"><img src="${escapeHtml(getSenaLogoUrlRedes())}" alt="Logo SENA"></td>
    <td class="label">Programa</td>
    <td>${escapeHtml(REDES_WORD_METADATA.program)}</td>
    <td class="label">Fecha de elaboracion</td>
    <td>${escapeHtml(fecha)}</td>
  </tr>
  <tr><td class="label">Guia / actividad</td><td colspan="3">${escapeHtml(`${REDES_WORD_METADATA.guideName} - ${title}`)}</td></tr>
  <tr><td class="label">Competencia</td><td colspan="3">${escapeHtml(REDES_WORD_METADATA.competencia)}</td></tr>
  <tr><td class="label">Resultado de Aprendizaje</td><td colspan="3">${escapeHtml(REDES_WORD_METADATA.resultado)}</td></tr>
</table>
<table class="meta">
  <tr>
    <td class="label">Nombre completo del aprendiz</td>
    <td>${escapeHtml(fullName || "Aprendiz")}</td>
    <td class="label">Numero de ficha</td>
    <td>${escapeHtml(getWordIdentityValueRedes(identity, "ficha") || "0000")}</td>
  </tr>
  <tr>
    <td class="label">Grado</td>
    <td>${escapeHtml(getWordIdentityValueRedes(identity, "grupo"))}</td>
    <td class="label">Institucion</td>
    <td>${escapeHtml(getWordIdentityValueRedes(identity, "inst"))}</td>
  </tr>
</table>`;
}

function getGuideSelectionRedes() {
  const bodyEl = document.body || {};
  const defaults = {
    ficha: bodyEl.dataset?.defaultFicha || "",
    inst: bodyEl.dataset?.defaultInst || "",
    grupo: bodyEl.dataset?.defaultGrupo || "",
  };
  const auth = _portalAuth || window.portalAuth || null;
  const session = auth?.getCurrentSession?.() || null;
  const user = session && session.user ? session.user : null;
  const selection = auth?.getCurrentSelection?.(defaults) || defaults;

  if (user) {
    return {
      ficha: String(user.ficha || selection.ficha || defaults.ficha || "").trim(),
      inst: String(user.inst || selection.inst || defaults.inst || "").trim(),
      grupo: String(user.grupo || selection.grupo || defaults.grupo || "").trim(),
      fullName: String(user.fullName || user.username || "").trim() || "Aprendiz",
      usernameKey: String(user.usernameKey || session.usernameKey || user.username || "").trim(),
    };
  }

  try {
    const raw = localStorage.getItem("sena_portal_session") || localStorage.getItem("portal_session") || "";
    const session = raw ? JSON.parse(raw) : null;
    if (session) {
      const user = session.user || {};
      return {
        ficha: user.ficha || session.ficha || session.fichaId || selection.ficha || defaults.ficha || "",
        inst: user.inst || session.inst || session.institucion || selection.inst || defaults.inst || "",
        grupo: user.grupo || session.grupo || selection.grupo || defaults.grupo || "",
        fullName: user.fullName || user.username || session.fullName || "Aprendiz",
        usernameKey: user.usernameKey || session.usernameKey || user.username || "",
      };
    }
  } catch {}
  return {
    ...defaults,
    fullName: "Aprendiz",
    usernameKey: "",
  };
}

function getDeliveryIdentityRedes() {
  const bodyEl = document.body || {};
  const defaults = {
    ficha: bodyEl.dataset?.defaultFicha || "",
    inst: bodyEl.dataset?.defaultInst || "",
    grupo: bodyEl.dataset?.defaultGrupo || "",
  };
  const auth = _portalAuth || window.portalAuth || null;
  const session = auth?.getCurrentSession?.() || null;
  const selection = auth?.getCurrentSelection?.(defaults) || defaults;
  const user = session && session.user ? session.user : null;
  const usernameSource =
    (session && session.usernameKey) ||
    (user && (user.usernameKey || user.username)) ||
    "desconocido";
  const usernameKey = String(usernameSource || "desconocido")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "") || "desconocido";
  const fullName = String((user && user.fullName) || "").trim();
  const ficha = String((user && user.ficha) || selection.ficha || defaults.ficha || "").trim();

  return {
    session,
    user,
    selection,
    usernameKey: usernameKey || "desconocido",
    fullName: fullName || usernameKey || "Aprendiz",
    ficha: ficha || "0000",
    grupo: String((user && user.grupo) || selection.grupo || defaults.grupo || "").trim(),
    inst: String((user && user.inst) || selection.inst || defaults.inst || "").trim(),
  };
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
function renderEvidenceTable() {
  const tbody = document.getElementById("evidenceTable");
  if (!tbody) return;
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
      </tr>`
    )
    .join("");
}

function formatQuizDateRedes(value) {
  if (!value) return "Sin registro";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Sin registro";
  return parsed.toLocaleString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getQuizStatusLabelRedes(attempt) {
  if (!attempt || typeof attempt !== "object") return "Pendiente";
  if (attempt.status === "terminated_visibility") return "Finalizado por visibilidad";
  if (attempt.locked || attempt.status === "completed") return "Completado";
  if (attempt.startedAt) return "En progreso";
  return "Pendiente";
}

function renderQuizRedesStatus() {
  const panel = document.getElementById("quizRedesStatus");
  const actionLink = document.getElementById("quizRedesActionLink");
  const attempt = state?.["quiz-redes-321h"];

  if (!panel || !actionLink) {
    return;
  }

  if (!attempt || typeof attempt !== "object") {
    panel.style.display = "none";
    actionLink.innerHTML = "&#128218; Presentar quiz aleatorio";
    return;
  }

  const statusLabel = getQuizStatusLabelRedes(attempt);
  const variant = String(attempt.variant || "Sin asignar");
  const warningCount = Number(attempt.warningCount) || 0;
  const score = Number(attempt.score) || 0;
  const maxScore = Number(attempt.maxScore) || 100;
  const submittedAt = attempt.submittedAt || attempt.completedAt || "";

  panel.style.display = "block";
  panel.innerHTML =
    `<div class="label">&#128221; Estado del quiz 3.2.1.H</div>` +
    `<p style="margin:8px 0 0"><strong>Estado:</strong> ${escapeHtml(statusLabel)} | ` +
    `<strong>Variante:</strong> ${escapeHtml(variant)} | ` +
    `<strong>Advertencias:</strong> ${escapeHtml(String(warningCount))} / 2</p>` +
    (attempt.locked
      ? `<p style="margin:8px 0 0"><strong>Puntaje:</strong> ${escapeHtml(String(score))} / ${escapeHtml(String(maxScore))} | ` +
        `<strong>Presentado:</strong> ${escapeHtml(formatQuizDateRedes(submittedAt))}</p>`
      : `<p style="margin:8px 0 0">Tienes un intento iniciado. Si vuelves a entrar, continuaras con la misma variante asignada.</p>`);

  if (attempt.locked) {
    actionLink.innerHTML = "&#128065; Ver quiz presentado";
    return;
  }

  actionLink.innerHTML = "&#9205; Continuar quiz";
}

function renderGlossary() {
  const grid = document.getElementById("glossaryGrid");
  if (!grid) return;
  grid.innerHTML = glossaryTerms
    .map(
      ([term, def]) => `
      <article class="glossary-card" data-search="${escapeHtml((term + " " + def).toLowerCase())}">
        <strong>${escapeHtml(term)}</strong>
        <p>${escapeHtml(def)}</p>
      </article>`
    )
    .join("");
}

function renderMaterialCardRedes(item) {
  return `
    <div class="resource-card">
      <span class="resource-icon">${item.icon}</span>
      <div class="resource-info">
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.desc)}</p>
      </div>
    </div>`;
}

function renderSupportMaterialsRedes() {
  ["supportTemplatesGrid", "supportDocsGrid", "supportToolsGrid"].forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    const lists = [supportTemplates, supportDocuments, supportTools];
    el.innerHTML = lists[i].map(renderMaterialCardRedes).join("");
  });
}

function renderTopbarCampus() {
  const el = document.getElementById("topbarCampus");
  if (!el) return;
  const sel = getGuideSelectionRedes();
  const inst = sel.inst || document.body.dataset.defaultInst || "Santa Barbara";
  const grupo = sel.grupo || document.body.dataset.defaultGrupo || "";
  el.textContent = grupo ? inst + " | " + grupo : inst;
}

// ---------------------------------------------------------------------------
// Hydration
// ---------------------------------------------------------------------------
function hydrateFieldsRedes() {
  document.querySelectorAll("[data-store]").forEach((field) => {
    const key = field.dataset.store;
    if (!(key in state)) return;
    if (field.type === "checkbox") { field.checked = Boolean(state[key]); return; }
    if (field.type === "radio") { field.checked = String(state[key]) === String(field.value); return; }
    field.value = state[key];
  });
  restoreImagenBloqueA();
  restoreImagenBloqueB();
  restoreImagenBloqueE();
  restoreImagenSocial();
  restoreImagenBloqueIP1();
  restoreImagenBloqueIP3();
  restorePantallazoTallerIPEj4();
  restoreLab1EvidenceUploads();
  restoreLab2EvidenceUploads();
  restoreLab3EvidenceUploads();
  applyReflexionLock();
  applyReflexionSocializacionLock();
  applyBloqueALock();
  applyBloqueBLock();
  applyBloqueCLock();
  applyBloqueDLock();
  applyBloqueELock();
  applySocialLock();
  applyBloqueIP1Lock();
  applyBloqueIP2Lock();
  applyBloqueIP3Lock();
  applyTallerIPEj1Lock();
  applyTallerIPEj2Lock();
  applyTallerIPEj3Lock();
  applyTallerIPEj4Lock();
  applyTallerIPEj5Lock();
  applyLab1Lock();
  applyLab2Lock();
  applyLab3Lock();
}

function applyReflexionSocializacionLock() {
  const locked = Boolean(state["reflexion-socializacion-locked"]);
  const ta = document.getElementById("socializacionTextarea311");
  if (ta) { ta.disabled = locked; ta.style.opacity = locked ? "0.75" : ""; }
  const btn = document.getElementById("btnEnviarSocializacion");
  if (btn) { btn.disabled = locked; btn.textContent = locked ? "\u2705 Enviado" : "\uD83D\uDCE4 Enviar"; }
  const status = document.getElementById("socializacionStatus311");
  if (status) status.style.display = locked ? "block" : "none";
}

const BLOQUEA_KEYS = ["bloqueA-1", "bloqueA-2", "bloqueA-3"];

function applyBloqueALock() {
  const locked = Boolean(state["bloqueA-locked"]);
  BLOQUEA_KEYS.forEach((k) => {
    const el = document.querySelector(`[data-store="${k}"]`);
    if (el) { el.disabled = locked; el.style.opacity = locked ? "0.75" : ""; }
  });
  const input = document.getElementById("bloqueAImagenInput");
  if (input) input.disabled = locked;
  const label = document.getElementById("bloqueAImagenLabel");
  if (label) {
    label.style.opacity = locked ? "0.5" : "";
    label.style.pointerEvents = locked ? "none" : "";
  }
  const btn = document.getElementById("btnGuardarBloqueA");
  if (btn) {
    btn.disabled = locked;
    btn.textContent = locked ? "\u2705 Respuestas guardadas" : "\uD83D\uDCBE Guardar respuestas";
  }
  const status = document.getElementById("bloqueAStatus");
  if (status) status.style.display = locked ? "block" : "none";
}

function _getDriveThumbnailUrl(driveUrl) {
  const m = driveUrl && driveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w500` : null;
}

function restoreImagenBloqueA() {
  const driveUrl = state["bloqueA-imagen-url"];
  const localBase64 = state["bloqueA-imagen"];
  const img = document.getElementById("bloqueAImagenImg");
  const preview = document.getElementById("bloqueAImagenPreview");
  const nombre = document.getElementById("bloqueAImagenNombre");
  if (driveUrl) {
    const thumb = _getDriveThumbnailUrl(driveUrl);
    if (img) img.src = thumb || driveUrl;
    if (preview) preview.style.display = "block";
    if (nombre) nombre.innerHTML =
      `<a href="${driveUrl}" target="_blank" rel="noopener" style="color:#1e40af">&#128194; Ver imagen en Drive</a>` +
      ` &mdash; ${state["bloqueA-imagen-nombre"] || "imagen guardada"}`;
  } else if (localBase64) {
    if (img) img.src = localBase64;
    if (preview) preview.style.display = "block";
    if (nombre) nombre.textContent = state["bloqueA-imagen-nombre"] || "imagen adjunta";
  }
}

window.subirImagenBloqueA = async function (input) {
  const file = input.files && input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    alert("La imagen es demasiado grande (máx. 5 MB). Usa una foto más pequeña o comprímela.");
    input.value = "";
    return;
  }
  const label = document.getElementById("bloqueAImagenLabel");
  const originalLabel = label ? label.innerHTML : "";
  if (label) { label.innerHTML = "&#9203; Subiendo imagen..."; label.style.pointerEvents = "none"; }

  try {
    const delivery = window.sharedAppsScriptDelivery;
    if (!delivery || typeof delivery.uploadToAppsScript !== "function") {
      throw new Error("El sistema de entrega no está disponible.");
    }
    const identity = getDeliveryIdentityRedes();
    const usernameKey = identity.usernameKey;
    const ficha = identity.ficha || "0000";
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const fileName = `bloqueA_${ficha}_${usernameKey}_${dateStr}.${ext}`;

    // Show local preview immediately while uploading
    const reader = new FileReader();
    const localBase64 = await new Promise((res) => { reader.onload = (e) => res(e.target.result); reader.readAsDataURL(file); });
    state["bloqueA-imagen"] = localBase64;
    state["bloqueA-imagen-nombre"] = fileName;
    saveStateRedes();
    restoreImagenBloqueA();

    // Upload to Drive
    const fileBase64 = localBase64.split(",").pop();
    const response = await delivery.uploadToAppsScript({
      guideLabel: "Guia 2",
      activityLabel: "Bloque A — Producto Individual",
      activityNumber: "3.2.A",
      activityTitle: "Producto Individual — Esquema LAN/MAN/WAN",
      fileName,
      mimeType: file.type || "image/jpeg",
      fileBase64,
      fullName: identity.fullName || identity.usernameKey || "Aprendiz",
      ficha,
    });

    if (response && response.driveUrl) {
      state["bloqueA-imagen-url"] = response.driveUrl;
      saveStateRedes();
      await saveToCloudRedes();
      restoreImagenBloqueA(); // refresh to show Drive link
    }

    if (label) { label.innerHTML = "&#128247; Cambiar imagen"; label.style.pointerEvents = ""; }
  } catch (err) {
    alert("Error al subir imagen: " + ((err && err.message) || "Intenta de nuevo."));
    if (label) { label.innerHTML = originalLabel; label.style.pointerEvents = ""; }
  }
};

window.guardarBloqueA = async function () {
  const empty = BLOQUEA_KEYS.slice(0, 3).filter((k) => !String(state[k] || "").trim());
  if (empty.length > 0) {
    alert("Responde las 3 preguntas antes de guardar.");
    return;
  }
  const btn = document.getElementById("btnGuardarBloqueA");
  if (btn) { btn.disabled = true; btn.textContent = "Guardando\u2026"; }
  state["bloqueA-locked"] = true;
  saveStateRedes();
  await saveToCloudRedes();
  applyBloqueALock();
};

// ---------------------------------------------------------------------------
// Bloque B
// ---------------------------------------------------------------------------
const BLOQUEB_KEYS = ["bloqueB-1", "bloqueB-2", "bloqueB-3"];

function applyBloqueBLock() {
  const locked = Boolean(state["bloqueB-locked"]);
  BLOQUEB_KEYS.forEach((k) => {
    const el = document.querySelector(`[data-store="${k}"]`);
    if (el) { el.disabled = locked; el.style.opacity = locked ? "0.75" : ""; }
  });
  const input = document.getElementById("bloqueBImagenInput");
  if (input) input.disabled = locked;
  const label = document.getElementById("bloqueBImagenLabel");
  if (label) {
    label.style.opacity = locked ? "0.5" : "";
    label.style.pointerEvents = locked ? "none" : "";
  }
  const btn = document.getElementById("btnGuardarBloqueB");
  if (btn) {
    btn.disabled = locked;
    btn.textContent = locked ? "\u2705 Respuestas guardadas" : "\uD83D\uDCBE Guardar respuestas";
  }
  const status = document.getElementById("bloqueBStatus");
  if (status) status.style.display = locked ? "block" : "none";
}

function restoreImagenBloqueB() {
  const driveUrl = state["bloqueB-imagen-url"];
  const localBase64 = state["bloqueB-imagen"];
  const img = document.getElementById("bloqueBImagenImg");
  const preview = document.getElementById("bloqueBImagenPreview");
  const nombre = document.getElementById("bloqueBImagenNombre");
  if (driveUrl) {
    const m = driveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    const thumb = m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w500` : null;
    if (img) img.src = thumb || driveUrl;
    if (preview) preview.style.display = "block";
    if (nombre) nombre.innerHTML =
      `<a href="${driveUrl}" target="_blank" rel="noopener" style="color:#1e40af">&#128194; Ver imagen en Drive</a>` +
      ` &mdash; ${state["bloqueB-imagen-nombre"] || "imagen guardada"}`;
  } else if (localBase64) {
    if (img) img.src = localBase64;
    if (preview) preview.style.display = "block";
    if (nombre) nombre.textContent = state["bloqueB-imagen-nombre"] || "imagen adjunta";
  }
}

window.subirImagenBloqueB = async function (input) {
  const file = input.files && input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    alert("La imagen es demasiado grande (máx. 5 MB). Usa una foto más pequeña o comprímela.");
    input.value = "";
    return;
  }
  const label = document.getElementById("bloqueBImagenLabel");
  const originalLabel = label ? label.innerHTML : "";
  if (label) { label.innerHTML = "&#9203; Subiendo imagen..."; label.style.pointerEvents = "none"; }

  try {
    const delivery = window.sharedAppsScriptDelivery;
    if (!delivery || typeof delivery.uploadToAppsScript !== "function") {
      throw new Error("El sistema de entrega no está disponible.");
    }
    const identity = getDeliveryIdentityRedes();
    const usernameKey = identity.usernameKey;
    const ficha = identity.ficha || "0000";
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const fileName = `bloqueB_${ficha}_${usernameKey}_${dateStr}.${ext}`;

    const reader = new FileReader();
    const localBase64 = await new Promise((res) => { reader.onload = (e) => res(e.target.result); reader.readAsDataURL(file); });
    state["bloqueB-imagen"] = localBase64;
    state["bloqueB-imagen-nombre"] = fileName;
    saveStateRedes();
    restoreImagenBloqueB();

    const fileBase64 = localBase64.split(",").pop();
    const response = await delivery.uploadToAppsScript({
      guideLabel: "Guia 2",
      activityLabel: "Bloque B — Producto Individual",
      activityNumber: "3.2.B",
      activityTitle: "Producto Individual — Topologías de red",
      fileName,
      mimeType: file.type || "image/jpeg",
      fileBase64,
      fullName: identity.fullName || identity.usernameKey || "Aprendiz",
      ficha,
    });

    if (response && response.driveUrl) {
      state["bloqueB-imagen-url"] = response.driveUrl;
      saveStateRedes();
      await saveToCloudRedes();
      restoreImagenBloqueB();
    }

    if (label) { label.innerHTML = "&#128247; Cambiar imagen"; label.style.pointerEvents = ""; }
  } catch (err) {
    alert("Error al subir imagen: " + ((err && err.message) || "Intenta de nuevo."));
    if (label) { label.innerHTML = originalLabel; label.style.pointerEvents = ""; }
  }
};

window.guardarBloqueB = async function () {
  const empty = BLOQUEB_KEYS.filter((k) => !String(state[k] || "").trim());
  if (empty.length > 0) {
    alert("Responde las 3 preguntas antes de guardar.");
    return;
  }
  const btn = document.getElementById("btnGuardarBloqueB");
  if (btn) { btn.disabled = true; btn.textContent = "Guardando\u2026"; }
  state["bloqueB-locked"] = true;
  saveStateRedes();
  await saveToCloudRedes();
  applyBloqueBLock();
};

// ---------------------------------------------------------------------------
// Bloque C
// ---------------------------------------------------------------------------
const BLOQUEC_KEYS = ["bloqueC-1", "bloqueC-2", "bloqueC-3"];

function applyBloqueCLock() {
  const locked = Boolean(state["bloqueC-locked"]);
  document.querySelectorAll('[data-store^="bloqueC-"]').forEach((el) => {
    el.disabled = locked;
    el.style.opacity = locked ? "0.75" : "";
  });
  const btn = document.getElementById("btnGuardarBloqueC");
  if (btn) {
    btn.disabled = locked;
    btn.textContent = locked ? "\u2705 Respuestas guardadas" : "\uD83D\uDCBE Guardar respuestas";
  }
  const status = document.getElementById("bloqueCStatus");
  if (status) status.style.display = locked ? "block" : "none";
}

window.guardarBloqueC = async function () {
  const empty = BLOQUEC_KEYS.filter((k) => !String(state[k] || "").trim());
  if (empty.length > 0) {
    alert("Responde las 3 preguntas antes de guardar.");
    return;
  }
  const btn = document.getElementById("btnGuardarBloqueC");
  if (btn) { btn.disabled = true; btn.textContent = "Guardando\u2026"; }
  state["bloqueC-locked"] = true;
  saveStateRedes();
  await saveToCloudRedes();
  applyBloqueCLock();
};

// ---------------------------------------------------------------------------
// Bloque D — tab de videos
// ---------------------------------------------------------------------------
window.showVideoBloqueD = function (n) {
  const active   = "flex:1;padding:8px 12px;border-radius:8px;border:2px solid #2e7d32;cursor:pointer;font-size:0.85rem;font-weight:600;font-family:inherit;background:#2e7d32;color:#fff";
  const inactive = "flex:1;padding:8px 12px;border-radius:8px;border:2px solid #2e7d32;cursor:pointer;font-size:0.85rem;font-weight:600;font-family:inherit;background:#e8f5e9;color:#1b5e20";
  const v1 = document.getElementById("videoD-1");
  const v2 = document.getElementById("videoD-2");
  const b1 = document.getElementById("tabD-btn-1");
  const b2 = document.getElementById("tabD-btn-2");
  if (v1) v1.style.display = n === 1 ? "block" : "none";
  if (v2) v2.style.display = n === 2 ? "block" : "none";
  if (b1) b1.style.cssText = n === 1 ? active : inactive;
  if (b2) b2.style.cssText = n === 2 ? active : inactive;
};

// ---------------------------------------------------------------------------
// Bloque D
const BLOQUED_KEYS = ["bloqueD-1", "bloqueD-2", "bloqueD-3"];

function applyBloqueDLock() {
  const locked = Boolean(state["bloqueD-locked"]);
  document.querySelectorAll('[data-store^="bloqueD-"]').forEach((el) => {
    el.disabled = locked;
    el.style.opacity = locked ? "0.75" : "";
  });
  const btn = document.getElementById("btnGuardarBloqueD");
  if (btn) {
    btn.disabled = locked;
    btn.textContent = locked ? "\u2705 Respuestas guardadas" : "\uD83D\uDCBE Guardar respuestas";
  }
  const status = document.getElementById("bloqueDStatus");
  if (status) status.style.display = locked ? "block" : "none";
}

window.guardarBloqueD = async function () {
  const empty = BLOQUED_KEYS.filter((k) => !String(state[k] || "").trim());
  if (empty.length > 0) {
    alert("Responde las 3 preguntas antes de guardar.");
    return;
  }
  const btn = document.getElementById("btnGuardarBloqueD");
  if (btn) { btn.disabled = true; btn.textContent = "Guardando\u2026"; }
  state["bloqueD-locked"] = true;
  saveStateRedes();
  await saveToCloudRedes();
  applyBloqueDLock();
};

// ---------------------------------------------------------------------------
// Bloque E
// ---------------------------------------------------------------------------
const BLOQUEE_KEYS = ["bloqueE-1", "bloqueE-2", "bloqueE-3"];

function applyBloqueELock() {
  const locked = Boolean(state["bloqueE-locked"]);
  document.querySelectorAll('[data-store^="bloqueE-"]').forEach((el) => {
    el.disabled = locked;
    el.style.opacity = locked ? "0.75" : "";
  });
  const input = document.getElementById("bloqueEImagenInput");
  if (input) input.disabled = locked;
  const label = document.getElementById("bloqueEImagenLabel");
  if (label) {
    label.style.opacity = locked ? "0.5" : "";
    label.style.pointerEvents = locked ? "none" : "";
  }
  const btn = document.getElementById("btnGuardarBloqueE");
  if (btn) {
    btn.disabled = locked;
    btn.textContent = locked ? "\u2705 Respuestas guardadas" : "\uD83D\uDCBE Guardar respuestas";
  }
  const status = document.getElementById("bloqueEStatus");
  if (status) status.style.display = locked ? "block" : "none";
}

function restoreImagenBloqueE() {
  const driveUrl = state["bloqueE-imagen-url"];
  const localBase64 = state["bloqueE-imagen"];
  const img = document.getElementById("bloqueEImagenImg");
  const preview = document.getElementById("bloqueEImagenPreview");
  const nombre = document.getElementById("bloqueEImagenNombre");
  if (driveUrl) {
    const m = driveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    const thumb = m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w500` : null;
    if (img) img.src = thumb || driveUrl;
    if (preview) preview.style.display = "block";
    if (nombre) nombre.innerHTML =
      `<a href="${driveUrl}" target="_blank" rel="noopener" style="color:#1e40af">&#128194; Ver imagen en Drive</a>` +
      ` &mdash; ${state["bloqueE-imagen-nombre"] || "imagen guardada"}`;
  } else if (localBase64) {
    if (img) img.src = localBase64;
    if (preview) preview.style.display = "block";
    if (nombre) nombre.textContent = state["bloqueE-imagen-nombre"] || "imagen adjunta";
  }
}

window.subirImagenBloqueE = async function (input) {
  const file = input.files && input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    alert("La imagen es demasiado grande (máx. 5 MB). Usa una foto más pequeña o comprímela.");
    input.value = "";
    return;
  }
  const label = document.getElementById("bloqueEImagenLabel");
  const originalLabel = label ? label.innerHTML : "";
  if (label) { label.innerHTML = "&#9203; Subiendo imagen..."; label.style.pointerEvents = "none"; }

  try {
    const delivery = window.sharedAppsScriptDelivery;
    if (!delivery || typeof delivery.uploadToAppsScript !== "function") {
      throw new Error("El sistema de entrega no está disponible.");
    }
    const identity = getDeliveryIdentityRedes();
    const usernameKey = identity.usernameKey;
    const ficha = identity.ficha || "0000";
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const fileName = `bloqueE_${ficha}_${usernameKey}_${dateStr}.${ext}`;

    const reader = new FileReader();
    const localBase64 = await new Promise((res) => { reader.onload = (e) => res(e.target.result); reader.readAsDataURL(file); });
    state["bloqueE-imagen"] = localBase64;
    state["bloqueE-imagen-nombre"] = fileName;
    saveStateRedes();
    restoreImagenBloqueE();

    const fileBase64 = localBase64.split(",").pop();
    const response = await delivery.uploadToAppsScript({
      guideLabel: "Guia 2",
      activityLabel: "Bloque E — Producto Individual",
      activityNumber: "3.2.1.E",
      activityTitle: "Producto Individual — Diagrama OSI",
      fileName,
      mimeType: file.type || "image/jpeg",
      fileBase64,
      fullName: identity.fullName || identity.usernameKey || "Aprendiz",
      ficha,
    });

    if (response && response.driveUrl) {
      state["bloqueE-imagen-url"] = response.driveUrl;
      saveStateRedes();
      await saveToCloudRedes();
      restoreImagenBloqueE();
    }

    if (label) { label.innerHTML = "&#128247; Cambiar imagen"; label.style.pointerEvents = ""; }
  } catch (err) {
    alert("Error al subir imagen: " + ((err && err.message) || "Intenta de nuevo."));
    if (label) { label.innerHTML = originalLabel; label.style.pointerEvents = ""; }
  }
};

window.guardarBloqueE = async function () {
  const empty = BLOQUEE_KEYS.filter((k) => !String(state[k] || "").trim());
  if (empty.length > 0) {
    alert("Responde las 3 preguntas antes de guardar.");
    return;
  }
  const btn = document.getElementById("btnGuardarBloqueE");
  if (btn) { btn.disabled = true; btn.textContent = "Guardando\u2026"; }
  state["bloqueE-locked"] = true;
  saveStateRedes();
  await saveToCloudRedes();
  applyBloqueELock();
};

// ---------------------------------------------------------------------------
// Exportar Word 3.2.1 — Exploración Contextual
// ---------------------------------------------------------------------------
async function _loadScriptBlob(url) {
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error("Error al descargar librería de Word.");
  }
  const scriptText = await response.text();

  await new Promise((resolve, reject) => {
    const blobUrl = URL.createObjectURL(new Blob([scriptText], { type: "text/javascript" }));
    const s = document.createElement("script");
    s.src = blobUrl;
    s.onload = function () {
      URL.revokeObjectURL(blobUrl);
      resolve();
    };
    s.onerror = function () {
      URL.revokeObjectURL(blobUrl);
      reject(new Error("Error al cargar librería de Word."));
    };
    document.head.appendChild(s);
  });
}

window.exportarWordContextualizacion = async function (evt) {
  const btn = evt && evt.currentTarget ? evt.currentTarget
    : document.querySelector('[onclick*="exportarWordContextualizacion"]');
  const origHTML = btn ? btn.innerHTML : "";
  if (btn) { btn.disabled = true; btn.innerHTML = "&#9203; Generando Word\u2026"; }

  try {
    if (!window.docx) {
      await _loadScriptBlob("https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.min.js");
    }

    const identity = getDeliveryIdentityRedes();
    const fullName = identity.fullName || identity.usernameKey || "Aprendiz";
    const ficha    = identity.ficha || "0000";
    const grupo    = identity.grupo || document.body.dataset.defaultGrupo || "";
    const institucion = identity.inst || document.body.dataset.defaultInst || "";
    const fecha    = new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
    const fileName = `Exploracion_Contextual_${fullName.replace(/\s+/g, "_")}_${ficha}.docx`;

    function val(key) { return String(state[key] || "").trim() || "(sin respuesta)"; }

    const { Document, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ImageRun, Packer } = window.docx;

    function makeBlockTitle(num, title) {
      return new Paragraph({
        children: [new TextRun({ text: `${num} \u2014 ${title}`, bold: true, size: 24, font: "Times New Roman", color: "1B5E20" })],
        spacing: { before: 320, after: 120 },
      });
    }

    function makeQuestion(q, key) {
      return [
        new Paragraph({
          children: [new TextRun({ text: q, bold: true, size: 24, font: "Times New Roman", color: "475569" })],
          spacing: { before: 120, after: 60 },
        }),
        new Paragraph({
          children: [new TextRun({ text: val(key), size: 24, font: "Times New Roman" })],
          indent: { left: 300 },
          spacing: { after: 140 },
        }),
      ];
    }

    function makeProductLabel(label) {
      return new Paragraph({
        children: [new TextRun({ text: `Producto \u2014 ${label}`, bold: true, size: 24, font: "Times New Roman", color: "1E40AF" })],
        spacing: { before: 200, after: 80 },
      });
    }

    async function makeImageParagraph(b64Key) {
      const b64Full = state[b64Key];
      if (!b64Full) {
        return new Paragraph({
          children: [new TextRun({ text: "(Sin imagen adjunta)", italics: true, size: 24, font: "Times New Roman", color: "94A3B8" })],
          spacing: { after: 160 },
        });
      }
      try {
        const b64Data = b64Full.split(",").pop();
        const binary = atob(b64Data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return new Paragraph({
          children: [new ImageRun({ data: bytes, transformation: { width: 400, height: 220 } })],
          spacing: { after: 200 },
        });
      } catch (_) {
        return new Paragraph({
          children: [new TextRun({ text: "(Imagen no disponible)", italics: true, size: 24, font: "Times New Roman", color: "94A3B8" })],
          spacing: { after: 160 },
        });
      }
    }

    function makeTable(head, rows) {
      return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            tableHeader: true,
            children: head.map(h => new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, font: "Times New Roman" })] })],
            })),
          }),
          ...rows.map(row => new TableRow({
            children: row.map(cell => new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: cell, size: 20, font: "Times New Roman" })] })],
            })),
          })),
        ],
      });
    }

    async function makeSenaLogoParagraph() {
      try {
        const response = await fetch(getSenaLogoUrlRedes(), { cache: "force-cache" });
        if (!response.ok) throw new Error("No logo");
        const data = new Uint8Array(await response.arrayBuffer());
        return new Paragraph({
          children: [new ImageRun({ data, transformation: { width: 72, height: 72 } })],
          spacing: { after: 100 },
        });
      } catch (_) {
        return new Paragraph({
          children: [new TextRun({ text: "SENA", bold: true, size: 24, font: "Times New Roman", color: "1B5E20" })],
          spacing: { after: 100 },
        });
      }
    }

    function makeInstitutionalDocxRows() {
      return [
        ["Programa", REDES_WORD_METADATA.program, "Fecha de elaboracion", fecha],
        ["Guia / actividad", `${REDES_WORD_METADATA.guideName} - Actividad 3.2.1`, "Numero de ficha", ficha],
        ["Competencia", REDES_WORD_METADATA.competencia, "Grado", grupo],
        ["Resultado de Aprendizaje", REDES_WORD_METADATA.resultado, "Institucion", institucion],
        ["Nombre completo del aprendiz", fullName, "", ""],
      ].map((row) => new TableRow({
        children: row.map((cell, index) => new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: cell, bold: index % 2 === 0 && cell !== "", size: 20, font: "Times New Roman" })],
          })],
        })),
      }));
    }

    const imgA = await makeImageParagraph("bloqueA-imagen");
    const imgB = await makeImageParagraph("bloqueB-imagen");
    const imgE = await makeImageParagraph("bloqueE-imagen");
    const senaLogoParagraph = await makeSenaLogoParagraph();

    const doc = new Document({
      sections: [{
        children: [
          senaLogoParagraph,
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: makeInstitutionalDocxRows(),
          }),
          new Paragraph({
            children: [new TextRun({ text: "Exploracion Visual por Bloques Tematicos", bold: true, size: 28, font: "Times New Roman", color: "1B5E20" })],
            spacing: { before: 240, after: 80 },
          }),
          new Paragraph({
            children: [new TextRun({ text: `Guia 2 \u2014 Redes RAP01  |  Actividad 3.2.1`, size: 24, font: "Times New Roman", color: "475569" })],
            spacing: { after: 60 },
          }),
          new Paragraph({
            children: [new TextRun({ text: `${fullName}   |   Ficha: ${ficha}   |   Grupo: ${grupo}   |   ${fecha}`, size: 24, font: "Times New Roman", color: "64748B" })],
            spacing: { after: 240 },
          }),

          // Bloque A
          makeBlockTitle("3.2.1.A", "Tipos de redes: LAN, MAN y WAN"),
          ...makeQuestion("1. \u00bfQue tipo de red tiene la papeleria de Carmen? \u00bfPor que?", "bloqueA-1"),
          ...makeQuestion("2. \u00bfQue red usa el SENA para conectar todas sus regionales?", "bloqueA-2"),
          ...makeQuestion("3. \u00bfEn que se diferencia una LAN de una WAN en velocidad y costo?", "bloqueA-3"),
          makeProductLabel("Esquema 3 circulos concentricos"),
          imgA,

          // Bloque B
          makeBlockTitle("3.2.1.B", "Topologias de red"),
          ...makeQuestion("1. \u00bfPor que la topologia estrella es la mas usada en oficinas y MiPymes?", "bloqueB-1"),
          ...makeQuestion("2. \u00bfQue ocurre si se dana el switch central en una topologia estrella?", "bloqueB-2"),
          ...makeQuestion("3. \u00bfEn que situacion elegirias la topologia arbol en lugar de la estrella?", "bloqueB-3"),
          makeProductLabel("Diagrama de topologias"),
          imgB,

          // Bloque C
          makeBlockTitle("3.2.1.C", "Medios de transmision"),
          ...makeQuestion("1. \u00bfPor que el cable Cat6 es mejor que el Cat5e?", "bloqueC-1"),
          ...makeQuestion("2. \u00bfEn que situacion instalarias fibra optica en lugar de UTP?", "bloqueC-2"),
          ...makeQuestion("3. \u00bfCual es la distancia maxima de un cable UTP y que pasa si se supera?", "bloqueC-3"),
          makeProductLabel("Tabla comparativa de medios"),
          makeTable(
            ["Medio", "Velocidad max.", "Distancia max.", "Costo", "Interferencia", "Cuando usarlo"],
            [
              ["Cable UTP",    val("bloqueC-utp-vel"),  val("bloqueC-utp-dist"),  val("bloqueC-utp-costo"),  val("bloqueC-utp-int"),  val("bloqueC-utp-uso")],
              ["Fibra optica", val("bloqueC-fo-vel"),   val("bloqueC-fo-dist"),   val("bloqueC-fo-costo"),   val("bloqueC-fo-int"),   val("bloqueC-fo-uso")],
              ["Wi-Fi",        val("bloqueC-wifi-vel"), val("bloqueC-wifi-dist"), val("bloqueC-wifi-costo"), val("bloqueC-wifi-int"), val("bloqueC-wifi-uso")],
            ]
          ),

          // Bloque D
          makeBlockTitle("3.2.1.D", "Dispositivos de interconexion"),
          ...makeQuestion("1. \u00bfPor que el hub ya no se usa en redes modernas?", "bloqueD-1"),
          ...makeQuestion("2. \u00bfEn que capa del modelo OSI opera el switch? \u00bfY el router?", "bloqueD-2"),
          ...makeQuestion("3. \u00bfCuando necesitas un router y cuando te basta con un switch?", "bloqueD-3"),
          makeProductLabel("Cuadro comparativo de dispositivos"),
          makeTable(
            ["Dispositivo", "Capa OSI", "Funcion principal", "Cuando usarlo"],
            [
              ["Hub",          val("bloqueD-hub-capa"),    val("bloqueD-hub-func"),    val("bloqueD-hub-uso")],
              ["Switch",       val("bloqueD-switch-capa"), val("bloqueD-switch-func"), val("bloqueD-switch-uso")],
              ["Router",       val("bloqueD-router-capa"), val("bloqueD-router-func"), val("bloqueD-router-uso")],
              ["Access Point", val("bloqueD-ap-capa"),     val("bloqueD-ap-func"),     val("bloqueD-ap-uso")],
            ]
          ),

          // Bloque E
          makeBlockTitle("3.2.1.E", "Modelo OSI y TCP/IP"),
          ...makeQuestion("1. \u00bfQue hace la capa de Red (capa 3)? \u00bfQue protocolo opera en ella?", "bloqueE-1"),
          ...makeQuestion("2. \u00bfEn que capa trabaja el switch? \u00bfY el router?", "bloqueE-2"),
          ...makeQuestion("3. \u00bfQue relacion hay entre el modelo OSI y lo que ves cuando navegas?", "bloqueE-3"),
          makeProductLabel("Diagrama de 7 capas OSI"),
          imgE,
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    const file = new File([blob], fileName, {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    if (
      !window.sharedAppsScriptDelivery ||
      typeof window.sharedAppsScriptDelivery.openDeliveryModal !== "function"
    ) {
      throw new Error("El sistema de entrega no está disponible.");
    }

    window.sharedAppsScriptDelivery.openDeliveryModal({
      guideLabel: "Guia 2",
      activityLabel: "Actividad 3.2.1",
      activityNumber: "3.2.1",
      activityTitle: "Exploracion Visual por Bloques Tematicos",
      fileNamePrefix: "Exploracion_Contextual",
      learnerNameMode: "full",
    });

    setTimeout(() => {
      const fileInput = document.querySelector("[data-shared-apps-file]");
      if (!fileInput) return;
      try {
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      } catch (_) {
        // Si DataTransfer no está disponible, el modal queda abierto para selección manual.
      }
    }, 80);

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origHTML;
    }

  } catch (err) {
    alert("Error al generar el Word: " + ((err && err.message) || "Intenta de nuevo."));
    if (btn) { btn.disabled = false; btn.innerHTML = origHTML; }
  }
};

window.enviarSocializacion311 = async function () {
  if (!String(state["reflexion-socializacion"] || "").trim()) {
    alert("Escribe tus notas de la socialización antes de enviar.");
    return;
  }
  const btn = document.getElementById("btnEnviarSocializacion");
  if (btn) { btn.disabled = true; btn.textContent = "Enviando\u2026"; }

  state["reflexion-socializacion-locked"] = true;
  saveStateRedes();
  await saveToCloudRedes();
  applyReflexionSocializacionLock();
};

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------
function updateProgressRedes() {
  const tracked = Array.from(document.querySelectorAll("[data-track]")).filter(
    (field) => !field.closest("[data-ignore-progress='true']")
  );
  const checks = Array.from(document.querySelectorAll(".activity-check"));
  const total = tracked.length + checks.length;
  if (total === 0) return;

  const filledTracked = tracked.filter((f) => {
    if (f.type === "checkbox") return f.checked;
    return String(f.value || "").trim().length > 0;
  }).length;

  const filledChecks = checks.filter((c) => c.checked).length;
  const filled = filledTracked + filledChecks;
  const pct = Math.round((filled / total) * 100);

  const bar = document.getElementById("progressBar");
  const val = document.getElementById("progressValue");
  if (bar) bar.style.width = pct + "%";
  if (val) val.textContent = pct + "%";
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
function bindEventsRedes() {
  document.addEventListener("input", (e) => {
    const field = e.target.closest("[data-store]");
    if (!field) return;
    state[field.dataset.store] = field.type === "checkbox" ? field.checked : field.value;
    saveStateRedes();
    if (field.dataset.track !== undefined) updateProgressRedes();
  });

  document.addEventListener("change", (e) => {
    const field = e.target.closest("[data-store]");
    if (!field) return;
    state[field.dataset.store] = field.type === "checkbox" ? field.checked : field.value;
    saveStateRedes();
    if (field.dataset.track !== undefined) updateProgressRedes();
  });

  const glossarySearch = document.getElementById("glossarySearch");
  if (glossarySearch) {
    glossarySearch.addEventListener("input", (e) => {
      const query = e.target.value.trim().toLowerCase();
      document.querySelectorAll(".glossary-card").forEach((card) => {
        card.classList.toggle("is-hidden", Boolean(query) && !card.dataset.search.includes(query));
      });
    });
  }

  const resetBtn = document.getElementById("resetProgress");
  if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
      if (!window.confirm("Se borraran las respuestas guardadas localmente. Deseas continuar?")) return;
      window.clearGuideActivityChecks?.();
      window.clearGuideLayoutState?.();
      localStorage.removeItem(STORAGE_KEY_REDES);
      localStorage.removeItem(LEGACY_STORAGE_KEY_REDES);
      localStorage.removeItem(STORAGE_META_KEY_REDES);
      state = {};
      window.location.reload();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal-overlay.open").forEach((m) => m.classList.remove("open"));
    }
  });
}

// ---------------------------------------------------------------------------
// Cloud sync — usa _firebaseDb directamente (igual que script_guia2.js)
// ---------------------------------------------------------------------------
let _cloudSyncTimer = null;
let _cloudRefreshTimer = null;

const LOCK_KEYS_REDES = [
  "bloqueA-locked",
  "bloqueB-locked",
  "bloqueC-locked",
  "bloqueD-locked",
  "bloqueE-locked",
  "reflexion-311-locked",
  "reflexion-socializacion-locked",
  "social-locked",
  "ip1-locked",
  "ip2-locked",
  "ip3-locked",
  "taller-ip-ej1-locked",
  "taller-ip-ej2-locked",
  "taller-ip-ej3-locked",
  "lab1-locked",
  "lab2-locked",
  "lab3-locked",
];

LOCK_KEYS_REDES.push("taller-ip-ej4-locked");
LOCK_KEYS_REDES.push("taller-ip-ej5-locked");

function getCloudScopeKeyRedes() {
  const session = _portalAuth?.getCurrentSession?.();
  if (!session) return "";
  if (session.role === "admin") return `admin:${session.usernameKey || session.user?.usernameKey || "admin"}`;
  if (session.role === "student") return `student:${session.user?.usernameKey || ""}`;
  return "";
}

const IMAGE_KEYS_REDES = ["bloqueA-imagen", "bloqueB-imagen", "social-mapa", "ip1-imagen", "ip3-imagen"]; // Excluir base64 local del sync a Firebase; las URLs de Drive sí se guardan

[
  "ej4-captura",
  "lab1-ping1-image",
  "lab1-ping2-image",
  "lab1-broadcast-image",
  "lab1-ipconfig-image",
  "lab2-ping-mismo-image",
  "lab2-ping-dif-image",
  "lab2-tracert-interno-image",
  "lab2-tracert-externo-image",
  "lab3-topologia-image",
  "lab3-ping-bloques-image",
  "lab3-ping-wifi-image",
  "lab3-ipconfig-wifi-image",
].forEach((key) => IMAGE_KEYS_REDES.push(key));

function buildCloudSnapshotRedes() {
  const data = { ...state };
  IMAGE_KEYS_REDES.forEach((k) => delete data[k]);
  return { data, updatedAt: new Date().toISOString() };
}

function snapshotTimeRedes(value) {
  const parsed = Date.parse(value?.updatedAt || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function localSnapshotTimeRedes() {
  return snapshotTimeRedes(readStateMetaRedes());
}

function applyCloudSnapshotRedes(snapshot) {
  const remoteData = snapshot?.data && typeof snapshot.data === "object" ? snapshot.data : {};
  state =
    _redesLockSync && typeof _redesLockSync.syncRemoteLockFlagsRedes === "function"
      ? _redesLockSync.syncRemoteLockFlagsRedes(state, remoteData, LOCK_KEYS_REDES)
      : { ...state, ...remoteData };
  saveStateRedes({
    updatedAt: snapshot?.updatedAt || new Date().toISOString(),
  });
  hydrateFieldsRedes();
  renderQuizRedesStatus();
  updateProgressRedes();
}

function applyAllLocksRedes() {
  applyReflexionLock();
  applyReflexionSocializacionLock();
  applyBloqueALock();
  applyBloqueBLock();
  applyBloqueCLock();
  applyBloqueDLock();
  applyBloqueELock();
  applySocialLock();
  applyBloqueIP1Lock();
  applyBloqueIP2Lock();
  applyBloqueIP3Lock();
  applyTallerIPEj1Lock();
  applyTallerIPEj2Lock();
  applyTallerIPEj3Lock();
  applyTallerIPEj4Lock();
  applyTallerIPEj5Lock();
  applyLab1Lock();
  applyLab2Lock();
  applyLab3Lock();
}

function syncAuthoritativeLockFlagsFromRemoteRedes(remoteData) {
  const syncResult =
    _redesLockSync && typeof _redesLockSync.syncAuthoritativeLockFlagsOnlyRedes === "function"
      ? _redesLockSync.syncAuthoritativeLockFlagsOnlyRedes(state, remoteData, LOCK_KEYS_REDES)
      : (() => {
          const nextState = state && typeof state === "object" ? { ...state } : {};
          let changed = false;
          LOCK_KEYS_REDES.forEach((key) => {
            if (remoteData && remoteData[key]) {
              if (!nextState[key]) changed = true;
              nextState[key] = true;
              return;
            }
            if (Object.prototype.hasOwnProperty.call(nextState, key)) {
              changed = true;
              delete nextState[key];
            }
          });
          return { state: nextState, changed };
        })();

  state = syncResult.state;
  return syncResult;
}

async function saveToCloudRedes() {
  const scopeKey = getCloudScopeKeyRedes();
  if (!scopeKey || !window._firebaseDb?.cloudSaveGuideData) return false;
  try {
    return await window._firebaseDb.cloudSaveGuideData(scopeKey, GUIDE_DATA_FILE_REDES, buildCloudSnapshotRedes());
  } catch { return false; }
}

function scheduleCloudSyncRedes() {
  clearTimeout(_cloudSyncTimer);
  _cloudSyncTimer = setTimeout(saveToCloudRedes, CLOUD_SYNC_DELAY_REDES);
}

async function initCloudSyncRedes() {
  const scopeKey = getCloudScopeKeyRedes();
  if (!scopeKey || !window._firebaseDb?.cloudGetGuideData) return;
  try {
    const remote = await window._firebaseDb.cloudGetGuideData(scopeKey, GUIDE_DATA_FILE_REDES);
    if (remote?.data && Object.keys(remote.data).length > 0) {
      const lockSync = snapshotTimeRedes(remote) > localSnapshotTimeRedes()
        ? null
        : syncAuthoritativeLockFlagsFromRemoteRedes(remote.data);
      if (snapshotTimeRedes(remote) > localSnapshotTimeRedes()) {
        applyCloudSnapshotRedes(remote);
      } else {
        applyAllLocksRedes(); // aunque el local sea más nuevo, Firebase sigue mandando el estado de bloqueo
        renderQuizRedesStatus();
        updateProgressRedes();
        if (lockSync?.changed) {
          saveStateRedes({
            updatedAt: readStateMetaRedes().updatedAt || new Date().toISOString(),
          });
        } else {
          scheduleCloudSyncRedes();
        }
      }
    }
    _cloudRefreshTimer = setInterval(async () => {
      if (document.hidden) {
        return;
      }
      if (window._firebaseDb?.shouldDeferCloudReads?.()) {
        return;
      }

      try {
        const refreshed = await window._firebaseDb.cloudGetGuideData(scopeKey, GUIDE_DATA_FILE_REDES);
        if (refreshed?.data) {
          const lockSync = snapshotTimeRedes(refreshed) > localSnapshotTimeRedes()
            ? null
            : syncAuthoritativeLockFlagsFromRemoteRedes(refreshed.data);
          if (snapshotTimeRedes(refreshed) > localSnapshotTimeRedes()) {
            applyCloudSnapshotRedes(refreshed);
          } else {
            applyAllLocksRedes();
            renderQuizRedesStatus();
            updateProgressRedes();
            if (lockSync?.changed) {
              saveStateRedes({
                updatedAt: readStateMetaRedes().updatedAt || new Date().toISOString(),
              });
            }
          }
        }
      } catch {}
    }, CLOUD_REFRESH_REDES);
  } catch {}
}

// ---------------------------------------------------------------------------
// Actividad 3.1.1 — guardar / exportar / drive
// ---------------------------------------------------------------------------
const REFLEXION_311_KEYS = [
  "reflexion-1-red",
  "reflexion-2-beneficios",
  "reflexion-3-ejemplos",
  "reflexion-4-elementos",
  "reflexion-5-problemas",
];
const REFLEXION_311_LABELS = [
  "1. ¿Cómo le explicarías a la señora Carmen qué es una red y para qué sirve, en términos sencillos?",
  "2. ¿Qué beneficios concretos obtendría la papelería al tener los 3 computadores en red?",
  "3. ¿Qué redes informáticas utilizas en tu vida cotidiana? Da al menos 5 ejemplos específicos.",
  "4. ¿Qué crees que necesita una red para funcionar? Lista los elementos que imaginas que hacen falta.",
  "5. ¿Has tenido alguna vez problemas de red (internet lento, sin conexión, impresora no encontrada)? ¿Qué hiciste o qué crees que causó el problema?",
];

function applyReflexionLock() {
  const locked = Boolean(state["reflexion-311-locked"]);
  document.querySelectorAll("#reflexionForm311 [data-store]").forEach((f) => {
    f.disabled = locked;
    f.style.opacity = locked ? "0.75" : "";
  });
  const btn = document.getElementById("btnGuardarReflexion");
  if (btn) {
    btn.disabled = locked;
    btn.textContent = locked ? "✅ Respuestas enviadas" : "\uD83D\uDCBE Guardar respuestas";
  }
  const status = document.getElementById("reflexionStatus311");
  if (status) status.style.display = locked ? "block" : "none";
}

window.guardarReflexion311 = async function () {
  const empty = REFLEXION_311_KEYS.filter((k) => !String(state[k] || "").trim());
  if (empty.length > 0) {
    alert("Por favor responde todas las preguntas antes de guardar.");
    return;
  }
  const btn = document.getElementById("btnGuardarReflexion");
  if (btn) { btn.disabled = true; btn.textContent = "Guardando…"; }

  state["reflexion-311-locked"] = true;
  saveStateRedes();
  await saveToCloudRedes();
  applyReflexionLock();
};

function buildReflexion311WordFile() {
  const sel = getGuideSelectionRedes();
  const rows = REFLEXION_311_KEYS.map((k, i) => `
    <p><b>${escapeHtml(REFLEXION_311_LABELS[i])}</b></p>
    <p style="margin-left:20px;white-space:pre-wrap">${escapeHtml(String(state[k] || "(sin respuesta)"))}</p><br>`).join("");

  const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office'
    xmlns:w='urn:schemas-microsoft-com:office:word'
    xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'><title>Reflexión 3.1.1</title>
<style>body{font-family:"Times New Roman",Times,serif;font-size:12pt;line-height:2;margin:2.54cm}
h1{font-size:16pt;color:#1b5e20}h2{font-size:13pt}p{margin:6pt 0;line-height:1.5}
${buildInstitutionalWordStylesRedes()}</style>
</head><body>
${buildInstitutionalWordHeaderRedes("Actividad 3.1.1 - Reflexion Individual Escrita", sel.fullName || "Aprendiz", sel, new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" }))}
<h1>Actividad 3.1.1 – Reflexión Individual Escrita</h1>
<h2>Caso: La papelería de la señora Carmen</h2>
<p>Aprendiz: ${escapeHtml(sel.fullName || "Aprendiz")} &nbsp;|&nbsp; Institución: ${escapeHtml(sel.inst || "")} &nbsp;|&nbsp; Grupo: ${escapeHtml(sel.grupo || "")} &nbsp;|&nbsp; Ficha: ${escapeHtml(sel.ficha || "")}</p>
<hr>${rows}</body></html>`;

  const fileName = `Reflexion_311_Carmen_${sel.ficha || "sin_ficha"}.doc`;
  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  return new File([blob], fileName, { type: "application/msword" });
}

window.exportarReflexion311 = function () {
  const file = buildReflexion311WordFile();
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

window.subirReflexion311AlDrive = function () {
  const file = buildReflexion311WordFile();

  window.sharedAppsScriptDelivery.openDeliveryModal({
    guideLabel: "Guia 2",
    activityNumber: "3.1.1",
    activityTitle: "Reflexión Individual — Caso Carmen",
    activityLabel: "Actividad 3.1.1",
  });

  // Inyectar el archivo generado en el input del modal (que ya fue abierto y limpiado)
  setTimeout(() => {
    const fileInput = document.querySelector("[data-shared-apps-file]");
    if (!fileInput) return;
    try {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (_) {
      // DataTransfer no disponible: el usuario deberá seleccionar el archivo manualmente
    }
  }, 80);
};

// ---------------------------------------------------------------------------
// Generar Word combinado — Bloques IP 1–3 (3.3.1 / 3.3.2 / 3.3.3)
// ---------------------------------------------------------------------------
window.exportarWordBloques123IP = function (evt) {
  const btn = evt && evt.currentTarget ? evt.currentTarget
    : document.querySelector('[onclick*="exportarWordBloques123IP"]');
  const origHTML = btn ? btn.innerHTML : "";
  if (btn) { btn.disabled = true; btn.innerHTML = "&#9203; Generando Word\u2026"; }

  try {
    const sel = getGuideSelectionRedes();
    const fullName = sel.fullName || sel.usernameKey || "Aprendiz";
    const ficha    = sel.ficha || "0000";

    function val(key) { return escapeHtml(String(state[key] || "(sin respuesta)")); }

    // ---- Bloque 1 ----
    const b1Labels = [
      "1. Una direcci\u00f3n IP tiene 4 n\u00fameros separados por puntos (ej. 192.168.1.10). \u00bfQu\u00e9 representa cada n\u00famero?",
      "2. \u00bfQu\u00e9 significa que una direcci\u00f3n IP tiene una parte de red y una parte de host?",
      "3. \u00bfPor qu\u00e9 no puede haber dos dispositivos con la misma IP en la misma red?",
    ];
    const b1Rows = BLOQUE_IP1_KEYS.map((k, i) => `
      <p><b>${b1Labels[i]}</b></p>
      <p style="margin-left:20px;white-space:pre-wrap">${val(k)}</p><br>`).join("");
    const b1Img = state["ip1-imagen-url"]
      ? `<h3>Producto \u2014 Diagrama IPv4</h3><p><a href="${state["ip1-imagen-url"]}">Ver diagrama en Drive</a></p>`
      : "<h3>Producto \u2014 Diagrama IPv4</h3><p><i>(Sin imagen adjunta)</i></p>";

    // ---- Bloque 2 ----
    const b2Labels = [
      "1. \u00bfC\u00f3mo sabes con solo mirar el primer n\u00famero si una IP es Clase A, B o C?",
      "2. \u00bfPor qu\u00e9 las MiPymes casi siempre usan direcciones Clase C?",
      "3. \u00bfQu\u00e9 son las direcciones privadas y por qu\u00e9 no se pueden usar en internet directamente?",
    ];
    const b2Rows = ["ip2-1", "ip2-2", "ip2-3"].map((k, i) => `
      <p><b>${b2Labels[i]}</b></p>
      <p style="margin-left:20px;white-space:pre-wrap">${val(k)}</p><br>`).join("");
    const b2Table = [
      ["A", "ip2-claseA-mask", "ip2-claseA-hosts", "ip2-claseA-uso"],
      ["B", "ip2-claseB-mask", "ip2-claseB-hosts", "ip2-claseB-uso"],
      ["C", "ip2-claseC-mask", "ip2-claseC-hosts", "ip2-claseC-uso"],
    ].map(([cls, mask, hosts, uso]) =>
      `<tr><td><b>${cls}</b></td><td>${val(mask)}</td><td>${val(hosts)}</td><td>${val(uso)}</td></tr>`
    ).join("");

    // ---- Bloque 3 ----
    const b3Labels = [
      "1. \u00bfQu\u00e9 pasar\u00eda si configuras mal el gateway en un computador? \u00bfPodr\u00edas navegar en internet?",
      "2. \u00bfPara qu\u00e9 sirve el DNS? \u00bfQu\u00e9 pasar\u00eda si no existiera y tuvieras que recordar las IPs de todos los sitios?",
      "3. \u00bfPuede un computador funcionar en red local sin tener configurado el DNS? \u00bfPor qu\u00e9?",
    ];
    const b3Rows = BLOQUE_IP3_KEYS.map((k, i) => `
      <p><b>${b3Labels[i]}</b></p>
      <p style="margin-left:20px;white-space:pre-wrap">${val(k)}</p><br>`).join("");
    const b3Img = state["ip3-imagen-url"]
      ? `<h3>Producto \u2014 Diagrama de par\u00e1metros de red</h3><p><a href="${state["ip3-imagen-url"]}">Ver diagrama en Drive</a></p>`
      : "<h3>Producto \u2014 Diagrama de par\u00e1metros de red</h3><p><i>(Sin imagen adjunta)</i></p>";

    const fecha = new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:w='urn:schemas-microsoft-com:office:word'
      xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'><title>Bloques IP 1-3</title>
<style>body{font-family:"Times New Roman",Times,serif;font-size:12pt;line-height:2;margin:2.54cm}
h1{font-size:16pt;color:#1b5e20}h2{font-size:13pt;color:#1b5e20;border-bottom:1px solid #c8e6c9;padding-bottom:4pt}
h3{font-size:11pt;color:#1e40af}p{margin:6pt 0;line-height:1.5}
table{border-collapse:collapse;width:100%;max-width:100%;table-layout:fixed;overflow-wrap:break-word;word-break:break-word}th,td{border:1px solid #ccc;padding:5pt;font-size:10pt;line-height:1.35}
th{background:#c8e6c9}
${buildInstitutionalWordStylesRedes()}</style>
</head><body>
${buildInstitutionalWordHeaderRedes("Actividad 3.3 - Direccionamiento IP (Bloques 1-3)", fullName, sel, fecha)}
<h1>Actividad 3.3 \u2013 Direccionamiento IP (Bloques 1\u20133)</h1>
<p>Aprendiz: <b>${escapeHtml(fullName)}</b> &nbsp;|&nbsp; Ficha: ${escapeHtml(ficha)} &nbsp;|&nbsp; Grupo: ${escapeHtml(sel.grupo || "")} &nbsp;|&nbsp; ${fecha}</p>
<hr>
<h2>Bloque 1 (3.3.1) \u2014 Estructura de una direcci\u00f3n IPv4</h2>
${b1Rows}${b1Img}
<h2>Bloque 2 (3.3.2) \u2014 Clases de IP y direcciones privadas</h2>
${b2Rows}
<h3>Tabla de referencia r\u00e1pida de clases IP</h3>
<table>
  <tr style="background:#c8e6c9"><th>Clase</th><th>M\u00e1scara</th><th>Hosts posibles</th><th>Uso t\u00edpico</th></tr>
  ${b2Table}
</table><br>
<h2>Bloque 3 (3.3.3) \u2014 Par\u00e1metros de red: IP, m\u00e1scara, gateway y DNS</h2>
${b3Rows}${b3Img}
</body></html>`;

    const fileName = `BloqueIP_1-3_${escapeHtml(fullName).replace(/\s+/g, "_")}_${ficha}.doc`;
    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const file = new File([blob], fileName, { type: "application/msword" });

    window.sharedAppsScriptDelivery.openDeliveryModal({
      guideLabel: "Guia 2",
      activityNumber: "3.3",
      activityTitle: "Direccionamiento IP \u2014 Bloques 1\u20133",
      activityLabel: "Actividad 3.3",
    });
    setTimeout(() => {
      const fileInput = document.querySelector("[data-shared-apps-file]");
      if (!fileInput) return;
      try { const dt = new DataTransfer(); dt.items.add(file); fileInput.files = dt.files; fileInput.dispatchEvent(new Event("change", { bubbles: true })); } catch (_) {}
    }, 80);

    if (btn) { btn.disabled = false; btn.innerHTML = origHTML; }
  } catch (err) {
    alert("Error al generar el Word: " + ((err && err.message) || "Intenta de nuevo."));
    if (btn) { btn.disabled = false; btn.innerHTML = origHTML; }
  }
};

// ---------------------------------------------------------------------------
// Bloque IP2 — Clases de IP y direcciones privadas (3.3.2)
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Generar Word final - Taller IP completo (Ejercicios 1-5)
// ---------------------------------------------------------------------------
window.exportarWordTallerIP = function (evt) {
  const btn = evt && evt.currentTarget ? evt.currentTarget
    : document.querySelector('[onclick*="exportarWordTallerIP"]');
  const origHTML = btn ? btn.innerHTML : "";
  if (btn) { btn.disabled = true; btn.innerHTML = "&#9203; Generando Word\u2026"; }

  try {
    const identity = getDeliveryIdentityRedes();
    const fullName = identity.fullName || identity.usernameKey || "Aprendiz";
    const ficha = identity.ficha || "0000";
    const grupo = identity.grupo || document.body.dataset.defaultGrupo || "";
    const institucion = identity.institucion || document.body.dataset.defaultInst || "";
    const fecha = new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
    const allExerciseKeys = [
      ...TALLER_IP_EJ1_KEYS,
      ...TALLER_IP_EJ2_KEYS,
      ...TALLER_IP_EJ3_KEYS,
      ...TALLER_IP_EJ4_KEYS,
      ...TALLER_IP_EJ5_KEYS,
    ];
    const missingKeys = allExerciseKeys.filter((key) => !String(state[key] || "").trim());

    if (missingKeys.length > 0) {
      throw new Error("Completa todos los ejercicios del 1 al 5 antes de generar la entrega final.");
    }
    if (!state["ej4-captura-url"] && !state["ej4-captura"]) {
      throw new Error("Primero sube el pantallazo de ipconfig /all del Ejercicio 4.");
    }

    function val(key) {
      return escapeHtml(String(state[key] || "(sin respuesta)"));
    }

    const learnerFileLabel = String(fullName || "Aprendiz")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "Aprendiz";

    const ej1Rows = [
      ["10.5.20.1", "ej1-a-clase", "ej1-a-mask"],
      ["172.20.0.1", "ej1-b-clase", "ej1-b-mask"],
      ["192.168.1.50", "ej1-c-clase", "ej1-c-mask"],
      ["200.14.5.3", "ej1-d-clase", "ej1-d-mask"],
    ].map(([ip, claseKey, maskKey]) =>
      `<tr><td>${ip}</td><td>${val(claseKey)}</td><td>${val(maskKey)}</td></tr>`
    ).join("");

    const ej3Rows = [
      ["Computador 1 - Caja", "ej3-pc1"],
      ["Computador 2 - Administracion", "ej3-pc2"],
      ["Computador 3 - Bodega", "ej3-pc3"],
      ["Computador 4 - Punto de Venta", "ej3-pc4"],
      ["Computador 5 - Gerencia", "ej3-pc5"],
      ["Computador 6 - Ventas", "ej3-pc6"],
      ["Impresora de red", "ej3-print"],
      ["Camara IP", "ej3-cam"],
    ].map(([device, key]) =>
      `<tr><td>${device}</td><td>${val(key)}</td><td>255.255.255.0</td></tr>`
    ).join("");

    const ej5Rows = [
      ["Miscelanea Lucia - Tunja", "50 dispositivos", "ej5-lucia-clase", "ej5-lucia-just"],
      ["Empresa de transporte regional", "500 dispositivos", "ej5-trans-clase", "ej5-trans-just"],
      ["Corporacion con sedes en todo el pais", "3.000 dispositivos", "ej5-corp-clase", "ej5-corp-just"],
    ].map(([company, devices, classKey, justKey]) =>
      `<tr><td>${company}</td><td>${devices}</td><td>${val(classKey)}</td><td>${val(justKey)}</td></tr>`
    ).join("");

    const screenshotBlock = state["ej4-captura"]
      ? `<p><b>Pantallazo ipconfig /all:</b></p><p><img src="${state["ej4-captura"]}" alt="Pantallazo ipconfig" style="max-width:580px;border:1px solid #c8e6c9;border-radius:8px"></p>`
      : `<p><b>Pantallazo ipconfig /all:</b> <a href="${escapeHtml(state["ej4-captura-url"] || "")}">Ver pantallazo en Drive</a></p>`;

    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:w='urn:schemas-microsoft-com:office:word'
      xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'><title>Taller IP</title>
<style>
body{font-family:"Times New Roman",Times,serif;font-size:12pt;line-height:2;margin:2.54cm;color:#263238}
h1{font-size:16pt;color:#1b5e20}h2{font-size:13pt;color:#1b5e20;border-bottom:1px solid #c8e6c9;padding-bottom:4pt}
h3{font-size:11pt;color:#1e40af}p{margin:6pt 0;line-height:1.5}
table{border-collapse:collapse;width:100%;max-width:100%;table-layout:fixed;overflow-wrap:break-word;word-break:break-word;margin-top:8pt}th,td{border:1px solid #ccc;padding:6pt;font-size:10pt;line-height:1.35;vertical-align:top}
th{background:#c8e6c9}
${buildInstitutionalWordStylesRedes()}
</style>
</head><body>
${buildInstitutionalWordHeaderRedes("Actividad 3.3.4 - Taller IP (Ejercicios 1-5)", fullName, identity, fecha)}
<h1>Actividad 3.3.4 - Taller IP (Ejercicios 1-5)</h1>
<p>Aprendiz: <b>${escapeHtml(fullName)}</b> &nbsp;|&nbsp; Ficha: ${escapeHtml(ficha)} &nbsp;|&nbsp; Grupo: ${escapeHtml(grupo)} &nbsp;|&nbsp; ${fecha}</p>
<p>Institucion: ${escapeHtml(institucion)}</p>
<hr>

<h2>Ejercicio 1 — Identificar clases de direcciones IP</h2>
<table>
  <tr><th>Direccion IP</th><th>Clase</th><th>Mascara por defecto</th></tr>
  ${ej1Rows}
</table>

<h2>Ejercicio 2 — Analizar una direccion IP</h2>
<p><b>Caso base:</b> IP 192.168.10.45 &nbsp;|&nbsp; Mascara 255.255.255.0</p>
<p><b>¿A que clase pertenece?</b></p>
<p style="margin-left:20px;white-space:pre-wrap">${val("ej2-clase")}</p>
<p><b>¿Cual es la parte de red y cual es la parte del host?</b></p>
<p style="margin-left:20px;white-space:pre-wrap">${val("ej2-red-host")}</p>
<p><b>¿Cuantos hosts puede tener esta red?</b></p>
<p style="margin-left:20px;white-space:pre-wrap">${val("ej2-hosts")}</p>
<p><b>¿Es una IP privada o publica? ¿Como lo sabe?</b></p>
<p style="margin-left:20px;white-space:pre-wrap">${val("ej2-privada")}</p>

<h2>Ejercicio 3 — Asignacion de IP a la Ferretera El Tornillo</h2>
<p><b>Red:</b> 192.168.1.0 &nbsp;|&nbsp; <b>Mascara:</b> 255.255.255.0 &nbsp;|&nbsp; <b>Gateway:</b> 192.168.1.1</p>
<table>
  <tr><th>Dispositivo</th><th>IP asignada</th><th>Mascara</th></tr>
  ${ej3Rows}
</table>
<p><b>Justificacion:</b></p>
<p style="margin-left:20px;white-space:pre-wrap">${val("ej3-justifica")}</p>

<h2>Ejercicio 4 — Verificar parametros de red en tu computador</h2>
${screenshotBlock}
<p><b>Direccion IPv4 que aparece - ¿para que sirve?</b></p>
<p style="margin-left:20px;white-space:pre-wrap">${val("ej4-ipv4")}</p>
<p><b>Mascara de subred - ¿para que sirve?</b></p>
<p style="margin-left:20px;white-space:pre-wrap">${val("ej4-mask")}</p>
<p><b>Puerta de enlace predeterminada - ¿para que sirve?</b></p>
<p style="margin-left:20px;white-space:pre-wrap">${val("ej4-gw")}</p>
<p><b>Servidores DNS - ¿para que sirven?</b></p>
<p style="margin-left:20px;white-space:pre-wrap">${val("ej4-dns")}</p>

<h2>Ejercicio 5 — Elegir la clase de IP correcta para cada caso</h2>
<table>
  <tr><th>Empresa</th><th>N. de dispositivos</th><th>Clase elegida</th><th>Justificacion</th></tr>
  ${ej5Rows}
</table>
</body></html>`;

    const fileName = `Taller_IP_${learnerFileLabel}_${ficha}.doc`;
    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const file = new File([blob], fileName, { type: "application/msword" });

    if (
      !window.sharedAppsScriptDelivery ||
      typeof window.sharedAppsScriptDelivery.openDeliveryModal !== "function"
    ) {
      throw new Error("El sistema de entrega no está disponible.");
    }

    window.sharedAppsScriptDelivery.openDeliveryModal({
      guideLabel: "Guia 2",
      activityNumber: "3.3.4",
      activityTitle: "Actividad 3.3.4 — Taller IP (Ejercicios 1–5)",
      activityLabel: "Actividad 3.3.4",
      fileNamePrefix: "Taller_IP",
      learnerNameMode: "full",
    });
    setTimeout(() => {
      const fileInput = document.querySelector("[data-shared-apps-file]");
      if (!fileInput) return;
      try {
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      } catch (_) {}
    }, 80);

    if (btn) { btn.disabled = false; btn.innerHTML = origHTML; }
  } catch (err) {
    alert("Error al generar el Word: " + ((err && err.message) || "Intenta de nuevo."));
    if (btn) { btn.disabled = false; btn.innerHTML = origHTML; }
  }
};

const BLOQUE_IP2_KEYS = [
  "ip2-1", "ip2-2", "ip2-3",
  "ip2-claseA-mask", "ip2-claseA-hosts", "ip2-claseA-uso",
  "ip2-claseB-mask", "ip2-claseB-hosts", "ip2-claseB-uso",
  "ip2-claseC-mask", "ip2-claseC-hosts", "ip2-claseC-uso",
];

function applyBloqueIP2Lock() {
  const locked = Boolean(state["ip2-locked"]);
  document.querySelectorAll("[data-store^='ip2-']").forEach((el) => {
    el.disabled = locked;
    el.style.opacity = locked ? "0.75" : "";
  });
  const btn = document.getElementById("btnGuardarIP2");
  if (btn) {
    btn.disabled = locked;
    btn.textContent = locked ? "\u2705 Respuestas guardadas" : "\uD83D\uDCBE Guardar respuestas";
  }
  const status = document.getElementById("ip2Status");
  if (status) status.style.display = locked ? "block" : "none";
}

window.guardarBloqueIP2 = async function () {
  const empty = ["ip2-1", "ip2-2", "ip2-3"].filter((k) => !String(state[k] || "").trim());
  if (empty.length > 0) {
    alert("Responde las 3 preguntas antes de guardar.");
    return;
  }
  const btn = document.getElementById("btnGuardarIP2");
  if (btn) { btn.disabled = true; btn.textContent = "Guardando\u2026"; }
  state["ip2-locked"] = true;
  saveStateRedes();
  await saveToCloudRedes();
  applyBloqueIP2Lock();
};

// ---------------------------------------------------------------------------
// Taller IP — Ejercicio 1 (3.3.4)
// ---------------------------------------------------------------------------
const TALLER_IP_EJ1_KEYS = [
  "ej1-a-clase",
  "ej1-a-mask",
  "ej1-b-clase",
  "ej1-b-mask",
  "ej1-c-clase",
  "ej1-c-mask",
  "ej1-d-clase",
  "ej1-d-mask",
];

function applyTallerIPEj1Lock() {
  const locked = Boolean(state["taller-ip-ej1-locked"]);
  document.querySelectorAll("[data-store^='ej1-']").forEach((el) => {
    el.disabled = locked;
    el.style.opacity = locked ? "0.75" : "";
  });
  const btn = document.getElementById("btnGuardarTallerIPEj1");
  if (btn) {
    btn.disabled = locked;
    btn.textContent = locked ? "\u2705 Respuestas guardadas" : "\uD83D\uDCBE Guardar respuestas";
  }
  const status = document.getElementById("tallerIPEj1Status");
  if (status) status.style.display = locked ? "block" : "none";
}

window.guardarTallerIPEj1 = async function () {
  const empty = TALLER_IP_EJ1_KEYS.filter((k) => !String(state[k] || "").trim());
  if (empty.length > 0) {
    alert("Completa todas las respuestas del Ejercicio 1 antes de guardar.");
    return;
  }
  const btn = document.getElementById("btnGuardarTallerIPEj1");
  if (btn) { btn.disabled = true; btn.textContent = "Guardando\u2026"; }
  state["taller-ip-ej1-locked"] = true;
  saveStateRedes();
  await saveToCloudRedes();
  applyTallerIPEj1Lock();
};

const TALLER_IP_EJ2_KEYS = [
  "ej2-clase",
  "ej2-red-host",
  "ej2-hosts",
  "ej2-privada",
];

function applyTallerIPEj2Lock() {
  const locked = Boolean(state["taller-ip-ej2-locked"]);
  document.querySelectorAll("[data-store^='ej2-']").forEach((el) => {
    el.disabled = locked;
    el.style.opacity = locked ? "0.75" : "";
  });
  const btn = document.getElementById("btnGuardarTallerIPEj2");
  if (btn) {
    btn.disabled = locked;
    btn.textContent = locked ? "\u2705 Respuestas guardadas" : "\uD83D\uDCBE Guardar respuestas";
  }
  const status = document.getElementById("tallerIPEj2Status");
  if (status) status.style.display = locked ? "block" : "none";
}

window.guardarTallerIPEj2 = async function () {
  const empty = TALLER_IP_EJ2_KEYS.filter((k) => !String(state[k] || "").trim());
  if (empty.length > 0) {
    alert("Completa todas las respuestas del Ejercicio 2 antes de guardar.");
    return;
  }
  const btn = document.getElementById("btnGuardarTallerIPEj2");
  if (btn) { btn.disabled = true; btn.textContent = "Guardando\u2026"; }
  state["taller-ip-ej2-locked"] = true;
  saveStateRedes();
  await saveToCloudRedes();
  applyTallerIPEj2Lock();
};

const TALLER_IP_EJ3_KEYS = [
  "ej3-pc1",
  "ej3-pc2",
  "ej3-pc3",
  "ej3-pc4",
  "ej3-pc5",
  "ej3-pc6",
  "ej3-print",
  "ej3-cam",
  "ej3-justifica",
];

function applyTallerIPEj3Lock() {
  const locked = Boolean(state["taller-ip-ej3-locked"]);
  document.querySelectorAll("[data-store^='ej3-']").forEach((el) => {
    el.disabled = locked;
    el.style.opacity = locked ? "0.75" : "";
  });
  const btn = document.getElementById("btnGuardarTallerIPEj3");
  if (btn) {
    btn.disabled = locked;
    btn.textContent = locked ? "\u2705 Respuestas guardadas" : "\uD83D\uDCBE Guardar respuestas";
  }
  const status = document.getElementById("tallerIPEj3Status");
  if (status) status.style.display = locked ? "block" : "none";
}

window.guardarTallerIPEj3 = async function () {
  const empty = TALLER_IP_EJ3_KEYS.filter((k) => !String(state[k] || "").trim());
  if (empty.length > 0) {
    alert("Completa todas las respuestas del Ejercicio 3 antes de guardar.");
    return;
  }
  const btn = document.getElementById("btnGuardarTallerIPEj3");
  if (btn) { btn.disabled = true; btn.textContent = "Guardando\u2026"; }
  state["taller-ip-ej3-locked"] = true;
  saveStateRedes();
  await saveToCloudRedes();
  applyTallerIPEj3Lock();
};

const TALLER_IP_EJ4_KEYS = ["ej4-ipv4", "ej4-mask", "ej4-gw", "ej4-dns"];

function applyTallerIPEj4Lock() {
  const locked = Boolean(state["taller-ip-ej4-locked"]);
  document.querySelectorAll("[data-store^='ej4-']").forEach((el) => {
    el.disabled = locked;
    el.style.opacity = locked ? "0.75" : "";
  });
  const input = document.getElementById("ej4CapturaInput");
  if (input) input.disabled = locked;
  const uploadBtn = document.getElementById("btnSubirTallerIPEj4");
  if (uploadBtn) {
    uploadBtn.disabled = locked;
    uploadBtn.textContent = locked ? "\u2705 Pantallazo cargado" : "\uD83D\uDCF8 Subir pantallazo de ipconfig /all";
    uploadBtn.style.opacity = locked ? "0.7" : "";
    uploadBtn.style.pointerEvents = locked ? "none" : "";
  }
  const btn = document.getElementById("btnGuardarTallerIPEj4");
  if (btn) {
    btn.disabled = locked;
    btn.textContent = locked ? "\u2705 Respuestas guardadas" : "\uD83D\uDCBE Guardar respuestas";
  }
  const status = document.getElementById("tallerIPEj4Status");
  if (status) status.style.display = locked ? "block" : "none";
}

function restorePantallazoTallerIPEj4() {
  const driveUrl = state["ej4-captura-url"];
  const localBase64 = state["ej4-captura"];
  const img = document.getElementById("tallerIPEj4Img");
  const preview = document.getElementById("tallerIPEj4Preview");
  const nombre = document.getElementById("tallerIPEj4Nombre");
  const uploadBtn = document.getElementById("btnSubirTallerIPEj4");
  if (driveUrl) {
    const thumb = _getDriveThumbnailUrl(driveUrl);
    if (img) img.src = thumb || driveUrl;
    if (preview) preview.style.display = "block";
    if (nombre) {
      nombre.innerHTML = `<a href="${driveUrl}" target="_blank" rel="noopener">Ver pantallazo en Drive</a> \u2014 ${state["ej4-captura-nombre"] || "pantallazo adjunto"}`;
    }
    if (uploadBtn && !state["taller-ip-ej4-locked"]) uploadBtn.innerHTML = "&#128247; Cambiar pantallazo";
    return;
  }
  if (localBase64) {
    if (img) img.src = localBase64;
    if (preview) preview.style.display = "block";
    if (nombre) nombre.textContent = state["ej4-captura-nombre"] || "pantallazo adjunto";
    if (uploadBtn && !state["taller-ip-ej4-locked"]) uploadBtn.innerHTML = "&#128247; Cambiar pantallazo";
  }
}

window.subirPantallazoTallerIPEj4 = async function (input) {
  const file = input.files && input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    alert("La imagen es demasiado grande (m\u00e1x. 5 MB). Usa un pantallazo m\u00e1s liviano.");
    input.value = "";
    return;
  }
  const uploadBtn = document.getElementById("btnSubirTallerIPEj4");
  const originalLabel = uploadBtn ? uploadBtn.innerHTML : "";
  if (uploadBtn) {
    uploadBtn.innerHTML = "&#9203; Subiendo pantallazo...";
    uploadBtn.style.pointerEvents = "none";
  }
  try {
    const delivery = window.sharedAppsScriptDelivery;
    if (!delivery || typeof delivery.uploadToAppsScript !== "function") {
      throw new Error("El sistema de entrega no est\u00e1 disponible.");
    }
    const identity = getDeliveryIdentityRedes();
    const usernameKey = identity.usernameKey;
    const ficha = identity.ficha || "0000";
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const fileName = `ej4_ipconfig_${ficha}_${usernameKey}_${dateStr}.${ext}`;

    const reader = new FileReader();
    const localBase64 = await new Promise((res) => { reader.onload = (e) => res(e.target.result); reader.readAsDataURL(file); });
    state["ej4-captura"] = localBase64;
    state["ej4-captura-nombre"] = fileName;
    saveStateRedes();
    restorePantallazoTallerIPEj4();

    const fileBase64 = localBase64.split(",").pop();
    const response = await delivery.uploadToAppsScript({
      guideLabel: "Guia 2",
      activityLabel: "Ejercicio 4 \u2014 Pantallazo ipconfig /all",
      activityNumber: "3.3.4",
      activityTitle: "Taller IP \u2014 Verificar parametros de red",
      fileName,
      mimeType: file.type || "image/jpeg",
      fileBase64,
      fullName: identity.fullName || identity.usernameKey || "Aprendiz",
      ficha,
    });

    if (response && response.driveUrl) {
      delete state["ej4-captura"];
      state["ej4-captura-url"] = response.driveUrl;
      state["ej4-captura-folder-path"] = response.folderPath || "";
      saveStateRedes();
      await saveToCloudRedes();
      restorePantallazoTallerIPEj4();
    }
    if (uploadBtn) {
      uploadBtn.innerHTML = "&#128247; Cambiar pantallazo";
      uploadBtn.style.pointerEvents = "";
    }
  } catch (err) {
    alert("Error al subir el pantallazo: " + ((err && err.message) || "Intenta de nuevo."));
    if (uploadBtn) {
      uploadBtn.innerHTML = originalLabel;
      uploadBtn.style.pointerEvents = "";
    }
  }
};

window.guardarTallerIPEj4 = async function () {
  const empty = TALLER_IP_EJ4_KEYS.filter((k) => !String(state[k] || "").trim());
  if (empty.length > 0) {
    alert("Responde las 4 preguntas del Ejercicio 4 antes de guardar.");
    return;
  }
  if (!state["ej4-captura"] && !state["ej4-captura-url"]) {
    alert("Primero sube el pantallazo de ipconfig /all.");
    return;
  }
  const btn = document.getElementById("btnGuardarTallerIPEj4");
  if (btn) { btn.disabled = true; btn.textContent = "Guardando\u2026"; }
  state["taller-ip-ej4-locked"] = true;
  saveStateRedes();
  await saveToCloudRedes();
  applyTallerIPEj4Lock();
};

const TALLER_IP_EJ5_KEYS = [
  "ej5-lucia-clase",
  "ej5-lucia-just",
  "ej5-trans-clase",
  "ej5-trans-just",
  "ej5-corp-clase",
  "ej5-corp-just",
];

function applyTallerIPEj5Lock() {
  const locked = Boolean(state["taller-ip-ej5-locked"]);
  document.querySelectorAll("[data-store^='ej5-']").forEach((el) => {
    el.disabled = locked;
    el.style.opacity = locked ? "0.75" : "";
  });
  const btn = document.getElementById("btnGuardarTallerIPEj5");
  if (btn) {
    btn.disabled = locked;
    btn.textContent = locked ? "\u2705 Respuestas guardadas" : "\uD83D\uDCBE Guardar respuestas";
  }
  const status = document.getElementById("tallerIPEj5Status");
  if (status) status.style.display = locked ? "block" : "none";
}

window.guardarTallerIPEj5 = async function () {
  const empty = TALLER_IP_EJ5_KEYS.filter((k) => !String(state[k] || "").trim());
  if (empty.length > 0) {
    alert("Completa todas las respuestas del Ejercicio 5 antes de guardar.");
    return;
  }
  const btn = document.getElementById("btnGuardarTallerIPEj5");
  if (btn) { btn.disabled = true; btn.textContent = "Guardando\u2026"; }
  state["taller-ip-ej5-locked"] = true;
  saveStateRedes();
  await saveToCloudRedes();
  applyTallerIPEj5Lock();
};

const LAB1_ANALYSIS_KEYS = ["lab1-ping1", "lab1-ping2", "lab1-broadcast", "lab1-ipconfig"];

const LAB1_EVIDENCE_SLOTS = {
  ping1: {
    baseKey: "lab1-ping1",
    title: "Ping PC1_Caja a PC6_Gerencia",
    buttonId: "btnSubirLab1Ping1",
    inputId: "lab1Ping1Input",
    previewId: "lab1Ping1Preview",
    imageId: "lab1Ping1Img",
    nameId: "lab1Ping1Nombre",
    fileToken: "ping_pc1_pc6",
  },
  ping2: {
    baseKey: "lab1-ping2",
    title: "Ping PC3_Bodega a PC4_Punto1",
    buttonId: "btnSubirLab1Ping2",
    inputId: "lab1Ping2Input",
    previewId: "lab1Ping2Preview",
    imageId: "lab1Ping2Img",
    nameId: "lab1Ping2Nombre",
    fileToken: "ping_pc3_pc4",
  },
  broadcast: {
    baseKey: "lab1-broadcast",
    title: "Ping broadcast 192.168.10.255",
    buttonId: "btnSubirLab1Broadcast",
    inputId: "lab1BroadcastInput",
    previewId: "lab1BroadcastPreview",
    imageId: "lab1BroadcastImg",
    nameId: "lab1BroadcastNombre",
    fileToken: "ping_broadcast",
  },
  ipconfig: {
    baseKey: "lab1-ipconfig",
    title: "Verificacion con ipconfig",
    buttonId: "btnSubirLab1Ipconfig",
    inputId: "lab1IpconfigInput",
    previewId: "lab1IpconfigPreview",
    imageId: "lab1IpconfigImg",
    nameId: "lab1IpconfigNombre",
    fileToken: "ipconfig",
  },
};

function getLab1EvidenceStateKey(slotKey, suffix) {
  const slot = LAB1_EVIDENCE_SLOTS[slotKey];
  return slot ? `${slot.baseKey}-${suffix}` : "";
}

function refreshLab1EvidenceSlot(slotKey) {
  const slot = LAB1_EVIDENCE_SLOTS[slotKey];
  if (!slot) return;

  const driveUrl = state[getLab1EvidenceStateKey(slotKey, "url")];
  const localBase64 = state[getLab1EvidenceStateKey(slotKey, "image")];
  const fileName = state[getLab1EvidenceStateKey(slotKey, "name")] || `${slot.title}.png`;
  const locked = Boolean(state["lab1-locked"]);
  const preview = document.getElementById(slot.previewId);
  const img = document.getElementById(slot.imageId);
  const name = document.getElementById(slot.nameId);
  const input = document.getElementById(slot.inputId);
  const btn = document.getElementById(slot.buttonId);

  if (input) input.disabled = locked;
  if (btn) {
    btn.disabled = locked;
    btn.style.opacity = locked ? "0.7" : "";
    btn.style.pointerEvents = locked ? "none" : "";
  }

  if (driveUrl) {
    const thumb = _getDriveThumbnailUrl(driveUrl);
    if (img) img.src = thumb || driveUrl;
    if (preview) preview.style.display = "block";
    if (name) {
      name.innerHTML = `<a href="${driveUrl}" target="_blank" rel="noopener">Ver pantallazo en Drive</a> \u2014 ${escapeHtml(fileName)}`;
    }
    if (btn) btn.innerHTML = locked ? "&#9989; Evidencia cargada" : "&#128247; Cambiar pantallazo";
    return;
  }

  if (localBase64) {
    if (img) img.src = localBase64;
    if (preview) preview.style.display = "block";
    if (name) name.textContent = fileName;
    if (btn) btn.innerHTML = locked ? "&#9989; Evidencia cargada" : "&#128247; Cambiar pantallazo";
    return;
  }

  if (img) img.removeAttribute("src");
  if (preview) preview.style.display = "none";
  if (name) name.textContent = "";
  if (btn) btn.innerHTML = locked ? "&#9989; Evidencia cargada" : "&#128248; Subir pantallazo";
}

function restoreLab1EvidenceUploads() {
  Object.keys(LAB1_EVIDENCE_SLOTS).forEach(refreshLab1EvidenceSlot);
}

function applyLab1Lock() {
  const locked = Boolean(state["lab1-locked"]);
  document.querySelectorAll("[data-store^='lab1-']").forEach((el) => {
    el.disabled = locked;
    el.style.opacity = locked ? "0.75" : "";
  });
  Object.keys(LAB1_EVIDENCE_SLOTS).forEach(refreshLab1EvidenceSlot);
  const btn = document.getElementById("btnGuardarLab1");
  if (btn) {
    btn.disabled = locked;
    btn.textContent = locked ? "\u2705 Respuestas guardadas" : "\uD83D\uDCBE Guardar respuestas del laboratorio";
  }
  const status = document.getElementById("lab1Status");
  if (status) status.style.display = locked ? "block" : "none";
}

window.subirPantallazoLab1 = async function (slotKey, input) {
  const slot = LAB1_EVIDENCE_SLOTS[slotKey];
  const file = input && input.files && input.files[0];
  if (!slot || !file) return;

  if (file.size > 5 * 1024 * 1024) {
    alert("La imagen es demasiado grande (max. 5 MB). Usa un pantallazo mas liviano.");
    input.value = "";
    return;
  }

  const uploadBtn = document.getElementById(slot.buttonId);
  const originalLabel = uploadBtn ? uploadBtn.innerHTML : "";
  if (uploadBtn) {
    uploadBtn.innerHTML = "&#9203; Subiendo pantallazo...";
    uploadBtn.style.pointerEvents = "none";
  }

  try {
    const delivery = window.sharedAppsScriptDelivery;
    if (!delivery || typeof delivery.uploadToAppsScript !== "function") {
      throw new Error("El sistema de entrega no esta disponible.");
    }

    const identity = getDeliveryIdentityRedes();
    const usernameKey = identity.usernameKey;
    const ficha = identity.ficha || "0000";
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const fileName = `lab1_${slot.fileToken}_${ficha}_${usernameKey}_${dateStr}.${ext}`;

    const reader = new FileReader();
    const localBase64 = await new Promise((resolve) => {
      reader.onload = (event) => resolve(event.target.result);
      reader.readAsDataURL(file);
    });

    state[getLab1EvidenceStateKey(slotKey, "image")] = localBase64;
    state[getLab1EvidenceStateKey(slotKey, "name")] = fileName;
    saveStateRedes();
    refreshLab1EvidenceSlot(slotKey);

    const response = await delivery.uploadToAppsScript({
      guideLabel: "Guia 2",
      activityLabel: `Laboratorio 1 \u2014 ${slot.title}`,
      activityNumber: "3.4.1",
      activityTitle: "Laboratorio 1 \u2014 Red topologia estrella con direccionamiento IP",
      fileName,
      mimeType: file.type || "image/jpeg",
      fileBase64: String(localBase64).split(",").pop(),
      fullName: identity.fullName || identity.usernameKey || "Aprendiz",
      ficha,
    });

    if (response && response.driveUrl) {
      delete state[getLab1EvidenceStateKey(slotKey, "image")];
      state[getLab1EvidenceStateKey(slotKey, "url")] = response.driveUrl;
      state[getLab1EvidenceStateKey(slotKey, "folder-path")] = response.folderPath || "";
      saveStateRedes();
      await saveToCloudRedes();
      refreshLab1EvidenceSlot(slotKey);
    }

    if (uploadBtn) {
      uploadBtn.innerHTML = "&#128247; Cambiar pantallazo";
      uploadBtn.style.pointerEvents = "";
    }
    if (input) input.value = "";
  } catch (err) {
    alert("Error al subir el pantallazo: " + ((err && err.message) || "Intenta de nuevo."));
    if (uploadBtn) {
      uploadBtn.innerHTML = originalLabel;
      uploadBtn.style.pointerEvents = "";
    }
  }
};

window.guardarLab1Transferencia = async function () {
  const emptyAnalysis = LAB1_ANALYSIS_KEYS.filter((key) => !String(state[key] || "").trim());
  if (emptyAnalysis.length > 0) {
    alert("Responde las 4 preguntas del analisis antes de guardar.");
    return;
  }

  const pendingEvidence = Object.keys(LAB1_EVIDENCE_SLOTS).filter((slotKey) => !state[getLab1EvidenceStateKey(slotKey, "url")]);
  if (pendingEvidence.length > 0) {
    alert("Debes subir los 4 pantallazos del laboratorio antes de guardar.");
    return;
  }

  const btn = document.getElementById("btnGuardarLab1");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Guardando\u2026";
  }

  state["lab1-locked"] = true;
  saveStateRedes();
  await saveToCloudRedes();
  applyLab1Lock();
};

window.subirEntregaFinalLab1 = function () {
  if (
    !window.sharedAppsScriptDelivery ||
    typeof window.sharedAppsScriptDelivery.openDeliveryModal !== "function"
  ) {
    alert("El sistema de entrega no esta disponible en este momento.");
    return;
  }

  window.sharedAppsScriptDelivery.openDeliveryModal({
    guideLabel: "Guia 2",
    activityNumber: "3.4.1",
    activityTitle: "Laboratorio 1 \u2014 Red topologia estrella con direccionamiento IP",
    activityLabel: "Actividad 3.4.1",
    fileNamePrefix: "Lab1_EstrellaCarmen",
    allowedExtensions: [".pkt"],
    learnerNameMode: "full",
  });
};

const LAB2_ANALYSIS_KEYS = [
  "lab2-ping-mismo",
  "lab2-ping-dif",
  "lab2-tracert-interno",
  "lab2-tracert-externo",
];

const LAB2_EVIDENCE_SLOTS = {
  mismo: {
    title: "Ping mismo departamento",
    fileToken: "ping_mismo_departamento",
    baseKey: "lab2-ping-mismo",
    inputId: "lab2PingMismoInput",
    buttonId: "btnSubirLab2PingMismo",
    previewId: "lab2PingMismoPreview",
    imageId: "lab2PingMismoImg",
    nameId: "lab2PingMismoNombre",
  },
  diferente: {
    title: "Ping entre departamentos",
    fileToken: "ping_entre_departamentos",
    baseKey: "lab2-ping-dif",
    inputId: "lab2PingDifInput",
    buttonId: "btnSubirLab2PingDif",
    previewId: "lab2PingDifPreview",
    imageId: "lab2PingDifImg",
    nameId: "lab2PingDifNombre",
  },
  tracertInterno: {
    title: "Tracert interno",
    fileToken: "tracert_interno",
    baseKey: "lab2-tracert-interno",
    inputId: "lab2TracertInternoInput",
    buttonId: "btnSubirLab2TracertInterno",
    previewId: "lab2TracertInternoPreview",
    imageId: "lab2TracertInternoImg",
    nameId: "lab2TracertInternoNombre",
  },
  tracertExterno: {
    title: "Tracert externo",
    fileToken: "tracert_externo",
    baseKey: "lab2-tracert-externo",
    inputId: "lab2TracertExternoInput",
    buttonId: "btnSubirLab2TracertExterno",
    previewId: "lab2TracertExternoPreview",
    imageId: "lab2TracertExternoImg",
    nameId: "lab2TracertExternoNombre",
  },
};

function getLab2EvidenceStateKey(slotKey, suffix) {
  const slot = LAB2_EVIDENCE_SLOTS[slotKey];
  return slot ? `${slot.baseKey}-${suffix}` : "";
}

function refreshLab2EvidenceSlot(slotKey) {
  const slot = LAB2_EVIDENCE_SLOTS[slotKey];
  if (!slot) return;

  const driveUrl = state[getLab2EvidenceStateKey(slotKey, "url")];
  const localBase64 = state[getLab2EvidenceStateKey(slotKey, "image")];
  const fileName = state[getLab2EvidenceStateKey(slotKey, "name")] || `${slot.title}.png`;
  const locked = Boolean(state["lab2-locked"]);
  const preview = document.getElementById(slot.previewId);
  const img = document.getElementById(slot.imageId);
  const name = document.getElementById(slot.nameId);
  const input = document.getElementById(slot.inputId);
  const btn = document.getElementById(slot.buttonId);

  if (input) input.disabled = locked;
  if (btn) {
    btn.disabled = locked;
    btn.style.opacity = locked ? "0.7" : "";
    btn.style.pointerEvents = locked ? "none" : "";
  }

  if (driveUrl) {
    const thumb = _getDriveThumbnailUrl(driveUrl);
    if (img) img.src = thumb || driveUrl;
    if (preview) preview.style.display = "block";
    if (name) {
      name.innerHTML = `<a href="${driveUrl}" target="_blank" rel="noopener">Ver pantallazo en Drive</a> — ${escapeHtml(fileName)}`;
    }
    if (btn) btn.innerHTML = locked ? "&#9989; Evidencia cargada" : "&#128247; Cambiar pantallazo";
    return;
  }

  if (localBase64) {
    if (img) img.src = localBase64;
    if (preview) preview.style.display = "block";
    if (name) name.textContent = fileName;
    if (btn) btn.innerHTML = locked ? "&#9989; Evidencia cargada" : "&#128247; Cambiar pantallazo";
    return;
  }

  if (img) img.removeAttribute("src");
  if (preview) preview.style.display = "none";
  if (name) name.textContent = "";
  if (btn) btn.innerHTML = locked ? "&#9989; Evidencia cargada" : "&#128248; Subir pantallazo";
}

function restoreLab2EvidenceUploads() {
  Object.keys(LAB2_EVIDENCE_SLOTS).forEach(refreshLab2EvidenceSlot);
}

function applyLab2Lock() {
  const locked = Boolean(state["lab2-locked"]);
  document.querySelectorAll("[data-store^='lab2-']").forEach((el) => {
    el.disabled = locked;
    el.style.opacity = locked ? "0.75" : "";
  });
  Object.keys(LAB2_EVIDENCE_SLOTS).forEach(refreshLab2EvidenceSlot);
  const btn = document.getElementById("btnGuardarLab2");
  if (btn) {
    btn.disabled = locked;
    btn.textContent = locked ? "✅ Respuestas guardadas" : "💾 Guardar respuestas del laboratorio";
  }
  const status = document.getElementById("lab2Status");
  if (status) status.style.display = locked ? "block" : "none";
}

window.subirPantallazoLab2 = async function (slotKey, input) {
  const slot = LAB2_EVIDENCE_SLOTS[slotKey];
  const file = input && input.files && input.files[0];
  if (!slot || !file) return;

  if (file.size > 5 * 1024 * 1024) {
    alert("La imagen es demasiado grande (max. 5 MB). Usa un pantallazo mas liviano.");
    input.value = "";
    return;
  }

  const uploadBtn = document.getElementById(slot.buttonId);
  const originalLabel = uploadBtn ? uploadBtn.innerHTML : "";
  if (uploadBtn) {
    uploadBtn.innerHTML = "&#9203; Subiendo pantallazo...";
    uploadBtn.style.pointerEvents = "none";
  }

  try {
    const delivery = window.sharedAppsScriptDelivery;
    if (!delivery || typeof delivery.uploadToAppsScript !== "function") {
      throw new Error("El sistema de entrega no esta disponible.");
    }

    const identity = getDeliveryIdentityRedes();
    const usernameKey = identity.usernameKey;
    const ficha = identity.ficha || "0000";
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const fileName = `lab2_${slot.fileToken}_${ficha}_${usernameKey}_${dateStr}.${ext}`;

    const reader = new FileReader();
    const localBase64 = await new Promise((resolve) => {
      reader.onload = (event) => resolve(event.target.result);
      reader.readAsDataURL(file);
    });

    state[getLab2EvidenceStateKey(slotKey, "image")] = localBase64;
    state[getLab2EvidenceStateKey(slotKey, "name")] = fileName;
    saveStateRedes();
    refreshLab2EvidenceSlot(slotKey);

    const response = await delivery.uploadToAppsScript({
      guideLabel: "Guia 2",
      activityLabel: `Laboratorio 2 — ${slot.title}`,
      activityNumber: "3.4.2",
      activityTitle: "Laboratorio 2 — Red topologia arbol con multiples segmentos (Autonomo)",
      fileName,
      mimeType: file.type || "image/jpeg",
      fileBase64: String(localBase64).split(",").pop(),
      fullName: identity.fullName || identity.usernameKey || "Aprendiz",
      ficha,
    });

    if (response && response.driveUrl) {
      delete state[getLab2EvidenceStateKey(slotKey, "image")];
      state[getLab2EvidenceStateKey(slotKey, "url")] = response.driveUrl;
      state[getLab2EvidenceStateKey(slotKey, "folder-path")] = response.folderPath || "";
      saveStateRedes();
      await saveToCloudRedes();
      refreshLab2EvidenceSlot(slotKey);
    }

    if (uploadBtn) {
      uploadBtn.innerHTML = "&#128247; Cambiar pantallazo";
      uploadBtn.style.pointerEvents = "";
    }
    if (input) input.value = "";
  } catch (err) {
    alert("Error al subir el pantallazo: " + ((err && err.message) || "Intenta de nuevo."));
    if (uploadBtn) {
      uploadBtn.innerHTML = originalLabel;
      uploadBtn.style.pointerEvents = "";
    }
  }
};

window.guardarLab2Arbol = async function () {
  const emptyAnalysis = LAB2_ANALYSIS_KEYS.filter((key) => !String(state[key] || "").trim());
  if (emptyAnalysis.length > 0) {
    alert("Responde las 4 preguntas del analisis antes de guardar.");
    return;
  }

  const pendingEvidence = Object.keys(LAB2_EVIDENCE_SLOTS).filter((slotKey) => !state[getLab2EvidenceStateKey(slotKey, "url")]);
  if (pendingEvidence.length > 0) {
    alert("Debes subir los 4 pantallazos del laboratorio antes de guardar.");
    return;
  }

  const btn = document.getElementById("btnGuardarLab2");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Guardando…";
  }

  state["lab2-locked"] = true;
  saveStateRedes();
  await saveToCloudRedes();
  applyLab2Lock();
};

window.subirEntregaFinalLab2 = function () {
  if (
    !window.sharedAppsScriptDelivery ||
    typeof window.sharedAppsScriptDelivery.openDeliveryModal !== "function"
  ) {
    alert("El sistema de entrega no esta disponible en este momento.");
    return;
  }

  window.sharedAppsScriptDelivery.openDeliveryModal({
    guideLabel: "Guia 2",
    activityNumber: "3.4.2",
    activityTitle: "Laboratorio 2 — Red topologia arbol con multiples segmentos (Autonomo)",
    activityLabel: "Actividad 3.4.2",
    fileNamePrefix: "Lab2_ArbolBoycaTech",
    allowedExtensions: [".pkt"],
    learnerNameMode: "full",
  });
};

const LAB3_ANALYSIS_KEYS = [
  "lab3-topologia",
  "lab3-ping-bloques",
  "lab3-ping-wifi",
  "lab3-ipconfig-wifi",
];

const LAB3_EVIDENCE_SLOTS = {
  topologia: {
    title: "Topologia completa",
    fileToken: "topologia_completa",
    baseKey: "lab3-topologia",
    inputId: "lab3TopologiaInput",
    buttonId: "btnSubirLab3Topologia",
    previewId: "lab3TopologiaPreview",
    imageId: "lab3TopologiaImg",
    nameId: "lab3TopologiaNombre",
  },
  pingBloques: {
    title: "Ping entre bloques",
    fileToken: "ping_entre_bloques",
    baseKey: "lab3-ping-bloques",
    inputId: "lab3PingBloquesInput",
    buttonId: "btnSubirLab3PingBloques",
    previewId: "lab3PingBloquesPreview",
    imageId: "lab3PingBloquesImg",
    nameId: "lab3PingBloquesNombre",
  },
  pingWifi: {
    title: "Ping Wi-Fi a equipo cableado",
    fileToken: "ping_wifi_a_cableado",
    baseKey: "lab3-ping-wifi",
    inputId: "lab3PingWifiInput",
    buttonId: "btnSubirLab3PingWifi",
    previewId: "lab3PingWifiPreview",
    imageId: "lab3PingWifiImg",
    nameId: "lab3PingWifiNombre",
  },
  ipconfigWifi: {
    title: "Parametros del cliente inalambrico",
    fileToken: "parametros_cliente_inalambrico",
    baseKey: "lab3-ipconfig-wifi",
    inputId: "lab3IpconfigWifiInput",
    buttonId: "btnSubirLab3IpconfigWifi",
    previewId: "lab3IpconfigWifiPreview",
    imageId: "lab3IpconfigWifiImg",
    nameId: "lab3IpconfigWifiNombre",
  },
};

function getLab3EvidenceStateKey(slotKey, suffix) {
  const slot = LAB3_EVIDENCE_SLOTS[slotKey];
  return slot ? `${slot.baseKey}-${suffix}` : "";
}

function refreshLab3EvidenceSlot(slotKey) {
  const slot = LAB3_EVIDENCE_SLOTS[slotKey];
  if (!slot) return;

  const driveUrl = state[getLab3EvidenceStateKey(slotKey, "url")];
  const localBase64 = state[getLab3EvidenceStateKey(slotKey, "image")];
  const fileName = state[getLab3EvidenceStateKey(slotKey, "name")] || `${slot.title}.png`;
  const locked = Boolean(state["lab3-locked"]);
  const preview = document.getElementById(slot.previewId);
  const img = document.getElementById(slot.imageId);
  const name = document.getElementById(slot.nameId);
  const input = document.getElementById(slot.inputId);
  const btn = document.getElementById(slot.buttonId);

  if (input) input.disabled = locked;
  if (btn) {
    btn.disabled = locked;
    btn.style.opacity = locked ? "0.7" : "";
    btn.style.pointerEvents = locked ? "none" : "";
  }

  if (driveUrl) {
    const thumb = _getDriveThumbnailUrl(driveUrl);
    if (img) img.src = thumb || driveUrl;
    if (preview) preview.style.display = "block";
    if (name) {
      name.innerHTML = `<a href="${driveUrl}" target="_blank" rel="noopener">Ver pantallazo en Drive</a> &mdash; ${escapeHtml(fileName)}`;
    }
    if (btn) btn.innerHTML = locked ? "&#9989; Evidencia cargada" : "&#128247; Cambiar pantallazo";
    return;
  }

  if (localBase64) {
    if (img) img.src = localBase64;
    if (preview) preview.style.display = "block";
    if (name) name.textContent = fileName;
    if (btn) btn.innerHTML = locked ? "&#9989; Evidencia cargada" : "&#128247; Cambiar pantallazo";
    return;
  }

  if (img) img.removeAttribute("src");
  if (preview) preview.style.display = "none";
  if (name) name.textContent = "";
  if (btn) btn.innerHTML = locked ? "&#9989; Evidencia cargada" : "&#128248; Subir pantallazo";
}

function restoreLab3EvidenceUploads() {
  Object.keys(LAB3_EVIDENCE_SLOTS).forEach(refreshLab3EvidenceSlot);
}

function applyLab3Lock() {
  const locked = Boolean(state["lab3-locked"]);
  document.querySelectorAll("[data-store^='lab3-']").forEach((el) => {
    el.disabled = locked;
    el.style.opacity = locked ? "0.75" : "";
  });
  Object.keys(LAB3_EVIDENCE_SLOTS).forEach(refreshLab3EvidenceSlot);
  const btn = document.getElementById("btnGuardarLab3");
  if (btn) {
    btn.disabled = locked;
    btn.innerHTML = locked ? "&#9989; Respuestas guardadas" : "&#128190; Guardar respuestas del laboratorio";
  }
  const status = document.getElementById("lab3Status");
  if (status) status.style.display = locked ? "block" : "none";
}

window.subirPantallazoLab3 = async function (slotKey, input) {
  const slot = LAB3_EVIDENCE_SLOTS[slotKey];
  const file = input && input.files && input.files[0];
  if (!slot || !file) return;

  if (file.size > 5 * 1024 * 1024) {
    alert("La imagen es demasiado grande (max. 5 MB). Usa un pantallazo mas liviano.");
    input.value = "";
    return;
  }

  const uploadBtn = document.getElementById(slot.buttonId);
  const originalLabel = uploadBtn ? uploadBtn.innerHTML : "";
  if (uploadBtn) {
    uploadBtn.innerHTML = "&#9203; Subiendo pantallazo...";
    uploadBtn.style.pointerEvents = "none";
  }

  try {
    const delivery = window.sharedAppsScriptDelivery;
    if (!delivery || typeof delivery.uploadToAppsScript !== "function") {
      throw new Error("El sistema de entrega no esta disponible.");
    }

    const identity = getDeliveryIdentityRedes();
    const usernameKey = identity.usernameKey;
    const ficha = identity.ficha || "0000";
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const fileName = `lab3_${slot.fileToken}_${ficha}_${usernameKey}_${dateStr}.${ext}`;

    const reader = new FileReader();
    const localBase64 = await new Promise((resolve) => {
      reader.onload = (event) => resolve(event.target.result);
      reader.readAsDataURL(file);
    });

    state[getLab3EvidenceStateKey(slotKey, "image")] = localBase64;
    state[getLab3EvidenceStateKey(slotKey, "name")] = fileName;
    saveStateRedes();
    refreshLab3EvidenceSlot(slotKey);

    const response = await delivery.uploadToAppsScript({
      guideLabel: "Guia 2",
      activityLabel: `Laboratorio 3 - ${slot.title}`,
      activityNumber: "3.4.3",
      activityTitle: "Laboratorio 3 - Red hibrida estrella y arbol con fibra optica, cableado y Wi-Fi",
      fileName,
      mimeType: file.type || "image/jpeg",
      fileBase64: String(localBase64).split(",").pop(),
      fullName: identity.fullName || identity.usernameKey || "Aprendiz",
      ficha,
    });

    if (response && response.driveUrl) {
      delete state[getLab3EvidenceStateKey(slotKey, "image")];
      state[getLab3EvidenceStateKey(slotKey, "url")] = response.driveUrl;
      state[getLab3EvidenceStateKey(slotKey, "folder-path")] = response.folderPath || "";
      saveStateRedes();
      await saveToCloudRedes();
      refreshLab3EvidenceSlot(slotKey);
    }

    if (uploadBtn) {
      uploadBtn.innerHTML = "&#128247; Cambiar pantallazo";
      uploadBtn.style.pointerEvents = "";
    }
    if (input) input.value = "";
  } catch (err) {
    alert("Error al subir el pantallazo: " + ((err && err.message) || "Intenta de nuevo."));
    if (uploadBtn) {
      uploadBtn.innerHTML = originalLabel;
      uploadBtn.style.pointerEvents = "";
    }
  }
};

window.guardarLab3Hibrida = async function () {
  const emptyAnalysis = LAB3_ANALYSIS_KEYS.filter((key) => !String(state[key] || "").trim());
  if (emptyAnalysis.length > 0) {
    alert("Responde las 4 preguntas del analisis antes de guardar.");
    return;
  }

  const pendingEvidence = Object.keys(LAB3_EVIDENCE_SLOTS).filter(
    (slotKey) => !state[getLab3EvidenceStateKey(slotKey, "url")]
  );
  if (pendingEvidence.length > 0) {
    alert("Debes subir los 4 pantallazos del laboratorio antes de guardar.");
    return;
  }

  const btn = document.getElementById("btnGuardarLab3");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Guardando...";
  }

  state["lab3-locked"] = true;
  saveStateRedes();
  await saveToCloudRedes();
  applyLab3Lock();
};

window.subirEntregaFinalLab3 = function () {
  if (
    !window.sharedAppsScriptDelivery ||
    typeof window.sharedAppsScriptDelivery.openDeliveryModal !== "function"
  ) {
    alert("El sistema de entrega no esta disponible en este momento.");
    return;
  }

  window.sharedAppsScriptDelivery.openDeliveryModal({
    guideLabel: "Guia 2",
    activityNumber: "3.4.3",
    activityTitle: "Laboratorio 3 - Red hibrida estrella y arbol con fibra optica, cableado y Wi-Fi",
    activityLabel: "Actividad 3.4.3",
    fileNamePrefix: "Lab3_HibridaColegio",
    allowedExtensions: [".pkt"],
    learnerNameMode: "full",
  });
};

window.showVideoBloqueIP3 = function (n) {
  const active   = "flex:1;min-width:140px;padding:8px 12px;border-radius:8px;border:2px solid #2e7d32;cursor:pointer;font-size:0.85rem;font-weight:600;font-family:inherit;background:#2e7d32;color:#fff";
  const inactive = "flex:1;min-width:140px;padding:8px 12px;border-radius:8px;border:2px solid #2e7d32;cursor:pointer;font-size:0.85rem;font-weight:600;font-family:inherit;background:#e8f5e9;color:#1b5e20";
  [1, 3].forEach((i) => {
    const v = document.getElementById(`videoIP3-${i}`);
    const b = document.getElementById(`tabIP3-btn-${i}`);
    if (v) v.style.display = i === n ? "block" : "none";
    if (b) b.style.cssText = i === n ? active : inactive;
  });
};

// ---------------------------------------------------------------------------
// Bloque IP3 — Parámetros de red: IP, máscara, gateway y DNS (3.3.3)
// ---------------------------------------------------------------------------
const BLOQUE_IP3_KEYS = ["ip3-1", "ip3-2", "ip3-3"];

function applyBloqueIP3Lock() {
  const locked = Boolean(state["ip3-locked"]);
  BLOQUE_IP3_KEYS.forEach((k) => {
    const el = document.querySelector(`[data-store="${k}"]`);
    if (el) { el.disabled = locked; el.style.opacity = locked ? "0.75" : ""; }
  });
  const input = document.getElementById("ip3ImagenInput");
  if (input) input.disabled = locked;
  const label = document.getElementById("ip3ImagenLabel");
  if (label) {
    label.style.opacity = locked ? "0.5" : "";
    label.style.pointerEvents = locked ? "none" : "";
  }
  const btn = document.getElementById("btnGuardarIP3");
  if (btn) {
    btn.disabled = locked;
    btn.textContent = locked ? "\u2705 Respuestas guardadas" : "\uD83D\uDCBE Guardar respuestas";
  }
  const status = document.getElementById("ip3Status");
  if (status) status.style.display = locked ? "block" : "none";
}

function restoreImagenBloqueIP3() {
  const driveUrl = state["ip3-imagen-url"];
  const localBase64 = state["ip3-imagen"];
  const img = document.getElementById("ip3ImagenImg");
  const preview = document.getElementById("ip3ImagenPreview");
  const nombre = document.getElementById("ip3ImagenNombre");
  if (driveUrl) {
    const thumb = _getDriveThumbnailUrl(driveUrl);
    if (img) img.src = thumb || driveUrl;
    if (preview) preview.style.display = "block";
    if (nombre) nombre.innerHTML =
      `<a href="${driveUrl}" target="_blank" rel="noopener">Ver en Drive</a> \u2014 ${state["ip3-imagen-nombre"] || "imagen adjunta"}`;
  } else if (localBase64) {
    if (img) img.src = localBase64;
    if (preview) preview.style.display = "block";
    if (nombre) nombre.textContent = state["ip3-imagen-nombre"] || "imagen adjunta";
  }
}

window.subirImagenBloqueIP3 = async function (input) {
  const file = input.files && input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    alert("La imagen es demasiado grande (m\u00e1x. 5 MB). Usa una foto m\u00e1s peque\u00f1a o comp\u00edmela.");
    input.value = "";
    return;
  }
  const label = document.getElementById("ip3ImagenLabel");
  const originalLabel = label ? label.innerHTML : "";
  if (label) { label.innerHTML = "&#9203; Subiendo imagen..."; label.style.pointerEvents = "none"; }
  try {
    const delivery = window.sharedAppsScriptDelivery;
    if (!delivery || typeof delivery.uploadToAppsScript !== "function") {
      throw new Error("El sistema de entrega no est\u00e1 disponible.");
    }
    const identity = getDeliveryIdentityRedes();
    const usernameKey = identity.usernameKey;
    const ficha = identity.ficha || "0000";
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const fileName = `ip3_${ficha}_${usernameKey}_${dateStr}.${ext}`;

    const reader = new FileReader();
    const localBase64 = await new Promise((res) => { reader.onload = (e) => res(e.target.result); reader.readAsDataURL(file); });
    state["ip3-imagen"] = localBase64;
    state["ip3-imagen-nombre"] = fileName;
    saveStateRedes();
    restoreImagenBloqueIP3();

    const fileBase64 = localBase64.split(",").pop();
    const response = await delivery.uploadToAppsScript({
      guideLabel: "Guia 2",
      activityLabel: "Bloque 3 \u2014 Producto Individual",
      activityNumber: "3.3.3",
      activityTitle: "Producto Individual \u2014 Diagrama de par\u00e1metros de red",
      fileName,
      mimeType: file.type || "image/jpeg",
      fileBase64,
      fullName: identity.fullName || identity.usernameKey || "Aprendiz",
      ficha,
    });

    if (response && response.driveUrl) {
      state["ip3-imagen-url"] = response.driveUrl;
      saveStateRedes();
      await saveToCloudRedes();
      restoreImagenBloqueIP3();
    }
    if (label) { label.innerHTML = "&#128247; Cambiar imagen"; label.style.pointerEvents = ""; }
  } catch (err) {
    alert("Error al subir imagen: " + ((err && err.message) || "Intenta de nuevo."));
    if (label) { label.innerHTML = originalLabel; label.style.pointerEvents = ""; }
  }
};

window.guardarBloqueIP3 = async function () {
  const empty = BLOQUE_IP3_KEYS.filter((k) => !String(state[k] || "").trim());
  if (empty.length > 0) {
    alert("Responde las 3 preguntas antes de guardar.");
    return;
  }
  const btn = document.getElementById("btnGuardarIP3");
  if (btn) { btn.disabled = true; btn.textContent = "Guardando\u2026"; }
  state["ip3-locked"] = true;
  saveStateRedes();
  await saveToCloudRedes();
  applyBloqueIP3Lock();
};

// ---------------------------------------------------------------------------
// Bloque IP1 — Estructura de una dirección IPv4 (3.3.1)
// ---------------------------------------------------------------------------
const BLOQUE_IP1_KEYS = ["ip1-1", "ip1-2", "ip1-3"];

function applyBloqueIP1Lock() {
  const locked = Boolean(state["ip1-locked"]);
  BLOQUE_IP1_KEYS.forEach((k) => {
    const el = document.querySelector(`[data-store="${k}"]`);
    if (el) { el.disabled = locked; el.style.opacity = locked ? "0.75" : ""; }
  });
  const input = document.getElementById("ip1ImagenInput");
  if (input) input.disabled = locked;
  const label = document.getElementById("ip1ImagenLabel");
  if (label) {
    label.style.opacity = locked ? "0.5" : "";
    label.style.pointerEvents = locked ? "none" : "";
  }
  const btn = document.getElementById("btnGuardarIP1");
  if (btn) {
    btn.disabled = locked;
    btn.textContent = locked ? "\u2705 Respuestas guardadas" : "\uD83D\uDCBE Guardar respuestas";
  }
  const status = document.getElementById("ip1Status");
  if (status) status.style.display = locked ? "block" : "none";
}

function restoreImagenBloqueIP1() {
  const driveUrl = state["ip1-imagen-url"];
  const localBase64 = state["ip1-imagen"];
  const img = document.getElementById("ip1ImagenImg");
  const preview = document.getElementById("ip1ImagenPreview");
  const nombre = document.getElementById("ip1ImagenNombre");
  if (driveUrl) {
    const thumb = _getDriveThumbnailUrl(driveUrl);
    if (img) img.src = thumb || driveUrl;
    if (preview) preview.style.display = "block";
    if (nombre) nombre.innerHTML =
      `<a href="${driveUrl}" target="_blank" rel="noopener">Ver en Drive</a> \u2014 ${state["ip1-imagen-nombre"] || "imagen adjunta"}`;
  } else if (localBase64) {
    if (img) img.src = localBase64;
    if (preview) preview.style.display = "block";
    if (nombre) nombre.textContent = state["ip1-imagen-nombre"] || "imagen adjunta";
  }
}

window.subirImagenBloqueIP1 = async function (input) {
  const file = input.files && input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    alert("La imagen es demasiado grande (m\u00e1x. 5 MB). Usa una foto m\u00e1s peque\u00f1a o comp\u00edmela.");
    input.value = "";
    return;
  }
  const label = document.getElementById("ip1ImagenLabel");
  const originalLabel = label ? label.innerHTML : "";
  if (label) { label.innerHTML = "&#9203; Subiendo imagen..."; label.style.pointerEvents = "none"; }
  try {
    const delivery = window.sharedAppsScriptDelivery;
    if (!delivery || typeof delivery.uploadToAppsScript !== "function") {
      throw new Error("El sistema de entrega no est\u00e1 disponible.");
    }
    const identity = getDeliveryIdentityRedes();
    const usernameKey = identity.usernameKey;
    const ficha = identity.ficha || "0000";
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const fileName = `ip1_${ficha}_${usernameKey}_${dateStr}.${ext}`;

    const reader = new FileReader();
    const localBase64 = await new Promise((res) => { reader.onload = (e) => res(e.target.result); reader.readAsDataURL(file); });
    state["ip1-imagen"] = localBase64;
    state["ip1-imagen-nombre"] = fileName;
    saveStateRedes();
    restoreImagenBloqueIP1();

    const fileBase64 = localBase64.split(",").pop();
    const response = await delivery.uploadToAppsScript({
      guideLabel: "Guia 2",
      activityLabel: "Bloque 1 \u2014 Producto Individual",
      activityNumber: "3.3.1",
      activityTitle: "Producto Individual \u2014 Diagrama IPv4",
      fileName,
      mimeType: file.type || "image/jpeg",
      fileBase64,
      fullName: identity.fullName || identity.usernameKey || "Aprendiz",
      ficha,
    });

    if (response && response.driveUrl) {
      state["ip1-imagen-url"] = response.driveUrl;
      saveStateRedes();
      await saveToCloudRedes();
      restoreImagenBloqueIP1();
    }
    if (label) { label.innerHTML = "&#128247; Cambiar imagen"; label.style.pointerEvents = ""; }
  } catch (err) {
    alert("Error al subir imagen: " + ((err && err.message) || "Intenta de nuevo."));
    if (label) { label.innerHTML = originalLabel; label.style.pointerEvents = ""; }
  }
};

window.guardarBloqueIP1 = async function () {
  const empty = BLOQUE_IP1_KEYS.filter((k) => !String(state[k] || "").trim());
  if (empty.length > 0) {
    alert("Responde las preguntas antes de guardar.");
    return;
  }
  const btn = document.getElementById("btnGuardarIP1");
  if (btn) { btn.disabled = true; btn.textContent = "Guardando\u2026"; }
  state["ip1-locked"] = true;
  saveStateRedes();
  await saveToCloudRedes();
  applyBloqueIP1Lock();
};

// ---------------------------------------------------------------------------
// Socialización 3.2.1.G
// ---------------------------------------------------------------------------
const SOCIAL_KEYS = ["social-diferencias", "social-representacion", "social-dudas", "social-pregunta"];

function applySocialLock() {
  const locked = Boolean(state["social-locked"]);
  SOCIAL_KEYS.forEach((k) => {
    const el = document.querySelector(`[data-store="${k}"]`);
    if (el) { el.disabled = locked; el.style.opacity = locked ? "0.75" : ""; }
  });
  const input = document.getElementById("socialMapaInput");
  if (input) input.disabled = locked;
  const label = document.getElementById("socialMapaLabel");
  if (label) {
    label.style.opacity = locked ? "0.5" : "";
    label.style.pointerEvents = locked ? "none" : "";
  }
  const btn = document.getElementById("btnGuardarSocial");
  if (btn) {
    btn.disabled = locked;
    btn.textContent = locked ? "\u2705 Respuestas guardadas" : "\uD83D\uDCBE Guardar respuestas";
  }
  const status = document.getElementById("socialStatus");
  if (status) status.style.display = locked ? "block" : "none";
}

function restoreImagenSocial() {
  const driveUrl = state["social-mapa-url"];
  const localBase64 = state["social-mapa"];
  const img = document.getElementById("socialMapaImg");
  const preview = document.getElementById("socialMapaPreview");
  const nombre = document.getElementById("socialMapaNombre");
  if (driveUrl) {
    const thumb = _getDriveThumbnailUrl(driveUrl);
    if (img) img.src = thumb || driveUrl;
    if (preview) preview.style.display = "block";
    if (nombre) nombre.innerHTML =
      `<a href="${driveUrl}" target="_blank" rel="noopener">Ver en Drive</a> \u2014 ${state["social-mapa-nombre"] || "mapa adjunto"}`;
  } else if (localBase64) {
    if (img) img.src = localBase64;
    if (preview) preview.style.display = "block";
    if (nombre) nombre.textContent = state["social-mapa-nombre"] || "imagen adjunta";
  }
}

window.subirImagenSocial = async function (input) {
  const file = input.files && input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    alert("La imagen es demasiado grande (m\u00e1x. 5 MB). Usa una foto m\u00e1s peque\u00f1a o comp\u00edmela.");
    input.value = "";
    return;
  }
  const label = document.getElementById("socialMapaLabel");
  const originalLabel = label ? label.innerHTML : "";
  if (label) { label.innerHTML = "&#9203; Subiendo imagen..."; label.style.pointerEvents = "none"; }

  try {
    const delivery = window.sharedAppsScriptDelivery;
    if (!delivery || typeof delivery.uploadToAppsScript !== "function") {
      throw new Error("El sistema de entrega no est\u00e1 disponible.");
    }
    const identity = getDeliveryIdentityRedes();
    const usernameKey = identity.usernameKey;
    const ficha = identity.ficha || "0000";
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const fileName = `social_mapa_${ficha}_${usernameKey}_${dateStr}.${ext}`;

    const reader = new FileReader();
    const localBase64 = await new Promise((res) => { reader.onload = (e) => res(e.target.result); reader.readAsDataURL(file); });
    state["social-mapa"] = localBase64;
    state["social-mapa-nombre"] = fileName;
    saveStateRedes();
    restoreImagenSocial();

    const fileBase64 = localBase64.split(",").pop();
    const response = await delivery.uploadToAppsScript({
      guideLabel: "Guia 2",
      activityLabel: "Socializaci\u00f3n 3.2.1.G \u2014 Mapa elegido",
      activityNumber: "3.2.1.G",
      activityTitle: "Mapa mental \u2014 representaci\u00f3n visual m\u00e1s completa",
      fileName,
      mimeType: file.type || "image/jpeg",
      fileBase64,
      fullName: identity.fullName || identity.usernameKey || "Aprendiz",
      ficha,
    });

    if (response && response.driveUrl) {
      state["social-mapa-url"] = response.driveUrl;
      saveStateRedes();
      await saveToCloudRedes();
      restoreImagenSocial();
    }

    if (label) { label.innerHTML = "&#128247; Cambiar imagen"; label.style.pointerEvents = ""; }
  } catch (err) {
    alert("Error al subir imagen: " + ((err && err.message) || "Intenta de nuevo."));
    if (label) { label.innerHTML = originalLabel; label.style.pointerEvents = ""; }
  }
};

window.guardarSocializacion = async function () {
  const empty = SOCIAL_KEYS.filter((k) => !String(state[k] || "").trim());
  if (empty.length > 0) {
    alert("Responde las 4 preguntas antes de guardar.");
    return;
  }
  const btn = document.getElementById("btnGuardarSocial");
  if (btn) { btn.disabled = true; btn.textContent = "Guardando\u2026"; }
  state["social-locked"] = true;
  saveStateRedes();
  await saveToCloudRedes();
  applySocialLock();
};

// ---------------------------------------------------------------------------
// Exposed for external use
// ---------------------------------------------------------------------------
window.getGuideState = () => state;
window.saveGuideState = saveStateRedes;

// ---------------------------------------------------------------------------
// Floating Theory Panel — Blocks 3.3.1 / 3.3.2 / 3.3.3
// ---------------------------------------------------------------------------
(function injectTeoriaPanelStyles() {
  const s = document.createElement("style");
  s.textContent = `
    @keyframes tp-popIn { from{transform:scale(0);opacity:0} to{transform:scale(1);opacity:1} }
    @keyframes tp-slideL { from{transform:translateX(-40px);opacity:0} to{transform:translateX(0);opacity:1} }
    @keyframes tp-slideR { from{transform:translateX(40px);opacity:0} to{transform:translateX(0);opacity:1} }
    @keyframes tp-fadeUp { from{transform:translateY(18px);opacity:0} to{transform:translateY(0);opacity:1} }
    @keyframes tp-bar    { from{width:0} to{width:var(--tw)} }
    .tp-octet{display:inline-flex;align-items:center;justify-content:center;width:54px;height:54px;
      background:#fff;border:2px solid #2e7d32;border-radius:8px;font-size:1.25rem;font-weight:700;
      color:#1b5e20;box-shadow:0 2px 8px rgba(46,125,50,.15)}
    .tp-lbl{font-size:.7rem;color:#78909c;text-align:center;margin-top:3px;font-weight:600;letter-spacing:.04em}
    .tp-h{font-size:.78rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#2e7d32;margin:0 0 8px}
    .tp-card{background:#f1f8e9;border-radius:10px;padding:14px}
    .tp-sec{margin-bottom:20px}
    .dns-step{display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;animation:tp-fadeUp .4s both}
    .dns-num{width:26px;height:26px;background:#2e7d32;color:#fff;border-radius:50%;display:flex;
      align-items:center;justify-content:center;font-weight:700;font-size:.8rem;flex-shrink:0}
  `;
  document.head.appendChild(s);
})();

const TEORIA_PANEL_CONTENTS = {
  ip1: {
    title: "📡 IPv4 — Estructura y direccionamiento",
    html: `
      <div class="tp-sec">
        <p class="tp-h">¿Qué es una dirección IPv4?</p>
        <div class="tp-card">
          <p style="color:#37474f;font-size:.9rem;line-height:1.65;margin:0 0 12px">
            Una <strong>dirección IPv4</strong> es un número de 32 bits que identifica de forma única
            a cada dispositivo en una red. Se escribe en cuatro grupos (octetos) separados por puntos.
          </p>
          <p class="tp-h">Ejemplo: 192.168.1.100</p>
          <div style="display:flex;justify-content:center;align-items:flex-start;gap:6px;flex-wrap:wrap;margin:8px 0 4px">
            <div><div class="tp-octet" style="animation:tp-popIn .4s .1s both">192</div><div class="tp-lbl">8 bits</div></div>
            <div style="font-size:1.6rem;color:#2e7d32;line-height:3">.</div>
            <div><div class="tp-octet" style="animation:tp-popIn .4s .3s both">168</div><div class="tp-lbl">8 bits</div></div>
            <div style="font-size:1.6rem;color:#2e7d32;line-height:3">.</div>
            <div><div class="tp-octet" style="animation:tp-popIn .4s .5s both">1</div><div class="tp-lbl">8 bits</div></div>
            <div style="font-size:1.6rem;color:#2e7d32;line-height:3">.</div>
            <div><div class="tp-octet" style="animation:tp-popIn .4s .7s both">100</div><div class="tp-lbl">8 bits</div></div>
          </div>
          <p style="color:#78909c;font-size:.78rem;text-align:center;margin:4px 0 0">Total: 32 bits = 4 × 8 bits</p>
        </div>
      </div>
      <div class="tp-sec">
        <p class="tp-h">🔢 Decimal ↔ Binario</p>
        <div class="tp-card">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:.85rem">
            <div style="padding:8px;background:#fff;border-radius:6px;text-align:center">
              <div style="font-weight:700;color:#1b5e20;font-size:1.1rem">192</div>
              <div style="color:#78909c;font-size:.75rem;letter-spacing:.03em">1100 0000</div>
            </div>
            <div style="padding:8px;background:#fff;border-radius:6px;text-align:center">
              <div style="font-weight:700;color:#1b5e20;font-size:1.1rem">168</div>
              <div style="color:#78909c;font-size:.75rem;letter-spacing:.03em">1010 1000</div>
            </div>
            <div style="padding:8px;background:#fff;border-radius:6px;text-align:center">
              <div style="font-weight:700;color:#1b5e20;font-size:1.1rem">1</div>
              <div style="color:#78909c;font-size:.75rem;letter-spacing:.03em">0000 0001</div>
            </div>
            <div style="padding:8px;background:#fff;border-radius:6px;text-align:center">
              <div style="font-weight:700;color:#1b5e20;font-size:1.1rem">100</div>
              <div style="color:#78909c;font-size:.75rem;letter-spacing:.03em">0110 0100</div>
            </div>
          </div>
          <p style="color:#546e7a;font-size:.78rem;margin:8px 0 0;text-align:center">Cada octeto puede ser de 0 a 255</p>
        </div>
      </div>
      <div class="tp-sec">
        <p class="tp-h">🏘️ Parte de Red vs Parte de Host</p>
        <div class="tp-card">
          <div style="display:flex;border-radius:8px;overflow:hidden;margin-bottom:10px">
            <div style="flex:3;background:#1b5e20;color:#fff;padding:10px 8px;text-align:center;animation:tp-slideL .5s .6s both;font-size:.85rem">
              <div style="font-weight:700">192.168.1</div>
              <div style="font-size:.72rem;opacity:.85">Parte de RED</div>
            </div>
            <div style="flex:1;background:#f57c00;color:#fff;padding:10px 8px;text-align:center;animation:tp-slideR .5s .8s both;font-size:.85rem">
              <div style="font-weight:700">100</div>
              <div style="font-size:.72rem;opacity:.85">HOST</div>
            </div>
          </div>
          <p style="color:#37474f;font-size:.83rem;line-height:1.5;margin:0">
            Con máscara <strong>/24 (255.255.255.0)</strong>: los primeros 3 octetos = red,
            el último = dispositivo individual. Permite hasta <strong>254 hosts</strong> en la misma red.
          </p>
        </div>
      </div>
      <div class="tp-sec">
        <p class="tp-h">📋 Ejemplo: Red de Carmen's Cafetería</p>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:.82rem">
            <thead><tr style="background:#1b5e20;color:#fff">
              <th style="padding:7px 10px;text-align:left">Dispositivo</th>
              <th style="padding:7px 10px;text-align:left">IP</th>
              <th style="padding:7px 10px;text-align:left">Función</th>
            </tr></thead>
            <tbody>
              <tr style="background:#f1f8e9"><td style="padding:6px 10px">Router</td><td style="padding:6px 10px">192.168.1.1</td><td style="padding:6px 10px">Puerta de enlace</td></tr>
              <tr><td style="padding:6px 10px">PC Caja</td><td style="padding:6px 10px">192.168.1.10</td><td style="padding:6px 10px">Registro de ventas</td></tr>
              <tr style="background:#f1f8e9"><td style="padding:6px 10px">Tablet</td><td style="padding:6px 10px">192.168.1.20</td><td style="padding:6px 10px">Tomar pedidos</td></tr>
              <tr><td style="padding:6px 10px">Impresora</td><td style="padding:6px 10px">192.168.1.30</td><td style="padding:6px 10px">Facturas</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `
  },
  ip2: {
    title: "🗂️ Clases de IP y direcciones privadas",
    html: `
      <div class="tp-sec">
        <p class="tp-h">Las 3 clases de uso frecuente</p>
        <div class="tp-card" style="padding:16px">
          <div style="margin-bottom:14px;animation:tp-fadeUp .4s .1s both">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <span style="font-weight:700;color:#1b5e20;font-size:.9rem">Clase A</span>
              <span style="font-size:.78rem;color:#78909c">1.0.0.0 – 126.255.255.255</span>
            </div>
            <div style="background:#e0e0e0;border-radius:4px;height:22px;overflow:hidden">
              <div style="--tw:100%;width:0;height:100%;background:linear-gradient(90deg,#1b5e20,#4caf50);animation:tp-bar 1s .3s forwards;border-radius:4px;display:flex;align-items:center;padding-left:8px">
                <span style="color:#fff;font-size:.72rem;font-weight:700;white-space:nowrap">~16 millones de hosts</span>
              </div>
            </div>
          </div>
          <div style="margin-bottom:14px;animation:tp-fadeUp .4s .3s both">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <span style="font-weight:700;color:#1565c0;font-size:.9rem">Clase B</span>
              <span style="font-size:.78rem;color:#78909c">128.0.0.0 – 191.255.255.255</span>
            </div>
            <div style="background:#e0e0e0;border-radius:4px;height:22px;overflow:hidden">
              <div style="--tw:65%;width:0;height:100%;background:linear-gradient(90deg,#1565c0,#42a5f5);animation:tp-bar 1s .5s forwards;border-radius:4px;display:flex;align-items:center;padding-left:8px">
                <span style="color:#fff;font-size:.72rem;font-weight:700;white-space:nowrap">~65 mil hosts</span>
              </div>
            </div>
          </div>
          <div style="animation:tp-fadeUp .4s .5s both">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <span style="font-weight:700;color:#6a1b9a;font-size:.9rem">Clase C</span>
              <span style="font-size:.78rem;color:#78909c">192.0.0.0 – 223.255.255.255</span>
            </div>
            <div style="background:#e0e0e0;border-radius:4px;height:22px;overflow:hidden">
              <div style="--tw:28%;width:0;height:100%;background:linear-gradient(90deg,#6a1b9a,#ba68c8);animation:tp-bar 1s .7s forwards;border-radius:4px;display:flex;align-items:center;padding-left:8px">
                <span style="color:#fff;font-size:.72rem;font-weight:700;white-space:nowrap">254 hosts</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="tp-sec">
        <p class="tp-h">Mascara por defecto con ejemplos</p>
        <div class="tp-card">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px">
            <div style="background:#fff;padding:12px;border-radius:8px;border-left:4px solid #2e7d32">
              <div style="font-weight:800;color:#1b5e20;margin-bottom:4px">Clase A</div>
              <div style="font-size:.82rem;color:#546e7a;margin-bottom:6px">Mascara por defecto: <strong>255.0.0.0</strong> /8</div>
              <div style="font-size:.8rem;color:#37474f;line-height:1.5">
                Ejemplo: <code style="background:#f1f8e9;padding:2px 5px;border-radius:4px">10.5.20.1</code><br>
                Red por defecto: <strong>10.0.0.0</strong>
              </div>
            </div>
            <div style="background:#fff;padding:12px;border-radius:8px;border-left:4px solid #1565c0">
              <div style="font-weight:800;color:#1565c0;margin-bottom:4px">Clase B</div>
              <div style="font-size:.82rem;color:#546e7a;margin-bottom:6px">Mascara por defecto: <strong>255.255.0.0</strong> /16</div>
              <div style="font-size:.8rem;color:#37474f;line-height:1.5">
                Ejemplo: <code style="background:#e3f2fd;padding:2px 5px;border-radius:4px">172.20.0.1</code><br>
                Red por defecto: <strong>172.20.0.0</strong>
              </div>
            </div>
            <div style="background:#fff;padding:12px;border-radius:8px;border-left:4px solid #6a1b9a">
              <div style="font-weight:800;color:#6a1b9a;margin-bottom:4px">Clase C</div>
              <div style="font-size:.82rem;color:#546e7a;margin-bottom:6px">Mascara por defecto: <strong>255.255.255.0</strong> /24</div>
              <div style="font-size:.8rem;color:#37474f;line-height:1.5">
                Ejemplo: <code style="background:#f3e5f5;padding:2px 5px;border-radius:4px">192.168.1.50</code><br>
                Red por defecto: <strong>192.168.1.0</strong>
              </div>
            </div>
          </div>
          <p style="color:#546e7a;font-size:.8rem;margin:10px 0 0;line-height:1.55">
            Regla rapida: la mascara por defecto te dice cuantos octetos pertenecen a la red.
            Clase A usa 1 octeto de red, Clase B usa 2 y Clase C usa 3.
          </p>
        </div>
      </div>
      <div class="tp-sec">
        <p class="tp-h">🔒 Rangos privados (no salen a Internet)</p>
        <div class="tp-card">
          <table style="width:100%;border-collapse:collapse;font-size:.82rem">
            <thead><tr style="background:#1b5e20;color:#fff">
              <th style="padding:7px 10px;text-align:left">Clase</th>
              <th style="padding:7px 10px;text-align:left">Rango privado</th>
              <th style="padding:7px 10px;text-align:left">Máscara</th>
            </tr></thead>
            <tbody>
              <tr style="background:#f1f8e9"><td style="padding:6px 10px">A</td><td style="padding:6px 10px">10.0.0.0 – 10.255.255.255</td><td style="padding:6px 10px">/8</td></tr>
              <tr><td style="padding:6px 10px">B</td><td style="padding:6px 10px">172.16.0.0 – 172.31.255.255</td><td style="padding:6px 10px">/12</td></tr>
              <tr style="background:#f1f8e9"><td style="padding:6px 10px">C</td><td style="padding:6px 10px">192.168.0.0 – 192.168.255.255</td><td style="padding:6px 10px">/24</td></tr>
            </tbody>
          </table>
          <p style="color:#37474f;font-size:.8rem;margin:8px 0 0;line-height:1.5">
            💡 Tu casa, la cafetería, el colegio usan IPs <strong>privadas</strong>.
            El router hace NAT para convertirlas en la IP pública que ve Internet.
          </p>
        </div>
      </div>
      <div class="tp-sec">
        <p class="tp-h">🏪 Caso: MiPyme — Distribuidora Valeria</p>
        <div class="tp-card">
          <p style="color:#37474f;font-size:.85rem;line-height:1.55;margin:0 0 10px">
            La distribuidora tiene 8 equipos. El administrador eligió <strong>Clase C</strong> con la red
            <code style="background:#c8e6c9;padding:2px 5px;border-radius:4px">192.168.0.0/24</code>
          </p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:.8rem">
            <div style="background:#fff;padding:8px;border-radius:6px;border-left:3px solid #2e7d32">
              <div style="font-weight:700;color:#1b5e20">Router/Gateway</div>
              <div style="color:#546e7a">192.168.0.1</div>
            </div>
            <div style="background:#fff;padding:8px;border-radius:6px;border-left:3px solid #2e7d32">
              <div style="font-weight:700;color:#1b5e20">Servidor NAS</div>
              <div style="color:#546e7a">192.168.0.5</div>
            </div>
            <div style="background:#fff;padding:8px;border-radius:6px;border-left:3px solid #f57c00">
              <div style="font-weight:700;color:#e65100">PCs Inventario</div>
              <div style="color:#546e7a">192.168.0.10–17</div>
            </div>
            <div style="background:#fff;padding:8px;border-radius:6px;border-left:3px solid #1565c0">
              <div style="font-weight:700;color:#1565c0">Impresoras</div>
              <div style="color:#546e7a">192.168.0.20–22</div>
            </div>
          </div>
        </div>
      </div>
    `
  },
  ip3: {
    title: "🚪 Gateway y DNS — Cómo salen tus datos a Internet",
    html: `
      <div class="tp-sec">
        <p class="tp-h">🚪 ¿Qué es el Gateway?</p>
        <div class="tp-card">
          <p style="color:#37474f;font-size:.9rem;line-height:1.65;margin:0 0 12px">
            El <strong>gateway</strong> es el dispositivo (generalmente el router) que conecta tu red local
            con redes externas como Internet. Es la "puerta de salida" que todo paquete debe cruzar.
          </p>
          <svg viewBox="0 0 340 85" style="width:100%;max-width:340px;display:block;margin:0 auto 8px" aria-hidden="true">
            <defs>
              <marker id="tparr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L0,6 L6,3 z" fill="#2e7d32"/>
              </marker>
            </defs>
            <!-- PC -->
            <rect x="6" y="22" width="44" height="32" rx="4" fill="#e8f5e9" stroke="#2e7d32" stroke-width="1.5"/>
            <rect x="13" y="26" width="30" height="18" rx="2" fill="#a5d6a7"/>
            <rect x="19" y="46" width="18" height="4" rx="1" fill="#81c784"/>
            <text x="28" y="68" text-anchor="middle" font-size="8" fill="#1b5e20" font-weight="600">PC</text>
            <line x1="50" y1="38" x2="78" y2="38" stroke="#2e7d32" stroke-width="1.5" marker-end="url(#tparr)"/>
            <!-- Switch -->
            <rect x="78" y="25" width="44" height="26" rx="4" fill="#e3f2fd" stroke="#1565c0" stroke-width="1.5"/>
            <circle cx="90" cy="38" r="3" fill="#42a5f5"/>
            <circle cx="100" cy="38" r="3" fill="#42a5f5"/>
            <circle cx="110" cy="38" r="3" fill="#42a5f5"/>
            <text x="100" y="65" text-anchor="middle" font-size="8" fill="#1565c0" font-weight="600">Switch</text>
            <line x1="122" y1="38" x2="150" y2="38" stroke="#2e7d32" stroke-width="1.5" marker-end="url(#tparr)"/>
            <!-- Router -->
            <ellipse cx="174" cy="38" rx="24" ry="16" fill="#fff8e1" stroke="#f57c00" stroke-width="1.5"/>
            <text x="174" y="36" text-anchor="middle" font-size="7.5" fill="#e65100" font-weight="700">Router</text>
            <text x="174" y="46" text-anchor="middle" font-size="7" fill="#e65100">Gateway</text>
            <text x="174" y="68" text-anchor="middle" font-size="7.5" fill="#e65100" font-weight="600">192.168.1.1</text>
            <!-- animated dashed arrow to internet -->
            <line x1="198" y1="38" x2="228" y2="38" stroke="#f57c00" stroke-width="2" stroke-dasharray="5,3">
              <animate attributeName="stroke-dashoffset" from="0" to="-16" dur=".9s" repeatCount="indefinite"/>
            </line>
            <!-- Internet cloud -->
            <ellipse cx="268" cy="33" rx="22" ry="13" fill="#e1f5fe" stroke="#0288d1" stroke-width="1.5"/>
            <ellipse cx="256" cy="40" rx="14" ry="9" fill="#e1f5fe" stroke="#0288d1" stroke-width="1.5"/>
            <ellipse cx="280" cy="41" rx="14" ry="8" fill="#e1f5fe" stroke="#0288d1" stroke-width="1.5"/>
            <text x="268" y="38" text-anchor="middle" font-size="10" fill="#0277bd">🌐</text>
            <text x="268" y="68" text-anchor="middle" font-size="8" fill="#0277bd" font-weight="600">Internet</text>
            <!-- moving packet -->
            <circle r="5" fill="#f57c00" opacity=".9">
              <animateMotion dur="2s" repeatCount="indefinite" path="M 50 38 L 228 38"/>
            </circle>
          </svg>
          <p style="color:#546e7a;font-size:.8rem;text-align:center;margin:0">PC → Switch → Router (gateway) → Internet</p>
        </div>
      </div>
      <div class="tp-sec">
        <p class="tp-h">🔗 ¿Qué es el DNS?</p>
        <div class="tp-card">
          <p style="color:#37474f;font-size:.9rem;line-height:1.65;margin:0 0 10px">
            El <strong>DNS</strong> (Sistema de Nombres de Dominio) traduce nombres como
            <code style="background:#c8e6c9;padding:2px 5px;border-radius:4px">www.sena.edu.co</code>
            a la IP real del servidor. Es como una <em>agenda telefónica de Internet</em>.
          </p>
          <p style="font-weight:700;color:#2e7d32;font-size:.82rem;margin:0 0 8px">Pasos de una consulta DNS:</p>
          <div class="dns-step" style="animation-delay:.1s">
            <div class="dns-num">1</div>
            <div style="color:#37474f;font-size:.85rem;line-height:1.5">Tu PC escribe <strong>www.sena.edu.co</strong> en el navegador</div>
          </div>
          <div class="dns-step" style="animation-delay:.3s">
            <div class="dns-num">2</div>
            <div style="color:#37474f;font-size:.85rem;line-height:1.5">El sistema operativo pregunta al <strong>servidor DNS</strong> (ej. 8.8.8.8 de Google)</div>
          </div>
          <div class="dns-step" style="animation-delay:.5s">
            <div class="dns-num">3</div>
            <div style="color:#37474f;font-size:.85rem;line-height:1.5">El DNS responde con la <strong>IP del servidor</strong> (ej. 181.53.210.100)</div>
          </div>
          <div class="dns-step" style="animation-delay:.7s">
            <div class="dns-num">4</div>
            <div style="color:#37474f;font-size:.85rem;line-height:1.5">Tu PC se conecta directamente a esa IP y carga la página</div>
          </div>
        </div>
      </div>
      <div class="tp-sec">
        <p class="tp-h">⚙️ Configuración típica de red</p>
        <div class="tp-card">
          <table style="width:100%;border-collapse:collapse;font-size:.82rem">
            <thead><tr style="background:#1b5e20;color:#fff">
              <th style="padding:7px 10px;text-align:left">Parámetro</th>
              <th style="padding:7px 10px;text-align:left">Valor ejemplo</th>
              <th style="padding:7px 10px;text-align:left">Qué hace</th>
            </tr></thead>
            <tbody>
              <tr style="background:#f1f8e9"><td style="padding:6px 10px">IP equipo</td><td style="padding:6px 10px">192.168.1.50</td><td style="padding:6px 10px">Identifica al PC</td></tr>
              <tr><td style="padding:6px 10px">Máscara</td><td style="padding:6px 10px">255.255.255.0</td><td style="padding:6px 10px">Delimita la red</td></tr>
              <tr style="background:#f1f8e9"><td style="padding:6px 10px">Gateway</td><td style="padding:6px 10px">192.168.1.1</td><td style="padding:6px 10px">Salida a Internet</td></tr>
              <tr><td style="padding:6px 10px">DNS</td><td style="padding:6px 10px">8.8.8.8</td><td style="padding:6px 10px">Traduce nombres</td></tr>
            </tbody>
          </table>
          <p style="color:#546e7a;font-size:.78rem;margin:8px 0 0">
            💡 El gateway y el DNS suelen ser la misma IP del router en redes domésticas y de pequeñas empresas.
          </p>
        </div>
      </div>
    `
  },
  ip4: {
    title: "Analizar una direccion IP paso a paso",
    html: `
      <div class="tp-sec">
        <p class="tp-h">Ejemplo guiado distinto al taller</p>
        <div class="tp-card">
          <p style="color:#37474f;font-size:.9rem;line-height:1.65;margin:0 0 10px">
            Este <strong>ejemplo guiado</strong> usa una direccion diferente para que practiques
            el procedimiento sin ver resuelto el mismo ejercicio del taller.
            Vamos a analizar <strong>150.20.8.12</strong> con mascara <strong>255.255.0.0</strong>.
          </p>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px">
            <div style="background:#fff;padding:10px 12px;border-radius:8px;border-left:4px solid #2e7d32">
              <div style="font-size:.76rem;color:#78909c;text-transform:uppercase;letter-spacing:.04em">IP</div>
              <div style="font-weight:800;color:#1b5e20">150.20.8.12</div>
            </div>
            <div style="background:#fff;padding:10px 12px;border-radius:8px;border-left:4px solid #1565c0">
              <div style="font-size:.76rem;color:#78909c;text-transform:uppercase;letter-spacing:.04em">Mascara</div>
              <div style="font-weight:800;color:#1565c0">255.255.0.0 /16</div>
            </div>
          </div>
        </div>
      </div>
      <div class="tp-sec">
        <p class="tp-h">1. Identifica la clase</p>
        <div class="tp-card">
          <p style="color:#37474f;font-size:.86rem;line-height:1.6;margin:0 0 10px">
            El primer octeto es <strong>150</strong>. Las direcciones que empiezan entre
            <strong>128 y 191</strong> pertenecen a <strong>Clase B</strong>.
          </p>
          <div style="background:#fff;padding:10px 12px;border-radius:8px;border-left:4px solid #6a1b9a;color:#4a148c;font-weight:700">
            Resultado del ejemplo: Clase B
          </div>
        </div>
      </div>
      <div class="tp-sec">
        <p class="tp-h">2. Separa red y host</p>
        <div class="tp-card">
          <p style="color:#37474f;font-size:.86rem;line-height:1.6;margin:0 0 10px">
            Con <strong>255.255.0.0</strong> la red usa los primeros <strong>2 octetos</strong>
            y el host usa los <strong>2 ultimos</strong>.
          </p>
          <div style="display:flex;border-radius:8px;overflow:hidden;margin-bottom:10px">
            <div style="flex:2;background:#1b5e20;color:#fff;padding:10px 8px;text-align:center;font-size:.85rem">
              <div style="font-weight:700">150.20</div>
              <div style="font-size:.74rem;opacity:.88">Parte de RED</div>
            </div>
            <div style="flex:2;background:#f57c00;color:#fff;padding:10px 8px;text-align:center;font-size:.85rem">
              <div style="font-weight:700">8.12</div>
              <div style="font-size:.74rem;opacity:.88">HOST</div>
            </div>
          </div>
          <p style="color:#546e7a;font-size:.8rem;margin:0">
            Puedes escribirlo como: <strong>Red = 150.20</strong> y <strong>Host = 8.12</strong>.
            La direccion de red completa es <strong>150.20.0.0</strong>.
          </p>
        </div>
      </div>
      <div class="tp-sec">
        <p class="tp-h">3. Calcula cuantos hosts utiles tiene</p>
        <div class="tp-card">
          <p style="color:#37474f;font-size:.86rem;line-height:1.6;margin:0 0 10px">
            Una mascara <strong>/16</strong> deja <strong>16 bits</strong> para hosts.
          </p>
          <div style="background:#fff;padding:12px;border-radius:8px;border-left:4px solid #1565c0">
            <div style="font-weight:800;color:#1565c0;margin-bottom:6px">Calculo</div>
            <div style="font-size:.9rem;color:#37474f"><strong>2^16 - 2 = 65534 hosts</strong></div>
            <div style="font-size:.78rem;color:#546e7a;margin-top:6px">
              Se restan 2 porque una direccion es la red (<strong>150.20.0.0</strong>)
              y otra es el broadcast (<strong>150.20.255.255</strong>).
            </div>
          </div>
        </div>
      </div>
      <div class="tp-sec">
        <p class="tp-h">4. Define si es privada o publica</p>
        <div class="tp-card">
          <p style="color:#37474f;font-size:.86rem;line-height:1.6;margin:0 0 10px">
            En Clase B, el rango privado es <strong>172.16.0.0 - 172.31.255.255</strong>.
            Como <strong>150.20.8.12</strong> no cae en ese rango, se considera una IP
            <strong>publica</strong>.
          </p>
          <div style="background:#fff;padding:10px 12px;border-radius:8px;border-left:4px solid #2e7d32;color:#1b5e20;font-weight:700">
            Resultado del ejemplo: IP publica
          </div>
        </div>
      </div>
      <div class="tp-sec">
        <p class="tp-h">Resumen rapido para contestar</p>
        <div class="tp-card">
          <table style="width:100%;border-collapse:collapse;font-size:.82rem">
            <thead><tr style="background:#1b5e20;color:#fff">
              <th style="padding:7px 10px;text-align:left">Pregunta</th>
              <th style="padding:7px 10px;text-align:left">Pista</th>
            </tr></thead>
            <tbody>
              <tr style="background:#f1f8e9"><td style="padding:6px 10px">Clase</td><td style="padding:6px 10px">Primer octeto 150 = Clase B</td></tr>
              <tr><td style="padding:6px 10px">Red y host</td><td style="padding:6px 10px">Red 150.20 - Host 8.12</td></tr>
              <tr style="background:#f1f8e9"><td style="padding:6px 10px">Hosts utiles</td><td style="padding:6px 10px">2^16 - 2 = 65534 hosts</td></tr>
              <tr><td style="padding:6px 10px">Privada o publica</td><td style="padding:6px 10px">Solo 172.16 a 172.31 es privada en Clase B</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `
  },
  ip5: {
    title: "Asignar IPs en una red local paso a paso",
    html: `
      <div class="tp-sec">
        <p class="tp-h">Ejemplo guiado distinto al taller</p>
        <div class="tp-card">
          <p style="color:#37474f;font-size:.9rem;line-height:1.65;margin:0 0 10px">
            Este material usa una red diferente para mostrar el procedimiento sin resolver
            el caso de la Ferretera. Ejemplo: <strong>192.168.50.0/24</strong> con
            <strong>gateway 192.168.50.1</strong>.
          </p>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px">
            <div style="background:#fff;padding:10px 12px;border-radius:8px;border-left:4px solid #2e7d32">
              <div style="font-size:.76rem;color:#78909c;text-transform:uppercase;letter-spacing:.04em">Red</div>
              <div style="font-weight:800;color:#1b5e20">192.168.50.0</div>
            </div>
            <div style="background:#fff;padding:10px 12px;border-radius:8px;border-left:4px solid #1565c0">
              <div style="font-size:.76rem;color:#78909c;text-transform:uppercase;letter-spacing:.04em">Mascara</div>
              <div style="font-weight:800;color:#1565c0">255.255.255.0 /24</div>
            </div>
            <div style="background:#fff;padding:10px 12px;border-radius:8px;border-left:4px solid #f57c00">
              <div style="font-size:.76rem;color:#78909c;text-transform:uppercase;letter-spacing:.04em">Gateway</div>
              <div style="font-weight:800;color:#e65100">192.168.50.1</div>
            </div>
          </div>
        </div>
      </div>
      <div class="tp-sec">
        <p class="tp-h">1. Identifica las direcciones reservadas</p>
        <div class="tp-card">
          <table style="width:100%;border-collapse:collapse;font-size:.82rem">
            <thead><tr style="background:#1b5e20;color:#fff">
              <th style="padding:7px 10px;text-align:left">Direccion</th>
              <th style="padding:7px 10px;text-align:left">Uso</th>
            </tr></thead>
            <tbody>
              <tr style="background:#f1f8e9"><td style="padding:6px 10px">192.168.50.0</td><td style="padding:6px 10px">Direccion de red</td></tr>
              <tr><td style="padding:6px 10px">192.168.50.1</td><td style="padding:6px 10px">Gateway / router</td></tr>
              <tr style="background:#f1f8e9"><td style="padding:6px 10px">192.168.50.255</td><td style="padding:6px 10px">Broadcast</td></tr>
            </tbody>
          </table>
          <p style="color:#546e7a;font-size:.8rem;margin:10px 0 0;line-height:1.55">
            Nunca asignes la <strong>.0</strong> ni la <strong>.255</strong> a equipos finales.
            La <strong>.1</strong> ya quedó reservada para el gateway.
          </p>
        </div>
      </div>
      <div class="tp-sec">
        <p class="tp-h">2. Organiza un rango limpio para los equipos</p>
        <div class="tp-card">
          <p style="color:#37474f;font-size:.86rem;line-height:1.6;margin:0 0 10px">
            Una buena practica es <strong>empezar en .10</strong> para dejar libres las direcciones
            bajas por si luego necesitas switches gestionables, access points, DVR, otra impresora
            o mas infraestructura.
          </p>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px">
            <div style="background:#fff;padding:10px 12px;border-radius:8px;border-left:4px solid #1565c0">
              <div style="font-weight:700;color:#1565c0">Infraestructura reservada</div>
              <div style="color:#546e7a;font-size:.82rem">192.168.50.2 - 192.168.50.9</div>
            </div>
            <div style="background:#fff;padding:10px 12px;border-radius:8px;border-left:4px solid #2e7d32">
              <div style="font-weight:700;color:#1b5e20">Equipos de usuario</div>
              <div style="color:#546e7a;font-size:.82rem">192.168.50.10 en adelante</div>
            </div>
          </div>
        </div>
      </div>
      <div class="tp-sec">
        <p class="tp-h">3. Ejemplo de asignacion</p>
        <div class="tp-card">
          <table style="width:100%;border-collapse:collapse;font-size:.82rem">
            <thead><tr style="background:#1b5e20;color:#fff">
              <th style="padding:7px 10px;text-align:left">Dispositivo</th>
              <th style="padding:7px 10px;text-align:left">IP sugerida</th>
              <th style="padding:7px 10px;text-align:left">Motivo</th>
            </tr></thead>
            <tbody>
              <tr style="background:#f1f8e9"><td style="padding:6px 10px">PC Caja</td><td style="padding:6px 10px">192.168.50.10</td><td style="padding:6px 10px">Inicio ordenado del rango de usuarios</td></tr>
              <tr><td style="padding:6px 10px">PC Administracion</td><td style="padding:6px 10px">192.168.50.11</td><td style="padding:6px 10px">Secuencia continua</td></tr>
              <tr style="background:#f1f8e9"><td style="padding:6px 10px">PC Bodega</td><td style="padding:6px 10px">192.168.50.12</td><td style="padding:6px 10px">Facilita inventario</td></tr>
              <tr><td style="padding:6px 10px">PC Ventas</td><td style="padding:6px 10px">192.168.50.13</td><td style="padding:6px 10px">Mantiene orden consecutivo</td></tr>
              <tr style="background:#f1f8e9"><td style="padding:6px 10px">Impresora</td><td style="padding:6px 10px">192.168.50.20</td><td style="padding:6px 10px">Conviene separar perifericos</td></tr>
              <tr><td style="padding:6px 10px">Camara IP</td><td style="padding:6px 10px">192.168.50.30</td><td style="padding:6px 10px">Otro bloque para vigilancia</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="tp-sec">
        <p class="tp-h">4. Como justificar tu respuesta</p>
        <div class="tp-card">
          <p style="color:#37474f;font-size:.86rem;line-height:1.65;margin:0 0 10px">
            Una justificacion valida puede decir:
          </p>
          <div style="background:#fff;padding:12px;border-radius:8px;border-left:4px solid #6a1b9a;color:#4a148c;font-size:.84rem;line-height:1.6">
            "Empece en .10 porque .0 es la red, .255 es broadcast y .1 se usa como gateway.
            Ademas deje libres las direcciones bajas para equipos de infraestructura y mantuve
            un orden consecutivo para administrar mejor la red."
          </div>
        </div>
      </div>
    `
  },
  ip6: {
    title: "Interpretar IPv4, mascara, gateway y DNS",
    html: `
      <div class="tp-sec">
        <p class="tp-h">Ejemplo guiado distinto al equipo del aprendiz</p>
        <div class="tp-card">
          <p style="color:#37474f;font-size:.9rem;line-height:1.65;margin:0 0 10px">
            Usa este <strong>ejemplo guiado</strong> para aprender a leer un pantallazo de
            <code style="background:#c8e6c9;padding:2px 5px;border-radius:4px">ipconfig /all</code>
            sin responder con los datos reales de tu computador.
          </p>
          <table style="width:100%;border-collapse:collapse;font-size:.82rem">
            <thead><tr style="background:#1b5e20;color:#fff">
              <th style="padding:7px 10px;text-align:left">Parametro</th>
              <th style="padding:7px 10px;text-align:left">Valor ejemplo</th>
            </tr></thead>
            <tbody>
              <tr style="background:#f1f8e9"><td style="padding:6px 10px">IPv4</td><td style="padding:6px 10px">10.0.5.23</td></tr>
              <tr><td style="padding:6px 10px">Mascara</td><td style="padding:6px 10px">255.255.255.0</td></tr>
              <tr style="background:#f1f8e9"><td style="padding:6px 10px">Gateway</td><td style="padding:6px 10px">10.0.5.1</td></tr>
              <tr><td style="padding:6px 10px">DNS</td><td style="padding:6px 10px">8.8.8.8 y 1.1.1.1</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="tp-sec">
        <p class="tp-h">1. Direccion IPv4</p>
        <div class="tp-card">
          <p style="color:#37474f;font-size:.86rem;line-height:1.6;margin:0 0 10px">
            La <strong>IPv4</strong> identifica al equipo dentro de la red. En el ejemplo,
            <strong>10.0.5.23</strong> es la direccion del computador.
          </p>
          <div style="background:#fff;padding:10px 12px;border-radius:8px;border-left:4px solid #2e7d32;color:#1b5e20">
            Puedes responder: "Sirve para identificar mi computador dentro de la red local."
          </div>
        </div>
      </div>
      <div class="tp-sec">
        <p class="tp-h">2. Mascara de subred</p>
        <div class="tp-card">
          <p style="color:#37474f;font-size:.86rem;line-height:1.6;margin:0 0 10px">
            La <strong>mascara</strong> indica qu\u00e9 parte de la IP corresponde a la red y qu\u00e9
            parte al host. En <strong>255.255.255.0</strong>, los tres primeros octetos son red.
          </p>
          <div style="display:flex;border-radius:8px;overflow:hidden;margin-bottom:10px">
            <div style="flex:3;background:#1565c0;color:#fff;padding:10px 8px;text-align:center;font-size:.85rem">
              <div style="font-weight:700">10.0.5</div>
              <div style="font-size:.74rem;opacity:.88">RED</div>
            </div>
            <div style="flex:1;background:#f57c00;color:#fff;padding:10px 8px;text-align:center;font-size:.85rem">
              <div style="font-weight:700">23</div>
              <div style="font-size:.74rem;opacity:.88">HOST</div>
            </div>
          </div>
          <div style="background:#fff;padding:10px 12px;border-radius:8px;border-left:4px solid #1565c0;color:#0d47a1">
            Puedes responder: "Sirve para separar la parte de red y la parte del equipo."
          </div>
        </div>
      </div>
      <div class="tp-sec">
        <p class="tp-h">3. Puerta de enlace predeterminada</p>
        <div class="tp-card">
          <p style="color:#37474f;font-size:.86rem;line-height:1.6;margin:0 0 10px">
            El <strong>gateway</strong> es la salida de la red local hacia otras redes o Internet.
            En el ejemplo es <strong>10.0.5.1</strong>, normalmente el router.
          </p>
          <div style="background:#fff;padding:10px 12px;border-radius:8px;border-left:4px solid #f57c00;color:#e65100">
            Puedes responder: "Sirve para que mi computador salga a Internet o a otras redes."
          </div>
        </div>
      </div>
      <div class="tp-sec">
        <p class="tp-h">4. Servidores DNS</p>
        <div class="tp-card">
          <p style="color:#37474f;font-size:.86rem;line-height:1.6;margin:0 0 10px">
            Los <strong>DNS</strong> traducen nombres de paginas a direcciones IP. En el ejemplo
            aparecen <strong>8.8.8.8</strong> y <strong>1.1.1.1</strong>.
          </p>
          <div style="background:#fff;padding:10px 12px;border-radius:8px;border-left:4px solid #6a1b9a;color:#4a148c">
            Puedes responder: "Sirven para traducir nombres como google.com a una IP real."
          </div>
        </div>
      </div>
      <div class="tp-sec">
        <p class="tp-h">Como leer tu pantallazo</p>
        <div class="tp-card">
          <ol style="margin:0;padding-left:18px;color:#37474f;font-size:.84rem;line-height:1.65">
            <li>Busca la linea que diga <strong>Direccion IPv4</strong>.</li>
            <li>Ubica la <strong>Mascara de subred</strong>.</li>
            <li>Identifica la <strong>Puerta de enlace predeterminada</strong>.</li>
            <li>Revisa uno o dos valores en <strong>Servidores DNS</strong>.</li>
          </ol>
        </div>
      </div>
    `
  },
  ip7: {
    title: "Elegir la clase IP segun cantidad de dispositivos",
    html: `
      <div class="tp-sec">
        <p class="tp-h">Regla principal</p>
        <div class="tp-card">
          <p style="color:#37474f;font-size:.9rem;line-height:1.65;margin:0 0 10px">
            Para este tipo de ejercicio, <strong>elige la clase mas pequena</strong> que
            soporte la cantidad de equipos que necesita la empresa. No se trata de escoger
            la clase mas grande, sino la que sea suficiente para ese caso.
          </p>
          <table style="width:100%;border-collapse:collapse;font-size:.82rem">
            <thead><tr style="background:#1b5e20;color:#fff">
              <th style="padding:7px 10px;text-align:left">Clase</th>
              <th style="padding:7px 10px;text-align:left">Capacidad util</th>
              <th style="padding:7px 10px;text-align:left">Cuando conviene</th>
            </tr></thead>
            <tbody>
              <tr style="background:#f1f8e9"><td style="padding:6px 10px">Clase C</td><td style="padding:6px 10px">Hasta 254 hosts</td><td style="padding:6px 10px">Negocios pequenos</td></tr>
              <tr><td style="padding:6px 10px">Clase B</td><td style="padding:6px 10px">Hasta 65534 hosts</td><td style="padding:6px 10px">Empresas medianas o con varias areas</td></tr>
              <tr style="background:#f1f8e9"><td style="padding:6px 10px">Clase A</td><td style="padding:6px 10px">Hasta 16777214 hosts</td><td style="padding:6px 10px">Organizaciones muy grandes</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="tp-sec">
        <p class="tp-h">Ejemplo guiado distinto al taller</p>
        <div class="tp-card">
          <p style="color:#37474f;font-size:.86rem;line-height:1.6;margin:0 0 10px">
            Estos ejemplos son diferentes a los del ejercicio para que practiques el criterio
            sin ver respondidos los casos reales.
          </p>
          <table style="width:100%;border-collapse:collapse;font-size:.82rem">
            <thead><tr style="background:#1565c0;color:#fff">
              <th style="padding:7px 10px;text-align:left">Caso</th>
              <th style="padding:7px 10px;text-align:left">Cantidad</th>
              <th style="padding:7px 10px;text-align:left">Clase sugerida</th>
            </tr></thead>
            <tbody>
              <tr style="background:#eef7ff"><td style="padding:6px 10px">Papeleria escolar</td><td style="padding:6px 10px">120 dispositivos</td><td style="padding:6px 10px"><strong>Clase C</strong></td></tr>
              <tr><td style="padding:6px 10px">Clinica municipal</td><td style="padding:6px 10px">900 dispositivos</td><td style="padding:6px 10px"><strong>Clase B</strong></td></tr>
              <tr style="background:#eef7ff"><td style="padding:6px 10px">Operador logistico nacional</td><td style="padding:6px 10px">120000 dispositivos</td><td style="padding:6px 10px"><strong>Clase A</strong></td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="tp-sec">
        <p class="tp-h">Como razonar cada caso</p>
        <div class="tp-card">
          <div style="display:grid;gap:10px">
            <div style="background:#fff;padding:12px;border-radius:10px;border-left:4px solid #2e7d32">
              <div style="font-weight:800;color:#1b5e20;margin-bottom:4px">120 dispositivos</div>
              <div style="color:#455a64;font-size:.84rem;line-height:1.55">
                Como 120 es menor que 254, una <strong>Clase C</strong> es suficiente.
                No hace falta subir a Clase B.
              </div>
            </div>
            <div style="background:#fff;padding:12px;border-radius:10px;border-left:4px solid #1565c0">
              <div style="font-weight:800;color:#1565c0;margin-bottom:4px">900 dispositivos</div>
              <div style="color:#455a64;font-size:.84rem;line-height:1.55">
                900 ya supera 254, asi que <strong>Clase C no alcanza</strong>.
                La siguiente opcion valida es <strong>Clase B</strong>.
              </div>
            </div>
            <div style="background:#fff;padding:12px;border-radius:10px;border-left:4px solid #6a1b9a">
              <div style="font-weight:800;color:#6a1b9a;margin-bottom:4px">120000 dispositivos</div>
              <div style="color:#455a64;font-size:.84rem;line-height:1.55">
                120000 supera la capacidad de Clase B, por eso aqui ya se requiere
                <strong>Clase A</strong>.
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="tp-sec">
        <p class="tp-h">Frase modelo para justificar</p>
        <div class="tp-card">
          <div style="background:#fff;padding:12px;border-radius:8px;border-left:4px solid #f57c00;color:#5d4037;font-size:.84rem;line-height:1.65">
            "Elegi esa clase porque es la menor que soporta la cantidad de dispositivos
            del caso. Compare el numero de equipos con la capacidad maxima de las clases C,
            B y A, y descarte las que no alcanzaban."
          </div>
        </div>
      </div>
    `
  }
};

window.abrirTeoriaPanel = function (tipo) {
  const panel    = document.getElementById("teoria-panel");
  const backdrop = document.getElementById("teoria-backdrop");
  const title    = document.getElementById("teoria-panel-title");
  const body     = document.getElementById("teoria-panel-body");
  const content  = TEORIA_PANEL_CONTENTS[tipo];
  if (!panel || !content) return;
  title.textContent = content.title;
  body.innerHTML    = content.html;
  panel.style.transform            = "translateX(0)";
  backdrop.style.opacity           = "1";
  backdrop.style.pointerEvents     = "auto";
  document.body.style.overflow     = "hidden";
};

window.cerrarTeoriaPanel = function () {
  const panel    = document.getElementById("teoria-panel");
  const backdrop = document.getElementById("teoria-backdrop");
  if (!panel) return;
  panel.style.transform        = "translateX(110%)";
  backdrop.style.opacity       = "0";
  backdrop.style.pointerEvents = "none";
  document.body.style.overflow = "";
};

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
function initGuiaRedes() {
  if (redesBooted) {
    updateProgressRedes();
    return;
  }

  redesBooted = true;
  state = loadStateRedes();
  renderEvidenceTable();
  renderQuizRedesStatus();
  renderGlossary();
  renderSupportMaterialsRedes();
  renderTopbarCampus();
  hydrateFieldsRedes();
  bindEventsRedes();
  updateProgressRedes();
  initCloudSyncRedes();
}

window.initGuiaRedes = initGuiaRedes;

if (!window.__GUIDE_CONTEXT__) {
  document.addEventListener("DOMContentLoaded", initGuiaRedes);
}

document.addEventListener("guide-activity-check-change", () => {
  window.requestAnimationFrame(updateProgressRedes);
});
