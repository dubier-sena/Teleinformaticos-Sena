/* script_guia_redes.js — Guia 2 Redes RAP01 | Santa Barbara 10A/10B */
const PAGE_FILE_REDES = window.location.pathname.split("/").pop().toLowerCase() || "guia.html";
const STORAGE_FILE_ALIASES_REDES = {
  "santa-barbara-10a-guia-02-redes-rap01.html": "sb_10a_redes.html",
  "santa-barbara-10b-guia-02-redes-rap01.html": "sb_10b_redes.html",
};
const GUIDE_DATA_FILE_REDES = STORAGE_FILE_ALIASES_REDES[PAGE_FILE_REDES] || PAGE_FILE_REDES;
const PAGE_KEY_REDES = GUIDE_DATA_FILE_REDES.replace(/[^a-z0-9]+/g, "_");
const _portalAuth = window.portalAuth || null;
const LEGACY_STORAGE_KEY_REDES = "guia_interactiva_" + PAGE_KEY_REDES;
const STORAGE_KEY_REDES = _portalAuth
  ? _portalAuth.getScopedStorageKey(LEGACY_STORAGE_KEY_REDES, { area: "guide-data" })
  : LEGACY_STORAGE_KEY_REDES;
const STORAGE_META_KEY_REDES = STORAGE_KEY_REDES + "__meta";
const SCOPED_STORAGE_ENABLED_REDES = STORAGE_KEY_REDES !== LEGACY_STORAGE_KEY_REDES;
const CLOUD_SYNC_DELAY_REDES = 1200;
const CLOUD_REFRESH_REDES = 8000;

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

