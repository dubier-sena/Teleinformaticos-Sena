// js/python_lab_worker.js — Ejecutor aislado para la practica de Python.
// Seguridad: este Worker no tiene acceso al DOM, Firebase, portalAuth ni localStorage.
// Solo recibe texto, lo interpreta con una lista reducida de instrucciones permitidas
// y devuelve texto plano para evitar inyeccion de HTML/JavaScript.
// Soporta: variables, print(), input(), if/elif/else, for/while (con limite de pasos),
// range(), listas, diccionarios, tuplas, conjuntos, match-case, funciones (def/return),
// clases (class/__init__/self/metodos), is/is not, indexacion, break/continue y
// asignacion aumentada (+=, -=, ...). Sigue bloqueado: import, try/except, with, lambda.
// Este archivo tambien se puede cargar como <script> normal (fallback file://):
// expone __PYLAB_RUN__ y solo registra onmessage cuando corre dentro de un Worker.
(function () {
  "use strict";

  var MAX_STEPS = 50000;
  var MAX_OUTPUT_LINES = 1000;
  var MAX_RANGE_ITEMS = 100000;
  var MAX_CALL_DEPTH = 60;
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

  // Busca el cierre que corresponde al parentesis/corchete/llave en openIndex.
  function findMatchingBracket(expr, openIndex) {
    var open = expr[openIndex];
    var close = open === "(" ? ")" : open === "[" ? "]" : "}";
    var depth = 0;
    var quote = "";
    for (var i = openIndex; i < expr.length; i += 1) {
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
      if (ch === open) depth += 1;
      else if (ch === close) {
        depth -= 1;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  function isBalanced(expr) {
    var quote = "";
    var depth = 0;
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
      if ("([{".includes(ch)) depth += 1;
      if (")]}".includes(ch)) depth -= 1;
    }
    return depth === 0 && !quote;
  }

  // None interno: null o undefined se tratan igual (ambos son None de Python).
  function isNone(value) {
    return value === null || value === undefined;
  }

  function makeTuple(items) {
    return { __pyTuple: true, items: items };
  }

  function makeSet(items) {
    var unique = [];
    items.forEach(function (item) {
      if (!unique.some(function (u) { return pyEquals(u, item); })) unique.push(item);
    });
    return { __pySet: true, items: unique };
  }

  function makeDict() {
    return { __pyDict: true, map: new Map() };
  }

  // Verdad al estilo Python: None, 0, "" y las colecciones vacias son falsas.
  function pyTruthy(value) {
    if (isNone(value)) return false;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0 && !Number.isNaN(value);
    if (typeof value === "string") return value.length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (value.__pyTuple || value.__pySet) return value.items.length > 0;
    if (value.__pyDict) return value.map.size > 0;
    return true;
  }

  // Igualdad al estilo Python: listas y tuplas se comparan por contenido.
  function pyEquals(a, b) {
    if (a === b) return true;
    if (isNone(a) && isNone(b)) return true;
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (var i = 0; i < a.length; i += 1) {
        if (!pyEquals(a[i], b[i])) return false;
      }
      return true;
    }
    if (a && b && a.__pyTuple && b.__pyTuple) return pyEquals(a.items, b.items);
    return false;
  }

  function pyRepr(value) {
    if (isNone(value)) return "None";
    if (value === true) return "True";
    if (value === false) return "False";
    if (Array.isArray(value)) return "[" + value.map(pyReprQuoted).join(", ") + "]";
    if (typeof value === "object") {
      if (value.__pyTuple) {
        if (value.items.length === 1) return "(" + pyReprQuoted(value.items[0]) + ",)";
        return "(" + value.items.map(pyReprQuoted).join(", ") + ")";
      }
      if (value.__pySet) {
        if (!value.items.length) return "set()";
        return "{" + value.items.map(pyReprQuoted).join(", ") + "}";
      }
      if (value.__pyDict) {
        var pairs = [];
        value.map.forEach(function (v, k) { pairs.push(pyReprQuoted(k) + ": " + pyReprQuoted(v)); });
        return "{" + pairs.join(", ") + "}";
      }
      if (value.__pyInstance) return "<objeto " + value.cls.name + ">";
      if (value.__pyClass) return "<class '" + value.name + "'>";
      if (value.__pyFunc) return "<funcion " + value.name + ">";
      if (value.__pyBound) return "<metodo " + value.func.name + ">";
    }
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
          // signo unario: "5 * -2", "(-3", "x = -1", "2 < -1", "1, -2", "{"a": -1"
          var before = expr.slice(0, start).trim();
          if (!before || /[+\-*/%(<>=,:[{]$/.test(before)) continue;
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

  function nameError(name) {
    return new Error("NameError: la variable '" + name + "' no esta definida.");
  }

  function typeNameOf(value) {
    if (isNone(value)) return "None";
    if (Array.isArray(value)) return "list";
    if (typeof value === "object") {
      if (value.__pyTuple) return "tuple";
      if (value.__pySet) return "set";
      if (value.__pyDict) return "dict";
      if (value.__pyInstance) return value.cls.name;
      if (value.__pyClass) return "type";
      if (value.__pyFunc || value.__pyBound) return "function";
    }
    if (typeof value === "number") return Number.isInteger(value) ? "int" : "float";
    if (typeof value === "string") return "str";
    if (typeof value === "boolean") return "bool";
    return "dict";
  }

  function createPyHelpers(inputLines, pushOut) {
    var inputIndex = 0;
    function toItems(value, fnName) {
      if (Array.isArray(value)) return value.slice();
      if (typeof value === "string") return value.split("");
      if (value && (value.__pyTuple || value.__pySet)) return value.items.slice();
      if (value && value.__pyDict) return Array.from(value.map.keys());
      throw new Error(fnName + "() espera una lista, tupla, conjunto, texto o diccionario.");
    }
    return {
      print: function () {
        pushOut(Array.prototype.slice.call(arguments).map(pyRepr).join(" "));
        return undefined;
      },
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
      bool: function (value) { return pyTruthy(value); },
      len: function (value) {
        if (typeof value === "string" || Array.isArray(value)) return value.length;
        if (value && (value.__pyTuple || value.__pySet)) return value.items.length;
        if (value && value.__pyDict) return value.map.size;
        throw new Error("len() espera texto, lista, tupla, conjunto o diccionario.");
      },
      abs: function (value) { return Math.abs(Number(value)); },
      max: function () {
        var args = Array.prototype.slice.call(arguments);
        var items = args.length === 1 && typeof args[0] !== "number" ? toItems(args[0], "max") : args;
        if (!items.length) throw new Error("max() necesita al menos un valor.");
        return items.reduce(function (a, b) { return b > a ? b : a; });
      },
      min: function () {
        var args = Array.prototype.slice.call(arguments);
        var items = args.length === 1 && typeof args[0] !== "number" ? toItems(args[0], "min") : args;
        if (!items.length) throw new Error("min() necesita al menos un valor.");
        return items.reduce(function (a, b) { return b < a ? b : a; });
      },
      sum: function (value) {
        var items = toItems(value, "sum");
        return items.reduce(function (a, b) { return Number(a) + Number(b); }, 0);
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
        return "<class '" + typeNameOf(value) + "'>";
      },
      list: function (value) {
        if (value === undefined) return [];
        return toItems(value, "list");
      },
      tuple: function (value) {
        if (value === undefined) return makeTuple([]);
        return makeTuple(toItems(value, "tuple"));
      },
      set: function (value) {
        if (value === undefined) return makeSet([]);
        return makeSet(toItems(value, "set"));
      },
      dict: function (value) {
        if (value === undefined) return makeDict();
        if (value && value.__pyDict) {
          var copy = makeDict();
          value.map.forEach(function (v, k) { copy.map.set(k, v); });
          return copy;
        }
        throw new Error("dict() del laboratorio solo acepta otro diccionario o nada.");
      },
      sorted: function (value) {
        var items = toItems(value, "sorted");
        var allNumbers = items.every(function (it) { return typeof it === "number"; });
        var allStrings = items.every(function (it) { return typeof it === "string"; });
        if (!allNumbers && !allStrings) throw new Error("sorted() necesita elementos del mismo tipo (todos numeros o todos textos).");
        return items.slice().sort(function (a, b) {
          if (allNumbers) return a - b;
          return a < b ? -1 : a > b ? 1 : 0;
        });
      },
    };
  }

  // Acceso a un atributo con punto: instancia.atributo (o metodo sin llamar).
  function resolveAttr(owner, attrName) {
    if (owner && owner.__pyInstance) {
      if (attrName in owner.attrs) return owner.attrs[attrName];
      if (owner.cls.methods[attrName]) return { __pyBound: true, func: owner.cls.methods[attrName], self: owner };
      throw new Error("AttributeError: el objeto '" + owner.cls.name + "' no tiene el atributo '" + attrName + "'. Revisa que __init__ lo cree con self." + attrName + " = ...");
    }
    throw new Error("Para usar el punto (.) necesitas un objeto de una clase; aqui el valor es de tipo " + typeNameOf(owner) + ".");
  }

  // Llamada de metodo: instancia.metodo(...), lista.append(...), "texto".upper()...
  function callMethod(owner, name, callArgs, ctx) {
    var args = callArgs.args;
    if (owner && owner.__pyInstance) {
      var method = owner.cls.methods[name];
      if (method) return ctx.callUser(method, [owner].concat(args), callArgs.kwargs);
      if (name in owner.attrs) return ctx.callUser(owner.attrs[name], args, callArgs.kwargs);
      throw new Error("AttributeError: la clase '" + owner.cls.name + "' no tiene el metodo '" + name + "'.");
    }
    if (Array.isArray(owner)) {
      if (name === "append") {
        if (args.length !== 1) throw new Error(".append() recibe exactamente un valor.");
        if (owner.length >= MAX_RANGE_ITEMS) throw new Error("La lista supero el tamano maximo del entorno seguro.");
        owner.push(args[0]);
        return undefined;
      }
      throw new Error("El laboratorio solo soporta .append() en listas.");
    }
    if (owner && owner.__pySet) {
      if (name === "add") {
        if (args.length !== 1) throw new Error(".add() recibe exactamente un valor.");
        if (!owner.items.some(function (it) { return pyEquals(it, args[0]); })) owner.items.push(args[0]);
        return undefined;
      }
      throw new Error("El laboratorio solo soporta .add() en conjuntos.");
    }
    if (typeof owner === "string") {
      if (name === "upper") return owner.toUpperCase();
      if (name === "lower") return owner.toLowerCase();
      if (name === "strip") return owner.trim();
      throw new Error("El laboratorio solo soporta .upper(), .lower() y .strip() en textos.");
    }
    throw new Error("No se puede llamar el metodo ." + name + "() sobre un valor de tipo " + typeNameOf(owner) + ".");
  }

  // Indexacion: lista[i], texto[i], tupla[i], diccionario[llave].
  function indexValue(container, rawIndex) {
    if (container && container.__pyDict) {
      if (!container.map.has(rawIndex)) throw new Error("KeyError: la llave " + pyRepr(rawIndex) + " no existe en el diccionario.");
      return container.map.get(rawIndex);
    }
    var items = null;
    if (Array.isArray(container)) items = container;
    else if (typeof container === "string") items = container;
    else if (container && container.__pyTuple) items = container.items;
    else throw new Error("Solo puedes indexar listas, textos, tuplas o diccionarios (aqui hay " + typeNameOf(container) + ").");
    var idx = Math.trunc(Number(rawIndex));
    if (Number.isNaN(idx)) throw new Error("El indice debe ser un numero entero: " + pyRepr(rawIndex));
    var size = items.length;
    if (idx < 0) idx += size;
    if (idx < 0 || idx >= size) throw new Error("IndexError: indice " + pyRepr(rawIndex) + " fuera de rango.");
    return items[idx];
  }

  // Evalua argumentos de una llamada: posicionales y con nombre (nota=4.5).
  function parseCallArgs(argsSrc, env, ctx) {
    var result = { args: [], kwargs: null };
    if (!argsSrc.trim()) return result;
    splitTopLevel(argsSrc, ",").forEach(function (part) {
      if (!part) return;
      var kw = part.match(/^([A-Za-z_]\w*)\s*=(?!=)([\s\S]+)$/);
      if (kw) {
        if (!result.kwargs) result.kwargs = Object.create(null);
        result.kwargs[kw[1]] = evaluatePyExpr(kw[2], env, ctx);
      } else {
        if (result.kwargs) throw new Error("Los argumentos con nombre (nombre=valor) van al final de la llamada.");
        result.args.push(evaluatePyExpr(part, env, ctx));
      }
    });
    return result;
  }

  // Evalua cadenas con punto/parentesis/corchetes: obj.attr, obj.metodo(...),
  // Clase(...), funcion(...), lista[i], d["llave"], self.lista.append(x)...
  function tryEvalPostfix(expr, env, ctx) {
    var name = null;
    var pos = 0;
    var current;
    var haveValue = false;
    var pending = null; // atributo pendiente de resolver (puede ser metodo)
    var m = expr.match(/^([A-Za-z_]\w*)/);
    if (m) {
      name = m[1];
      pos = name.length;
      if (name in env) {
        current = env[name];
        haveValue = true;
      }
    } else if (expr[0] === '"' || expr[0] === "'") {
      // literal de texto como base: "hola".upper()
      var strEnd = -1;
      for (var s = 1; s < expr.length; s += 1) {
        if (expr[s] === expr[0] && expr[s - 1] !== "\\") { strEnd = s; break; }
      }
      if (strEnd < 0 || strEnd === expr.length - 1) return { ok: false };
      current = unquotePyString(expr.slice(0, strEnd + 1));
      haveValue = true;
      pos = strEnd + 1;
    } else {
      return { ok: false };
    }
    while (pos < expr.length) {
      var ch = expr[pos];
      if (ch === ".") {
        var am = expr.slice(pos).match(/^\.([A-Za-z_]\w*)/);
        if (!am) return { ok: false };
        if (!haveValue) throw nameError(name);
        if (pending) current = resolveAttr(current, pending);
        pending = am[1];
        pos += am[0].length;
        continue;
      }
      if (ch === "(") {
        var closeParen = findMatchingBracket(expr, pos);
        if (closeParen < 0) return { ok: false };
        var callArgs = parseCallArgs(expr.slice(pos + 1, closeParen), env, ctx);
        if (pending) {
          current = callMethod(current, pending, callArgs, ctx);
          pending = null;
        } else if (haveValue) {
          current = ctx.callUser(current, callArgs.args, callArgs.kwargs);
        } else if (ctx.helpers[name]) {
          if (callArgs.kwargs) throw new Error(name + "() del laboratorio no acepta argumentos con nombre.");
          current = ctx.helpers[name].apply(null, callArgs.args);
          haveValue = true;
        } else {
          throw nameError(name);
        }
        pos = closeParen + 1;
        continue;
      }
      if (ch === "[") {
        var closeBracket = findMatchingBracket(expr, pos);
        if (closeBracket < 0) return { ok: false };
        if (!haveValue) throw nameError(name);
        if (pending) {
          current = resolveAttr(current, pending);
          pending = null;
        }
        current = indexValue(current, evaluatePyExpr(expr.slice(pos + 1, closeBracket), env, ctx));
        pos = closeBracket + 1;
        continue;
      }
      return { ok: false };
    }
    if (!haveValue) throw nameError(name);
    if (pending) current = resolveAttr(current, pending);
    return { ok: true, value: current };
  }

  function evaluatePyExpr(expr, env, ctx) {
    expr = String(expr || "").trim();
    if (!expr) return "";
    while (isWrappedExpression(expr)) expr = expr.slice(1, -1).trim();

    // tupla: coma al nivel superior ("a", "b") o 1, 2, 3
    var commaParts = splitTopLevel(expr, ",");
    if (commaParts.length > 1) {
      if (commaParts[commaParts.length - 1] === "") commaParts.pop(); // coma final: (x,)
      return makeTuple(commaParts.map(function (part) { return evaluatePyExpr(part, env, ctx); }));
    }

    var orParts = splitLogical(expr, "or");
    if (orParts) return orParts.some(function (part) { return pyTruthy(evaluatePyExpr(part, env, ctx)); });
    var andParts = splitLogical(expr, "and");
    if (andParts) return andParts.every(function (part) { return pyTruthy(evaluatePyExpr(part, env, ctx)); });
    if (expr.startsWith("not ")) return !pyTruthy(evaluatePyExpr(expr.slice(4), env, ctx));

    // pertenencia: "x in coleccion" / "x not in coleccion"
    var inParts = splitLogical(expr, "in");
    if (inParts && inParts.length === 2 && inParts[0] && inParts[1]) {
      var leftIn = inParts[0].trim();
      var negIn = false;
      var notMatch = leftIn.match(/^(.*\S)\s+not$/);
      if (notMatch) {
        negIn = true;
        leftIn = notMatch[1];
      }
      var needle = evaluatePyExpr(leftIn, env, ctx);
      var haystack = evaluatePyExpr(inParts[1], env, ctx);
      var contains;
      if (Array.isArray(haystack)) contains = haystack.some(function (it) { return pyEquals(it, needle); });
      else if (haystack && (haystack.__pySet || haystack.__pyTuple)) contains = haystack.items.some(function (it) { return pyEquals(it, needle); });
      else if (haystack && haystack.__pyDict) contains = haystack.map.has(needle);
      else contains = String(haystack).includes(String(needle));
      return negIn ? !contains : contains;
    }

    // identidad: "x is None" / "x is not None"
    var isParts = splitLogical(expr, "is");
    if (isParts && isParts.length === 2 && isParts[0] && isParts[1]) {
      var rightIs = isParts[1].trim();
      var negIs = false;
      if (/^not\s/.test(rightIs)) {
        negIs = true;
        rightIs = rightIs.replace(/^not\s+/, "");
      }
      var leftVal = evaluatePyExpr(isParts[0], env, ctx);
      var rightVal = evaluatePyExpr(rightIs, env, ctx);
      var same = isNone(leftVal) && isNone(rightVal) ? true : leftVal === rightVal;
      return negIs ? !same : same;
    }

    var compare = findTopLevelOperator(expr, ["==", "!=", ">=", "<=", ">", "<"]);
    if (compare) {
      var left = evaluatePyExpr(expr.slice(0, compare.index), env, ctx);
      var right = evaluatePyExpr(expr.slice(compare.index + compare.op.length), env, ctx);
      if (compare.op === "==") return pyEquals(left, right);
      if (compare.op === "!=") return !pyEquals(left, right);
      if (isNone(left) || isNone(right)) {
        throw new Error("No puedes comparar None con < > <= >=. Compara primero con 'is None'.");
      }
      if (compare.op === ">=") return left >= right;
      if (compare.op === "<=") return left <= right;
      if (compare.op === ">") return left > right;
      if (compare.op === "<") return left < right;
    }

    var add = findTopLevelOperator(expr, ["+", "-"]);
    if (add) {
      var addLeft = evaluatePyExpr(expr.slice(0, add.index), env, ctx);
      var addRight = evaluatePyExpr(expr.slice(add.index + add.op.length), env, ctx);
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
      var mulLeftRaw = evaluatePyExpr(expr.slice(0, mul.index), env, ctx);
      var mulRightRaw = evaluatePyExpr(expr.slice(mul.index + mul.op.length), env, ctx);
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
      var base = Number(evaluatePyExpr(expr.slice(0, pow.index), env, ctx));
      var exp = Number(evaluatePyExpr(expr.slice(pow.index + 2), env, ctx));
      return Math.pow(base, exp);
    }

    if (/^[-+]?\d+(\.\d+)?$/.test(expr)) return Number(expr);
    if (expr === "True") return true;
    if (expr === "False") return false;
    if (expr === "None") return null;
    if (/^f["']/.test(expr)) {
      throw new Error('Los f-strings (f"...") aun no estan disponibles en el laboratorio. Usa print con comas o el operador +.');
    }
    if ((expr.startsWith('"') && expr.endsWith('"')) || (expr.startsWith("'") && expr.endsWith("'"))) return unquotePyString(expr);

    // literal de lista: [1, 2, 3]
    if (expr.startsWith("[") && expr.endsWith("]") && findMatchingBracket(expr, 0) === expr.length - 1) {
      var inner = expr.slice(1, -1).trim();
      if (!inner) return [];
      return splitTopLevel(inner, ",").map(function (part) {
        return evaluatePyExpr(part, env, ctx);
      });
    }

    // literal de diccionario {llave: valor} o de conjunto {a, b}
    if (expr.startsWith("{") && expr.endsWith("}") && findMatchingBracket(expr, 0) === expr.length - 1) {
      var dictInner = expr.slice(1, -1).trim();
      if (!dictInner) return makeDict();
      var entries = splitTopLevel(dictInner, ",").filter(function (part) { return part !== ""; });
      var firstColon = splitTopLevel(entries[0], ":");
      if (firstColon.length > 1) {
        var dict = makeDict();
        entries.forEach(function (entry) {
          var kv = splitTopLevel(entry, ":");
          if (kv.length !== 2) throw new Error("Entrada de diccionario no valida: " + entry + " (usa llave: valor).");
          dict.map.set(evaluatePyExpr(kv[0], env, ctx), evaluatePyExpr(kv[1], env, ctx));
        });
        return dict;
      }
      return makeSet(entries.map(function (part) { return evaluatePyExpr(part, env, ctx); }));
    }

    var postfix = tryEvalPostfix(expr, env, ctx);
    if (postfix.ok) return postfix.value;
    throw new Error("No se pudo interpretar esta expresion: " + expr);
  }

  // Quita un comentario al final de la linea (x = 5  # nota), respetando comillas.
  function stripInlineComment(text) {
    var quote = "";
    for (var i = 0; i < text.length; i += 1) {
      var ch = text[i];
      var prev = text[i - 1];
      if (quote) {
        if (ch === quote && prev !== "\\") quote = "";
        continue;
      }
      if (ch === "'" || ch === '"') {
        quote = ch;
        continue;
      }
      if (ch === "#") return text.slice(0, i);
    }
    return text;
  }

  // Profundidad de corchetes/parentesis/llaves abiertos (ignora los de las cadenas).
  function openBracketDepth(text) {
    var quote = "";
    var depth = 0;
    for (var i = 0; i < text.length; i += 1) {
      var ch = text[i];
      var prev = text[i - 1];
      if (quote) {
        if (ch === quote && prev !== "\\") quote = "";
        continue;
      }
      if (ch === "'" || ch === '"') {
        quote = ch;
        continue;
      }
      if ("([{".includes(ch)) depth += 1;
      if (")]}".includes(ch)) depth -= 1;
    }
    return quote ? -1 : depth;
  }

  function parsePyLines(code) {
    var physical = String(code || "").replace(/\r\n?/g, "\n").split("\n").map(function (raw, index) {
      var indent = (raw.match(/^ */) || [""])[0].length;
      var text = raw.trim();
      if (!text.startsWith("#")) text = stripInlineComment(text).trim();
      return { text: text, indent: indent, line: index + 1 };
    });
    // Continuacion logica: un diccionario/lista/llamada puede abarcar varias
    // lineas; se unen hasta cerrar los corchetes, como hace Python.
    var logical = [];
    var i = 0;
    while (i < physical.length) {
      var entry = physical[i];
      var depth = entry.text.startsWith("#") ? 0 : openBracketDepth(entry.text);
      if (depth <= 0) {
        logical.push(entry);
        i += 1;
        continue;
      }
      var joined = entry.text;
      var consumed = i + 1;
      while (depth > 0 && consumed < physical.length) {
        var nextText = physical[consumed].text.startsWith("#") ? "" : physical[consumed].text;
        if (nextText) {
          joined += " " + nextText;
          depth = openBracketDepth(joined);
        }
        consumed += 1;
      }
      if (depth === 0) {
        logical.push({ text: joined, indent: entry.indent, line: entry.line });
        i = consumed;
      } else {
        // corchete sin cerrar: se deja la linea original para que el error salga alli
        logical.push(entry);
        i += 1;
      }
    }
    return logical;
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

  // Busca un "=" de asignacion al nivel superior (ignora ==, <=, >=, !=, +=...).
  function findTopLevelAssign(text) {
    var quote = "";
    var depth = 0;
    for (var i = 0; i < text.length; i += 1) {
      var ch = text[i];
      var prev = text[i - 1];
      if (quote) {
        if (ch === quote && prev !== "\\") quote = "";
        continue;
      }
      if (ch === "'" || ch === '"') {
        quote = ch;
        continue;
      }
      if ("([{".includes(ch)) depth += 1;
      if (")]}".includes(ch)) depth -= 1;
      if (depth !== 0) continue;
      if (ch === "=" && text[i + 1] !== "=" && !"=<>!+-*/%".includes(prev || "")) return i;
    }
    return -1;
  }

  // Busca un operador de asignacion aumentada (+=, -=, ...) al nivel superior.
  var AUG_OPS = ["//=", "+=", "-=", "*=", "/=", "%="];
  function findTopLevelAugOp(text) {
    var quote = "";
    var depth = 0;
    for (var i = 0; i < text.length; i += 1) {
      var ch = text[i];
      var prev = text[i - 1];
      if (quote) {
        if (ch === quote && prev !== "\\") quote = "";
        continue;
      }
      if (ch === "'" || ch === '"') {
        quote = ch;
        continue;
      }
      if ("([{".includes(ch)) depth += 1;
      if (")]}".includes(ch)) depth -= 1;
      if (depth !== 0) continue;
      for (var o = 0; o < AUG_OPS.length; o += 1) {
        if (text.slice(i, i + AUG_OPS[o].length) === AUG_OPS[o]) {
          return { index: i, op: AUG_OPS[o] };
        }
      }
    }
    return null;
  }

  function runPythonEducational(code, stdinText) {
    assertSafeSource(code);
    var steps = 0;
    var callDepth = 0;
    var lines = parsePyLines(code);
    var globalEnv = Object.create(null); // sin prototipo: solo variables del aprendiz
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
    var ctx = { helpers: helpers, callUser: callUser };

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
      if (value && (value.__pyTuple || value.__pySet)) return value.items.slice();
      if (value && value.__pyDict) return Array.from(value.map.keys());
      throw new Error("Linea " + line.line + ": solo puedes recorrer listas, cadenas, tuplas, conjuntos, diccionarios o range().");
    }

    // Crea una funcion (def suelto o metodo de clase). Los valores por defecto
    // se evaluan al definir, como en Python.
    function makeFunction(name, paramsSrc, bodyStart, bodyEnd, bodyIndent, env) {
      var params = [];
      var seenDefault = false;
      if (paramsSrc.trim()) {
        splitTopLevel(paramsSrc, ",").forEach(function (part) {
          if (!part) return;
          var pm = part.match(/^([A-Za-z_]\w*)\s*(?:=\s*(.+))?$/);
          if (!pm) throw new Error("Parametro no valido en def " + name + ": " + part);
          var param = { name: pm[1], hasDefault: false, defaultValue: undefined };
          if (pm[2] !== undefined) {
            param.hasDefault = true;
            param.defaultValue = evaluatePyExpr(pm[2], env, ctx);
            seenDefault = true;
          } else if (seenDefault) {
            throw new Error("En def " + name + " los parametros con valor por defecto van al final.");
          }
          params.push(param);
        });
      }
      return { __pyFunc: true, name: name, params: params, bodyStart: bodyStart, bodyEnd: bodyEnd, bodyIndent: bodyIndent };
    }

    function invokeFunction(fn, args, kwargs) {
      var local = Object.create(globalEnv); // lee globales, escribe locales
      if (args.length > fn.params.length) {
        throw new Error(fn.name + "() esperaba maximo " + fn.params.length + " argumentos y recibio " + args.length + ".");
      }
      fn.params.forEach(function (param, idx) {
        if (idx < args.length) local[param.name] = args[idx];
      });
      if (kwargs) {
        Object.keys(kwargs).forEach(function (key) {
          var idx = fn.params.findIndex(function (p) { return p.name === key; });
          if (idx < 0) throw new Error(fn.name + "() no tiene un parametro llamado '" + key + "'.");
          if (idx < args.length) throw new Error(fn.name + "() recibio dos valores para '" + key + "'.");
          local[key] = kwargs[key];
        });
      }
      fn.params.forEach(function (param) {
        if (Object.prototype.hasOwnProperty.call(local, param.name)) return;
        if (param.hasDefault) {
          local[param.name] = param.defaultValue;
          return;
        }
        throw new Error("Falta el argumento '" + param.name + "' en la llamada a " + fn.name + "().");
      });
      try {
        execRange(fn.bodyStart, fn.bodyEnd, fn.bodyIndent, local);
      } catch (signal) {
        if (signal && signal.__pylabReturn) {
          return isNone(signal.value) ? undefined : signal.value;
        }
        if (signal === BREAK_SIGNAL || signal === CONTINUE_SIGNAL) {
          throw new Error("break y continue solo pueden usarse dentro de un ciclo for o while.");
        }
        throw signal;
      }
      return undefined;
    }

    function callUser(fnVal, args, kwargs) {
      callDepth += 1;
      try {
        if (callDepth > MAX_CALL_DEPTH) {
          throw new Error("Demasiadas llamadas anidadas. Revisa si tienes una recursion infinita.");
        }
        tick(null);
        if (fnVal && fnVal.__pyBound) return callUser(fnVal.func, [fnVal.self].concat(args), kwargs);
        if (fnVal && fnVal.__pyClass) {
          var instance = { __pyInstance: true, cls: fnVal, attrs: Object.create(null) };
          var init = fnVal.methods.__init__;
          if (init) invokeFunction(init, [instance].concat(args), kwargs);
          else if (args.length || kwargs) {
            throw new Error("La clase '" + fnVal.name + "' no tiene __init__: crea el metodo __init__ para recibir datos.");
          }
          return instance;
        }
        if (fnVal && fnVal.__pyFunc) return invokeFunction(fnVal, args, kwargs);
        throw new Error("Este valor (" + typeNameOf(fnVal) + ") no se puede llamar como una funcion.");
      } finally {
        callDepth -= 1;
      }
    }

    // Asigna a un destino: variable, self.atributo, lista[i], diccionario[llave]...
    function assignToTarget(targetSrc, value, env) {
      var target = targetSrc.trim();
      if (/^[A-Za-z_]\w*$/.test(target)) {
        env[target] = value;
        return;
      }
      var attrMatch = target.match(/^(.+)\.([A-Za-z_]\w*)$/);
      if (attrMatch && isBalanced(attrMatch[1])) {
        var owner = evaluatePyExpr(attrMatch[1], env, ctx);
        if (owner && owner.__pyInstance) {
          owner.attrs[attrMatch[2]] = value;
          return;
        }
        throw new Error("Solo puedes asignar atributos (con punto) sobre objetos de una clase.");
      }
      if (target.endsWith("]")) {
        // localizar el [ de apertura cuyo cierre es el ] final
        var openIdx = -1;
        var scan = 0;
        while (scan < target.length) {
          if (target[scan] === "[" && isBalanced(target.slice(0, scan))) {
            var close = findMatchingBracket(target, scan);
            if (close === target.length - 1) {
              openIdx = scan;
              break;
            }
            if (close < 0) break;
            scan = close + 1;
            continue;
          }
          scan += 1;
        }
        if (openIdx > 0) {
          var container = evaluatePyExpr(target.slice(0, openIdx), env, ctx);
          var keyVal = evaluatePyExpr(target.slice(openIdx + 1, -1), env, ctx);
          if (Array.isArray(container)) {
            var idx = Math.trunc(Number(keyVal));
            if (Number.isNaN(idx)) throw new Error("El indice debe ser un numero entero: " + pyRepr(keyVal));
            if (idx < 0) idx += container.length;
            if (idx < 0 || idx >= container.length) throw new Error("IndexError: indice fuera de rango.");
            container[idx] = value;
            return;
          }
          if (container && container.__pyDict) {
            container.map.set(keyVal, value);
            return;
          }
          if (container && container.__pyTuple) throw new Error("Las tuplas no se pueden modificar (son inmutables).");
          throw new Error("Solo puedes asignar por indice en listas o diccionarios.");
        }
      }
      throw new Error("No se pudo entender el lado izquierdo de la asignacion: " + target);
    }

    function execRange(start, end, indent, env) {
      var i = start;
      while (i < end) {
        var line = lines[i];
        if (!line.text || line.text.startsWith("#")) {
          i += 1;
          continue;
        }
        tick(line);
        if (line.indent < indent) return i;
        try {
          if (line.indent > indent) throw new Error("indentacion inesperada.");

          var ifMatch = line.text.match(/^if\s+(.+):$/);
          if (ifMatch) {
            var handled = false;
            var cursor = i;
            while (cursor < end) {
              var chainLine = lines[cursor];
              // Solo la primera linea es "if"; un "if" nuevo despues es OTRA cadena
              // (antes se trataba como parte de esta y se saltaba si ya corrio una rama).
              var ifPart = chainLine.text.match(cursor === i ? /^(if)\s+(.+):$/ : /^(elif)\s+(.+):$/);
              var elsePart = cursor === i ? null : chainLine.text.match(/^else:$/);
              if (chainLine.indent !== indent || (!ifPart && !elsePart)) break;
              var blockStart = cursor + 1;
              var blockEnd = findBlockEnd(lines, blockStart, indent);
              var shouldRun = elsePart ? !handled : (!handled && pyTruthy(evaluatePyExpr(ifPart[2], env, ctx)));
              if (shouldRun) {
                execRange(blockStart, blockEnd, indent + 4, env);
                handled = true;
              }
              cursor = blockEnd;
            }
            i = cursor;
            continue;
          }

          if (/^(elif\s+.+|else):$/.test(line.text)) {
            throw new Error("este elif/else no tiene un if al mismo nivel justo antes.");
          }

          var forMatch = line.text.match(/^for\s+([A-Za-z_]\w*)\s+in\s+(.+):$/);
          if (forMatch) {
            var forBodyStart = i + 1;
            var forBodyEnd = findBlockEnd(lines, forBodyStart, indent);
            if (forBodyStart >= forBodyEnd) throw new Error("el for necesita un bloque indentado.");
            var items = getIterable(evaluatePyExpr(forMatch[2], env, ctx), line);
            for (var itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
              tick(line);
              env[forMatch[1]] = items[itemIndex];
              try {
                execRange(forBodyStart, forBodyEnd, indent + 4, env);
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
            if (whileBodyStart >= whileBodyEnd) throw new Error("el while necesita un bloque indentado.");
            while (pyTruthy(evaluatePyExpr(whileMatch[1], env, ctx))) {
              tick(line);
              try {
                execRange(whileBodyStart, whileBodyEnd, indent + 4, env);
              } catch (signal) {
                if (signal === BREAK_SIGNAL) break;
                if (signal !== CONTINUE_SIGNAL) throw signal;
              }
            }
            i = whileBodyEnd;
            continue;
          }

          // definicion de funcion: def nombre(parametros):
          var defMatch = line.text.match(/^def\s+([A-Za-z_]\w*)\s*\((.*)\)\s*:$/);
          if (defMatch) {
            var defBodyStart = i + 1;
            var defBodyEnd = findBlockEnd(lines, defBodyStart, indent);
            if (defBodyStart >= defBodyEnd) throw new Error("def " + defMatch[1] + " necesita un bloque indentado (4 espacios).");
            env[defMatch[1]] = makeFunction(defMatch[1], defMatch[2], defBodyStart, defBodyEnd, indent + 4, env);
            i = defBodyEnd;
            continue;
          }

          // definicion de clase: class Nombre:  (solo metodos def y pass adentro)
          var classMatch = line.text.match(/^class\s+([A-Za-z_]\w*)\s*(?:\(([^)]*)\))?\s*:$/);
          if (classMatch) {
            if (classMatch[2] && classMatch[2].trim()) {
              throw new Error("la herencia (class " + classMatch[1] + "(...)) no esta disponible en el laboratorio: define la clase sin parentesis.");
            }
            var clsBodyStart = i + 1;
            var clsBodyEnd = findBlockEnd(lines, clsBodyStart, indent);
            if (clsBodyStart >= clsBodyEnd) throw new Error("class " + classMatch[1] + " necesita un bloque indentado (4 espacios).");
            var cls = { __pyClass: true, name: classMatch[1], methods: Object.create(null) };
            var clsCursor = clsBodyStart;
            while (clsCursor < clsBodyEnd) {
              var member = lines[clsCursor];
              if (!member.text || member.text.startsWith("#")) {
                clsCursor += 1;
                continue;
              }
              if (member.indent !== indent + 4) throw new Error("Linea " + member.line + ": dentro de la clase usa 4 espacios de indentacion.");
              if (member.text === "pass") {
                clsCursor += 1;
                continue;
              }
              var methodMatch = member.text.match(/^def\s+([A-Za-z_]\w*)\s*\((.*)\)\s*:$/);
              if (!methodMatch) throw new Error("Linea " + member.line + ": dentro de una clase solo se admiten metodos (def) o pass.");
              var mBodyStart = clsCursor + 1;
              var mBodyEnd = findBlockEnd(lines, mBodyStart, indent + 4);
              if (mBodyStart >= mBodyEnd) throw new Error("Linea " + member.line + ": el metodo " + methodMatch[1] + " necesita un bloque indentado.");
              var method = makeFunction(methodMatch[1], methodMatch[2], mBodyStart, mBodyEnd, indent + 8, env);
              if (!method.params.length || method.params[0].name !== "self") {
                throw new Error("Linea " + member.line + ": el primer parametro del metodo " + methodMatch[1] + " debe ser self.");
              }
              cls.methods[methodMatch[1]] = method;
              clsCursor = mBodyEnd;
            }
            env[classMatch[1]] = cls;
            i = clsBodyEnd;
            continue;
          }

          if (line.text === "return" || /^return\s/.test(line.text)) {
            var retExpr = line.text.slice(6).trim();
            throw { __pylabReturn: true, value: retExpr ? evaluatePyExpr(retExpr, env, ctx) : undefined };
          }

          // match valor: / case patron: / case _:
          var matchStmt = line.text.match(/^match\s+(.+):$/);
          if (matchStmt) {
            var subject = evaluatePyExpr(matchStmt[1], env, ctx);
            var matchEnd = findBlockEnd(lines, i + 1, indent);
            var caseCursor = i + 1;
            var matched = false;
            while (caseCursor < matchEnd) {
              var caseLine = lines[caseCursor];
              if (!caseLine.text || caseLine.text.startsWith("#")) {
                caseCursor += 1;
                continue;
              }
              var caseMatch = caseLine.text.match(/^case\s+(.+):$/);
              if (caseLine.indent !== indent + 4 || !caseMatch) {
                throw new Error("Linea " + caseLine.line + ": dentro de match solo van lineas case patron: (con 4 espacios).");
              }
              var caseBodyStart = caseCursor + 1;
              var caseBodyEnd = findBlockEnd(lines, caseBodyStart, indent + 4);
              if (caseBodyStart >= caseBodyEnd) throw new Error("Linea " + caseLine.line + ": el case necesita un bloque indentado.");
              if (!matched) {
                var pattern = caseMatch[1].trim();
                var hit = pattern === "_" ? true : pyEquals(subject, evaluatePyExpr(pattern, env, ctx));
                if (hit) {
                  matched = true;
                  execRange(caseBodyStart, caseBodyEnd, indent + 8, env);
                }
              }
              caseCursor = caseBodyEnd;
            }
            i = matchEnd;
            continue;
          }

          if (line.text === "break") throw BREAK_SIGNAL;
          if (line.text === "continue") throw CONTINUE_SIGNAL;
          if (line.text === "pass") {
            i += 1;
            continue;
          }

          if (/^(import|from|with|try|except|finally|lambda|global|nonlocal|del|raise|assert|yield)\b/.test(line.text)) {
            throw new Error("import, try/except, with y lambda aun no estan disponibles en el laboratorio. Descarga el .py para trabajarlos en Python instalado.");
          }

          var printMatch = line.text.match(/^print\((.*)\)$/);
          if (printMatch && isBalanced(printMatch[1])) {
            pushOut(splitTopLevel(printMatch[1], ",").map(function (part) {
              return pyRepr(evaluatePyExpr(part, env, ctx));
            }).join(" "));
            i += 1;
            continue;
          }

          // asignacion aumentada: x += 1, self.total -= 2, notas[0] *= 2...
          var aug = findTopLevelAugOp(line.text);
          if (aug) {
            var augTarget = line.text.slice(0, aug.index).trim();
            var augValue = line.text.slice(aug.index + aug.op.length).trim();
            var augOp = aug.op.slice(0, -1);
            var newValue = evaluatePyExpr("(" + augTarget + ") " + augOp + " (" + augValue + ")", env, ctx);
            assignToTarget(augTarget, newValue, env);
            i += 1;
            continue;
          }

          // asignacion: variable = ..., self.attr = ..., lista[i] = ..., d["k"] = ...
          var assignIdx = findTopLevelAssign(line.text);
          if (assignIdx > 0) {
            var assignValue = evaluatePyExpr(line.text.slice(assignIdx + 1), env, ctx);
            assignToTarget(line.text.slice(0, assignIdx), assignValue, env);
            i += 1;
            continue;
          }

          var value = evaluatePyExpr(line.text, env, ctx);
          if (value !== undefined) pushOut(pyRepr(value));
          i += 1;
        } catch (err) {
          // Etiqueta el error con la linea donde ocurrio (solo una vez, la mas interna).
          if (err instanceof Error && !err.__pylabLine) {
            err.__pylabLine = true;
            if (!/^Linea\s+\d+/i.test(err.message)) err.message = "Linea " + line.line + ": " + err.message;
          }
          throw err;
        }
      }
      return i;
    }

    try {
      execRange(0, lines.length, 0, globalEnv);
    } catch (signal) {
      if (signal === BREAK_SIGNAL || signal === CONTINUE_SIGNAL) {
        throw new Error("break y continue solo pueden usarse dentro de un ciclo for o while.");
      }
      if (signal && signal.__pylabReturn) {
        throw new Error("return solo puede usarse dentro de una funcion (def).");
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
