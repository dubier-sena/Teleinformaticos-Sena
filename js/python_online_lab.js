// js/python_online_lab.js — Laboratorio interno opcional para practicar Python.
(function () {
  "use strict";

  var portalAuth = window.portalAuth || null;
  var BASE_STORAGE_KEY = "practica_python_online_lab";
  var STORAGE_KEY = portalAuth
    ? portalAuth.getScopedStorageKey(BASE_STORAGE_KEY, { area: "guide-data" })
    : BASE_STORAGE_KEY;
  var WORKER_URL = "js/python_lab_worker.js?v=20260611_13";
  var EXECUTION_TIMEOUT_MS = 4000;

  var PYTHON_LAB_DEFAULT_CODE = "";
  var FORBIDDEN_PATTERNS = [
    { re: /\bimport\s+os\b|\bos\./, msg: "Uso de os/os.system bloqueado por seguridad." },
    { re: /\bimport\s+subprocess\b|\bsubprocess\./, msg: "Uso de subprocess bloqueado por seguridad." },
    { re: /\bopen\s*\(/, msg: "Lectura o escritura de archivos bloqueada por seguridad." },
    { re: /\b__import__\s*\(/, msg: "Importacion dinamica bloqueada por seguridad." },
    { re: /\beval\s*\(|\bexec\s*\(/, msg: "eval() y exec() estan bloqueados por seguridad." },
    { re: /\b(socket|requests|urllib|http\.client)\b/, msg: "Conexiones externas bloqueadas por seguridad." },
    { re: /\b(fetch|XMLHttpRequest|WebSocket)\b/, msg: "Acceso de red del navegador bloqueado por seguridad." },
    { re: /\b(window|document|localStorage|sessionStorage|indexedDB|firebase|portalAuth)\b/, msg: "Acceso a datos del portal o del navegador bloqueado por seguridad." },
    { re: /(^|[^.\w])(\.{2}\/|\/Users\/|\/etc\/|\/var\/|[A-Za-z]:\\)/, msg: "Acceso a rutas del sistema bloqueado por seguridad." },
  ];

  function assertSafeSource(code) {
    FORBIDDEN_PATTERNS.forEach(function (item) {
      if (item.re.test(code)) throw new Error(item.msg);
    });
  }

  function getSessionFicha() {
    var session = portalAuth?.getCurrentSession?.();
    var fromUser = session?.user?.ficha;
    if (fromUser) return String(fromUser).trim();
    try {
      var raw = localStorage.getItem("sena_portal_session_v1");
      if (raw) {
        var parsed = JSON.parse(raw);
        var ficha = parsed?.user?.ficha;
        if (ficha) return String(ficha).trim();
      }
    } catch (_) {}
    var stored = localStorage.getItem("sena_ficha");
    if (stored) return String(stored).trim();
    return String(document.body?.dataset?.ficha || document.body?.dataset?.defaultFicha || "").trim();
  }

  function getGuideSelection() {
    var session = portalAuth?.getCurrentSession?.();
    var user = session?.user || {};
    var ds = document.body?.dataset || {};
    return {
      ficha: getSessionFicha(),
      grupo: user.grupo || ds.grupo || ds.defaultGrupo || "",
      inst: user.inst || ds.inst || ds.defaultInst || "",
    };
  }

  function getCurrentLearnerName() {
    var session = portalAuth?.getCurrentSession?.();
    return session?.user?.fullName || session?.user?.username || "";
  }

  function isOnlinePracticeEnabled() {
    var ficha = getSessionFicha();
    var selection = getGuideSelection();
    var fichaInfo = portalAuth?.getFichaInfo?.(ficha) || null;
    var modules = fichaInfo?.optionalModules || {};
    var configured = modules.pythonOnlinePractice;
    var globalConfig = window.PORTAL_PYTHON_ONLINE_PRACTICE || {};

    if (Array.isArray(globalConfig.disabledFichas) && globalConfig.disabledFichas.includes(ficha)) return false;
    if (Array.isArray(globalConfig.disabledGroups) && globalConfig.disabledGroups.includes(selection.grupo)) return false;
    if (Array.isArray(globalConfig.enabledFichas) && globalConfig.enabledFichas.length) {
      return globalConfig.enabledFichas.includes(ficha);
    }
    if (typeof configured === "boolean") return configured;
    return globalConfig.enabled !== false;
  }

  function applyOnlinePracticeVisibility() {
    var enabled = isOnlinePracticeEnabled();
    document.querySelectorAll("[data-python-online-practice]").forEach(function (el) {
      el.style.display = enabled ? "" : "none";
    });
    document.querySelectorAll("[data-python-disabled]").forEach(function (el) {
      el.hidden = enabled;
    });
  }

  function getSavedLabCode() {
    return PYTHON_LAB_DEFAULT_CODE;
  }

  function saveLabCode(code) {
    // Seguridad: no se persiste automaticamente el codigo del aprendiz en localStorage,
    // Firebase ni Firestore. El estudiante decide si lo descarga como archivo .py.
    void code;
  }

  function executePythonInWorker(code, stdinText) {
    return new Promise(function (resolve, reject) {
      if (window.location.protocol === "file:") {
        // Seguridad: al abrir como archivo local algunos navegadores bloquean Worker.
        // Se carga el mismo interprete del Worker como script normal (sin eval, sin red).
        try {
          assertSafeSource(String(code || ""));
        } catch (err) {
          reject(err);
          return;
        }
        ensureFallbackRunner()
          .then(function (run) {
            try {
              resolve(run(String(code || ""), String(stdinText || "")));
            } catch (err) {
              reject(err);
            }
          })
          .catch(reject);
        return;
      }
      if (typeof Worker !== "function") {
        reject(new Error("Tu navegador no permite ejecutar el modulo seguro de Python."));
        return;
      }
      // Seguridad: la ejecucion del codigo del aprendiz ocurre en un Worker externo,
      // aislado del DOM, del sistema de guias y de las credenciales del portal.
      var worker = new Worker(WORKER_URL);
      var finished = false;
      var timer = setTimeout(function () {
        if (finished) return;
        finished = true;
        worker.terminate();
        reject(new Error("El codigo tardo demasiado en ejecutarse. Revisa si tienes un ciclo infinito."));
      }, EXECUTION_TIMEOUT_MS);

      worker.onmessage = function (event) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        worker.terminate();
        if (event.data && event.data.ok) resolve(event.data.output || "");
        else reject(new Error((event.data && event.data.error) || "No se pudo ejecutar el codigo."));
      };
      worker.onerror = function () {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        worker.terminate();
        reject(new Error("Error interno del entorno seguro de ejecucion."));
      };
      worker.postMessage({ code: String(code || ""), stdin: String(stdinText || "") });
    });
  }

  function getInputPrompts(code) {
    var prompts = [];
    var re = /\binput\s*\(\s*(?:"([^"]*)"|'([^']*)')?\s*\)/g;
    var match;
    while ((match = re.exec(String(code || "")))) {
      prompts.push(match[1] || match[2] || "Entrada: ");
    }
    return prompts;
  }

  function parsePyLines(code) {
    return String(code || "").replace(/\r\n?/g, "\n").split("\n").map(function (raw, index) {
      var indent = (raw.match(/^ */) || [""])[0].length;
      return { raw: raw, text: raw.trim(), indent: indent, line: index + 1 };
    });
  }

  // Fallback file://: carga el MISMO interprete del Worker como <script> normal.
  // python_lab_worker.js expone __PYLAB_RUN__ y solo registra onmessage dentro
  // de un Worker real, asi no hay dos copias del interprete que mantener.
  var fallbackRunnerPromise = null;
  function ensureFallbackRunner() {
    if (typeof window.__PYLAB_RUN__ === "function") return Promise.resolve(window.__PYLAB_RUN__);
    if (!fallbackRunnerPromise) {
      fallbackRunnerPromise = new Promise(function (resolve, reject) {
        var script = document.createElement("script");
        script.src = WORKER_URL;
        script.onload = function () {
          if (typeof window.__PYLAB_RUN__ === "function") resolve(window.__PYLAB_RUN__);
          else reject(new Error("No se pudo iniciar el interprete local."));
        };
        script.onerror = function () { reject(new Error("No se pudo cargar el interprete local.")); };
        document.head.appendChild(script);
      });
    }
    return fallbackRunnerPromise;
  }

  function validatePythonLabCode(code) {
    var messages = [];
    var text = String(code || "");
    if (!text.trim()) messages.push("Escribe codigo Python antes de validar.");
    if (/\t/.test(text)) messages.push("Usa espacios en lugar de tabulaciones para indentar.");
    if (!/\bprint\s*\(/.test(text)) messages.push("Agrega al menos un print() para ver resultados en consola.");
    if (/^(?:\s*)(def|class)\b/m.test(text)) {
      messages.push("El laboratorio ejecuta variables, input(), print(), condicionales y ciclos for/while. def y class aun no: descarga el .py para trabajarlos en Python instalado.");
    }
    [["(", ")"], ["[", "]"], ["{", "}"]].forEach(function (pair) {
      var open = pair[0];
      var close = pair[1];
      var opens = (text.match(new RegExp("\\" + open, "g")) || []).length;
      var closes = (text.match(new RegExp("\\" + close, "g")) || []).length;
      if (opens !== closes) messages.push("Revisa " + open + close + ": hay simbolos sin cerrar.");
    });
    parsePyLines(text).forEach(function (line) {
      if (!line.text || line.text.startsWith("#")) return;
      if (line.indent % 4 !== 0) messages.push("Linea " + line.line + ": usa indentacion de 4 espacios.");
      if (/^(if|elif|else)\b/.test(line.text) && !line.text.endsWith(":")) {
        messages.push("Linea " + line.line + ": las condicionales terminan con dos puntos (:).");
      }
    });
    return messages;
  }

  function sanitizeLabFileSegment(value) {
    return String(value == null ? "" : value)
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function downloadPythonCode(code) {
    var selection = getGuideSelection();
    var learner = sanitizeLabFileSegment(getCurrentLearnerName() || "Aprendiz") || "Aprendiz";
    var ficha = sanitizeLabFileSegment(selection.ficha || "Ficha") || "Ficha";
    var blob = new Blob([code || ""], { type: "text/x-python;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "PracticaPython_" + learner + "_" + ficha + ".py";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 400);
  }

  function escapeHtml(value) {
    var u = window.portalUtils;
    if (u && typeof u.escapeHtml === "function") return u.escapeHtml(value);
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function highlightPythonLine(line) {
    var parts = [];
    var pattern = /(#.*$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:if|elif|else|and|or|not|True|False|None|return|import|from|class|def|for|while|in|is)\b|\b(?:print|input|int|float|str|bool|len|round|type)\b|\b\d+(?:\.\d+)?\b)/g;
    var last = 0;
    var match;
    while ((match = pattern.exec(line))) {
      parts.push(escapeHtml(line.slice(last, match.index)));
      var token = match[0];
      var cls = "py-token";
      if (token.startsWith("#")) cls = "py-token pytok-comment";
      else if (token.startsWith('"') || token.startsWith("'")) cls = "py-token pytok-string";
      else if (/^\d/.test(token)) cls = "py-token pytok-number";
      else if (/^(print|input|int|float|str|bool|len|round|type)$/.test(token)) cls = "py-token pytok-builtin";
      else cls = "py-token pytok-keyword";
      parts.push('<span class="' + cls + '">' + escapeHtml(token) + '</span>');
      last = pattern.lastIndex;
    }
    parts.push(escapeHtml(line.slice(last)));
    return parts.join("");
  }

  function highlightPythonCode(code) {
    // Seguridad: el codigo se escapa antes de pintar tokens; nunca se inserta HTML crudo del aprendiz.
    return String(code || "").split("\n").map(highlightPythonLine).join("\n") || " ";
  }

  function mountPythonOnlineLab() {
    applyOnlinePracticeVisibility();
    var lab = document.querySelector("[data-python-lab]");
    if (!lab || lab.dataset.labBooted || !isOnlinePracticeEnabled()) return;
    lab.dataset.labBooted = "1";
    var codeEl = lab.querySelector("[data-python-code]");
    var linesEl = lab.querySelector("[data-python-lines]");
    var highlightEl = lab.querySelector("[data-python-highlight]");
    var consoleLineEl = lab.querySelector("[data-python-console-line]");
    var consolePromptEl = lab.querySelector("[data-python-console-prompt]");
    var consoleInputEl = lab.querySelector("[data-python-console-input]");
    var outputEl = lab.querySelector("[data-python-output]");
    var statusEl = lab.querySelector("[data-python-status]");
    if (!codeEl || !outputEl || !statusEl) return;

    function updateEditorView() {
      var count = String(codeEl.value || "").split("\n").length || 1;
      if (linesEl) {
        var numbers = [];
        for (var i = 1; i <= count; i += 1) numbers.push(String(i));
        linesEl.textContent = numbers.join("\n");
        linesEl.scrollTop = codeEl.scrollTop;
      }
      if (highlightEl) {
        highlightEl.innerHTML = highlightPythonCode(codeEl.value);
        highlightEl.scrollTop = codeEl.scrollTop;
        highlightEl.scrollLeft = codeEl.scrollLeft;
      }
    }

    codeEl.value = getSavedLabCode();
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    updateEditorView();
    codeEl.addEventListener("input", function () {
      saveLabCode(codeEl.value);
      updateEditorView();
    });
    codeEl.addEventListener("scroll", updateEditorView);

    codeEl.placeholder =
      '# Escribe tu programa y presiona Ejecutar (Ctrl + Enter)\n' +
      'nombre = input("Como te llamas? ")\n' +
      'print("Hola,", nombre)\n' +
      'for i in range(3):\n' +
      '    print("Python", i + 1)';

    function insertAtCursor(text) {
      var startPos = codeEl.selectionStart;
      var endPos = codeEl.selectionEnd;
      codeEl.value = codeEl.value.slice(0, startPos) + text + codeEl.value.slice(endPos);
      codeEl.selectionStart = codeEl.selectionEnd = startPos + text.length;
      updateEditorView();
    }

    codeEl.addEventListener("keydown", function (event) {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        lab.querySelector("[data-python-run]")?.click();
        return;
      }
      if (event.key === "Tab" && !event.shiftKey) {
        event.preventDefault();
        insertAtCursor("    ");
        return;
      }
      if (event.key === "Enter") {
        // auto-indentacion: conserva la sangria y suma 4 espacios tras ":"
        event.preventDefault();
        var before = codeEl.value.slice(0, codeEl.selectionStart);
        var lineStart = before.lastIndexOf("\n") + 1;
        var currentLine = before.slice(lineStart);
        var indent = (currentLine.match(/^ */) || [""])[0];
        if (/:\s*$/.test(currentLine)) indent += "    ";
        insertAtCursor("\n" + indent);
      }
    });

    // ---- Consola tipo terminal -------------------------------------------
    var termStreamTimer = null;

    function termStop() {
      if (termStreamTimer) {
        clearInterval(termStreamTimer);
        termStreamTimer = null;
      }
      lab.classList.remove("python-lab--running");
    }

    function termLine(text, cls) {
      var el = document.createElement("span");
      el.className = "pyterm-line" + (cls ? " " + cls : "");
      el.textContent = text;
      outputEl.appendChild(el);
      outputEl.scrollTop = outputEl.scrollHeight;
    }

    function termClear() {
      termStop();
      outputEl.textContent = "";
    }

    function termCommandLine() {
      termLine("$ python practica.py", "pyterm-cmd");
    }

    // Muestra la salida linea por linea para que se sienta una ejecucion real.
    function termStream(text, cls, onDone) {
      var streamLines = String(text == null ? "" : text).split("\n");
      if (streamLines.length > 150) {
        streamLines.forEach(function (l) { termLine(l, cls); });
        if (onDone) onDone();
        return;
      }
      var index = 0;
      lab.classList.add("python-lab--running");
      termStreamTimer = setInterval(function () {
        if (index >= streamLines.length) {
          termStop();
          if (onDone) onDone();
          return;
        }
        termLine(streamLines[index], cls);
        index += 1;
      }, 24);
    }

    function termWelcome() {
      termLine("Practica de Python - consola del portal SENA", "pyterm-exit");
      termLine("Escribe tu programa y presiona Ejecutar (o Ctrl + Enter).", "pyterm-exit");
    }

    function setOutput(text, status) {
      if (consoleLineEl) consoleLineEl.hidden = true;
      termClear();
      if (text) {
        String(text).split("\n").forEach(function (l) { termLine(l); });
      }
      statusEl.textContent = status || "Listo.";
    }

    function runWithConsoleInput(stdinText) {
      statusEl.textContent = "Ejecutando...";
      lab.classList.add("python-lab--running");
      executePythonInWorker(codeEl.value, stdinText)
        .then(function (output) {
          termStream(output, null, function () {
            termLine("[programa terminado - codigo 0]", "pyterm-exit");
            statusEl.textContent = "Ejecucion finalizada.";
          });
        })
        .catch(function (err) {
          termStop();
          termLine("Traceback (entorno seguro del portal):", "pyterm-err");
          termLine("  " + (err?.message || err), "pyterm-err");
          termLine("[programa terminado - codigo 1]", "pyterm-exit");
          statusEl.textContent = "Revisa el codigo.";
        });
    }

    function askInputsInConsole(prompts) {
      if (!consoleLineEl || !consolePromptEl || !consoleInputEl) return false;
      var values = [];
      var index = 0;
      termClear();
      termCommandLine();
      statusEl.textContent = "El programa espera tus datos...";

      function renderPrompt() {
        consoleLineEl.hidden = false;
        consolePromptEl.textContent = prompts[index] || "Entrada: ";
        consoleInputEl.value = "";
        consoleInputEl.focus();
      }

      consoleInputEl.onkeydown = function (event) {
        if (event.key !== "Enter") return;
        event.preventDefault();
        var promptText = prompts[index] || "Entrada: ";
        var value = consoleInputEl.value;
        values.push(value);
        termLine(promptText + value, "pyterm-echo");
        index += 1;
        if (index < prompts.length) {
          renderPrompt();
          return;
        }
        consoleLineEl.hidden = true;
        // se repite la corrida completa: el eco de las entradas vuelve a salir
        // en su posicion real dentro del programa, como en una consola.
        termClear();
        termCommandLine();
        runWithConsoleInput(values.join("\n"));
      };

      renderPrompt();
      return true;
    }

    lab.querySelector("[data-python-run]")?.addEventListener("click", function () {
      saveLabCode(codeEl.value);
      if (!String(codeEl.value || "").trim()) {
        setOutput("Escribe codigo Python en el editor y luego presiona Ejecutar.", "Sin codigo.");
        return;
      }
      if (consoleLineEl) consoleLineEl.hidden = true;
      var prompts = getInputPrompts(codeEl.value);
      if (prompts.length && askInputsInConsole(prompts)) return;
      termClear();
      termCommandLine();
      runWithConsoleInput("");
    });

    termClear();
    termWelcome();

    lab.querySelector("[data-python-validate]")?.addEventListener("click", function () {
      saveLabCode(codeEl.value);
      var messages = validatePythonLabCode(codeEl.value);
      setOutput(
        messages.length ? messages.map(function (m) { return "- " + m; }).join("\n") : "Validacion correcta. Puedes ejecutar o descargar el archivo.",
        messages.length ? "Validacion con observaciones." : "Validacion correcta."
      );
    });

    lab.querySelector("[data-python-download]")?.addEventListener("click", function () {
      saveLabCode(codeEl.value);
      downloadPythonCode(codeEl.value);
      statusEl.textContent = "Archivo .py descargado.";
    });

    lab.querySelector("[data-python-clear]")?.addEventListener("click", function () {
      if (consoleLineEl) consoleLineEl.hidden = true;
      termClear();
      termWelcome();
      statusEl.textContent = "Consola limpia.";
    });
  }

  window.PythonOnlineLab = {
    isOnlinePracticeEnabled: isOnlinePracticeEnabled,
    executePythonInWorker: executePythonInWorker,
    validatePythonLabCode: validatePythonLabCode,
    mount: mountPythonOnlineLab,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountPythonOnlineLab);
  } else {
    mountPythonOnlineLab();
  }
  setTimeout(mountPythonOnlineLab, 800);
})();
