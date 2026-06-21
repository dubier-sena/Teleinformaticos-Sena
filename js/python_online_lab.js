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

  // Revision EN VIVO mientras el aprendiz escribe: detecta errores de ESTRUCTURA
  // sin ejecutar, para subrayar la linea. Los errores de logica/ejecucion (variable
  // no definida, sumar texto+numero, etc.) solo se conocen al Ejecutar, no aqui.
  // Funcion pura: probada en tests/python_live_check.test.cjs.
  function liveStructuralIssues(code) {
    var raw = String(code == null ? "" : code).replace(/\r\n?/g, "\n");
    var rows = raw.split("\n");
    var errorLines = [];
    var note = "";
    function flag(n, message) {
      if (errorLines.indexOf(n) < 0) errorLines.push(n);
      if (!note) note = message;
    }
    rows.forEach(function (rawLine, i) {
      var n = i + 1;
      var text = rawLine.trim();
      if (!text || text.charAt(0) === "#") return;
      if (/\t/.test(rawLine)) flag(n, "Linea " + n + ": usa espacios, no tabulaciones.");
      var indent = (rawLine.match(/^ */) || [""])[0].length;
      if (indent % 4 !== 0) flag(n, "Linea " + n + ": la indentacion debe ir de 4 en 4 espacios.");
      if (/^(if|elif|else|for|while)\b/.test(text) && text.indexOf(":") < 0) {
        flag(n, "Linea " + n + ": falta el dos puntos (:) al final.");
      }
    });
    if (!note) {
      var pairs = [["(", ")"], ["[", "]"], ["{", "}"]];
      for (var p = 0; p < pairs.length; p += 1) {
        var opens = (raw.match(new RegExp("\\" + pairs[p][0], "g")) || []).length;
        var closes = (raw.match(new RegExp("\\" + pairs[p][1], "g")) || []).length;
        if (opens !== closes) { note = "Revisa los " + pairs[p][0] + pairs[p][1] + ": hay alguno sin cerrar."; break; }
      }
    }
    return { lines: errorLines, note: note };
  }

  // ── Autocompletado contextual (estatico, sin IA) ───────────────────────────
  // Detecta las variables que el aprendiz YA creo en su codigo, para sugerirlas.
  function collectUserVariables(code) {
    var names = [];
    var seen = {};
    function add(name) { if (name && !seen[name]) { seen[name] = true; names.push(name); } }
    String(code == null ? "" : code).split("\n").forEach(function (line) {
      var t = line.replace(/#.*$/, "");
      var assign = t.match(/^\s*([A-Za-z_]\w*)\s*(?:[-+*/]?=)(?!=)/); // NAME = / NAME += (no ==)
      if (assign) add(assign[1]);
      var loop = t.match(/^\s*for\s+([A-Za-z_]\w*)\s+in\b/);           // for NAME in ...
      if (loop) add(loop[1]);
    });
    return names;
  }

  // Sugerencias para el prefijo que escribe el aprendiz, por relevancia:
  // sus variables, luego funciones soportadas y palabras clave del lenguaje.
  function getCompletions(code, prefix, limit) {
    var p = String(prefix == null ? "" : prefix);
    if (!/^[A-Za-z_]/.test(p)) return [];
    var lp = p.toLowerCase();
    var max = limit || 8;
    var groups = [collectUserVariables(code), PY_BUILTINS.split("|"), PY_KEYWORDS.split("|")];
    var out = [];
    var seen = {};
    groups.forEach(function (group) {
      group.forEach(function (name) {
        if (out.length >= max || seen[name] || name === p) return;
        if (name.toLowerCase().indexOf(lp) === 0) { seen[name] = true; out.push(name); }
      });
    });
    return out;
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

  // Comandos de control (keyword) y funciones (builtin) que colorea el editor.
  var PY_KEYWORDS = "if|elif|else|and|or|not|True|False|None|return|import|from|class|def|for|while|in|is|break|continue|pass";
  var PY_BUILTINS = "print|input|int|float|str|bool|len|round|type|range|sum|max|min|abs|sorted|list|dict|tuple|set|append";
  var PY_KEYWORD_RE = new RegExp("^(?:" + PY_KEYWORDS + ")$");
  var PY_BUILTIN_RE = new RegExp("^(?:" + PY_BUILTINS + ")$");

  function highlightPythonLine(line) {
    var parts = [];
    // Orden importa: comentario, texto, comando/funcion, numero y, al final,
    // cualquier identificador restante = VARIABLE (nombre que crea el aprendiz).
    var pattern = new RegExp(
      "(#.*$" +
      '|"(?:\\\\.|[^"\\\\])*"' +
      "|'(?:\\\\.|[^'\\\\])*'" +
      "|\\b(?:" + PY_KEYWORDS + ")\\b" +
      "|\\b(?:" + PY_BUILTINS + ")\\b" +
      "|\\b\\d+(?:\\.\\d+)?\\b" +
      "|[A-Za-z_]\\w*)",
      "g"
    );
    var last = 0;
    var match;
    while ((match = pattern.exec(line))) {
      parts.push(escapeHtml(line.slice(last, match.index)));
      var token = match[0];
      var cls = "py-token";
      if (token.startsWith("#")) cls = "py-token pytok-comment";
      else if (token.startsWith('"') || token.startsWith("'")) cls = "py-token pytok-string";
      else if (/^\d/.test(token)) cls = "py-token pytok-number";
      else if (PY_BUILTIN_RE.test(token)) cls = "py-token pytok-builtin";
      else if (PY_KEYWORD_RE.test(token)) cls = "py-token pytok-keyword";
      else cls = "py-token pytok-variable";
      parts.push('<span class="' + cls + '">' + escapeHtml(token) + '</span>');
      last = pattern.lastIndex;
    }
    parts.push(escapeHtml(line.slice(last)));
    return parts.join("");
  }

  function highlightPythonCode(code) {
    // Seguridad: el codigo se escapa antes de pintar tokens; nunca se inserta HTML crudo del aprendiz.
    // Cada linea va en su propio <span class="py-line"> para poder subrayar en vivo
    // (clase pytok-errline) las lineas con error de estructura mientras el aprendiz escribe.
    var html = String(code || "").split("\n").map(function (line) {
      return '<span class="py-line">' + highlightPythonLine(line) + "</span>";
    }).join("\n");
    return html || " ";
  }

  // ── Ayuda al aprendiz: traduce el error a una explicacion + pista + ejemplo ──
  // El worker ya da mensajes en espanol, pero crudos. Esto agrega, para cada
  // tipo de error, QUE paso, COMO arreglarlo y un ejemplo corto. Es funcion pura
  // (se prueba en tests/python_error_help.test.cjs) y se expone en PythonOnlineLab.
  function extractErrorLine(message) {
    var m = String(message == null ? "" : message).match(/l[ií]nea\s+(\d+)/i);
    return m ? Number(m[1]) : 0;
  }

  function explainPythonError(rawMessage) {
    var msg = String(rawMessage == null ? "" : rawMessage);
    var lower = msg.toLowerCase();
    var line = extractErrorLine(msg);
    function help(title, fix, example) {
      return { title: title, fix: fix || "", example: example || "", line: line };
    }

    if (lower.indexOf("nameerror") >= 0 || lower.indexOf("no esta definid") >= 0 || lower.indexOf("no está definid") >= 0) {
      var varName = (msg.match(/variable '([^']+)'/) || [])[1];
      return help(
        varName ? "La variable '" + varName + "' no existe todavia." : "Usaste una variable que no existe todavia.",
        "Crea la variable (asignale un valor) ANTES de usarla y revisa mayusculas/minusculas: 'Nombre' y 'nombre' son distintas.",
        varName ? varName + ' = "valor"   # crea ' + varName + " antes de usarla" : 'nombre = "Ana"   # crea la variable antes'
      );
    }
    if (lower.indexOf("int() no pudo convertir") >= 0) {
      return help("Ese texto no se puede convertir a numero entero.", "int() solo convierte texto formado por digitos: sin letras ni decimales.", 'edad = int("16")   # bien   |   int("dieciseis") falla');
    }
    if (lower.indexOf("float() no pudo convertir") >= 0) {
      return help("Ese texto no se puede convertir a numero decimal.", "float() necesita un numero; usa punto para los decimales.", 'nota = float("4.5")   # bien');
    }
    if (lower.indexOf("sumar texto con numero") >= 0) {
      return help("Estas mezclando texto y numeros con el signo +.", "Convierte el numero a texto con str(), o suma numeros entre si.", 'print("Edad: " + str(edad))');
    }
    if (lower.indexOf("zerodivision") >= 0 || lower.indexOf("division entre cero") >= 0) {
      return help("Division entre cero.", "No se puede dividir entre 0. Revisa el divisor antes de dividir.", "if divisor != 0:\n    print(total / divisor)");
    }
    if (lower.indexOf("indexerror") >= 0 || lower.indexOf("fuera de rango") >= 0) {
      return help("Pediste una posicion que no existe en la lista.", "Las listas empiezan en 0: el primero es [0] y el ultimo es [len(lista) - 1].", "notas = [4.0, 3.5]\nprint(notas[0])   # primer elemento");
    }
    if (lower.indexOf("indentacion") >= 0 || lower.indexOf("indentación") >= 0 || lower.indexOf("bloque indentado") >= 0) {
      return help("La indentacion (sangria) no es correcta.", "Usa 4 espacios para el codigo que va DENTRO de un if, for o while.", "for i in range(3):\n    print(i)   # 4 espacios adentro");
    }
    if (lower.indexOf("dos puntos") >= 0 || lower.indexOf("terminan con :") >= 0) {
      return help("Falto el dos puntos (:).", "Las lineas con if, elif, else, for o while terminan en dos puntos.", 'if edad >= 18:\n    print("Mayor de edad")');
    }
    if (lower.indexOf("sin cerrar") >= 0) {
      return help("Hay un parentesis, corchete o comilla sin cerrar.", 'Revisa que cada ( [ { y cada " tengan su pareja de cierre.', 'print("Hola")');
    }
    if (lower.indexOf("aun no estan disponibles") >= 0 || lower.indexOf("def y class") >= 0 || lower.indexOf("def, class") >= 0) {
      return help("Esa instruccion aun no esta disponible en el laboratorio.", "El laboratorio practica variables, input(), print(), condicionales y ciclos. Para def/class/import descarga el .py y usalo en Python instalado.", "");
    }
    if (lower.indexOf("range()") >= 0) {
      return help("Problema con range().", "range(inicio, fin, paso): el paso no puede ser 0 y el rango no puede ser enorme.", "for i in range(0, 5):\n    print(i)");
    }
    if (lower.indexOf("tardo demasiado") >= 0 || lower.indexOf("ciclo infinito") >= 0) {
      return help("El programa no termino (posible ciclo infinito).", "Si usas while, asegurate de que la condicion llegue a ser falsa: algo debe cambiar dentro del ciclo.", "n = 0\nwhile n < 3:\n    print(n)\n    n = n + 1");
    }
    if (lower.indexOf("break y continue") >= 0) {
      return help("Usaste break o continue fuera de un ciclo.", "break y continue solo se usan dentro de un for o un while.", "");
    }
    if (lower.indexOf("solo puedes recorrer") >= 0) {
      return help("Estas recorriendo algo que no es lista, texto ni range.", "El for recorre listas, cadenas de texto o range(...).", 'for letra in "hola":\n    print(letra)');
    }
    if (lower.indexOf(".append()") >= 0) {
      return help(".append() solo funciona sobre listas.", "Crea la lista con [] antes de usar .append().", "notas = []\nnotas.append(4.5)");
    }
    if (lower.indexOf("seguridad") >= 0) {
      return help("El laboratorio bloqueo esa instruccion por seguridad.", "No necesitas archivos, internet ni el sistema para practicar lo basico: usa variables, input(), print(), if y ciclos.", "");
    }
    if (line) {
      return help("Hay un error en la linea " + line + ".", "Lee el mensaje de arriba y compara esa linea con los ejemplos de la guia.", "");
    }
    return help("El programa tiene un error.", "Lee el mensaje de arriba con calma y compara tu codigo con los ejemplos de la guia.", "");
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
    var liveStatusEl = lab.querySelector("[data-python-live-status]");
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

    // Subrayado en vivo de errores de estructura: las lineas <span class="py-line">
    // del overlay reciben la clase pytok-errline mientras el aprendiz escribe (con
    // un pequeno retardo). El visto bueno real sigue siendo al Ejecutar.
    var liveTimer = null;
    function markErrorLines(lineNumbers) {
      if (!highlightEl) return;
      var mark = {};
      (lineNumbers || []).forEach(function (n) { mark[n] = true; });
      var spans = highlightEl.querySelectorAll(".py-line");
      for (var k = 0; k < spans.length; k += 1) {
        spans[k].classList.toggle("pytok-errline", !!mark[k + 1]);
      }
    }
    function runLiveCheck() {
      liveTimer = null;
      var issues = liveStructuralIssues(codeEl.value);
      markErrorLines(issues.lines);
      if (liveStatusEl) liveStatusEl.textContent = issues.note ? "⚠ " + issues.note : "";
    }
    function scheduleLiveCheck() {
      if (liveTimer) clearTimeout(liveTimer);
      liveTimer = setTimeout(runLiveCheck, 400);
    }

    // ---- Autocompletado contextual: dropdown junto al cursor -----------------
    var acBox = null, acItems = [], acActive = 0, acCharW = 0;
    function acEnsureBox() {
      if (acBox) return acBox;
      acBox = document.createElement("ul");
      acBox.className = "python-lab__ac";
      acBox.setAttribute("role", "listbox");
      acBox.hidden = true;
      document.body.appendChild(acBox);
      acBox.addEventListener("mousedown", function (event) {
        var li = event.target.closest("[data-ac-index]");
        if (!li) return;
        event.preventDefault(); // conserva el foco del editor
        acActive = Number(li.getAttribute("data-ac-index")) || 0;
        acAccept();
      });
      return acBox;
    }
    function acMeasureCharWidth() {
      if (acCharW) return acCharW;
      var cs = getComputedStyle(codeEl);
      var span = document.createElement("span");
      span.style.cssText = "position:absolute;visibility:hidden;white-space:pre;";
      span.style.fontFamily = cs.fontFamily;
      span.style.fontSize = cs.fontSize;
      span.textContent = "00000000000000000000";
      document.body.appendChild(span);
      acCharW = (span.getBoundingClientRect().width / 20) || 8.4;
      span.remove();
      return acCharW;
    }
    function acCurrentWord() {
      var pos = codeEl.selectionStart;
      var value = codeEl.value;
      var start = pos;
      while (start > 0 && /[A-Za-z0-9_]/.test(value.charAt(start - 1))) start -= 1;
      return { start: start, end: pos, prefix: value.slice(start, pos) };
    }
    function acIsOpen() { return !!(acBox && !acBox.hidden && acItems.length); }
    function acClose() { if (acBox) acBox.hidden = true; acItems = []; }
    function acPosition(info) {
      var cs = getComputedStyle(codeEl);
      var padL = parseFloat(cs.paddingLeft) || 0;
      var padT = parseFloat(cs.paddingTop) || 0;
      var lh = parseFloat(cs.lineHeight) || (parseFloat(cs.fontSize) * 1.5) || 21;
      var rect = codeEl.getBoundingClientRect();
      var before = codeEl.value.slice(0, info.start);
      var lineIdx = before.split("\n").length - 1;
      var col = info.start - (before.lastIndexOf("\n") + 1);
      var chW = acMeasureCharWidth();
      acBox.style.left = (rect.left + padL + col * chW - codeEl.scrollLeft) + "px";
      acBox.style.top = (rect.top + padT + (lineIdx + 1) * lh - codeEl.scrollTop) + "px";
    }
    function acRenderActive() {
      if (!acBox) return;
      Array.prototype.forEach.call(acBox.children, function (li, i) {
        li.classList.toggle("is-active", i === acActive);
      });
    }
    function acOpen() {
      var info = acCurrentWord();
      var items = getCompletions(codeEl.value, info.prefix);
      if (!items.length) { acClose(); return; }
      var box = acEnsureBox();
      acItems = items;
      acActive = 0;
      box.innerHTML = items.map(function (name, i) {
        return '<li role="option" class="python-lab__ac-item' + (i === 0 ? " is-active" : "") +
          '" data-ac-index="' + i + '">' + escapeHtml(name) + "</li>";
      }).join("");
      acPosition(info);
      box.hidden = false;
    }
    function acMove(delta) {
      if (!acItems.length) return;
      acActive = (acActive + delta + acItems.length) % acItems.length;
      acRenderActive();
    }
    function acAccept() {
      var word = acItems[acActive];
      if (!word) { acClose(); return; }
      var info = acCurrentWord();
      var v = codeEl.value;
      codeEl.value = v.slice(0, info.start) + word + v.slice(info.end);
      codeEl.selectionStart = codeEl.selectionEnd = info.start + word.length;
      acClose();
      updateEditorView();
      scheduleLiveCheck();
      codeEl.focus();
    }
    // Este keydown se registra ANTES que el de indentacion/ejecucion: cuando el
    // dropdown esta abierto intercepta las teclas y corta la propagacion para que
    // Tab/Enter completen en vez de indentar o ejecutar.
    codeEl.addEventListener("keydown", function (event) {
      if (!acIsOpen()) return;
      if (event.key === "ArrowDown") { event.preventDefault(); event.stopImmediatePropagation(); acMove(1); }
      else if (event.key === "ArrowUp") { event.preventDefault(); event.stopImmediatePropagation(); acMove(-1); }
      else if (event.key === "Enter" || event.key === "Tab") { event.preventDefault(); event.stopImmediatePropagation(); acAccept(); }
      else if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); acClose(); }
    });
    codeEl.addEventListener("input", acOpen);
    codeEl.addEventListener("blur", function () { setTimeout(acClose, 120); });
    codeEl.addEventListener("scroll", function () { if (acIsOpen()) acClose(); });
    window.addEventListener("resize", acClose);

    codeEl.value = getSavedLabCode();
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    updateEditorView();
    codeEl.addEventListener("input", function () {
      saveLabCode(codeEl.value);
      updateEditorView();
      scheduleLiveCheck();
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

    // Pinta el bloque de AYUDA en la consola: que paso, como arreglarlo y un
    // ejemplo. Convierte el error crudo del worker en una guia para el aprendiz.
    function renderErrorHelp(raw) {
      var help = explainPythonError(raw);
      if (!help) return;
      termLine("", null);
      termLine("💡 Ayuda: " + help.title, "pyterm-help");
      if (help.fix) termLine("   " + help.fix, "pyterm-help");
      if (help.example) {
        String(help.example).split("\n").forEach(function (l, i) {
          termLine("   " + (i === 0 ? "Ejemplo:  " : "          ") + l, "pyterm-help-ex");
        });
      }
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
          var raw = (err && err.message) || String(err);
          termLine("Traceback (entorno seguro del portal):", "pyterm-err");
          termLine("  " + raw, "pyterm-err");
          termLine("[programa terminado - codigo 1]", "pyterm-exit");
          renderErrorHelp(raw);
          statusEl.textContent = "Mira la ayuda de abajo.";
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
    explainPythonError: explainPythonError,
    highlightPythonCode: highlightPythonCode,
    liveStructuralIssues: liveStructuralIssues,
    collectUserVariables: collectUserVariables,
    getCompletions: getCompletions,
    mount: mountPythonOnlineLab,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountPythonOnlineLab);
  } else {
    mountPythonOnlineLab();
  }
  setTimeout(mountPythonOnlineLab, 800);
})();
