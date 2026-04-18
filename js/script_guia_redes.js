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
    evidence: "Producto: Exploracion_Contextual_NombreAprendiz_FICHA.pdf (5 productos compilados).",
    criteria: "Clasifica tipos de redes y topologias segun el caso. Selecciona medios y dispositivos de interconexion segun necesidad. Relaciona capas OSI con dispositivos y protocolos.",
    methods: "Tecnica: Evaluacion de producto. Instrumento: Rubrica analitica (calidad tecnica, completitud y presentacion).",
  },
  {
    phase: "Analisis",
    project: "Diagnosticar el estado de la infraestructura de redes y equipos informaticos y solicitudes de servicio tecnico presente en el entorno de trabajo.",
    learning: "Mapa mental integrador de fundamentos de redes.",
    evidence: "Producto: MapaMental_Redes_NombreAprendiz_FICHA.pdf (o PNG).",
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

function saveStateRedes() {
  try {
    localStorage.setItem(STORAGE_KEY_REDES, JSON.stringify(state));
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
  applyReflexionLock();
  applyReflexionSocializacionLock();
  applyBloqueALock();
  applyBloqueBLock();
  applyBloqueCLock();
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
    const session = portalAuth.getCurrentSession();
    const usernameKey = ((session && (session.usernameKey || session.username)) || "desconocido")
      .toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    const ficha = (session && session.ficha) || "0000";
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
      fullName: (session && session.fullName) || usernameKey,
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
    const session = portalAuth.getCurrentSession();
    const usernameKey = ((session && (session.usernameKey || session.username)) || "desconocido")
      .toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    const ficha = (session && session.ficha) || "0000";
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
      fullName: (session && session.fullName) || usernameKey,
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
  "reflexion-311-locked",
  "reflexion-socializacion-locked",
];

function getCloudScopeKeyRedes() {
  const session = _portalAuth?.getCurrentSession?.();
  if (!session) return "";
  if (session.role === "admin") return `admin:${session.usernameKey || session.user?.usernameKey || "admin"}`;
  if (session.role === "student") return `student:${session.user?.usernameKey || ""}`;
  return "";
}

const IMAGE_KEYS_REDES = ["bloqueA-imagen", "bloqueB-imagen"]; // Excluir base64 local del sync a Firebase; las URLs de Drive sí se guardan

function buildCloudSnapshotRedes() {
  const data = { ...state };
  IMAGE_KEYS_REDES.forEach((k) => delete data[k]);
  return { data, updatedAt: new Date().toISOString() };
}

function applyAllLocksRedes() {
  applyReflexionLock();
  applyReflexionSocializacionLock();
  applyBloqueALock();
  applyBloqueBLock();
  applyBloqueCLock();
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
      const localTime = Number(localStorage.getItem(STORAGE_META_KEY_REDES) || 0);
      const remoteTime = Date.parse(remote.updatedAt || "") || 0;
      if (remoteTime > localTime) {
        state = { ...state, ...remote.data };
        saveStateRedes();
        hydrateFieldsRedes();
        updateProgressRedes();
      } else {
        applyAllLocksRedes(); // aunque el local sea más nuevo, respeta bloqueos de Firebase
      }
    }
    _cloudRefreshTimer = setInterval(async () => {
      try {
        const refreshed = await window._firebaseDb.cloudGetGuideData(scopeKey, GUIDE_DATA_FILE_REDES);
        if (refreshed?.data) {
          enforceLockFlagsFromRemote(refreshed.data);
          state = { ...state, ...refreshed.data };
          saveStateRedes();
          hydrateFieldsRedes();
          updateProgressRedes();
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

window.exportarReflexion311 = function () {
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

  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Reflexion_311_Carmen_${sel.ficha || "sin_ficha"}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

window.abrirDriveReflexion311 = async function () {
  const empty = REFLEXION_311_KEYS.filter((k) => !String(state[k] || "").trim());
  if (empty.length > 0) {
    alert("Responde todas las preguntas antes de subir al Drive.");
    return;
  }

  const delivery = window.sharedAppsScriptDelivery;
  if (!delivery) { alert("El sistema de entrega no está disponible."); return; }

  const session = window.portalAuth?.getCurrentSession?.();
  const sel = getGuideSelectionRedes();
  const fullName = session?.user?.fullName || "";
  const ficha = session?.user?.ficha || sel.ficha || "";
  if (!fullName || !ficha) { alert("Inicia sesión para subir el archivo al Drive."); return; }

  const btn = document.getElementById("btnDriveReflexion311");
  if (btn) { btn.disabled = true; btn.textContent = "Subiendo…"; }

  try {
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
<p>Institución: ${escapeHtml(sel.inst || "")} &nbsp;|&nbsp; Grupo: ${escapeHtml(sel.grupo || "")} &nbsp;|&nbsp; Ficha: ${escapeHtml(ficha)}</p>
<hr>${rows}</body></html>`;

    const fileName = `Reflexion_311_Carmen_${ficha}.doc`;
    const file = new File(["\ufeff" + html], fileName, { type: "application/msword" });
    const fileBase64 = await delivery.readFileAsBase64(file);
    await delivery.uploadToAppsScript({
      guideLabel: "Guia 2",
      activityLabel: "Actividad 3.1.1",
      activityNumber: "3.1.1",
      activityTitle: "Reflexión Individual - Caso Carmen",
      fileName,
      mimeType: "application/msword",
      fileBase64,
      fullName,
      ficha,
    });
    alert("¡Archivo subido exitosamente al Drive!");
  } catch (err) {
    alert("Error al subir: " + (err?.message || "Intenta de nuevo."));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "📁 Subir al Drive"; }
  }
};

// ---------------------------------------------------------------------------
// Exposed for external use
// ---------------------------------------------------------------------------
window.getGuideState = () => state;
window.saveGuideState = saveStateRedes;

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
