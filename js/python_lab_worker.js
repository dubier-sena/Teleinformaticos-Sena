// js/python_lab_worker.js — Ejecutor aislado para la practica de Python.
// Seguridad: este Worker no tiene acceso al DOM, Firebase, portalAuth ni localStorage.
// Solo recibe texto, lo interpreta con una lista reducida de instrucciones permitidas
// y devuelve texto plano para evitar inyeccion de HTML/JavaScript.
(function () {
  "use strict";

  var MAX_STEPS = 5000;
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
    return String(value);
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

  function createPyHelpers(inputLines, output) {
    var inputIndex = 0;
    return {
      input: function (prompt) {
        var label = String(prompt == null ? "" : prompt);
        var value = inputIndex < inputLines.length ? inputLines[inputIndex] : "";
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
      len: function (value) { return value && typeof value.length === "number" ? value.length : 0; },
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
    if ((expr.startsWith('"') && expr.endsWith('"')) || (expr.startsWith("'") && expr.endsWith("'"))) return unquotePyString(expr);
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
    var inputLines = String(stdinText || "").replace(/\r\n?/g, "\n").split("\n");
    var helpers = createPyHelpers(inputLines, output);

    function tick(line) {
      steps += 1;
      if (steps > MAX_STEPS) throw new Error("El codigo tardo demasiado en ejecutarse. Revisa si tienes un ciclo infinito.");
      if (/^(for|while)\b/.test(line.text)) {
        throw new Error("Linea " + line.line + ": for y while estan restringidos para evitar ciclos infinitos en el portal.");
      }
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

        var printMatch = line.text.match(/^print\((.*)\)$/);
        if (printMatch) {
          output.push(splitTopLevel(printMatch[1], ",").map(function (part) {
            return pyRepr(evaluatePyExpr(part, env, helpers));
          }).join(" "));
          i += 1;
          continue;
        }

        var assignMatch = line.text.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/);
        if (assignMatch) {
          env[assignMatch[1]] = evaluatePyExpr(assignMatch[2], env, helpers);
          i += 1;
          continue;
        }

        if (/^(def|class|with|try|except|finally|lambda)\b/.test(line.text)) {
          throw new Error("Linea " + line.line + ": esta instruccion esta restringida en el entorno seguro.");
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

  self.onmessage = function (event) {
    try {
      self.postMessage({ ok: true, output: runPythonEducational(event.data.code || "", event.data.stdin || "") });
    } catch (err) {
      self.postMessage({ ok: false, error: err && err.message ? err.message : String(err) });
    }
  };
})();
