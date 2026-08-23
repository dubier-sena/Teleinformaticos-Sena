(function () {
  const runtimeRequest = window.__GUIDE_CONTEXT__ || null;

  function currentPageFile() {
    return window.location.pathname.split("/").pop() || "guia.html";
  }

  function routePageMatches(context) {
    const current = currentPageFile();
    return context.pageFile === current || runtimeRequest.routePageFile === current;
  }

  async function fetchJson(url) {
    if (window.__GUIDE_RUNTIME_CONTEXTS__ && url === "data/guide_contexts.json") {
      return window.__GUIDE_RUNTIME_CONTEXTS__;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("No se pudo cargar " + url);
    }
    return response.json();
  }

  async function fetchText(url) {
    const bundledPartials = window.__PAGE_RUNTIME_PARTIALS__ || {};
    if (Object.prototype.hasOwnProperty.call(bundledPartials, url)) {
      return bundledPartials[url];
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("No se pudo cargar " + url);
    }
    return response.text();
  }

  function setContextDatasets(context) {
    document.body.dataset.defaultInst = context.inst || "";
    document.body.dataset.defaultGrupo = context.grupo || "";
    document.body.dataset.defaultFicha = context.ficha || "";
  }

  // Auditoria/cierre de riesgos 2026-08-22 (Riesgo 3): mismo fix que
  // js/page_runtime_loader.js -- ver su comentario. Los partials fuente
  // traen enlaces internos entre guias como archivo crudo, que no existe
  // servido asi en produccion (guia.html?g=... es el unico punto de entrada
  // real). Se reescribe aqui, una sola vez tras inyectar el HTML.
  function rewireGuideLinks(container) {
    if (!container || typeof container.querySelectorAll !== "function") return;
    var auth = window.portalAuth;
    if (!auth || typeof auth.getGuideHref !== "function") return;
    var links = container.querySelectorAll("a[href]");
    Array.prototype.forEach.call(links, function (link) {
      var href = link.getAttribute("href") || "";
      var match = href.match(/^((?:grupo|santa-barbara)-[a-z0-9._-]+\.html)(#.*)?$/i);
      if (!match) return;
      link.setAttribute("href", auth.getGuideHref(match[1]) + (match[2] || ""));
    });
  }

  function setContextLinks(context) {
    const quizRedesLink = document.getElementById("quizRedesActionLink");
    const quizIpLink = document.getElementById("quizIPActionLink");
    if (quizRedesLink && context.quizRedesUrl) {
      quizRedesLink.setAttribute("href", context.quizRedesUrl);
    }
    if (quizIpLink && context.quizIpUrl) {
      quizIpLink.setAttribute("href", context.quizIpUrl);
    }
  }

  function showRuntimeError(message) {
    const root = document.getElementById("guide-root");
    if (!root) return;
    root.innerHTML = '<section class="card"><div class="info-box red">' + message + "</div></section>";
  }

  async function bootstrapGuideRuntime() {
    if (!runtimeRequest) {
      return;
    }

    const root = document.getElementById("guide-root");
    if (!root) {
      throw new Error("No existe #guide-root para cargar la guia.");
    }

    const contexts = await fetchJson("data/guide_contexts.json");
    const context = contexts[runtimeRequest.key];
    if (!context) {
      throw new Error("No existe el contexto " + runtimeRequest.key + ".");
    }

    if (context.template !== runtimeRequest.template) {
      throw new Error("El template solicitado no coincide con el contexto publico.");
    }

    if (!routePageMatches(context)) {
      throw new Error("El wrapper no coincide con el contexto solicitado.");
    }

    const html = await fetchText(context.partialPath);
    root.innerHTML = html;
    window.__GUIDE_RUNTIME_CONTEXT__ = context;
    setContextDatasets(context);
    setContextLinks(context);
    rewireGuideLinks(root);

    if (typeof window.initGuiaTemplateShell === "function") {
      window.initGuiaTemplateShell();
    }
    if (typeof window.initGuiaRedes === "function") {
      window.initGuiaRedes();
    }
    // Hook generico para guias nuevas: el script de la guia expone
    // window.__GUIDE_INIT__ y el loader lo invoca tras inyectar el contenido.
    if (typeof window.__GUIDE_INIT__ === "function") {
      window.__GUIDE_INIT__();
    }
  }

  window.__guideRuntimePromise = bootstrapGuideRuntime().catch(function (error) {
    console.error("[guide_runtime_loader]", error);
    showRuntimeError("No fue posible cargar esta guia. Recarga la pagina o vuelve a entrar desde el portal.");
  });
})();
