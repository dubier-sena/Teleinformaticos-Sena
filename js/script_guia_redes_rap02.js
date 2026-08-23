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

  // Carga/guardado/hidratacion desde la nube/reintento centralizados en
  // js/guide_cloud_sync.js (antes cada guion los reimplementaba por su cuenta;
  // 8 de ellas, incluida esta, nunca leian de la nube al cargar -- auditoria
  // 2026-08-22).
  let state = window.GuideCloudSync
    ? window.GuideCloudSync.loadLocal(STORAGE_KEY, LEGACY_STORAGE_KEY)
    : {};
  let booted = false;

  function getActor() {
    const session = portalAuth?.getCurrentSession?.();
    return session?.user?.fullName || session?.user?.username || "Aprendiz";
  }

  const cloudStore = window.GuideCloudSync?.createStore({
    storageKey: STORAGE_KEY,
    legacyStorageKey: LEGACY_STORAGE_KEY,
    guideDataFile: GUIDE_DATA_FILE,
    getState: () => state,
    setState: (next) => { state = next; },
    getActor: getActor,
    periodicRefreshMs: 300000,
    onHydrated: () => { hydrateFields(); updateProgress(); },
  });

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
    cloudStore?.notifyChanged();
    updateProgress();
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
    // Sincroniza el avance a la nube para que el panel admin lo vea aunque el
    // aprendiz haya guardado desde otro equipo (sin esto el admin deriva mal el %).
    portalAuth?.writeGuideProgress?.(PAGE_FILE, { completed: filled, total, percent: pct });

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
    btn.addEventListener("click", async () => {
      if (!(await window.portalConfirm("¿Reiniciar todas las respuestas guardadas en este navegador? Esta accion no se puede deshacer.", { title: "Reiniciar respuestas", confirmText: "Reiniciar" }))) return;
      state = {};
      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(`${STORAGE_KEY}__meta`);
      } catch {}
      hydrateFields();
      updateProgress();
      cloudStore?.notifyChanged();
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
    reflectGradesForGuia3Redes();
    cloudStore?.hydrate();
  }

  // Esta guia nunca llamaba a reflectGradesIntoGuideState (mismo bug que Guia
  // 5/7/8, ver reflectGradesForGuia8() en js/script_guia8.js): si el admin
  // aprobaba una actividad de formulario con el banco de respuestas (el
  // aprendiz nunca la guardo el mismo), el flag "{id}-locked" nunca se ponia,
  // asi que ActivityStandard.mountActivities() seguia mostrando los campos
  // editables aunque la actividad ya estuviera Aprobada. Detectado 2026-07-26
  // en QA de la cuenta de pruebas 10A/10B Santa Barbara.
  function reflectGradesForGuia3Redes() {
    var mgr = window.activityGradesManager;
    if (!mgr || typeof mgr.reflectGradesIntoGuideState !== "function") return;
    mgr.reflectGradesIntoGuideState({
      guideFamily: "guia-redes-rap02",
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

  // Copiar comando al portapapeles — actividad 3.3.1
  window.copiarComando331 = function (btn, texto) {
    var original = btn.innerHTML;
    function mostrarCopiado() {
      btn.innerHTML = "&#10003; Copiado";
      btn.style.background = "#e8f5e9";
      btn.style.borderColor = "#2e7d32";
      btn.style.color = "#1b5e20";
      setTimeout(function () {
        btn.innerHTML = original;
        btn.style.background = "#e3f2fd";
        btn.style.borderColor = "#1565c0";
        btn.style.color = "#1565c0";
      }, 1800);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(mostrarCopiado).catch(function () {
        fallbackCopiar(texto);
        mostrarCopiado();
      });
    } else {
      fallbackCopiar(texto);
      mostrarCopiado();
    }
  };

  function fallbackCopiar(texto) {
    var ta = document.createElement("textarea");
    ta.value = texto;
    ta.style.cssText = "position:fixed;top:-9999px;left:-9999px";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) { /* silencioso */ }
    document.body.removeChild(ta);
  }

  // Pestañas de video para el Bloque C (3.2.3 — DHCP y DNS)
  window.showVideoBloque323 = function (n) {
    var active   = "flex:1;padding:8px 12px;border-radius:8px;border:2px solid #2e7d32;cursor:pointer;font-size:0.85rem;font-weight:600;font-family:inherit;background:#2e7d32;color:#fff";
    var inactive = "flex:1;padding:8px 12px;border-radius:8px;border:2px solid #2e7d32;cursor:pointer;font-size:0.85rem;font-weight:600;font-family:inherit;background:#e8f5e9;color:#1b5e20";
    var v1 = document.getElementById("videoC323-1");
    var v2 = document.getElementById("videoC323-2");
    var b1 = document.getElementById("tabC323-btn-1");
    var b2 = document.getElementById("tabC323-btn-2");
    if (v1) v1.style.display = n === 1 ? "block" : "none";
    if (v2) v2.style.display = n === 2 ? "block" : "none";
    if (b1) b1.style.cssText = n === 1 ? active : inactive;
    if (b2) b2.style.cssText = n === 2 ? active : inactive;
  };

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
