const PAGE_FILE = window.location.pathname.split("/").pop().toLowerCase() || "guia.html";
const STORAGE_FILE_ALIASES = {
  "grupo-10a-guia-01-induccion.html": "10a_guia.html",
  "grupo-10b-guia-01-induccion.html": "10b_guia.html",
};
const GUIDE_DATA_FILE = STORAGE_FILE_ALIASES[PAGE_FILE] || PAGE_FILE;
const PAGE_KEY = GUIDE_DATA_FILE.replace(/[^a-z0-9]+/g, "_") || "guia";
const STORAGE_KEY = `guia_induccion_${PAGE_KEY}`;
const portalAuth = window.portalAuth || null;
const LEGACY_STORAGE_KEY = STORAGE_KEY;
const ACTIVE_STORAGE_KEY = portalAuth
  ? portalAuth.getScopedStorageKey(LEGACY_STORAGE_KEY, { area: "guide-data" })
  : LEGACY_STORAGE_KEY;
const STORAGE_META_KEY = `${ACTIVE_STORAGE_KEY}__meta`;
const SCOPED_STORAGE_ENABLED = ACTIVE_STORAGE_KEY !== LEGACY_STORAGE_KEY;
const CLOUD_SYNC_DELAY_MS = 1200;
const CLOUD_REFRESH_MS = 8000;

const treePrompts = [
  ["Raices", "Fortalezas que considera tiene para enfrentar este proceso formativo en Sistemas Teleinformaticos."],
  ["Tronco", "Principales soportes como familia, metas o vocacion tecnica que lo motivan a estudiar."],
  ["Frutos", "Metas y propositos que pretende alcanzar con esta formacion en lo laboral, personal o de emprendimiento."],
  ["Hojas", "Conocimientos en tecnologia e informatica que quiere lograr con la formacion."],
  ["Parasito", "Debilidades internas y externas que pueden afectar su formacion, como tiempo, acceso a equipos o conocimientos previos."],
];

const videoLinks = [
  ["El SENA es Colombia", "https://www.youtube.com/watch?v=k5rZk-qC0JM", "SENATV | 10:45 min | 2019"],
  ["Oportunidades para todos los colombianos", "https://www.youtube.com/watch?v=FZX0-iUduMw", "SENATV | 2:19 min | 2022"],
  ["Himno del SENA", "https://youtu.be/KD5wULG4PcY", "SENATV | 2:52 min | 2025"],
  ["Simbolos del SENA y su significado", "https://www.youtube.com/watch?v=OP4z_14gFU8", "Video de apoyo | 1:03 min"],
];

const curriculumQuestions = [
  "Nombre del Programa",
  "Codigo y version del Programa",
  "Duracion total en horas",
  "Campo ocupacional del egresado",
  "Productos del trabajo del egresado",
  "Numero de competencias del programa",
  "Numero de resultados de aprendizaje",
  "Competencias especificas (cuales son)",
  "Resultados de aprendizaje por competencia",
  "Tematica en la que mas desea profundizar",
];

const platforms = [
  ["Territorium LMS", "Gestion de cursos, evidencias y portafolio del aprendiz.", "https://territorio.s3.amazonaws.com/archivos/sena/manuales/Manual%2BAprendiz%2B-%2BTerritorium_Version3.pdf"],
  ["SOFIA Plus", "Consulta de oferta educativa y gestion academica.", "https://oferta.senasofiaplus.edu.co"],
  ["Biblioteca Virtual SENA", "Recursos bibliograficos y bases de datos.", "https://biblioteca.sena.edu.co"],
  ["Fondo Emprender", "Plataforma de emprendimiento y apoyo a iniciativas productivas.", "https://www.fondoemprender.com"],
  ["Agencia Publica de Empleo", "Intermediacion laboral, vacantes y orientacion ocupacional.", "https://agenciapublicadeempleo.sena.edu.co"],
];
const portfolioFolders = [
  ["Carpeta 1: Diseno Curricular", "Documento del programa 233108 V1 y cuestionario completado (Actividad 3.3.2)."],
  ["Carpeta 2: Proyecto Formativo", "Descripcion del proyecto: Alfabetizacion Digital, Asesoria Tecnica y Ciberseguridad - CIAS Puerto Boyaca."],
  ["Carpeta 3: Guia 1 - Induccion", "Esta guia y todas las evidencias generadas durante la induccion."],
  ["Carpeta 4: Evidencias", "Arbol de la vida, analisis logo-simbolos SENA, taller reglamento y taller plataformas."],
  ["Carpeta 5: Guias siguientes", "Carpetas de las guias posteriores del programa."],
];

