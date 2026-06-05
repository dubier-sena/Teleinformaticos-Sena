// script_guia_redes_rap02.js — Guia 3 (Redes RAP02): Comprobar la conectividad de la red.
// Santa Barbara 10A / 10B. Usa ActivityStandard para guardar/bloquear/exportar Word y entregar a Drive.
// El guide_runtime_loader inyecta el contenido y luego llama window.initGuiaRedes().
(function () {
  "use strict";

  const PAGE_FILE =
    (window.__RUNTIME_PAGE_FILE__ || window.location.pathname.split("/").pop() || "").toLowerCase();
  const GUIDE_DATA_FILE = PAGE_FILE;
  const PAGE_KEY = GUIDE_DATA_FILE.replace(/[^a-z0-9]+/g, "_") || "guia3_redes";

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
      console.warn("[guia3-redes] cloud sync failed", err);
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
    else alert("Selecciona primero tu ficha desde el panel lateral.");
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
    "g3r_311_p1", "g3r_311_p2", "g3r_311_p3", "g3r_311_p4", "g3r_311_p5",
    "g3r_321_q1", "g3r_321_q2", "g3r_321_q3",
    "g3r_322_q1", "g3r_322_q2", "g3r_322_q3",
    "g3r_323_q1", "g3r_323_q2", "g3r_323_q3",
    "g3r_324_q1", "g3r_324_q2", "g3r_324_q3",
    "g3r_331_ipconfig", "g3r_331_ping_local", "g3r_331_ping_gw", "g3r_331_ping_8888",
    "g3r_331_ping_google", "g3r_331_tracert", "g3r_331_nslookup", "g3r_331_netstat",
  ];

  function updateProgress() {
    const filled = FORM_FIELDS.filter((k) => String(state[k] || "").trim().length > 0).length;
    const total = FORM_FIELDS.length;
    const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
    const bar = document.getElementById("progressBar");
    const lbl = document.getElementById("progressValue");
    if (bar) bar.style.width = pct + "%";
    if (lbl) lbl.textContent = pct + "%";

    document.querySelectorAll(".nav-link .check").forEach((c) => c.classList.remove("done"));
    const navMap = {
      reflexion: ["reflexion311-locked"],
      contexto: ["bloqueA321-locked", "bloqueB322-locked", "bloqueC323-locked", "bloqueD324-locked", "entregaContexto325-locked"],
      apropiacion: ["comandos331-locked", "presentacion332-locked"],
      transferencia: ["laboratorio341-locked"],
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
    btn.addEventListener("click", () => {
      if (!confirm("¿Reiniciar todas las respuestas guardadas en este navegador? Esta accion no se puede deshacer.")) return;
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

  function initGuia3Redes() {
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
  }

  // El guide_runtime_loader llama window.initGuiaRedes() tras inyectar el contenido.
  window.initGuiaRedes = initGuia3Redes;
  window.initGuia3Redes = initGuia3Redes;

  document.addEventListener("guide-activity-check-change", () => {
    window.requestAnimationFrame(() => updateProgress());
  });
  document.addEventListener("guide-delivery-registered", () => {
    window.requestAnimationFrame(() => updateProgress());
  });
})();