function getGuideSelectionRedes() {
  try {
    const raw = localStorage.getItem("sena_portal_session") || localStorage.getItem("portal_session") || "";
    const session = raw ? JSON.parse(raw) : null;
    if (session) {
      return {
        ficha: session.ficha || session.fichaId || "",
        inst: session.inst || session.institucion || "",
        grupo: session.grupo || "",
      };
    }
  } catch {}
  const bodyEl = document.body;
  return {
    ficha: bodyEl.dataset.defaultFicha || "",
    inst: bodyEl.dataset.defaultInst || "",
    grupo: bodyEl.dataset.defaultGrupo || "",
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
}

function applyReflexionSocializacionLock() {
  if (!state["reflexion-socializacion-locked"]) return;
  const ta = document.getElementById("socializacionTextarea311");
  if (ta) { ta.disabled = true; ta.style.opacity = "0.75"; }
  const btn = document.getElementById("btnEnviarSocializacion");
  if (btn) { btn.disabled = true; btn.textContent = "\u2705 Enviado"; }
  const status = document.getElementById("socializacionStatus311");
  if (status) status.style.display = "block";
}

const BLOQUEA_KEYS = ["bloqueA-1", "bloqueA-2", "bloqueA-3"];

function applyBloqueALock() {
  if (!state["bloqueA-locked"]) return;
  BLOQUEA_KEYS.forEach((k) => {
    const el = document.querySelector(`[data-store="${k}"]`);
    if (el) { el.disabled = true; el.style.opacity = "0.75"; }
  });
  const input = document.getElementById("bloqueAImagenInput");
  if (input) input.disabled = true;
  const label = document.getElementById("bloqueAImagenLabel");
  if (label) { label.style.opacity = "0.5"; label.style.pointerEvents = "none"; }
  const btn = document.getElementById("btnGuardarBloqueA");
  if (btn) { btn.disabled = true; btn.textContent = "\u2705 Respuestas guardadas"; }
  const status = document.getElementById("bloqueAStatus");
  if (status) status.style.display = "block";
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
  if (!state["bloqueB-locked"]) return;
  BLOQUEB_KEYS.forEach((k) => {
    const el = document.querySelector(`[data-store="${k}"]`);
    if (el) { el.disabled = true; el.style.opacity = "0.75"; }
  });
  const input = document.getElementById("bloqueBImagenInput");
  if (input) input.disabled = true;
  const label = document.getElementById("bloqueBImagenLabel");
  if (label) { label.style.opacity = "0.5"; label.style.pointerEvents = "none"; }
  const btn = document.getElementById("btnGuardarBloqueB");
  if (btn) { btn.disabled = true; btn.textContent = "\u2705 Respuestas guardadas"; }
  const status = document.getElementById("bloqueBStatus");
  if (status) status.style.display = "block";
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
  if (!state["bloqueC-locked"]) return;
  document.querySelectorAll('[data-store^="bloqueC-"]').forEach((el) => {
    el.disabled = true;
    el.style.opacity = "0.75";
  });
  const btn = document.getElementById("btnGuardarBloqueC");
  if (btn) { btn.disabled = true; btn.textContent = "\u2705 Respuestas guardadas"; }
  const status = document.getElementById("bloqueCStatus");
  if (status) status.style.display = "block";
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
  if (!state["bloqueD-locked"]) return;
  document.querySelectorAll('[data-store^="bloqueD-"]').forEach((el) => {
    el.disabled = true;
    el.style.opacity = "0.75";
  });
  const btn = document.getElementById("btnGuardarBloqueD");
  if (btn) { btn.disabled = true; btn.textContent = "\u2705 Respuestas guardadas"; }
  const status = document.getElementById("bloqueDStatus");
  if (status) status.style.display = "block";
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
  if (!state["bloqueE-locked"]) return;
  document.querySelectorAll('[data-store^="bloqueE-"]').forEach((el) => {
    el.disabled = true;
    el.style.opacity = "0.75";
  });
  const input = document.getElementById("bloqueEImagenInput");
  if (input) input.disabled = true;
  const label = document.getElementById("bloqueEImagenLabel");
  if (label) { label.style.opacity = "0.5"; label.style.pointerEvents = "none"; }
  const btn = document.getElementById("btnGuardarBloqueE");
  if (btn) { btn.disabled = true; btn.textContent = "\u2705 Respuestas guardadas"; }
  const status = document.getElementById("bloqueEStatus");
  if (status) status.style.display = "block";
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

    const session = window._portalAuth?.getCurrentSession?.() || portalAuth?.getCurrentSession?.();
    const user = session && session.user ? session.user : null;
    const fullName = (user && user.fullName) || "Aprendiz";
    const ficha    = (user && user.ficha)    || "0000";
    const grupo    = document.body.dataset.defaultGrupo || "";
    const fecha    = new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
    const fileName = `Exploracion_Contextual_${fullName.replace(/\s+/g, "_")}_${ficha}.docx`;

    function val(key) { return String(state[key] || "").trim() || "(sin respuesta)"; }

    const { Document, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ImageRun, Packer } = window.docx;

    function makeBlockTitle(num, title) {
      return new Paragraph({
        children: [new TextRun({ text: `${num} \u2014 ${title}`, bold: true, size: 24, color: "1B5E20" })],
        spacing: { before: 320, after: 120 },
      });
    }

    function makeQuestion(q, key) {
      return [
        new Paragraph({
          children: [new TextRun({ text: q, bold: true, size: 19, color: "475569" })],
          spacing: { before: 120, after: 60 },
        }),
        new Paragraph({
          children: [new TextRun({ text: val(key), size: 20 })],
          indent: { left: 300 },
          spacing: { after: 140 },
        }),
      ];
    }

    function makeProductLabel(label) {
      return new Paragraph({
        children: [new TextRun({ text: `Producto \u2014 ${label}`, bold: true, size: 20, color: "1E40AF" })],
        spacing: { before: 200, after: 80 },
      });
    }

    async function makeImageParagraph(b64Key) {
      const b64Full = state[b64Key];
      if (!b64Full) {
        return new Paragraph({
          children: [new TextRun({ text: "(Sin imagen adjunta)", italics: true, size: 19, color: "94A3B8" })],
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
          children: [new TextRun({ text: "(Imagen no disponible)", italics: true, size: 19, color: "94A3B8" })],
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
              children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 18 })] })],
            })),
          }),
          ...rows.map(row => new TableRow({
            children: row.map(cell => new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: cell, size: 18 })] })],
            })),
          })),
        ],
      });
    }

    const imgA = await makeImageParagraph("bloqueA-imagen");
    const imgB = await makeImageParagraph("bloqueB-imagen");
    const imgE = await makeImageParagraph("bloqueE-imagen");

    const doc = new Document({
      sections: [{
        children: [
          // Encabezado
          new Paragraph({
            children: [new TextRun({ text: "Exploracion Visual por Bloques Tematicos", bold: true, size: 32, color: "1B5E20" })],
            spacing: { after: 80 },
          }),
          new Paragraph({
            children: [new TextRun({ text: `Guia 2 \u2014 Redes RAP01  |  Actividad 3.2.1`, size: 19, color: "475569" })],
            spacing: { after: 60 },
          }),
          new Paragraph({
            children: [new TextRun({ text: `${fullName}   |   Ficha: ${ficha}   |   Grupo: ${grupo}   |   ${fecha}`, size: 19, color: "64748B" })],
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
    const fileBase64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",").pop());
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const delivery = window.sharedAppsScriptDelivery;
    if (!delivery || typeof delivery.uploadToAppsScript !== "function") {
      throw new Error("El sistema de entrega no está disponible.");
    }
    const response = await delivery.uploadToAppsScript({
      guideLabel: "Guia 2",
      activityLabel: "Exploracion Contextual 3.2.1",
      activityNumber: "3.2.1",
      activityTitle: "Exploracion Visual por Bloques Tematicos",
      fileName,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileBase64,
      fullName, ficha, grupo,
      submittedAt: new Date().toISOString(),
    });

    if (btn) {
      if (response && response.driveUrl) {
        btn.innerHTML = `&#9989; Word entregado &mdash; <a href="${response.driveUrl}" target="_blank" rel="noopener" style="color:#fff;text-decoration:underline">Ver en Drive</a>`;
        btn.style.background = "linear-gradient(135deg,#1b5e20,#2e7d32)";
      } else {
        btn.innerHTML = "&#9989; Word entregado en Drive";
        btn.style.background = "linear-gradient(135deg,#1b5e20,#2e7d32)";
      }
      btn.disabled = false;
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
  const tracked = Array.from(document.querySelectorAll("[data-track]"));
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
];

function getCloudScopeKeyRedes() {
  const session = _portalAuth?.getCurrentSession?.();
  if (!session) return "";
  if (session.role === "admin") return `admin:${session.usernameKey || session.user?.usernameKey || "admin"}`;
  if (session.role === "student") return `student:${session.user?.usernameKey || ""}`;
  return "";
}

const IMAGE_KEYS_REDES = ["bloqueA-imagen", "bloqueB-imagen", "social-mapa", "ip1-imagen", "ip3-imagen"]; // Excluir base64 local del sync a Firebase; las URLs de Drive sí se guardan

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
  state = { ...state, ...remoteData };
  saveStateRedes({
    updatedAt: snapshot?.updatedAt || new Date().toISOString(),
  });
  hydrateFieldsRedes();
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
}

function enforceLockFlagsFromRemote(remoteData) {
  // Los flags de bloqueo en Firebase son autoritativos: si Firebase dice bloqueado, siempre se aplica
  LOCK_KEYS_REDES.forEach((k) => { if (remoteData[k]) state[k] = true; });
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
      enforceLockFlagsFromRemote(remote.data);
      if (snapshotTimeRedes(remote) > localSnapshotTimeRedes()) {
        applyCloudSnapshotRedes(remote);
      } else {
        applyAllLocksRedes(); // aunque el local sea más nuevo, respeta bloqueos de Firebase
        scheduleCloudSyncRedes();
      }
    }
    _cloudRefreshTimer = setInterval(async () => {
      try {
        const refreshed = await window._firebaseDb.cloudGetGuideData(scopeKey, GUIDE_DATA_FILE_REDES);
        if (refreshed?.data) {
          enforceLockFlagsFromRemote(refreshed.data);
          if (snapshotTimeRedes(refreshed) > localSnapshotTimeRedes()) {
            applyCloudSnapshotRedes(refreshed);
          } else {
            applyAllLocksRedes();
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
  if (!state["reflexion-311-locked"]) return;
  document.querySelectorAll("#reflexionForm311 [data-store]").forEach((f) => {
    f.disabled = true;
    f.style.opacity = "0.75";
  });
  const btn = document.getElementById("btnGuardarReflexion");
  if (btn) { btn.disabled = true; btn.textContent = "✅ Respuestas enviadas"; }
  const status = document.getElementById("reflexionStatus311");
  if (status) status.style.display = "block";
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
<style>body{font-family:Calibri,Arial;font-size:12pt;margin:2cm}
h1{font-size:16pt;color:#1b5e20}h2{font-size:13pt}p{margin:6pt 0;line-height:1.5}</style>
</head><body>
<h1>Actividad 3.1.1 – Reflexión Individual Escrita</h1>
<h2>Caso: La papelería de la señora Carmen</h2>
<p>Institución: ${escapeHtml(sel.inst || "")} &nbsp;|&nbsp; Grupo: ${escapeHtml(sel.grupo || "")} &nbsp;|&nbsp; Ficha: ${escapeHtml(sel.ficha || "")}</p>
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
// Word / Drive — Bloques IP1, IP2, IP3
// ---------------------------------------------------------------------------
function buildBloqueIP1WordFile() {
  const sel = getGuideSelectionRedes();
  const labels = [
    "1. Una dirección IP tiene 4 números separados por puntos (ej. 192.168.1.10). ¿Qué representa cada número?",
    "2. ¿Qué significa que una dirección IP tiene una parte de red y una parte de host?",
    "3. ¿Por qué no puede haber dos dispositivos con la misma IP en la misma red?",
  ];
  const rows = BLOQUE_IP1_KEYS.map((k, i) => `
    <p><b>${escapeHtml(labels[i])}</b></p>
    <p style="margin-left:20px;white-space:pre-wrap">${escapeHtml(String(state[k] || "(sin respuesta)"))}</p><br>`).join("");
  const imgSection = state["ip1-imagen-url"]
    ? `<h2>Producto — Diagrama IPv4</h2><p><a href="${state["ip1-imagen-url"]}">Ver diagrama en Drive</a></p>`
    : "";
  const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office'
    xmlns:w='urn:schemas-microsoft-com:office:word'
    xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'><title>Bloque 1 IPv4</title>
<style>body{font-family:Calibri,Arial;font-size:12pt;margin:2cm}
h1{font-size:16pt;color:#1b5e20}h2{font-size:13pt}p{margin:6pt 0;line-height:1.5}</style>
</head><body>
<h1>Actividad 3.3.1 \u2013 Bloque 1 \u2014 Estructura de una direcci\u00f3n IPv4</h1>
<p>Instituci\u00f3n: ${escapeHtml(sel.inst || "")} &nbsp;|&nbsp; Grupo: ${escapeHtml(sel.grupo || "")} &nbsp;|&nbsp; Ficha: ${escapeHtml(sel.ficha || "")}</p>
<hr>${rows}${imgSection}</body></html>`;
  const fileName = `Bloque1_IPv4_${sel.ficha || "sin_ficha"}.doc`;
  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  return new File([blob], fileName, { type: "application/msword" });
}

window.subirBloqueIP1AlDrive = function () {
  const file = buildBloqueIP1WordFile();
  window.sharedAppsScriptDelivery.openDeliveryModal({
    guideLabel: "Guia 2",
    activityNumber: "3.3.1",
    activityTitle: "Bloque 1 \u2014 Estructura de una direcci\u00f3n IPv4",
    activityLabel: "Actividad 3.3.1",
  });
  setTimeout(() => {
    const fileInput = document.querySelector("[data-shared-apps-file]");
    if (!fileInput) return;
    try { const dt = new DataTransfer(); dt.items.add(file); fileInput.files = dt.files; fileInput.dispatchEvent(new Event("change", { bubbles: true })); } catch (_) {}
  }, 80);
};

function buildBloqueIP2WordFile() {
  const sel = getGuideSelectionRedes();
  const labels = [
    "1. \u00bfC\u00f3mo sabes con solo mirar el primer n\u00famero si una IP es Clase A, B o C?",
    "2. \u00bfPor qu\u00e9 las MiPymes casi siempre usan direcciones Clase C?",
    "3. \u00bfQu\u00e9 son las direcciones privadas y por qu\u00e9 no se pueden usar en internet directamente?",
  ];
  const rows = ["ip2-1", "ip2-2", "ip2-3"].map((k, i) => `
    <p><b>${escapeHtml(labels[i])}</b></p>
    <p style="margin-left:20px;white-space:pre-wrap">${escapeHtml(String(state[k] || "(sin respuesta)"))}</p><br>`).join("");
  const tableRows = [
    ["A", "ip2-claseA-mask", "ip2-claseA-hosts", "ip2-claseA-uso"],
    ["B", "ip2-claseB-mask", "ip2-claseB-hosts", "ip2-claseB-uso"],
    ["C", "ip2-claseC-mask", "ip2-claseC-hosts", "ip2-claseC-uso"],
  ].map(([cls, mask, hosts, uso]) =>
    `<tr><td><b>Clase ${escapeHtml(cls)}</b></td><td>${escapeHtml(String(state[mask] || ""))}</td><td>${escapeHtml(String(state[hosts] || ""))}</td><td>${escapeHtml(String(state[uso] || ""))}</td></tr>`
  ).join("");
  const tableSection = `<h2>Cuadro comparativo de clases IP</h2>
<table border="1" cellpadding="6" style="border-collapse:collapse;width:100%;font-size:11pt">
  <tr style="background:#c8e6c9"><th>Clase</th><th>M\u00e1scara</th><th>Hosts posibles</th><th>Uso t\u00edpico</th></tr>
  ${tableRows}
</table>`;
  const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office'
    xmlns:w='urn:schemas-microsoft-com:office:word'
    xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'><title>Bloque 2 Clases IP</title>
<style>body{font-family:Calibri,Arial;font-size:12pt;margin:2cm}
h1{font-size:16pt;color:#1b5e20}h2{font-size:13pt}p{margin:6pt 0;line-height:1.5}</style>
</head><body>
<h1>Actividad 3.3.2 \u2013 Bloque 2 \u2014 Clases de IP y direcciones privadas</h1>
<p>Instituci\u00f3n: ${escapeHtml(sel.inst || "")} &nbsp;|&nbsp; Grupo: ${escapeHtml(sel.grupo || "")} &nbsp;|&nbsp; Ficha: ${escapeHtml(sel.ficha || "")}</p>
<hr>${rows}${tableSection}</body></html>`;
  const fileName = `Bloque2_ClasesIP_${sel.ficha || "sin_ficha"}.doc`;
  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  return new File([blob], fileName, { type: "application/msword" });
}

window.subirBloqueIP2AlDrive = function () {
  const file = buildBloqueIP2WordFile();
  window.sharedAppsScriptDelivery.openDeliveryModal({
    guideLabel: "Guia 2",
    activityNumber: "3.3.2",
    activityTitle: "Bloque 2 \u2014 Clases de IP y direcciones privadas",
    activityLabel: "Actividad 3.3.2",
  });
  setTimeout(() => {
    const fileInput = document.querySelector("[data-shared-apps-file]");
    if (!fileInput) return;
    try { const dt = new DataTransfer(); dt.items.add(file); fileInput.files = dt.files; fileInput.dispatchEvent(new Event("change", { bubbles: true })); } catch (_) {}
  }, 80);
};

function buildBloqueIP3WordFile() {
  const sel = getGuideSelectionRedes();
  const labels = [
    "1. \u00bfQu\u00e9 pasar\u00eda si configuras mal el gateway en un computador? \u00bfPodr\u00edas navegar en internet?",
    "2. \u00bfPara qu\u00e9 sirve el DNS? \u00bfQu\u00e9 pasar\u00eda si no existiera y tuvieras que recordar las IPs de todos los sitios?",
    "3. \u00bfPuede un computador funcionar en red local sin tener configurado el DNS? \u00bfPor qu\u00e9?",
  ];
  const rows = BLOQUE_IP3_KEYS.map((k, i) => `
    <p><b>${escapeHtml(labels[i])}</b></p>
    <p style="margin-left:20px;white-space:pre-wrap">${escapeHtml(String(state[k] || "(sin respuesta)"))}</p><br>`).join("");
  const imgSection = state["ip3-imagen-url"]
    ? `<h2>Producto — Diagrama de par\u00e1metros de red</h2><p><a href="${state["ip3-imagen-url"]}">Ver diagrama en Drive</a></p>`
    : "";
  const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office'
    xmlns:w='urn:schemas-microsoft-com:office:word'
    xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'><title>Bloque 3 Gateway y DNS</title>
<style>body{font-family:Calibri,Arial;font-size:12pt;margin:2cm}
h1{font-size:16pt;color:#1b5e20}h2{font-size:13pt}p{margin:6pt 0;line-height:1.5}</style>
</head><body>
<h1>Actividad 3.3.3 \u2013 Bloque 3 \u2014 Par\u00e1metros de red: IP, m\u00e1scara, gateway y DNS</h1>
<p>Instituci\u00f3n: ${escapeHtml(sel.inst || "")} &nbsp;|&nbsp; Grupo: ${escapeHtml(sel.grupo || "")} &nbsp;|&nbsp; Ficha: ${escapeHtml(sel.ficha || "")}</p>
<hr>${rows}${imgSection}</body></html>`;
  const fileName = `Bloque3_GatewayDNS_${sel.ficha || "sin_ficha"}.doc`;
  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  return new File([blob], fileName, { type: "application/msword" });
}

window.subirBloqueIP3AlDrive = function () {
  const file = buildBloqueIP3WordFile();
  window.sharedAppsScriptDelivery.openDeliveryModal({
    guideLabel: "Guia 2",
    activityNumber: "3.3.3",
    activityTitle: "Bloque 3 \u2014 Par\u00e1metros de red: IP, m\u00e1scara, gateway y DNS",
    activityLabel: "Actividad 3.3.3",
  });
  setTimeout(() => {
    const fileInput = document.querySelector("[data-shared-apps-file]");
    if (!fileInput) return;
    try { const dt = new DataTransfer(); dt.items.add(file); fileInput.files = dt.files; fileInput.dispatchEvent(new Event("change", { bubbles: true })); } catch (_) {}
  }, 80);
};

// ---------------------------------------------------------------------------
// Bloque IP2 — Clases de IP y direcciones privadas (3.3.2)
// ---------------------------------------------------------------------------
const BLOQUE_IP2_KEYS = [
  "ip2-1", "ip2-2", "ip2-3",
  "ip2-claseA-mask", "ip2-claseA-hosts", "ip2-claseA-uso",
  "ip2-claseB-mask", "ip2-claseB-hosts", "ip2-claseB-uso",
  "ip2-claseC-mask", "ip2-claseC-hosts", "ip2-claseC-uso",
];

function applyBloqueIP2Lock() {
  if (!state["ip2-locked"]) return;
  document.querySelectorAll("[data-store^='ip2-']").forEach((el) => {
    el.disabled = true; el.style.opacity = "0.75";
  });
  const btn = document.getElementById("btnGuardarIP2");
  if (btn) { btn.disabled = true; btn.textContent = "\u2705 Respuestas guardadas"; }
  const status = document.getElementById("ip2Status");
  if (status) status.style.display = "block";
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
  if (!state["ip3-locked"]) return;
  BLOQUE_IP3_KEYS.forEach((k) => {
    const el = document.querySelector(`[data-store="${k}"]`);
    if (el) { el.disabled = true; el.style.opacity = "0.75"; }
  });
  const input = document.getElementById("ip3ImagenInput");
  if (input) input.disabled = true;
  const label = document.getElementById("ip3ImagenLabel");
  if (label) { label.style.opacity = "0.5"; label.style.pointerEvents = "none"; }
  const btn = document.getElementById("btnGuardarIP3");
  if (btn) { btn.disabled = true; btn.textContent = "\u2705 Respuestas guardadas"; }
  const status = document.getElementById("ip3Status");
  if (status) status.style.display = "block";
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
  if (!state["ip1-locked"]) return;
  BLOQUE_IP1_KEYS.forEach((k) => {
    const el = document.querySelector(`[data-store="${k}"]`);
    if (el) { el.disabled = true; el.style.opacity = "0.75"; }
  });
  const input = document.getElementById("ip1ImagenInput");
  if (input) input.disabled = true;
  const label = document.getElementById("ip1ImagenLabel");
  if (label) { label.style.opacity = "0.5"; label.style.pointerEvents = "none"; }
  const btn = document.getElementById("btnGuardarIP1");
  if (btn) { btn.disabled = true; btn.textContent = "\u2705 Respuestas guardadas"; }
  const status = document.getElementById("ip1Status");
  if (status) status.style.display = "block";
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
  if (!state["social-locked"]) return;
  SOCIAL_KEYS.forEach((k) => {
    const el = document.querySelector(`[data-store="${k}"]`);
    if (el) { el.disabled = true; el.style.opacity = "0.75"; }
  });
  const input = document.getElementById("socialMapaInput");
  if (input) input.disabled = true;
  const label = document.getElementById("socialMapaLabel");
  if (label) { label.style.opacity = "0.5"; label.style.pointerEvents = "none"; }
  const btn = document.getElementById("btnGuardarSocial");
  if (btn) { btn.disabled = true; btn.textContent = "\u2705 Respuestas guardadas"; }
  const status = document.getElementById("socialStatus");
  if (status) status.style.display = "block";
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
document.addEventListener("DOMContentLoaded", () => {
  state = loadStateRedes();
  renderEvidenceTable();
  renderGlossary();
  renderSupportMaterialsRedes();
  renderTopbarCampus();
  hydrateFieldsRedes();
  bindEventsRedes();
  updateProgressRedes();
  initCloudSyncRedes();
});

document.addEventListener("guide-activity-check-change", () => {
  window.requestAnimationFrame(updateProgressRedes);
});
