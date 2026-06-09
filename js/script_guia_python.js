// script_guia_python.js — Guia practica de Python (variables, condicionales y POO).
// Una sola guia compartida por las 4 fichas de Santa Barbara. La entrega del reto
// integrador va a la carpeta Drive de la ficha del aprendiz (tomada de la sesion).
// El guide_runtime_loader inyecta el contenido y luego llama window.__GUIDE_INIT__().
(function () {
  "use strict";

  const PAGE_FILE =
    (window.__RUNTIME_PAGE_FILE__ || window.location.pathname.split("/").pop() || "").toLowerCase();
  const GUIDE_DATA_FILE = PAGE_FILE || "santa-barbara-guia-python.html";
  const PAGE_KEY = GUIDE_DATA_FILE.replace(/[^a-z0-9]+/g, "_") || "guia_python";

  const portalAuth = window.portalAuth || null;
  const LEGACY_STORAGE_KEY = `guia_interactiva_${PAGE_KEY}`;
  const STORAGE_KEY = portalAuth
    ? portalAuth.getScopedStorageKey(LEGACY_STORAGE_KEY, { area: "guide-data" })
    : LEGACY_STORAGE_KEY;
  const STORAGE_META_KEY = `${STORAGE_KEY}__meta`;
  const CLOUD_SYNC_DELAY_MS = 1200;

  // Carpetas Drive por ficha (las 4 fichas de Santa Barbara que comparten la guia).
  const DRIVE_FOLDERS = {
    "3441939": "https://drive.google.com/drive/folders/1SLkk986REOKGEFaCyWV7rSeudj7lnUMs?usp=drive_link",
    "3441942": "https://drive.google.com/drive/folders/1cv0DkFXhkMw22AddqIgC354DhUUHcQck?usp=drive_link",
    "3441944": "https://drive.google.com/drive/folders/1fZ7atqeSym9ayQylRG47HqKm2xdBbFOf?usp=drive_link",
    "3441950": "https://drive.google.com/drive/folders/1N49ulJRgbF7ySD3JDRJzFE5czCKFO1KM?usp=drive_link",
    "3168850": "https://drive.google.com/drive/folders/1fBPzXHU0OHDmKa18Y6V2tnomLyYWgiLp?usp=drive_link",
    "3168852": "https://drive.google.com/drive/folders/1p9HdGinK1me8PsbaLHYio_OC-idAmorR?usp=drive_link",
  };

  let state = loadState();
  let cloudStateSyncTimer = null;
  let booted = false;

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) || {} : {};
    } catch {
      return {};
    }
  }

  function getActor() {
    const session = portalAuth?.getCurrentSession?.();
    return session?.user?.fullName || session?.user?.username || "Aprendiz";
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      localStorage.setItem(STORAGE_META_KEY, JSON.stringify({
        updatedAt: new Date().toISOString(),
        updatedBy: getActor(),
      }));
    } catch {}
    scheduleCloudSync();
    updateProgress();
  }

  function getCloudScopeKey() {
    const session = portalAuth?.getCurrentSession?.();
    if (!session) return "";
    if (session.role === "admin") return `admin:${session.usernameKey || "admin"}`;
    if (session.role === "student") return `student:${session.user?.usernameKey || ""}`;
    return "";
  }

  function scheduleCloudSync() {
    if (cloudStateSyncTimer) clearTimeout(cloudStateSyncTimer);
    cloudStateSyncTimer = setTimeout(flushCloudSync, CLOUD_SYNC_DELAY_MS);
  }

  async function flushCloudSync() {
    cloudStateSyncTimer = null;
    const scopeKey = getCloudScopeKey();
    if (!scopeKey || !window._firebaseDb?.cloudSaveGuideData) return;
    try {
      await window._firebaseDb.cloudSaveGuideData(scopeKey, GUIDE_DATA_FILE, {
        scopeKey,
        fileName: GUIDE_DATA_FILE,
        updatedAt: new Date().toISOString(),
        updatedBy: getActor(),
        state: { ...state },
      });
    } catch (err) {
      console.warn("[guia-python] cloud sync failed", err);
    }
  }

  // ── Contexto para ActivityStandard ────────────────────────────────────────

  // La ficha viene de la SESION del aprendiz (no del contexto), porque una misma
  // guia la comparten las 4 fichas SB y cada aprendiz entrega a SU carpeta.
  function getSessionFicha() {
    const session = portalAuth?.getCurrentSession?.();
    const fromUser = session?.user?.ficha;
    if (fromUser) return String(fromUser).trim();
    // Fallback: leer directo de localStorage (disponible antes de que portalAuth inicialice)
    try {
      const raw = localStorage.getItem("sena_portal_session_v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        const ficha = parsed?.user?.ficha;
        if (ficha) return String(ficha).trim();
      }
    } catch (e) { /* ignorar */ }
    const stored = localStorage.getItem("sena_ficha");
    if (stored) return String(stored).trim();
    const ds = document.body.dataset || {};
    return String(ds.ficha || ds.defaultFicha || "").trim();
  }

  function getGuideSelection() {
    const session = portalAuth?.getCurrentSession?.();
    const user = session?.user || {};
    const ds = document.body.dataset || {};
    return {
      ficha: getSessionFicha(),
      grupo: user.grupo || ds.grupo || ds.defaultGrupo || "",
      inst: user.inst || ds.inst || ds.defaultInst || "",
    };
  }

  function getCurrentLearnerName() {
    const session = portalAuth?.getCurrentSession?.();
    return session?.user?.fullName || session?.user?.username || "";
  }

  function getStateCtx() {
    return {
      getState: () => state,
      saveState,
      getLearnerName: getCurrentLearnerName,
      getSelection: getGuideSelection,
      getGuideMetadata: () =>
        window.ActivityStandard?.getConfigForGuide(GUIDE_DATA_FILE) || {},
      getGuideDataFile: () => GUIDE_DATA_FILE,
    };
  }

  // ── Entrega a Drive ───────────────────────────────────────────────────────

  function openDriveFolder() {
    const ficha = getSessionFicha();
    const url = DRIVE_FOLDERS[ficha] || "";
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else alert("Inicia sesion como aprendiz con ficha asignada para ver tu carpeta de entrega.");
  }

  function mountDriveDelivery() {
    if (!window.sharedDriveDelivery?.appendDriveDeliveryPanels) return;
    if (!window.ActivityStandard?.buildDriveTargets) return;
    const targets = window.ActivityStandard.buildDriveTargets(GUIDE_DATA_FILE, getStateCtx());
    if (!targets.length) return;
    window.sharedDriveDelivery.appendDriveDeliveryPanels({
      targets,
      onDriveClick: openDriveFolder,
    });
  }

  // ── Progreso (1 entrega: el reto integrador) ──────────────────────────────

  function updateProgress() {
    const delivered = Boolean(state["retoPython-locked"]);
    const pct = delivered ? 100 : 0;
    const bar = document.getElementById("progressBar");
    const lbl = document.getElementById("progressValue");
    if (bar) bar.style.width = pct + "%";
    if (lbl) lbl.textContent = pct + "%";

    const check = document.querySelector('.nav-link[href="#reto"] .check');
    if (check) check.classList.toggle("done", delivered);

    document.dispatchEvent(new CustomEvent("guide-progress-changed", { detail: { pct } }));
  }

  // ── Demo animado de tipos de variable (seccion 2) ─────────────────────────

  function initVarDemo() {
    const root = document.querySelector("[data-var-demo]");
    if (!root || root.dataset.varBooted) return;
    root.dataset.varBooted = "1";

    const STEPS = [
      { code: 'nombre = "Laura"',             type: "str",      out: "Laura" },
      { code: "edad = 16",                    type: "int",      out: "16" },
      { code: "promedio = 4.3",               type: "float",    out: "4.3" },
      { code: "entrego = True",               type: "bool",     out: "True" },
      { code: "notas = [4.0, 3.5, 5.0]",      type: "list",     out: "[4.0, 3.5, 5.0]" },
      { code: "coordenada = (10, 20)",        type: "tuple",    out: "(10, 20)" },
      { code: 'aprendiz = {"nombre": "Ana"}', type: "dict",     out: "{'nombre': 'Ana'}" },
      { code: "fichas = {3441939, 3441942}",  type: "set",      out: "{3441939, 3441942}" },
      { code: "observacion = None",           type: "NoneType", out: "None" },
    ];

    const codeEl = root.querySelector("[data-var-code]");
    const typeEl = root.querySelector("[data-var-type]");
    const outEl = root.querySelector("[data-var-out]");
    const screen = root.querySelector(".var-demo__screen");
    const dotsWrap = root.querySelector("[data-var-dots]");
    const toggle = root.querySelector("[data-var-toggle]");
    if (!codeEl || !typeEl || !outEl || !screen || !dotsWrap) return;

    STEPS.forEach(() => dotsWrap.appendChild(document.createElement("span")));
    const dots = dotsWrap.querySelectorAll("span");

    let i = -1;
    let timer = null;
    let paused = false;

    function render(n) {
      const s = STEPS[n];
      codeEl.textContent = s.code;
      typeEl.textContent = s.type;
      outEl.textContent = s.out;
      dots.forEach((d, idx) => d.classList.toggle("on", idx === n));
      screen.classList.remove("var-anim");
      void screen.offsetWidth; // reinicia la animacion
      screen.classList.add("var-anim");
    }
    function next() {
      i = (i + 1) % STEPS.length;
      render(i);
    }
    function start() {
      if (timer) return;
      timer = setInterval(() => { if (!paused) next(); }, 2600);
    }

    next();
    start();

    if (toggle) {
      toggle.addEventListener("click", () => {
        paused = !paused;
        toggle.innerHTML = paused ? "&#9654;" : "&#10074;&#10074;";
        toggle.setAttribute("aria-label", paused ? "Reanudar la animacion" : "Pausar la animacion");
        if (!paused) next();
      });
    }
  }

  // ── Funciones interactivas: escribe el ejemplo y muestra su resultado ─────

  function initFnDemos() {
    const DATA = {
      // Seccion 1 — funciones
      print:      { code: 'print("Hola")',              out: "Hola" },
      input:      { code: 'nombre = input("Nombre: ")', out: 'Nombre: Laura   →   nombre vale "Laura"' },
      int:        { code: 'edad = int("15")',           out: "edad vale 15   (número entero)" },
      float:      { code: 'nota = float("4.5")',        out: "nota vale 4.5   (número decimal)" },
      str:        { code: "texto = str(2026)",          out: 'texto vale "2026"   (ahora es texto)' },
      bool:       { code: "activo = True",              out: "activo vale True   (verdadero)" },
      type:       { code: "print(type(16))",            out: "<class 'int'>" },
      comentario: { code: "# Esto no se ejecuta",       out: "(Python ignora esta línea)" },
      // Seccion 2 — tipos de variable (valor + tipo)
      var_str:   { code: 'nombre = "Laura"',             out: 'nombre = "Laura"   ·   tipo str' },
      var_int:   { code: "edad = 16",                    out: "edad = 16   ·   tipo int" },
      var_float: { code: "promedio = 4.3",               out: "promedio = 4.3   ·   tipo float" },
      var_bool:  { code: "entrego = True",               out: "entrego = True   ·   tipo bool" },
      var_list:  { code: "notas = [4.0, 3.5, 5.0]",      out: "notas = [4.0, 3.5, 5.0]   ·   tipo list" },
      var_tuple: { code: "coordenada = (10, 20)",        out: "coordenada = (10, 20)   ·   tipo tuple" },
      var_dict:  { code: 'aprendiz = {"nombre": "Ana"}', out: "aprendiz = {'nombre': 'Ana'}   ·   tipo dict" },
      var_set:   { code: "fichas = {3441939, 3441942}",  out: "fichas = {3441939, 3441942}   ·   tipo set" },
      var_none:  { code: "observacion = None",           out: "observacion = None   ·   tipo NoneType" },
      // Seccion 3 — operadores de comparacion (resultado True/False)
      op_eq: { code: "5.0 == 5.0",             out: "True" },
      op_ne: { code: '"tarde" != "Aprobado"',  out: "True" },
      op_gt: { code: "18 > 16",                out: "True" },
      op_lt: { code: "70 < 75",                out: "True" },
      op_ge: { code: "3.5 >= 3.5",             out: "True" },
      op_le: { code: "3 <= 3",                 out: "True" },
      // Seccion 3 — operadores logicos
      log_and: { code: "3.6 >= 3.5 and 80 >= 75", out: "True   (se cumplen las dos)" },
      log_or:  { code: "5 > 3 or 2 > 9",          out: "True   (basta con una)" },
      log_not: { code: "not False",               out: "True   (niega el valor)" },
    };
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Construye la mini-consola dentro de la fila si aun no existe (las filas de
    // las secciones 2 y 3 solo traen cabecera; la consola la pone el JS).
    function ensureConsole(row) {
      if (row.querySelector(".fn-row__console")) return;
      const cons = document.createElement("div");
      cons.className = "fn-row__console";
      cons.innerHTML =
        '<div class="fn-row__line"><span class="fn-row__prompt">&gt;&gt;&gt;</span> ' +
        '<span class="fn-row__typed" data-fn-typed></span><span class="fn-row__caret"></span></div>' +
        '<div class="fn-row__out" data-fn-result></div>';
      row.appendChild(cons);
    }

    // force=true (clic en "probar"): anima siempre, porque el usuario pidió
    // verlo. Sin force (cascadeo automatico) respeta prefers-reduced-motion.
    function play(row, done, force) {
      const d = DATA[row.getAttribute("data-fn")] || { code: "", out: "" };
      ensureConsole(row);
      const typed = row.querySelector("[data-fn-typed]");
      const result = row.querySelector("[data-fn-result]");
      if (!typed || !result) { if (done) done(); return; }
      if (row.dataset.fnPlaying === "1") return; // ya esta animando
      result.classList.remove("show");
      result.textContent = "";
      if (reduce && !force) {
        typed.textContent = d.code;
        result.textContent = d.out;
        result.classList.add("show");
        if (done) done();
        return;
      }
      typed.textContent = "";
      row.dataset.fnPlaying = "1";
      row.classList.add("is-typing");
      let i = 0;
      const id = setInterval(() => {
        typed.textContent = d.code.slice(0, ++i);
        if (i >= d.code.length) {
          clearInterval(id);
          row.classList.remove("is-typing");
          delete row.dataset.fnPlaying;
          result.textContent = d.out;
          setTimeout(() => result.classList.add("show"), 30);
          if (done) done();
        }
      }, 42);
    }

    document.querySelectorAll("[data-fn-demos]").forEach((wrap) => {
      if (wrap.dataset.fnBooted) return;
      wrap.dataset.fnBooted = "1";
      const rows = Array.prototype.slice.call(wrap.querySelectorAll("[data-fn]"));
      rows.forEach((row) => {
        ensureConsole(row);
        const btn = row.querySelector("[data-fn-play]");
        if (btn) btn.addEventListener("click", () => play(row, null, true));
      });
      function playSequence(idx) {
        if (idx >= rows.length) return;
        play(rows[idx], () => setTimeout(() => playSequence(idx + 1), 450));
      }
      if ("IntersectionObserver" in window) {
        const io = new IntersectionObserver((entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) { io.disconnect(); playSequence(0); }
          });
        }, { threshold: 0.15 });
        io.observe(wrap);
      } else {
        playSequence(0);
      }
    });
  }

  // ── Link Programiz (solo grupos Kennedy) ─────────────────────────────────

  var SANTA_BARBARA_FICHAS = ["3441944", "3441950", "3168850", "3168852"];

  function applyProgramizLinks() {
    var ficha = getSessionFicha();
    // Ocultar solo si la ficha es explicitamente Santa Barbara.
    // Si no hay sesion o la ficha es Kennedy, mostrar el link.
    var hide = SANTA_BARBARA_FICHAS.includes(ficha);
    document.querySelectorAll("[data-programiz-link]").forEach(function (el) {
      el.style.display = hide ? "none" : "";
    });
  }

  // ── Boot ──────────────────────────────────────────────────────────────────

  function initGuiaPython() {
    if (booted) return;
    booted = true;
    if (window.ActivityStandard?.mountActivities) {
      window.ActivityStandard.mountActivities(getStateCtx());
    }
    mountDriveDelivery();
    applyProgramizLinks();
    // Reintento por si portalAuth aun no habia cargado la sesion al momento del init
    setTimeout(applyProgramizLinks, 800);
    initVarDemo();
    initFnDemos();
    updateProgress();
  }

  window.__GUIDE_INIT__ = initGuiaPython;
  window.initGuiaPython = initGuiaPython;

  document.addEventListener("guide-delivery-registered", () => {
    window.requestAnimationFrame(() => updateProgress());
  });
})();
