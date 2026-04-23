(function () {
  const runtimeRequest = window.__GUIDE_CONTEXT__ || null;

  function currentPageFile() {
    return window.location.pathname.split("/").pop() || "guia.html";
  }

  async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("No se pudo cargar " + url);
    }
    return response.json();
  }

  async function fetchText(url) {
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

    if (context.pageFile !== currentPageFile()) {
      throw new Error("El wrapper no coincide con el contexto solicitado.");
    }

    const html = await fetchText(context.partialPath);
    root.innerHTML = html;
    window.__GUIDE_RUNTIME_CONTEXT__ = context;
    setContextDatasets(context);
    setContextLinks(context);

    if (typeof window.initGuiaTemplateShell === "function") {
      window.initGuiaTemplateShell();
    }
    if (typeof window.initGuiaRedes === "function") {
      window.initGuiaRedes();
    }
  }

  window.__guideRuntimePromise = bootstrapGuideRuntime().catch(function (error) {
    console.error("[guide_runtime_loader]", error);
    showRuntimeError("No fue posible cargar esta guia. Recarga la pagina o vuelve a entrar desde el portal.");
  });
})();