const evidenceRows = [
  {
    phase: "Analisis",
    project: "Reconocer la dinamica institucional del SENA y proyectar el rol de la formacion profesional integral en la construccion del proyecto de vida.",
    learning: "Presentacion e identidad, arbol de la vida, sopa de letras y crucigrama, conociendo el SENA, diseno curricular, reglamento, plataformas, compromiso y portafolio Drive.",
    evidence: "Participacion en la dinamica, arbol de la vida, sopa y crucigrama resueltos, analisis de simbolos, cuestionario curricular, taller del reglamento, taller de plataformas, compromiso personal y portafolio compartido.",
    criteria: "Se presenta con respeto, reconoce fortalezas y metas, identifica la dinamica institucional del SENA, interpreta el diseno curricular, comprende el reglamento, usa plataformas y organiza un portafolio digital completo.",
    methods: "Observacion directa, lista de cotejo, cuestionario, lista de verificacion y rubrica para productos y evidencias.",
  },
];

const glossaryTerms = [
  ["Agencia Publica de Empleo (APE)", "Servicio del SENA que facilita la intermediacion laboral, el registro de hoja de vida y la busqueda de vacantes."],
  ["Aprendiz", "Persona matriculada en un programa del SENA que desarrolla competencias segun el plan de formacion."],
  ["Biblioteca Virtual SENA", "Servicio digital del Sistema de Bibliotecas SENA para consultar libros, bases de datos y recursos academicos."],
  ["Competencia", "Capacidad demostrable para desempenar funciones integrando conocimientos, habilidades y actitudes."],
  ["Criterios de evaluacion", "Condiciones o referentes que permiten valorar si el aprendiz cumple el resultado de aprendizaje."],
  ["Diseno curricular", "Documento oficial del programa que describe competencias, resultados de aprendizaje, duracion y contenidos."],
  ["Evidencia de aprendizaje", "Producto, desempeno o conocimiento verificable que demuestra el avance del aprendiz."],
  ["Fondo Emprender", "Programa del SENA que impulsa la creacion de empresas mediante capital semilla y acompanamiento."],
  ["Formacion Profesional Integral (FPI)", "Modelo formativo del SENA que articula conocimientos tecnicos y desarrollo humano."],
  ["Guia de aprendizaje", "Documento que orienta el desarrollo de actividades, recursos, evidencias y criterios de evaluacion."],
  ["Induccion", "Etapa inicial del proceso formativo para reconocer el SENA, sus normas, plataformas y enfoque del programa."],
  ["Lista de verificacion", "Instrumento que permite comprobar el cumplimiento de criterios mediante items verificables."],
  ["Mapa conceptual", "Representacion grafica de conceptos y relaciones para organizar y comprender un tema."],
  ["MiPymes", "Micro, pequenas y medianas empresas a las que pueden aplicarse proyectos y soluciones del programa."],
  ["Portafolio de evidencias", "Repositorio organizado donde el aprendiz almacena evidencias y soportes del proceso formativo."],
  ["Proyecto formativo", "Eje integrador del programa que plantea un reto o necesidad real del entorno."],
  ["Reglamento del Aprendiz", "Norma institucional que define derechos, deberes, faltas, medidas formativas y sanciones."],
  ["Resultado de aprendizaje", "Enunciado de lo que el aprendiz debe lograr y demostrar al finalizar una etapa formativa."],
  ["SOFIA Plus", "Plataforma del SENA para gestion academica, oferta educativa, inscripcion y tramites."],
  ["Territorium (LMS)", "Plataforma de gestion del aprendizaje usada por el SENA para cursos, evidencias y seguimiento."],
];

