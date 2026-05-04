// script_guia5.js — Controles opcionales de fecha de entrega para Guía 5 (Herramientas 11°)
(function () {
  "use strict";
  const PAGE_FILE = (window.location.pathname.split("/").pop() || "").toLowerCase();
  const PAGE_FILE_ALIASES = {
    "grupo-11a-guia-05-herramientas-informaticas-digitales.html": "11a_guia.html",
    "grupo-11b-guia-05-herramientas-informaticas-digitales.html": "11b_guia.html",
  };
  const GUIDE_DATA_FILE = PAGE_FILE_ALIASES[PAGE_FILE] || PAGE_FILE;

  function installGuia5DeadlineControls() {
    if (!window.activityDeadlineManager?.applyAvailability) return;

    // 3.1.1 — Bitácora de análisis del caso
    window.activityDeadlineManager.applyAvailability({
      pageFile: GUIDE_DATA_FILE,
      activityId: "guia5-311",
      fieldSelector: "[data-store^='bitacora-']",
      adminMount: { mountSelector: "#guia5311DeadlineControls" },
      noticeMount: { mountSelector: "#guia5311DeadlineControls" },
    });

    // 3.3.1 — Evidencias de herramientas (extensiones + sistemas)
    window.activityDeadlineManager.applyAvailability({
      pageFile: GUIDE_DATA_FILE,
      activityId: "guia5-331",
      adminMount: { mountSelector: "#guia5331DeadlineControls" },
      noticeMount: { mountSelector: "#guia5331DeadlineControls" },
    });

    // 3.4.1 — Informe final integrador
    window.activityDeadlineManager.applyAvailability({
      pageFile: GUIDE_DATA_FILE,
      activityId: "guia5-341",
      adminMount: { mountSelector: "#guia5341DeadlineControls" },
      noticeMount: { mountSelector: "#guia5341DeadlineControls" },
    });
  }

  window.installGuia5DeadlineControls = installGuia5DeadlineControls;
  window.addEventListener("activity-deadlines-updated", installGuia5DeadlineControls);
})();
