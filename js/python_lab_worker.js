// js/python_lab_worker.js — Ejecutor aislado para la practica de Python.
// Seguridad: este Worker no tiene acceso al DOM, Firebase, portalAuth ni localStorage.
// Solo recibe texto, lo interpreta con una lista reducida de instrucciones permitidas
// y devuelve texto plano para evitar inyeccion de HTML/JavaScript.
// Soporta: variables, print(), input(), if/elif/else, for/while (con limite de pasos),
// range(), listas, indexacion, break/continue y asignacion aumentada (+=, -=, ...).
// Este archivo tambien se puede cargar como <script> normal (fallback file://):
// expone __PYLAB_RUN__ y solo registra onmessage cuando corre dentro de un Worker.
(function () {
  "use strict";

  var MAX_STEPS = 50000;
  var MAX_OUTPUT_LINES = 1000;
  var MAX_RANGE_ITEMS = 100000;
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

  // Sentinelas para break/continue (se lanzan y se capturan en los ciclos).
  var BREAK_SIGNAL = { __pylab: "break" };
  var CONTINUE_SIGNAL = { __pylab: "continue" };

  function assertSafeSource(code) {
    FORBIDDEN_PATTERNS.forEach(function (item) {
      if (item.re.test(code)) throw new Error(item.msg);
    });
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
    if (Array.isArray(value)) return "[" + value.map(pyReprQuoted).join(", ") + "]";
    return String(value);
  }

  // Dentro de listas, Python muestra las cadenas con comillas.
  function pyReprQuoted(value) {
    if (typeof value === "string") return "'" + value.replace(/'/g, "\\'") + "'";
    return pyRepr(value);
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
    return expr.slice(1, -1)
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
        // * y / sueltos no deben partir ** ni //
        if (op.length === 1 && (op === "*" || op === "/")) {
          if (expr[start - 1] === op || expr[i + 1] === op) continue;
        }
        if (op === "+" || op === "-") {
          if (start === 0) continue;
          // signo unario: "5 * -2", "(-3", "x = -1", "2 < -1", "1, -2"
          var before = expr.slice(0, start).trim();
          if (!before || /[+\-*/%(<>=,[]$/.test(before)) continue;
        }
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

  function createPyHelpers(inputLines, pushOut) {
    var inputIndex = 0;
    return {
      input: function (prompt) {
        var label = String(prompt == null ? "" : prompt);
        var value = inputIndex < inputLines.length ? inputLines[inputIndex] : "";
        inputIndex += 1;
        pushOut(label + value);
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
      len: function (value) { return value && typeof value.length === "number" ? value.length : 0; },
      abs: function (value) { return Math.abs(Number(value)); },
      max: function () {
        var args = Array.prototype.slice.call(arguments);
        var items = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
        if (!items.length) throw new Error("max() necesita al menos un valor.");
        return items.reduce(function (a, b) { return b > a ? b : a; });
      },
      min: function () {
        var args = Array.prototype.slice.call(arguments);
        var items = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
        if (!items.length) throw new Error("min() necesita al menos un valor.");
        return items.reduce(function (a, b) { return b < a ? b : a; });
      },
      sum: function (value) {
        if (!Array.isArray(value)) throw new Error("sum() espera una lista.");
        return value.reduce(function (a, b) { return Number(a) + Number(b); }, 0);
      },
      range: function (a, b, c) {
        var start = b === undefined ? 0 : Math.trunc(Number(a));
        var stop = b === undefined ? Math.trunc(Number(a)) : Math.trunc(Number(b));
        var step = c === undefined ? 1 : Math.trunc(Number(c));
        if (!step) throw new Error("range() no acepta paso 0.");
        var items = [];
        if (step > 0) {
          for (var i = start; i < stop; i += step) {
            items.push(i);
            if (items.length > MAX_RANGE_ITEMS) throw new Error("range() demasiado grande para el entorno seguro.");
          }
        } else {
          for (var j = start; j > stop; j += step) {
            items.push(j);
            if (items.length > MAX_RANGE_ITEMS) throw new Error("range() demasiado grande para el entorno seguro.");
          }
        }
        return items;
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

  function evaluatePyExpr(expr, env, helpers) {
    expr = String(expr || "").trim();
    if (!expr) return "";
    while (isWrappedExpression(expr)) expr = expr.slice(1, -1).trim();

    var orParts = splitLogical(expr, "or");
    if (orParts) return orParts.some(function (part) { return Boolean(evaluatePyExpr(part, env, helpers)); });
    var andParts = splitLogical(expr, "and");
    if (andParts) return andParts.every(function (part) { return Boolean(evaluatePyExpr(part, env, helpers)); });
    if (expr.startsWith("not ")) return !Boolean(evaluatePyExpr(expr.slice(4), env, helpers));

    // pertenencia: "x in lista" / "x not in lista"
    var notInParts = splitLogical(expr, "not in");
    var inParts = notInParts || splitLogical(expr, "in");
    if (inParts && inParts.length === 2 && inParts[0] && inParts[1]) {
      var needle = evaluatePyExpr(inParts[0], env, helpers);
      var haystack = evaluatePyExpr(inParts[1], env, helpers);
      var contains = Array.isArray(haystack)
        ? haystack.indexOf(needle) !== -1
        : String(haystack).includes(String(needle));
      return notInParts ? !contains : contains;
    }

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
      if (add.op === "+") {
        if (Array.isArray(addLeft) && Array.isArray(addRight)) return addLeft.concat(addRight);
        if (typeof addLeft === "string" || typeof addRight === "string") {
          if (typeof addLeft !== typeof addRight) {
            throw new Error('No puedes sumar texto con numeros. Usa str(): "texto " + str(numero)');
          }
          return addLeft + addRight;
        }
        return Number(addLeft) + Number(addRight);
      }
      return Number(addLeft) - Number(addRight);
    }
    var mul = findTopLevelOperator(expr, ["//", "%", "*", "/"]);
    if (mul) {
      var mulLeftRaw = evaluatePyExpr(expr.slice(0, mul.index), env, helpers);
      var mulRightRaw = evaluatePyExpr(expr.slice(mul.index + mul.op.length), env, helpers);
      // "ab" * 3 repite texto, como en Python
      if (mul.op === "*" && typeof mulLeftRaw === "string" && Number.isInteger(Number(mulRightRaw))) {
        return mulLeftRaw.repeat(Math.max(0, Number(mulRightRaw)));
      }
      var mulLeft = Number(mulLeftRaw);
      var mulRight = Number(mulRightRaw);
      if (mul.op === "*") return mulLeft * mulRight;
      if ((mul.op === "/" || mul.op === "//" || mul.op === "%") && mulRight === 0) {
        throw new Error("ZeroDivisionError: division entre cero.");
      }
      if (mul.op === "/") return mulLeft / mulRight;
      if (mul.op === "//") return Math.floor(mulLeft / mulRight);
      return ((mulLeft % mulRight) + mulRight) % mulRight; // modulo estilo Python
    }
    var pow = findTopLevelOperator(expr, ["**"]);
    if (pow) {
      var base = Number(evaluatePyExpr(expr.slice(0, pow.index), env, helpers));
      var exp = Number(evaluatePyExpr(expr.slice(pow.index + 2), env, helpers));
      return Math.pow(base, exp);
    }

    if (/^[-+]?\d+(\.\d+)?$/.test(expr)) return Number(expr);
    if (expr === "True") return true;
    if (expr === "False") return false;
    if (expr === "None") return null;
    if ((expr.startsWith('"') && expr.endsWith('"')) || (expr.startsWith("'") && expr.endsWith("'"))) return unquotePyString(expr);

    // literal de lista: [1, 2, 3]
    if (expr.startsWith("[") && expr.endsWith("]")) {
      var inner = expr.slice(1, -1).trim();
      if (!inner) return [];
      return splitTopLevel(inner, ",").map(function (part) {
        return evaluatePyExpr(part, env, helpers);
      });
    }

    if (/^[A-Za-z_]\w*$/.test(expr) && Object.prototype.hasOwnProperty.call(env, expr)) return env[expr];

    // indexacion: lista[i] o cadena[i] (acepta indices negativos como Python)
    var indexMatch = expr.match(/^([A-Za-z_]\w*)\[(.+)\]$/);
    if (indexMatch && Object.prototype.hasOwnProperty.call(env, indexMatch[1])) {
      var container = env[indexMatch[1]];
      var rawIndex = evaluatePyExpr(indexMatch[2], env, helpers);
      var idx = Math.trunc(Number(rawIndex));
      if (Number.isNaN(idx)) throw new Error("El indice debe ser un numero entero: " + indexMatch[2]);
      var size = container && typeof container.length === "number" ? container.length : 0;
      if (idx < 0) idx += size;
      if (idx < 0 || idx >= size) throw new Error("IndexError: indice " + pyRepr(rawIndex) + " fuera de rango.");
      return Array.isArray(container) ? container[idx] : String(container)[idx];
    }

    var callMatch = expr.match(/^([A-Za-z_]\w*)\((.*)\)$/);
    if (callMatch && helpers[callMatch[1]]) {
      var args = callMatch[2].trim() ? splitTopLevel(callMatch[2], ",").map(function (part) {
        return evaluatePyExpr(part, env, helpers);
      }) : [];
      return helpers[callMatch[1]].apply(null, args);
    }
    if (/^[A-Za-z_]\w*$/.test(expr)) {
      throw new Error("NameError: la variable '" + expr + "' no esta definida.");
    }
    throw new Error("No se pudo interpretar esta expresion: " + expr);
  }

  function parsePyLines(code) {
    return String(code || "").replace(/\r\n?/g, "\n").split("\n").map(function (raw, index) {
      var indent = (raw.match(/^ */) || [""])[0].length;
      return { text: raw.trim(), indent: indent, line: index + 1 };
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
    assertSafeSource(code);
    var steps = 0;
    var lines = parsePyLines(code);
    var env = {};
    var output = [];
    var truncated = false;
    var inputLines = String(stdinText || "").replace(/\r\n?/g, "\n").split("\n");

    function pushOut(text) {
      if (output.length >= MAX_OUTPUT_LINES) {
        if (!truncated) {
          truncated = true;
          output.push("... (salida truncada: el programa imprimio mas de " + MAX_OUTPUT_LINES + " lineas)");
        }
        return;
      }
      output.push(text);
    }

    var helpers = createPyHelpers(inputLines, pushOut);

    function tick(line) {
      steps += 1;
      if (steps > MAX_STEPS) {
        throw new Error(
          "El codigo supero el limite de " + MAX_STEPS + " pasos" +
          (line ? " (cerca de la linea " + line.line + ")" : "") +
          ". Revisa si tienes un ciclo infinito."
        );
      }
    }

    function getIterable(value, line) {
      if (Array.isArray(value)) return value;
      if (typeof value === "string") return value.split("");
      throw new Error("Linea " + line.line + ": solo puedes recorrer listas, cadenas o range().");
    }

    function execRange(start, end, indent) {
      var i = start;
      while (i < end) {
        var line = lines[i];
        if (!line.text || line.text.startsWith("#")) {
          i += 1;
          continue;
        }
        tick(line);
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

        var forMatch = line.text.match(/^for\s+([A-Za-z_]\w*)\s+in\s+(.+):$/);
        if (forMatch) {
          var forBodyStart = i + 1;
          var forBodyEnd = findBlockEnd(lines, forBodyStart, indent);
          if (forBodyStart >= forBodyEnd) throw new Error("Linea " + line.line + ": el for necesita un bloque indentado.");
          var items = getIterable(evaluatePyExpr(forMatch[2], env, helpers), line);
          for (var itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
            tick(line);
            env[forMatch[1]] = items[itemIndex];
            try {
              execRange(forBodyStart, forBodyEnd, indent + 4);
            } catch (signal) {
              if (signal === BREAK_SIGNAL) { itemIndex = items.length; }
              else if (signal !== CONTINUE_SIGNAL) throw signal;
            }
          }
          i = forBodyEnd;
          continue;
        }

        var whileMatch = line.text.match(/^while\s+(.+):$/);
        if (whileMatch) {
          var whileBodyStart = i + 1;
          var whileBodyEnd = findBlockEnd(lines, whileBodyStart, indent);
          if (whileBodyStart >= whileBodyEnd) throw new Error("Linea " + line.line + ": el while necesita un bloque indentado.");
          while (Boolean(evaluatePyExpr(whileMatch[1], env, helpers))) {
            tick(line);
            try {
              execRange(whileBodyStart, whileBodyEnd, indent + 4);
            } catch (signal) {
              if (signal === BREAK_SIGNAL) break;
              if (signal !== CONTINUE_SIGNAL) throw signal;
            }
          }
          i = whileBodyEnd;
          continue;
        }

        if (line.text === "break") throw BREAK_SIGNAL;
        if (line.text === "continue") throw CONTINUE_SIGNAL;
        if (line.text === "pass") {
          i += 1;
          continue;
        }

        var printMatch = line.text.match(/^print\((.*)\)$/);
        if (printMatch) {
          pushOut(splitTopLevel(printMatch[1], ",").map(function (part) {
            return pyRepr(evaluatePyExpr(part, env, helpers));
          }).join(" "));
          i += 1;
          continue;
        }

        // lista.append(valor) — unico metodo soportado
        var appendMatch = line.text.match(/^([A-Za-z_]\w*)\.append\((.+)\)$/);
        if (appendMatch) {
          var target = env[appendMatch[1]];
          if (!Array.isArray(target)) throw new Error("Linea " + line.line + ": .append() solo funciona sobre listas.");
          if (target.length >= MAX_RANGE_ITEMS) throw new Error("Linea " + line.line + ": la lista supero el tamano maximo del entorno seguro.");
          target.push(evaluatePyExpr(appendMatch[2], env, helpers));
          i += 1;
          continue;
        }

        // asignacion aumentada: x += 1, x -= 2, x *= 3, x /= 2, x //= 2, x %= 2
        var augMatch = line.text.match(/^([A-Za-z_]\w*)\s*(\+=|-=|\*=|\/\/=|\/=|%=)\s*(.+)$/);
        if (augMatch) {
          if (!Object.prototype.hasOwnProperty.call(env, augMatch[1])) {
            throw new Error("Linea " + line.line + ": la variable '" + augMatch[1] + "' no esta definida.");
          }
          var op = augMatch[2].slice(0, -1);
          env[augMatch[1]] = evaluatePyExpr(
            "(" + augMatch[1] + ") " + op + " (" + augMatch[3] + ")",
            env,
            helpers
          );
          i += 1;
          continue;
        }

        var assignMatch = line.text.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/);
        if (assignMatch && !/^=/.test(assignMatch[2])) {
          env[assignMatch[1]] = evaluatePyExpr(assignMatch[2], env, helpers);
          i += 1;
          continue;
        }

        // asignacion por indice: lista[i] = valor
        var indexAssign = line.text.match(/^([A-Za-z_]\w*)\[(.+)\]\s*=\s*(.+)$/);
        if (indexAssign) {
          var listTarget = env[indexAssign[1]];
          if (!Array.isArray(listTarget)) throw new Error("Linea " + line.line + ": solo puedes asignar por indice en listas.");
          var assignIdx = Math.trunc(Number(evaluatePyExpr(indexAssign[2], env, helpers)));
          if (assignIdx < 0) assignIdx += listTarget.length;
          if (assignIdx < 0 || assignIdx >= listTarget.length) throw new Error("Linea " + line.line + ": IndexError, indice fuera de rango.");
          listTarget[assignIdx] = evaluatePyExpr(indexAssign[3], env, helpers);
          i += 1;
          continue;
        }

        if (/^(def|class|with|try|except|finally|lambda|import|from)\b/.test(line.text)) {
          throw new Error("Linea " + line.line + ": def, class, import y try aun no estan disponibles en el laboratorio. Descarga el .py para trabajarlos en Python instalado.");
        }

        var value = evaluatePyExpr(line.text, env, helpers);
        if (value !== undefined) pushOut(pyRepr(value));
        i += 1;
      }
      return i;
    }

    try {
      execRange(0, lines.length, 0);
    } catch (signal) {
      if (signal === BREAK_SIGNAL || signal === CONTINUE_SIGNAL) {
        throw new Error("break y continue solo pueden usarse dentro de un ciclo for o while.");
      }
      throw signal;
    }
    return output.join("\n") || "(El programa termino sin imprimir resultados.)";
  }

  // Exposicion dual: como Worker responde mensajes; cargado como <script>
  // (fallback file:// del laboratorio) solo expone la funcion de ejecucion.
  self.__PYLAB_RUN__ = runPythonEducational;
  if (typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope) {
    self.onmessage = function (event) {
      try {
        self.postMessage({ ok: true, output: runPythonEducational(event.data.code || "", event.data.stdin || "") });
      } catch (err) {
        self.postMessage({ ok: false, error: err && err.message ? err.message : String(err) });
      }
    };
  }
})();