let state = loadState();
let cloudStateSyncTimer = null;
let cloudStateRetryTimer = null;
let pendingCloudStateSnapshot = null;

document.addEventListener("DOMContentLoaded", () => {
  renderStatefulSections();
  renderVideoGrid();
  renderEvidenceTable();
  renderGlossary();
  hydrateFields();
  bindEvents();
  updateProgress();
  setupScrollSpy();
  initializeCloudStateSync();
});
function loadState() {
  try {
    const saved = localStorage.getItem(ACTIVE_STORAGE_KEY);
    if (saved) return JSON.parse(saved) || {};

    if (SCOPED_STORAGE_ENABLED) {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        const parsed = JSON.parse(legacy) || {};
        localStorage.setItem(ACTIVE_STORAGE_KEY, JSON.stringify(parsed));
        return parsed;
      }
    }

    return {};
  }
  catch { return {}; }
}

function saveState() {
  localStorage.setItem(ACTIVE_STORAGE_KEY, JSON.stringify(state));
  saveStateMeta({
    updatedAt: new Date().toISOString(),
    updatedBy: getCloudActor(),
  });
  updateProgress();
  pendingCloudStateSnapshot = buildCloudStateSnapshot();
  scheduleCloudStateSync();
}

function renderStatefulSections() {
  renderTreePrompts();
  renderCurriculumTable();
  renderPlatformGrid();
  renderPortfolioTable();
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
  localStorage.setItem(ACTIVE_STORAGE_KEY, JSON.stringify(state));
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
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function slugify(value) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function renderTreePrompts() {
  document.getElementById("treePromptGrid").innerHTML = treePrompts.map(([part, prompt]) => `
    <article class="prompt-card">
      <strong>${escapeHtml(part)}</strong>
      <p>${escapeHtml(prompt)}</p>
      <textarea rows="5" data-store="arbol:${slugify(part)}" data-track placeholder="Escribe aqui tu respuesta sobre ${escapeHtml(part)}."></textarea>
    </article>`).join("");
}

function renderVideoGrid() {
  document.getElementById("videoGrid").innerHTML = videoLinks.map(([name, url, meta]) => `
    <article class="resource-card link-card">
      <strong>${escapeHtml(name)}</strong>
      <p>${escapeHtml(meta)}</p>
      <a class="button button-primary button-inline" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">Abrir recurso</a>
    </article>`).join("");
}

function renderCurriculumTable() {
  document.getElementById("curriculumTable").innerHTML = curriculumQuestions.map((question) => `
    <tr>
      <th scope="row">${escapeHtml(question)}</th>
      <td><textarea rows="3" data-store="curriculo:${slugify(question)}" data-track placeholder="Escribe aqui tu respuesta."></textarea></td>
    </tr>`).join("");
}

function renderPlatformGrid() {
  document.getElementById("platformGrid").innerHTML = platforms.map(([name, desc, url]) => {
    const slug = slugify(name);
    return `
      <article class="platform-card">
        <div class="platform-card-head"><strong>${escapeHtml(name)}</strong><a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">Ir al recurso</a></div>
        <p>${escapeHtml(desc)}</p>
        <label class="check-item"><input type="checkbox" data-store="plataforma:${slug}:acceso" data-track><span>Ingrese o revise esta plataforma</span></label>
        <label class="check-item"><input type="checkbox" data-store="plataforma:${slug}:evidencia" data-track><span>Registre evidencia o captura de uso</span></label>
      </article>`;
  }).join("");
}

function renderPortfolioTable() {
  document.getElementById("portfolioTable").innerHTML = portfolioFolders.map(([folder, content]) => `
    <tr>
      <th scope="row">${escapeHtml(folder)}</th>
      <td>${escapeHtml(content)}</td>
      <td><label class="check-item table-check"><input type="checkbox" data-store="portafolio:${slugify(folder)}" data-track><span>Lista</span></label></td>
    </tr>`).join("");
}

function renderEvidenceTable() {
  document.getElementById("evidenceTable").innerHTML = evidenceRows.map((row) => `
    <tr>
      <td>${escapeHtml(row.phase)}</td>
      <td>${escapeHtml(row.project)}</td>
      <td>${escapeHtml(row.learning)}</td>
      <td>${escapeHtml(row.evidence)}</td>
      <td>${escapeHtml(row.criteria)}</td>
      <td>${escapeHtml(row.methods)}</td>
    </tr>`).join("");
}

function renderGlossary() {
  document.getElementById("glossaryGrid").innerHTML = glossaryTerms.map(([term, def]) => `
    <article class="glossary-card" data-search="${escapeHtml((term + ' ' + def).toLowerCase())}">
      <strong>${escapeHtml(term)}</strong>
      <p>${escapeHtml(def)}</p>
    </article>`).join("");
}
function hydrateFields() {
  document.querySelectorAll("[data-store]").forEach((field) => {
    const key = field.dataset.store;
    if (!(key in state)) return;
    if (field.type === "checkbox") field.checked = Boolean(state[key]);
    else field.value = state[key];
  });
}

function bindEvents() {
  document.addEventListener("input", (event) => {
    const field = event.target.closest("[data-store]");
    if (!field) return;
    state[field.dataset.store] = field.type === "checkbox" ? field.checked : field.value;
    saveState();
  });

  document.addEventListener("change", (event) => {
    const field = event.target.closest("[data-store]");
    if (!field) return;
    state[field.dataset.store] = field.type === "checkbox" ? field.checked : field.value;
    saveState();
  });

  document.getElementById("glossarySearch").addEventListener("input", (event) => {
    const query = event.target.value.trim().toLowerCase();
    document.querySelectorAll(".glossary-card").forEach((card) => {
      card.classList.toggle("is-hidden", !card.dataset.search.includes(query));
    });
  });

  document.querySelector("[data-print]").addEventListener("click", () => window.print());
  document.getElementById("resetProgress").addEventListener("click", async () => {
    if (!window.confirm("Se borraran las respuestas guardadas localmente. Deseas continuar?")) return;
    window.clearGuideActivityChecks?.();
    window.clearGuideLayoutState?.();
    localStorage.removeItem(ACTIVE_STORAGE_KEY);
    localStorage.removeItem(STORAGE_META_KEY);
    state = {};
    pendingCloudStateSnapshot = buildCloudStateSnapshot();
    await window.syncGuideUiStateImmediately?.();
    await syncCloudState(true);
    window.location.reload();
  });
}

function updateProgress() {
  const tracked = Array.from(document.querySelectorAll("[data-track]"));
  const completed = tracked.filter((field) => field.type === "checkbox" ? field.checked : field.value.trim().length > 0).length;
  const percent = tracked.length ? Math.round((completed / tracked.length) * 100) : 0;
  const label = `${percent}%`;
  document.getElementById("progressValue").textContent = label;
  document.getElementById("progressBar").style.width = label;
  portalAuth?.writeGuideProgress?.(PAGE_FILE, { completed, total: tracked.length, percent });
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
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const id = `#${entry.target.id}`;
      links.forEach((link) => link.classList.toggle("is-current", link.getAttribute("href") === id));
    });
  }, { threshold: 0.15, rootMargin: "-20% 0px -55% 0px" });

  links.forEach((link) => {
    const target = document.querySelector(link.getAttribute("href"));
    if (target) observer.observe(target);
  });
}
