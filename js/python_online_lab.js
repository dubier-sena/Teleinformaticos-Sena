// js/python_online_lab.js — Laboratorio interno opcional para practicar Python.
(function () {
  "use strict";

  var portalAuth = window.portalAuth || null;
  var BASE_STORAGE_KEY = "practica_python_online_lab";
  var STORAGE_KEY = portalAuth
    ? portalAuth.getScopedStorageKey(BASE_STORAGE_KEY, { area: "guide-data" })
    : BASE_STORAGE_KEY;
  var WORKER_URL = "js/python_lab_worker.js?v=20260610_1";
  var EXECUTION_TIMEOUT_MS = 1500;

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
        // En ese caso se usa el interprete restringido sin eval(), sin red, sin archivos
        // y con ciclos for/while bloqueados para evitar congelar la pagina.
        try {
          assertSafeSource(String(code || ""));
          resolve(runPythonEducational(code, stdinText));
        } catch (err) {
          reject(err);
        }
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

  function splitTopLevel(value, separator) {
    var parts = [];
    var current = "";
    var quote = "";
    var depth = 0;
    for (var i = 0; i < value.length; i += 1) {
      var ch = value[i];
      var prev = value[i - 1];
      if (quote) {
        current += ch;
        if (ch === quote && prev !== "\\") quote = "";
        continue;
      }
      if (ch === "'" || ch === '"') {
        quote = ch;
        current += ch;
        continue;
      }
      if ("([{".includes(ch)) depth += 1;
      if (")]}".includes(ch)) depth -= 1;
      if (ch === separator && depth === 0) {
        parts.push(current.trim());
        current = "";
        continue;
      }
      current += ch;
    }
    if (current.trim() || value.endsWith(separator)) parts.push(current.trim());
    return parts;
  }

  function pyRepr(value) {
    if (value === null || value === undefined) return "None";
    if (value === true) return "True";
    if (value === false) return "False";
    if (Array.isArray(value)) return "[" + value.map(pyRepr).join(", ") + "]";
    if (typeof value === "object") {
      return "{" + Object.keys(value).map(function (key) {
        return pyRepr(key) + ": " + pyRepr(value[key]);
      }).join(", ") + "}";
    }
    return String(value);
  }

  function createPyHelpers(inputLines, output) {
    var inputIndex = 0;
    return {
      input: function (prompt) {
        var label = String(prompt == null ? "" : prompt);
        var value = "";
        if (inputIndex < inputLines.length && inputLines[inputIndex] !== "") {
          value = inputLines[inputIndex];
        }
        inputIndex += 1;
        output.push(label + value);
        return value;
      },
      int: function (value) {
        var parsed = parseInt(value, 10);
        if (Number.isNaN(parsed)) throw new Error("int() no pudo convertir: " + value);
        return parsed;
      },
      float: function (value) {
        var parsed = parseFloat(value);
        if (Number.isNaN(parsed)) throw new Error("float() no pudo convertir: " + value);
        return parsed;
      },
      str: function (value) { return pyRepr(value); },
      bool: function (value) { return Boolean(value); },
      len: function (value) {
        return value && typeof value.length === "number" ? value.length : Object.keys(value || {}).length;
      },
      round: function (value, digits) {
        var places = digits == null ? 0 : Number(digits);
        var factor = Math.pow(10, places);
        return Math.round(Number(value) * factor) / factor;
      },
      type: function (value) {
        if (Array.isArray(value)) return "<class 'list'>";
        if (value === null || value === undefined) return "<class 'NoneType'>";
        if (typeof value === "number") return Number.isInteger(value) ? "<class 'int'>" : "<class 'float'>";
        if (typeof value === "string") return "<class 'str'>";
        if (typeof value === "boolean") return "<class 'bool'>";
        return "<class 'dict'>";
      },
    };
  }

  function isWrappedExpression(expr) {
    if (!expr.startsWith("(") || !expr.endsWith(")")) return false;
    var depth = 0;
    var quote = "";
    for (var i = 0; i < expr.length; i += 1) {
      var ch = expr[i];
      var prev = expr[i - 1];
      if (quote) {
        if (ch === quote && prev !== "\\") quote = "";
        continue;
      }
      if (ch === "'" || ch === '"') {
        quote = ch;
        continue;
      }
      if (ch === "(") depth += 1;
      if (ch === ")") depth -= 1;
      if (depth === 0 && i < expr.length - 1) return false;
    }
    return depth === 0;
  }

  function unquotePyString(expr) {
    var quote = expr[0];
    var body = expr.slice(1, -1);
    return body
      .replace(new RegExp("\\\\" + quote, "g"), quote)
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\\\/g, "\\");
  }

  function findTopLevelOperator(expr, operators) {
    var quote = "";
    var depth = 0;
    for (var i = expr.length - 1; i >= 0; i -= 1) {
      var ch = expr[i];
      var prev = expr[i - 1];
      if (quote) {
        if (ch === quote && prev !== "\\") quote = "";
        continue;
      }
      if (ch === "'" || ch === '"') {
        quote = ch;
        continue;
      }
      if (")]}".includes(ch)) depth += 1;
      if ("([{".includes(ch)) depth -= 1;
      if (depth !== 0) continue;
      for (var o = 0; o < operators.length; o += 1) {
        var op = operators[o];
        var start = i - op.length + 1;
        if (start < 0) continue;
        if (expr.slice(start, i + 1) !== op) continue;
        if ((op === "+" || op === "-") && start === 0) continue;
        return { index: start, op: op };
      }
    }
    return null;
  }

  function splitLogical(expr, word) {
    var parts = splitTopLevel(expr, " ");
    var groups = [];
    var current = [];
    parts.forEach(function (part) {
      if (part === word) {
        groups.push(current.join(" "));
        current = [];
      } else {
        current.push(part);
      }
    });
    groups.push(current.join(" "));
    return groups.length > 1 ? groups : null;
  }

  function evaluatePyExpr(expr, env, helpers) {
    expr = String(expr || "").trim();
    if (!expr) return "";
    while (isWrappedExpression(expr)) expr = expr.slice(1, -1).trim();

    var orParts = splitLogical(expr, "or");
    if (orParts) return orParts.some(function (part) { return Boolean(evaluatePyExpr(part, env, helpers)); });
    var andParts = splitLogical(expr, "and");
    if (andParts) return andParts.every(function (part) { return Boolean(evaluatePyExpr(part, env, helpers)); });
    if (expr.startsWith("not ")) return !Boolean(evaluatePyExpr(expr.slice(4), env, helpers));

    var compare = findTopLevelOperator(expr, ["==", "!=", ">=", "<=", ">", "<"]);
    if (compare) {
      var left = evaluatePyExpr(expr.slice(0, compare.index), env, helpers);
      var right = evaluatePyExpr(expr.slice(compare.index + compare.op.length), env, helpers);
      if (compare.op === "==") return left === right;
      if (compare.op === "!=") return left !== right;
      if (compare.op === ">=") return left >= right;
      if (compare.op === "<=") return left <= right;
      if (compare.op === ">") return left > right;
      if (compare.op === "<") return left < right;
    }

    var add = findTopLevelOperator(expr, ["+", "-"]);
    if (add) {
      var addLeft = evaluatePyExpr(expr.slice(0, add.index), env, helpers);
      var addRight = evaluatePyExpr(expr.slice(add.index + add.op.length), env, helpers);
      return add.op === "+" ? addLeft + addRight : Number(addLeft) - Number(addRight);
    }
    var mul = findTopLevelOperator(expr, ["*", "/"]);
    if (mul) {
      var mulLeft = Number(evaluatePyExpr(expr.slice(0, mul.index), env, helpers));
      var mulRight = Number(evaluatePyExpr(expr.slice(mul.index + mul.op.length), env, helpers));
      return mul.op === "*" ? mulLeft * mulRight : mulLeft / mulRight;
    }

    if (/^[-+]?\d+(\.\d+)?$/.test(expr)) return Number(expr);
    if (expr === "True") return true;
    if (expr === "False") return false;
    if (expr === "None") return null;
    if ((expr.startsWith('"') && expr.endsWith('"')) || (expr.startsWith("'") && expr.endsWith("'"))) {
      return unquotePyString(expr);
    }
    if (/^[A-Za-z_]\w*$/.test(expr) && Object.prototype.hasOwnProperty.call(env, expr)) return env[expr];

    var callMatch = expr.match(/^([A-Za-z_]\w*)\((.*)\)$/);
    if (callMatch && helpers[callMatch[1]]) {
      var args = callMatch[2].trim() ? splitTopLevel(callMatch[2], ",").map(function (part) {
        return evaluatePyExpr(part, env, helpers);
      }) : [];
      return helpers[callMatch[1]].apply(null, args);
    }

    throw new Error("No se pudo interpretar esta expresion: " + expr);
  }

  function parsePyLines(code) {
    return String(code || "").replace(/\r\n?/g, "\n").split("\n").map(function (raw, index) {
      var indent = (raw.match(/^ */) || [""])[0].length;
      return { raw: raw, text: raw.trim(), indent: indent, line: index + 1 };
    });
  }

  function findBlockEnd(lines, start, parentIndent) {
    var i = start;
    while (i < lines.length) {
      var line = lines[i];
      if (!line.text || line.text.startsWith("#")) {
        i += 1;
        continue;
      }
      if (line.indent <= parentIndent) break;
      i += 1;
    }
    return i;
  }

  function runPythonEducational(code, stdinText) {
    assertSafeSource(String(code || ""));
    var lines = parsePyLines(code);
    var env = {};
    var output = [];
    var inputLines = String(stdinText || "").replace(/\r\n?/g, "\n").split("\n");
    var helpers = createPyHelpers(inputLines, output);

    function execRange(start, end, indent) {
      var i = start;
      while (i < end) {
        var line = lines[i];
        if (!line.text || line.text.startsWith("#")) {
          i += 1;
          continue;
        }
        if (line.indent < indent) return i;
        if (line.indent > indent) throw new Error("Linea " + line.line + ": indentacion inesperada.");

        var ifMatch = line.text.match(/^if\s+(.+):$/);
        if (ifMatch) {
          var handled = false;
          var cursor = i;
          while (cursor < end) {
            var chainLine = lines[cursor];
            var ifPart = chainLine.text.match(/^(if|elif)\s+(.+):$/);
            var elsePart = chainLine.text.match(/^else:$/);
            if (chainLine.indent !== indent || (!ifPart && !elsePart)) break;
            var blockStart = cursor + 1;
            var blockEnd = findBlockEnd(lines, blockStart, indent);
            var shouldRun = elsePart ? !handled : (!handled && Boolean(evaluatePyExpr(ifPart[2], env, helpers)));
            if (shouldRun) {
              execRange(blockStart, blockEnd, indent + 4);
              handled = true;
            }
            cursor = blockEnd;
          }
          i = cursor;
          continue;
        }

        if (/^(elif\s+.+|else):$/.test(line.text)) return i;

        var printMatch = line.text.match(/^print\((.*)\)$/);
        if (printMatch) {
          var values = splitTopLevel(printMatch[1], ",").map(function (part) {
            return pyRepr(evaluatePyExpr(part, env, helpers));
          });
          output.push(values.join(" "));
          i += 1;
          continue;
        }

        var assignMatch = line.text.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/);
        if (assignMatch) {
          env[assignMatch[1]] = evaluatePyExpr(assignMatch[2], env, helpers);
          i += 1;
          continue;
        }

        if (/^(for|while|def|class)\b/.test(line.text)) {
          throw new Error("Linea " + line.line + ": el laboratorio interno aun no ejecuta for, while, def o class. Descarga el .py para trabajarlo en Python instalado, o usa la Opcion B como respaldo.");
        }

        var value = evaluatePyExpr(line.text, env, helpers);
        if (value !== undefined) output.push(pyRepr(value));
        i += 1;
      }
      return i;
    }

    execRange(0, lines.length, 0);
    return output.join("\n") || "(El programa termino sin imprimir resultados.)";
  }

  function validatePythonLabCode(code) {
    var messages = [];
    var text = String(code || "");
    if (!text.trim()) messages.push("Escribe codigo Python antes de validar.");
    if (/\t/.test(text)) messages.push("Usa espacios en lugar de tabulaciones para indentar.");
    if (!/\bprint\s*\(/.test(text)) messages.push("Agrega al menos un print() para ver resultados en consola.");
    if (/^(?:\s*)(for|while|def|class)\b/m.test(text)) {
      messages.push("El laboratorio interno valida el archivo, pero solo ejecuta variables, input(), print() y condicionales. Para POO o ciclos, descarga el .py o usa la Opcion B.");
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
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
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

    function setOutput(text, status) {
      if (consoleLineEl) consoleLineEl.hidden = true;
      outputEl.textContent = text;
      statusEl.textContent = status || "Listo.";
    }

    function runWithConsoleInput(stdinText) {
      setOutput("Ejecutando en entorno seguro...", "Ejecutando.");
      executePythonInWorker(codeEl.value, stdinText)
        .then(function (output) {
          setOutput(output, "Ejecucion finalizada.");
        })
        .catch(function (err) {
          setOutput("Error: " + (err?.message || err), "Revisa el codigo.");
        });
    }

    function askInputsInConsole(prompts) {
      if (!consoleLineEl || !consolePromptEl || !consoleInputEl) return false;
      var values = [];
      var index = 0;
      outputEl.textContent = "";
      statusEl.textContent = "Esperando entradas.";

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
        outputEl.textContent += promptText + value + "\n";
        outputEl.scrollTop = outputEl.scrollHeight;
        index += 1;
        if (index < prompts.length) {
          renderPrompt();
          return;
        }
        consoleLineEl.hidden = true;
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
      var prompts = getInputPrompts(codeEl.value);
      if (prompts.length && askInputsInConsole(prompts)) return;
      runWithConsoleInput("");
    });

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
      setOutput("", "Consola limpia.");
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
