// script_guia_redes_rap03.js — Guia 4 (Redes RAP03): Documentar las acciones realizadas en la red.
// Santa Barbara 10A / 10B. Usa ActivityStandard para guardar/bloquear/exportar Word y entregar a Drive.
// El guide_runtime_loader inyecta el contenido y luego llama window.initGuiaRedes().
(function () {
  "use strict";

  const PAGE_FILE =
    (window.__RUNTIME_PAGE_FILE__ || window.location.pathname.split("/").pop() || "").toLowerCase();
  const GUIDE_DATA_FILE = PAGE_FILE;
  const PAGE_KEY = GUIDE_DATA_FILE.replace(/[^a-z0-9]+/g, "_") || "guia4_redes_rap03";

  const portalAuth = window.portalAuth || null;
  const LEGACY_STORAGE_KEY = `guia_interactiva_${PAGE_KEY}`;
  const STORAGE_KEY = portalAuth
    ? portalAuth.getScopedStorageKey(LEGACY_STORAGE_KEY, { area: "guide-data" })
    : LEGACY_STORAGE_KEY;
  const STORAGE_META_KEY = `${STORAGE_KEY}__meta`;
  const SCOPED_STORAGE_ENABLED = STORAGE_KEY !== LEGACY_STORAGE_KEY;
  const CLOUD_SYNC_DELAY_MS = 1200;

  let state = loadState();
  let cloudStateSyncTimer = null;
  let booted = false;

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) || {};
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
      console.warn("[guia4-redes-rap03] cloud sync failed", err);
    }
  }

  // ── Hidratacion y binding de formularios ──────────────────────────────────

  function hydrateFields() {
    document.querySelectorAll("[data-store]").forEach((el) => {
      const key = el.getAttribute("data-store");
      if (!key) return;
      const value = state[key];
      if (typeof value === "string" || typeof value === "number") {
        if (el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.tagName === "SELECT") {
          el.value = value;
        }
      }
    });
  }

  function bindFieldEvents() {
    document.addEventListener("input", (event) => {
      const target = event.target;
      if (!target?.matches?.("[data-store]")) return;
      const key = target.getAttribute("data-store");
      if (!key) return;
      state[key] = target.value;
      saveState();
    });
  }

  // ── Contexto para ActivityStandard ────────────────────────────────────────

  function getGuideSelection() {
    const ds = document.body.dataset || {};
    return {
      ficha: ds.ficha || ds.defaultFicha || "",
      grupo: ds.grupo || ds.defaultGrupo || "",
      inst: ds.inst || ds.defaultInst || "",
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
        window.ActivityStandard?.getConfigForGuide(PAGE_FILE) || {},
      getGuideDataFile: () => PAGE_FILE,
    };
  }

  // ── Entrega a Drive ───────────────────────────────────────────────────────

  function openDriveFolder() {
    const sel = getGuideSelection();
    const folders = {
      "3441944": "https://drive.google.com/drive/folders/1fZ7atqeSym9ayQylRG47HqKm2xdBbFOf?usp=drive_link",
      "3441950": "https://drive.google.com/drive/folders/1N49ulJRgbF7ySD3JDRJzFE5czCKFO1KM?usp=drive_link",
    };
    const url = folders[sel.ficha] || "";
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else window.portalAlert("Selecciona primero tu ficha desde el panel lateral.", { type: "warning" });
  }

  function mountDriveDelivery() {
    if (!window.sharedDriveDelivery?.appendDriveDeliveryPanels) return;
    if (!window.ActivityStandard?.buildDriveTargets) return;
    const targets = window.ActivityStandard.buildDriveTargets(PAGE_FILE, {
      getLearnerName: getCurrentLearnerName,
      getSelection: getGuideSelection,
      getGuideMetadata: () =>
        window.ActivityStandard.getConfigForGuide(PAGE_FILE) || {},
    });
    if (!targets.length) return;
    window.sharedDriveDelivery.appendDriveDeliveryPanels({
      targets,
      onDriveClick: openDriveFolder,
    });
  }

  // ── Progreso ──────────────────────────────────────────────────────────────

  const FORM_FIELDS = [
    "g5r_311_p1", "g5r_311_p2", "g5r_311_p3", "g5r_311_p4", "g5r_311_p5",
    "g5r_321_q1", "g5r_321_q2", "g5r_321_q3",
    "g5r_322_q1", "g5r_322_q2", "g5r_322_q3",
    "g5r_323_q1", "g5r_323_q2", "g5r_323_q3",
    "g5r_324_q1", "g5r_324_q2", "g5r_324_q3",
    "g5r_331_punchdown", "g5r_331_crimpadora", "g5r_331_tester", "g5r_331_certificador",
    "g5r_p1_r1", "g5r_p1_r2", "g5r_p1_r3", "g5r_p1_r4", "g5r_p1_r5", "g5r_p1_r6",
    "g5r_p1_r7", "g5r_p1_r8", "g5r_p1_r9", "g5r_p1_r10", "g5r_p1_r11", "g5r_p1_r12",
    "g5r_p2_r1", "g5r_p2_r2", "g5r_p2_r3", "g5r_p2_r4", "g5r_p2_r5", "g5r_p2_r6",
    "g5r_p2_r7", "g5r_p2_r8", "g5r_p2_r9", "g5r_p2_r10", "g5r_p2_r11", "g5r_p2_r12",
    "g5r_p3_r1", "g5r_p3_r2", "g5r_p3_r3", "g5r_p3_r4", "g5r_p3_r5",
    "g5r_p3_r6", "g5r_p3_r7", "g5r_p3_r8", "g5r_p3_r9", "g5r_p3_r10",
  ];

  function updateProgress() {
    const filled = FORM_FIELDS.filter((k) => String(state[k] || "").trim().length > 0).length;
    const total = FORM_FIELDS.length;
    const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
    const bar = document.getElementById("progressBar");
    const lbl = document.getElementById("progressValue");
    if (bar) bar.style.width = pct + "%";
    if (lbl) lbl.textContent = pct + "%";
    // Sincroniza el avance a la nube para que el panel admin lo vea aunque el
    // aprendiz haya guardado desde otro equipo (sin esto el admin deriva mal el %).
    portalAuth?.writeGuideProgress?.(PAGE_FILE, { completed: filled, total, percent: pct });

    document.querySelectorAll(".nav-link .check").forEach((c) => c.classList.remove("done"));
    const navMap = {
      reflexion: ["reflexion311-locked"],
      contexto: ["bloqueA321-locked", "bloqueB322-locked", "bloqueC323-locked", "bloqueD324-locked", "entregaContexto-locked"],
      apropiacion: ["demoHerramientas331-locked", "plantilla1Inventario-locked", "plantilla2IP-locked", "plantilla3Pruebas-locked"],
      transferencia: ["informeTecnico-locked"],
    };
    Object.entries(navMap).forEach(([sect, keys]) => {
      if (keys.every((k) => state[k])) {
        const link = document.querySelector(`.nav-link[href="#${sect}"] .check`);
        if (link) link.classList.add("done");
      }
    });

    document.dispatchEvent(new CustomEvent("guide-progress-changed", { detail: { pct } }));
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  function bindReset() {
    const btn = document.getElementById("resetProgress");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      if (!(await window.portalConfirm("¿Reiniciar todas las respuestas guardadas en este navegador? Esta accion no se puede deshacer.", { title: "Reiniciar respuestas", confirmText: "Reiniciar" }))) return;
      state = {};
      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_META_KEY);
      } catch {}
      hydrateFields();
      updateProgress();
      scheduleCloudSync();
      document.querySelectorAll("[data-store]").forEach((el) => {
        el.disabled = false;
        el.style.opacity = "";
      });
      document.querySelectorAll(".activity-saved-notice").forEach((n) => (n.style.display = "none"));
      window.dispatchEvent(new Event("activity-deadlines-updated"));
    });
  }

  // ── Boot ──────────────────────────────────────────────────────────────────

  function initGuia4RedesRap03() {
    if (booted) return;
    booted = true;

    hydrateFields();
    bindFieldEvents();
    bindReset();

    if (window.ActivityStandard?.mountActivities) {
      window.ActivityStandard.mountActivities(getStateCtx());
    }
    mountDriveDelivery();
    updateProgress();
    reflectGradesForGuia5RedesRap03();
  }

  // Mismo mecanismo que Guia 3 (script_guia_redes_rap02.js): si el admin
  // aprueba una actividad de formulario con el banco de respuestas (el
  // aprendiz nunca la guardo el mismo), hay que reflejar el "{id}-locked" en
  // el state para que ActivityStandard.mountActivities() deje de mostrar los
  // campos editables.
  function reflectGradesForGuia5RedesRap03() {
    var mgr = window.activityGradesManager;
    if (!mgr || typeof mgr.reflectGradesIntoGuideState !== "function") return;
    mgr.reflectGradesIntoGuideState({
      guideFamily: "guia-redes-rap03",
      pageFile: PAGE_FILE,
      getState: function () { return state; },
      onChanged: function () {
        saveState();
        updateProgress();
        if (window.ActivityStandard && typeof window.ActivityStandard.renderAvancePanel === "function" && document.querySelector("[data-act-std-avance]")) {
          window.ActivityStandard.renderAvancePanel({
            getGuideDataFile: function () { return PAGE_FILE; },
            getState: function () { return state; },
          });
        }
        // mountFormActivity() (activity_standard.js) escucha este evento y
        // vuelve a aplicar applyLock()/applyDeadlineGate() por actividad --
        // asi los campos quedan deshabilitados DE INMEDIATO si el aprendiz
        // tiene la guia abierta cuando el admin califica, sin re-montar nada.
        if (typeof window.dispatchEvent === "function") {
          window.dispatchEvent(new Event("activity-deadlines-updated"));
        }
      },
    });
  }

  // El guide_runtime_loader llama window.initGuiaRedes() tras inyectar el contenido.
  window.initGuiaRedes = initGuia4RedesRap03;
  window.initGuia4RedesRap03 = initGuia4RedesRap03;

  document.addEventListener("guide-activity-check-change", () => {
    window.requestAnimationFrame(() => updateProgress());
  });
  document.addEventListener("guide-delivery-registered", () => {
    window.requestAnimationFrame(() => updateProgress());
  });
})();
