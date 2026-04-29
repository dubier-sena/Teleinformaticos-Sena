(function () {
  const runtimeRequest = window.__PAGE_CONTEXT__ || null;

  function currentPageFile() {
    return window.location.pathname.split("/").pop() || "pagina.html";
  }

  async function fetchJson(url) {
    if (
      window.__PAGE_RUNTIME_CONTEXTS__ &&
      url === "data/page_runtime_contexts.json"
    ) {
      return window.__PAGE_RUNTIME_CONTEXTS__;
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

  function executeInlinePartialScripts(container) {
    function runInlineScript(code) {
      if (!code) {
        return;
      }
      if (document.head && typeof document.createElement === "function") {
        var newScript = document.createElement("script");
        newScript.textContent = code;
        document.head.appendChild(newScript);
        return;
      }
      if (typeof window.eval === "function") {
        window.eval(code);
      }
    }

    if (container && typeof container.querySelectorAll === "function") {
      var scripts = Array.from(container.querySelectorAll("script:not([src])"));
      scripts.forEach(function (oldScript) {
        runInlineScript(oldScript.textContent);
      });
      return;
    }

    String(container && container.innerHTML ? container.innerHTML : "").replace(
      /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi,
      function (_match, code) {
        runInlineScript(code);
        return "";
      }
    );
  }

  function showRuntimeError(message) {
    const root = document.getElementById("page-root");
    if (!root) {
      return;
    }

    root.innerHTML =
      '<section class="card"><div class="info-box red">' +
      message +
      "</div></section>";
  }

  function resolveBootHook(context) {
    const bootName = String(context.boot || "");
    if (!bootName) {
      return null;
    }

    const bootFn = window[bootName];
    if (typeof bootFn !== "function") {
      throw new Error("No existe el hook runtime " + bootName + ".");
    }

    return bootFn;
  }

  async function bootstrapPageRuntime() {
    if (!runtimeRequest) {
      return;
    }

    const root = document.getElementById("page-root");
    if (!root) {
      return;
    }

    const contexts = await fetchJson("data/page_runtime_contexts.json");
    const context = contexts[runtimeRequest.key];
    if (!context) {
      throw new Error("No existe el contexto " + runtimeRequest.key + ".");
    }

    if (context.family !== runtimeRequest.family) {
      throw new Error("La familia solicitada no coincide con el contexto publico.");
    }

    if (context.pageFile !== currentPageFile()) {
      throw new Error("El wrapper no coincide con el contexto solicitado.");
    }

    const html = await fetchText(context.partialPath);
    root.innerHTML = html;
    window.__PAGE_RUNTIME_CONTEXT__ = context;
    setContextDatasets(context);
    executeInlinePartialScripts(root);

    if (typeof window.initGuiaTemplateShell === "function") {
      window.initGuiaTemplateShell();
    }

    const bootFn = resolveBootHook(context);
    if (bootFn) {
      bootFn();
    }
  }

  window.__pageRuntimePromise = bootstrapPageRuntime().catch(function (error) {
    console.error("[page_runtime_loader]", error);
    showRuntimeError(
      "No fue posible cargar esta pagina. Recarga la pagina o vuelve a entrar desde el portal."
    );
  });
})();
