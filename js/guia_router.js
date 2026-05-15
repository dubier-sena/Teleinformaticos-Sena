(function () {
  const ROUTE_PAGE_FILE = "guia.html";
  const routeMap = {
    "10a-guia-1": {
      key: "jfk-induccion-10a",
      family: "guia-01-induccion",
      pageFile: "grupo-10a-guia-01-induccion.html",
      title: "Guia 1 - Induccion | Grupo 10A",
      type: "page",
      scripts: [
        "js/shared_shell.js?v=20260508_1",
        "data/calendario_2026_records.js?v=20260410_1",
        "data/calendario_2026_seed.js?v=20260410_1",
        "js/script_induccion.js?v=20260502_1",
        "js/guia_template.js?v=20260430_2",
        "data/page_runtime_contexts_bundle.js?v=20260429_1",
        "partials/guia-01-induccion-bundle.js?v=20260508_1",
        "js/page_runtime_loader.js?v=20260515_1",
      ],
    },
    "10b-guia-1": {
      key: "jfk-induccion-10b",
      family: "guia-01-induccion",
      pageFile: "grupo-10b-guia-01-induccion.html",
      title: "Guia 1 - Induccion | Grupo 10B",
      type: "page",
      scripts: [
        "js/shared_shell.js?v=20260508_1",
        "data/calendario_2026_records.js?v=20260410_1",
        "data/calendario_2026_seed.js?v=20260410_1",
        "js/script_induccion.js?v=20260502_1",
        "js/guia_template.js?v=20260430_2",
        "data/page_runtime_contexts_bundle.js?v=20260429_1",
        "partials/guia-01-induccion-bundle.js?v=20260508_1",
        "js/page_runtime_loader.js?v=20260515_1",
      ],
    },
    "10a-guia-2-herramientas": {
      key: "jfk-guia2-10a",
      family: "guia-02-herramientas",
      pageFile: "grupo-10a-guia-02-herramientas-informaticas-digitales.html",
      title: "Guia 2 - Operar Herramientas Informaticas y Digitales | Grupo 10A",
      type: "page",
      scripts: [
        "js/shared_shell.js?v=20260508_1",
        "js/project_integrations.js?v=20260411_1",
        "js/shared_apps_script_delivery.js?v=20260430_2",
        "js/shared_drive_delivery.js?v=20260430_2",
        "data/calendario_2026_records.js?v=20260410_1",
        "data/calendario_2026_seed.js?v=20260410_1",
        "js/script_guia2.js?v=20260502_1",
        "js/guia_template.js?v=20260430_2",
        "js/fichas_casos.js?v=20260414_1",
        "data/page_runtime_contexts_bundle.js?v=20260429_1",
        "partials/guia-02-herramientas-bundle.js?v=20260508_1",
        "js/page_runtime_loader.js?v=20260515_1",
      ],
    },
    "10b-guia-2-herramientas": {
      key: "jfk-guia2-10b",
      family: "guia-02-herramientas",
      pageFile: "grupo-10b-guia-02-herramientas-informaticas-digitales.html",
      title: "Guia 2 - Operar Herramientas Informaticas y Digitales | Grupo 10B",
      type: "page",
      scripts: [
        "js/shared_shell.js?v=20260508_1",
        "js/project_integrations.js?v=20260411_1",
        "js/shared_apps_script_delivery.js?v=20260430_2",
        "js/shared_drive_delivery.js?v=20260430_2",
        "data/calendario_2026_records.js?v=20260410_1",
        "data/calendario_2026_seed.js?v=20260410_1",
        "js/script_guia2.js?v=20260502_1",
        "js/guia_template.js?v=20260430_2",
        "js/fichas_casos.js?v=20260414_1",
        "data/page_runtime_contexts_bundle.js?v=20260429_1",
        "partials/guia-02-herramientas-bundle.js?v=20260508_1",
        "js/page_runtime_loader.js?v=20260515_1",
      ],
    },
    "10a-guia-3": {
      key: "jfk-guia3-10a",
      family: "guia-03-planificar",
      pageFile: "grupo-10a-guia-03-planificar-informacion.html",
      title: "Guia 3 - Planificar la informacion | Grupo 10A",
      type: "page",
      scripts: [
        "js/shared_shell.js?v=20260508_1",
        "js/project_integrations.js?v=20260411_1",
        "js/shared_apps_script_delivery.js?v=20260430_2",
        "js/shared_drive_delivery.js?v=20260430_2",
        "js/guia3_quiz_bank.js?v=20260506_1",
        "js/script_guia3.js?v=20260506_1",
        "js/guia_template.js?v=20260430_2",
        "data/calendario_2026_records.js?v=20260425_1",
        "data/page_runtime_contexts_bundle.js?v=20260506_1",
        "partials/guia-03-planificar-bundle.js?v=20260515_2",
        "js/page_runtime_loader.js?v=20260515_1",
      ],
    },
    "10b-guia-3": {
      key: "jfk-guia3-10b",
      family: "guia-03-planificar",
      pageFile: "grupo-10b-guia-03-planificar-informacion.html",
      title: "Guia 3 - Planificar la informacion | Grupo 10B",
      type: "page",
      scripts: [
        "js/shared_shell.js?v=20260508_1",
        "js/project_integrations.js?v=20260411_1",
        "js/shared_apps_script_delivery.js?v=20260430_2",
        "js/shared_drive_delivery.js?v=20260430_2",
        "js/guia3_quiz_bank.js?v=20260506_1",
        "js/script_guia3.js?v=20260506_1",
        "js/guia_template.js?v=20260430_2",
        "data/calendario_2026_records.js?v=20260425_1",
        "data/page_runtime_contexts_bundle.js?v=20260506_1",
        "partials/guia-03-planificar-bundle.js?v=20260515_2",
        "js/page_runtime_loader.js?v=20260515_1",
      ],
    },
    "11a-guia-5": {
      key: "sb-guia5-11a",
      family: "guia-05-herramientas",
      pageFile: "grupo-11a-guia-05-herramientas-informaticas-digitales.html",
      title: "Guia 5 - Operar Herramientas Informaticas y Digitales | Grupo 11A",
      type: "page",
      scripts: [
        "js/shared_shell.js?v=20260508_1",
        "js/project_integrations.js?v=20260411_1",
        "js/shared_apps_script_delivery.js?v=20260430_2",
        "js/shared_drive_delivery.js?v=20260430_2",
        "js/script.js?v=20260502_1",
        "js/guia_template.js?v=20260430_2",
        "data/calendario_2026_records.js?v=20260425_1",
        "data/page_runtime_contexts_bundle.js?v=20260429_1",
        "partials/guia-05-herramientas-bundle.js?v=20260429_1",
        "js/page_runtime_loader.js?v=20260515_1",
      ],
    },
    "11b-guia-5": {
      key: "sb-guia5-11b",
      family: "guia-05-herramientas",
      pageFile: "grupo-11b-guia-05-herramientas-informaticas-digitales.html",
      title: "Guia 5 - Operar Herramientas Informaticas y Digitales | Grupo 11B",
      type: "page",
      scripts: [
        "js/shared_shell.js?v=20260508_1",
        "js/project_integrations.js?v=20260411_1",
        "js/shared_apps_script_delivery.js?v=20260430_2",
        "js/shared_drive_delivery.js?v=20260430_2",
        "js/script.js?v=20260502_1",
        "js/guia_template.js?v=20260430_2",
        "data/calendario_2026_records.js?v=20260425_1",
        "data/page_runtime_contexts_bundle.js?v=20260429_1",
        "partials/guia-05-herramientas-bundle.js?v=20260429_1",
        "js/page_runtime_loader.js?v=20260515_1",
      ],
    },
    "11a-guia-6": {
      key: "sb-guia6-11a",
      family: "guia-06-planificar",
      pageFile: "grupo-11a-guia-06-planificar-informacion.html",
      title: "Guia 6 - Planificar la informacion | Grupo 11A",
      type: "page",
      scripts: [
        "js/shared_shell.js?v=20260508_1",
        "js/project_integrations.js?v=20260411_1",
        "js/shared_apps_script_delivery.js?v=20260430_2",
        "js/shared_drive_delivery.js?v=20260430_2",
        "js/guia6_quiz_bank.js?v=20260428_1",
        "js/script_guia6.js?v=20260502_1",
        "js/guia_template.js?v=20260430_2",
        "data/calendario_2026_records.js?v=20260425_1",
        "data/page_runtime_contexts_bundle.js?v=20260429_1",
        "partials/guia-06-planificar-bundle.js?v=20260508_1",
        "js/page_runtime_loader.js?v=20260515_1",
      ],
    },
    "11b-guia-6": {
      key: "sb-guia6-11b",
      family: "guia-06-planificar",
      pageFile: "grupo-11b-guia-06-planificar-informacion.html",
      title: "Guia 6 - Planificar la informacion | Grupo 11B",
      type: "page",
      scripts: [
        "js/shared_shell.js?v=20260508_1",
        "js/project_integrations.js?v=20260411_1",
        "js/shared_apps_script_delivery.js?v=20260430_2",
        "js/shared_drive_delivery.js?v=20260430_2",
        "js/guia6_quiz_bank.js?v=20260428_1",
        "js/script_guia6.js?v=20260502_1",
        "js/guia_template.js?v=20260430_2",
        "data/calendario_2026_records.js?v=20260425_1",
        "data/page_runtime_contexts_bundle.js?v=20260429_1",
        "partials/guia-06-planificar-bundle.js?v=20260508_1",
        "js/page_runtime_loader.js?v=20260515_1",
      ],
    },
    "10a-guia-2-redes": {
      key: "sb-redes-10a",
      template: "guia-redes-rap01",
      pageFile: "santa-barbara-10a-guia-02-redes-rap01.html",
      title: "Guia 2 - Redes RAP01 | Grupo 10A",
      type: "guide",
      scripts: [
        "js/shared_shell.js?v=20260508_1",
        "js/project_integrations.js?v=20260411_1",
        "js/shared_apps_script_delivery.js?v=20260430_2",
        "js/shared_drive_delivery.js?v=20260430_2",
        "data/calendario_2026_records.js?v=20260410_1",
        "data/calendario_2026_seed.js?v=20260410_1",
        "js/redes_lock_sync.js?v=20260428_1",
        "js/guia_template.js?v=20260430_2",
        "js/script_guia_redes.js?v=20260508_2",
        "data/guide_contexts_bundle.js?v=20260429_1",
        "partials/guia-redes-rap01-bundle.js?v=20260508_2",
        "js/guide_runtime_loader.js?v=20260430_1",
      ],
    },
    "10b-guia-2-redes": {
      key: "sb-redes-10b",
      template: "guia-redes-rap01",
      pageFile: "santa-barbara-10b-guia-02-redes-rap01.html",
      title: "Guia 2 - Redes RAP01 | Grupo 10B",
      type: "guide",
      scripts: [
        "js/shared_shell.js?v=20260508_1",
        "js/project_integrations.js?v=20260411_1",
        "js/shared_apps_script_delivery.js?v=20260430_2",
        "js/shared_drive_delivery.js?v=20260430_2",
        "data/calendario_2026_records.js?v=20260410_1",
        "data/calendario_2026_seed.js?v=20260410_1",
        "js/redes_lock_sync.js?v=20260428_1",
        "js/guia_template.js?v=20260430_2",
        "js/script_guia_redes.js?v=20260508_2",
        "data/guide_contexts_bundle.js?v=20260429_1",
        "partials/guia-redes-rap01-bundle.js?v=20260508_2",
        "js/guide_runtime_loader.js?v=20260430_1",
      ],
    },
  };

  const fileAliases = Object.keys(routeMap).reduce(function (accumulator, key) {
    const route = routeMap[key];
    accumulator[route.pageFile] = key;
    return accumulator;
  }, {});

  Object.assign(fileAliases, {
    "jfk-induccion-10a": "10a-guia-1",
    "jfk-induccion-10b": "10b-guia-1",
    "jfk-guia2-10a": "10a-guia-2-herramientas",
    "jfk-guia2-10b": "10b-guia-2-herramientas",
    "jfk-guia3-10a": "10a-guia-3",
    "jfk-guia3-10b": "10b-guia-3",
    "sb-guia5-11a": "11a-guia-5",
    "sb-guia5-11b": "11b-guia-5",
    "sb-guia6-11a": "11a-guia-6",
    "sb-guia6-11b": "11b-guia-6",
    "sb-redes-10a": "10a-guia-2-redes",
    "sb-redes-10b": "10b-guia-2-redes",
  });

  function showRouterError(message) {
    const root = document.getElementById("page-root") || document.getElementById("guide-root");
    if (!root) return;
    root.innerHTML = '<section class="card"><div class="info-box red">' + message + "</div></section>";
  }

  function getRouteKey() {
    const params = new URLSearchParams(window.location.search || "");
    const raw = params.get("g") || params.get("guia") || params.get("file") || params.get("key") || "";
    return fileAliases[raw] || raw;
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      const script = document.createElement("script");
      script.src = src;
      script.defer = false;
      script.onload = resolve;
      script.onerror = function () {
        reject(new Error("No se pudo cargar " + src));
      };
      document.head.appendChild(script);
    });
  }

  async function boot() {
    const routeKey = getRouteKey();
    const route = routeMap[routeKey];
    if (!route) {
      showRouterError("No fue posible encontrar la guia solicitada. Vuelve al portal y selecciona la guia.");
      return;
    }

    if (
      window.portalAuth &&
      typeof window.portalAuth.requireFileAccess === "function" &&
      !window.portalAuth.requireFileAccess(route.pageFile, { redirectUrl: "index.html" })
    ) {
      showRouterError("No tienes permiso para abrir esta guia con el usuario actual.");
      return;
    }

    window.__RUNTIME_PAGE_FILE__ = route.pageFile;
    document.title = route.title + " | SENA Teleinformaticos";

    if (route.type === "guide") {
      window.__GUIDE_CONTEXT__ = {
        key: route.key,
        template: route.template,
        routePageFile: "guia.html",
      };
    } else {
      window.__PAGE_CONTEXT__ = {
        key: route.key,
        family: route.family,
        routePageFile: "guia.html",
      };
    }

    for (const src of route.scripts) {
      await loadScript(src);
    }
  }

  window.guiaRouter = {
    ROUTE_PAGE_FILE,
    routeMap,
    fileAliases,
  };

  boot().catch(function (error) {
    console.error("[guia_router]", error);
    showRouterError("No fue posible cargar esta guia. Recarga la pagina o vuelve a entrar desde el portal.");
  });
})();
