(function () {
  const runtimeRequest = window.__PAGE_CONTEXT__ || null;

  function currentPageFile() {
    return window.location.pathname.split("/").pop() || "pagina.html";
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

  function executeInlinePartialScripts(html) {
    const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
    let match = scriptPattern.exec(html);

    while (match) {
      const attributes = String(match[1] || "");
      const sourceCode = String(match[2] || "").trim();

      if (!/\bsrc\s*=/.test(attributes) && sourceCode) {
        if (typeof window.eval === "function") {
          window.eval(sourceCode);
        } else {
          Function(sourceCode)();
        }
      }

      match = scriptPattern.exec(html);
    }
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
    executeInlinePartialScripts(html);

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
