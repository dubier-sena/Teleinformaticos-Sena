"use strict";

// Pruebas del interprete educativo del laboratorio de Python
// (js/python_lab_worker.js). Cubre lo que ya existia (variables, print, input,
// condicionales, ciclos, listas) y lo nuevo: def/return, class/__init__/self,
// diccionarios, tuplas, conjuntos, match-case, is/is not y multilinea.
// Incluye los ejercicios 7, 8, 9 y 10 de la guia de Python TAL CUAL estan
// publicados, para garantizar que el laboratorio puede ejecutarlos.

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadRun() {
  const code = fs.readFileSync(
    path.join(__dirname, "..", "js", "python_lab_worker.js"),
    "utf8"
  );
  const sandbox = {};
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.__PYLAB_RUN__;
}

const run = loadRun();

test("el worker expone __PYLAB_RUN__", () => {
  assert.strictEqual(typeof run, "function");
});

// ── Regresion: lo que ya funcionaba sigue funcionando ─────────────────────────

test("variables, print, input, condicionales y ciclos (regresion)", () => {
  const code = [
    'nombre = input("Nombre: ")',
    "edad = int(input(\"Edad: \"))",
    "if edad >= 18:",
    '    print(nombre, "es mayor de edad")',
    "else:",
    '    print(nombre, "es menor de edad")',
    "total = 0",
    "for i in range(3):",
    "    total += i",
    'print("Total:", total)',
    "n = 0",
    "while n < 5:",
    "    n += 1",
    "    if n == 3:",
    "        break",
    'print("n:", n)',
  ].join("\n");
  assert.strictEqual(
    run(code, "Ana\n15"),
    [
      "Nombre: Ana",
      "Edad: 15",
      "Ana es menor de edad",
      "Total: 3",
      "n: 3",
    ].join("\n")
  );
});

test("listas: append, indexacion y asignacion por indice (regresion)", () => {
  const code = [
    "notas = [4.0, 3.5]",
    "notas.append(5.0)",
    "notas[0] = 4.5",
    "print(notas)",
    "print(notas[-1])",
    "print(len(notas))",
  ].join("\n");
  // Nota: 5.0 se muestra como 5 (limitacion conocida: JS no distingue int de float)
  assert.strictEqual(run(code, ""), "[4.5, 3.5, 5]\n5\n3");
});

test("comentarios al final de la linea no rompen la ejecucion", () => {
  const code = [
    "x = 5  # esto es una nota",
    'print(x)  # imprime el valor',
  ].join("\n");
  assert.strictEqual(run(code, ""), "5");
});

// ── Funciones (def / return) ──────────────────────────────────────────────────

test("def con parametros, return y llamada", () => {
  const code = [
    "def doble(n):",
    "    return n * 2",
    "print(doble(4))",
  ].join("\n");
  assert.strictEqual(run(code, ""), "8");
});

test("def con valor por defecto y argumento con nombre", () => {
  const code = [
    'def saludar(nombre, saludo="Hola"):',
    '    print(saludo + ", " + nombre)',
    'saludar("Ana")',
    'saludar("Luis", saludo="Buen dia")',
  ].join("\n");
  assert.strictEqual(run(code, ""), "Hola, Ana\nBuen dia, Luis");
});

test("recursion controlada (factorial)", () => {
  const code = [
    "def factorial(n):",
    "    if n <= 1:",
    "        return 1",
    "    return n * factorial(n - 1)",
    "print(factorial(5))",
  ].join("\n");
  assert.strictEqual(run(code, ""), "120");
});

test("las variables de una funcion son locales", () => {
  const code = [
    "x = 1",
    "def cambia():",
    "    x = 99",
    "cambia()",
    "print(x)",
  ].join("\n");
  assert.strictEqual(run(code, ""), "1");
});

test("recursion infinita da mensaje claro", () => {
  const code = [
    "def loop(n):",
    "    return loop(n + 1)",
    "print(loop(0))",
  ].join("\n");
  assert.throws(() => run(code, ""), /llamadas anidadas|recursion/i);
});

test("return fuera de una funcion da mensaje claro", () => {
  assert.throws(() => run("return 5", ""), /return solo puede usarse dentro de una funcion/);
});

// ── Clases (class / __init__ / self / metodos) ────────────────────────────────

test("clase con __init__, atributos y metodos", () => {
  const code = [
    "class Computador:",
    "    def __init__(self, marca, velocidad, encendido):",
    "        self.marca = marca",
    "        self.velocidad = velocidad",
    "        self.encendido = encendido",
    "",
    "    def es_rapido(self):",
    "        if self.velocidad >= 2.5:",
    '            return "Rapido"',
    "        else:",
    '            return "Lento"',
    "",
    'pc = Computador("Lenovo", 3.1, True)',
    "print(pc.marca, pc.es_rapido(), pc.encendido)",
  ].join("\n");
  assert.strictEqual(run(code, ""), "Lenovo Rapido True");
});

test("ejercicio 8 de la guia: Clase Estudiante (verbatim)", () => {
  const code = [
    "# Ejercicio 8: POO 1 - Clase Estudiante",
    "class Estudiante:",
    "    def __init__(self, nombre, grado, nota1, nota2, nota3):",
    "        self.nombre = nombre",
    "        self.grado = grado",
    "        self.nota1 = nota1",
    "        self.nota2 = nota2",
    "        self.nota3 = nota3",
    "",
    "    def calcular_promedio(self):",
    "        return (self.nota1 + self.nota2 + self.nota3) / 3",
    "",
    "    def obtener_estado(self):",
    "        promedio = self.calcular_promedio()",
    "        if promedio >= 3.5:",
    '            return "Aprobado"',
    "        else:",
    '            return "No aprobado"',
    "",
    "    def mostrar_informacion(self):",
    '        print("=== INFORMACIÓN DEL ESTUDIANTE ===")',
    '        print("Nombre:", self.nombre)',
    '        print("Grado:", self.grado)',
    '        print("Promedio:", round(self.calcular_promedio(), 2))',
    '        print("Estado:", self.obtener_estado())',
    "",
    'estudiante1 = Estudiante("Laura Gómez", "10A", 4.0, 3.8, 4.5)',
    "estudiante1.mostrar_informacion()",
  ].join("\n");
  assert.strictEqual(
    run(code, ""),
    [
      "=== INFORMACIÓN DEL ESTUDIANTE ===",
      "Nombre: Laura Gómez",
      "Grado: 10A",
      "Promedio: 4.1",
      "Estado: Aprobado",
    ].join("\n")
  );
});

test("ejercicio 9 de la guia: Clase EntregaActividad con nota=None (verbatim)", () => {
  const code = [
    "class EntregaActividad:",
    "    def __init__(self, aprendiz, actividad, entregada, tarde, nota=None):",
    "        self.aprendiz = aprendiz",
    "        self.actividad = actividad",
    "        self.entregada = entregada",
    "        self.tarde = tarde",
    "        self.nota = nota",
    "",
    "    def obtener_estado(self):",
    "        if not self.entregada:",
    '            return "Pendiente por entregar"',
    "        elif self.nota is None:",
    '            return "Entregada, pendiente por calificar"',
    "        elif self.tarde and self.nota >= 3.5:",
    '            return "Aprobada, pero entregada tarde"',
    "        elif self.nota >= 3.5:",
    '            return "Aprobada"',
    "        else:",
    '            return "No aprobada"',
    "",
    "    def mostrar_reporte(self):",
    '        print("Aprendiz:", self.aprendiz)',
    '        print("Nota:", self.nota)',
    '        print("Estado:", self.obtener_estado())',
    "",
    'entrega1 = EntregaActividad("Carlos Pérez", "Condicionales", True, False, 4.2)',
    "entrega1.mostrar_reporte()",
    'entrega2 = EntregaActividad("Ana", "Listas", True, False)',
    "entrega2.mostrar_reporte()",
  ].join("\n");
  assert.strictEqual(
    run(code, ""),
    [
      "Aprendiz: Carlos Pérez",
      "Nota: 4.2",
      "Estado: Aprobada",
      "Aprendiz: Ana",
      "Nota: None",
      "Estado: Entregada, pendiente por calificar",
    ].join("\n")
  );
});

test("ejercicio 10 de la guia: Clase Ficha con lista de objetos (verbatim)", () => {
  const code = [
    "class Estudiante:",
    "    def __init__(self, nombre, promedio):",
    "        self.nombre = nombre",
    "        self.promedio = promedio",
    "",
    "    def esta_aprobado(self):",
    "        return self.promedio >= 3.5",
    "",
    "class Ficha:",
    "    def __init__(self, numero, programa):",
    "        self.numero = numero",
    "        self.programa = programa",
    "        self.estudiantes = []",
    "",
    "    def agregar_estudiante(self, estudiante):",
    "        self.estudiantes.append(estudiante)",
    "",
    "    def mostrar_reporte(self):",
    '        print("=== REPORTE DE FICHA ===")',
    '        print("Ficha:", self.numero)',
    '        print("Programa:", self.programa)',
    '        print("Cantidad de estudiantes:", len(self.estudiantes))',
    "        for estudiante in self.estudiantes:",
    "            if estudiante.esta_aprobado():",
    '                estado = "Aprobado"',
    "            else:",
    '                estado = "En revisión"',
    '            print(estudiante.nombre, "- Promedio:", estudiante.promedio, "-", estado)',
    "",
    'ficha = Ficha(3441939, "Sistemas Teleinformáticos")',
    'ficha.agregar_estudiante(Estudiante("Laura Gómez", 4.3))',
    'ficha.agregar_estudiante(Estudiante("Carlos Pérez", 3.2))',
    'ficha.agregar_estudiante(Estudiante("María Torres", 3.8))',
    "ficha.mostrar_reporte()",
  ].join("\n");
  assert.strictEqual(
    run(code, ""),
    [
      "=== REPORTE DE FICHA ===",
      "Ficha: 3441939",
      "Programa: Sistemas Teleinformáticos",
      "Cantidad de estudiantes: 3",
      "Laura Gómez - Promedio: 4.3 - Aprobado",
      "Carlos Pérez - Promedio: 3.2 - En revisión",
      "María Torres - Promedio: 3.8 - Aprobado",
    ].join("\n")
  );
});

test("codigo de la aprendiz de la captura (ejercicio adicional 9)", () => {
  const code = [
    "class EntregaActividad:",
    "    def __init__(self, aprendiz, actividad, entregada, tarde, nota):",
    "        self.aprendiz = aprendiz",
    "        self.actividad = actividad",
    "        self.entregada = entregada",
    "        self.tarde = tarde",
    "        self.nota = nota",
    "",
    "    def estado(self):",
    "        if not self.entregada:",
    '            return "Pendiente"',
    "        elif self.tarde:",
    '            return "Entrega tarde"',
    "        else:",
    '            return "Aprobada"',
    "",
    "    def mostrar(self):",
    '        print(self.aprendiz, "-", self.actividad, "-", self.estado())',
    "",
    'e1 = EntregaActividad("Angie Valentina","Variables",True,False,4.5)',
    'e2 = EntregaActividad("Carlos Pérez","Condicionales",False,False,None)',
    'e3 = EntregaActividad("Laura Gómez","POO",True,True,3.8)',
    "",
    "e1.mostrar()",
    "e2.mostrar()",
    "e3.mostrar()",
  ].join("\n");
  assert.strictEqual(
    run(code, ""),
    [
      "Angie Valentina - Variables - Aprobada",
      "Carlos Pérez - Condicionales - Pendiente",
      "Laura Gómez - POO - Entrega tarde",
    ].join("\n")
  );
});

test("metodo sin self da mensaje claro", () => {
  const code = [
    "class Cosa:",
    "    def hacer():",
    "        print(1)",
  ].join("\n");
  assert.throws(() => run(code, ""), /primer parametro del metodo hacer debe ser self/);
});

test("herencia da mensaje claro", () => {
  const code = [
    "class Hija(Madre):",
    "    pass",
  ].join("\n");
  assert.throws(() => run(code, ""), /herencia/);
});

test("atributo inexistente da AttributeError con pista", () => {
  const code = [
    "class P:",
    "    def __init__(self, a):",
    "        self.a = a",
    "p = P(1)",
    "print(p.b)",
  ].join("\n");
  assert.throws(() => run(code, ""), /AttributeError.*no tiene el atributo 'b'/);
});

test("cantidad incorrecta de argumentos da mensaje claro", () => {
  const code = [
    "def f(a, b):",
    "    return a + b",
    "print(f(1))",
  ].join("\n");
  assert.throws(() => run(code, ""), /Falta el argumento 'b'/);
});

// ── Diccionarios, tuplas y conjuntos ─────────────────────────────────────────

test("diccionario: literal multilinea, lectura, escritura y KeyError", () => {
  const code = [
    "aprendiz = {",
    '    "nombre": "María Torres",',
    '    "ficha": 3441939,',
    '    "activo": True',
    "}",
    'print(aprendiz["nombre"])',
    'aprendiz["grado"] = "10A"',
    'print(aprendiz["grado"])',
    "print(len(aprendiz))",
    "print(aprendiz)",
  ].join("\n");
  assert.strictEqual(
    run(code, ""),
    [
      "María Torres",
      "10A",
      "4",
      "{'nombre': 'María Torres', 'ficha': 3441939, 'activo': True, 'grado': '10A'}",
    ].join("\n")
  );
  assert.throws(() => run('d = {"a": 1}\nprint(d["b"])', ""), /KeyError/);
});

test("tupla: literal, impresion, indexacion e inmutabilidad", () => {
  const code = [
    'horario = ("Miércoles", "Viernes")',
    'print("Días de clase:", horario)',
    "print(horario[0])",
    "print(len(horario))",
  ].join("\n");
  assert.strictEqual(
    run(code, ""),
    ["Días de clase: ('Miércoles', 'Viernes')", "Miércoles", "2"].join("\n")
  );
  assert.throws(() => run('t = (1, 2)\nt[0] = 9', ""), /tuplas no se pueden modificar/);
});

test("conjunto: literal, pertenencia, add y len", () => {
  const code = [
    'evidencias = {"Variables", "Condicionales", "Listas"}',
    'print("POO" in evidencias)',
    'print("Variables" in evidencias)',
    'evidencias.add("POO")',
    'print("POO" in evidencias)',
    "print(len(evidencias))",
    "print(evidencias)",
  ].join("\n");
  assert.strictEqual(
    run(code, ""),
    [
      "False",
      "True",
      "True",
      "4",
      "{'Variables', 'Condicionales', 'Listas', 'POO'}",
    ].join("\n")
  );
});

test("not in funciona (antes estaba roto)", () => {
  const code = [
    "lista = [1, 2]",
    "print(3 not in lista)",
    "print(1 not in lista)",
  ].join("\n");
  assert.strictEqual(run(code, ""), "True\nFalse");
});

test("is None / is not None", () => {
  const code = [
    "nota = None",
    "print(nota is None)",
    "nota = 4.5",
    "print(nota is None)",
    "print(nota is not None)",
  ].join("\n");
  assert.strictEqual(run(code, ""), "True\nFalse\nTrue");
});

test("dos if consecutivos al mismo nivel son cadenas independientes (bug preexistente)", () => {
  const code = [
    "x = 10",
    "if x > 5:",
    '    print("primero")',
    "if x > 8:",
    '    print("segundo")',
    "elif x > 1:",
    '    print("segundo-elif")',
    "else:",
    '    print("segundo-else")',
  ].join("\n");
  // Antes del arreglo: el segundo if se saltaba porque el primero ya habia corrido.
  assert.strictEqual(run(code, ""), "primero\nsegundo");
});

test("elif/else huerfano da error claro en vez de cortar en silencio", () => {
  const code = [
    "x = 1",
    "else:",
    '    print("nunca")',
  ].join("\n");
  assert.throws(() => run(code, ""), /no tiene un if/);
});

test("la lista vacia es falsa (verdad estilo Python)", () => {
  const code = [
    "pendientes = []",
    "if not pendientes:",
    '    print("Sin pendientes")',
    "pendientes.append(1)",
    "if pendientes:",
    '    print("Hay pendientes")',
  ].join("\n");
  assert.strictEqual(run(code, ""), "Sin pendientes\nHay pendientes");
});

// ── match-case (ejercicio 7 de la guia, verbatim) ─────────────────────────────

const EXERCISE_7 = [
  "aprendiz = {",
  '    "nombre": "María Torres",',
  '    "grado": "10A",',
  '    "ficha": 3441939,',
  '    "promedio": 4.1,',
  '    "activo": True',
  "}",
  'horario = ("Miércoles", "Viernes")',
  'evidencias = {"Variables", "Condicionales", "Listas"}',
  "",
  'print("=== MENÚ DE CONSULTA ===")',
  'print("1. Ver datos del aprendiz")',
  'print("2. Ver horario")',
  'print("3. Ver evidencias entregadas")',
  'print("4. Ver estado final")',
  'opcion = int(input("Seleccione una opción: "))',
  "",
  "match opcion:",
  "    case 1:",
  '        print("Nombre:", aprendiz["nombre"])',
  '        print("Grado:", aprendiz["grado"])',
  '        print("Ficha:", aprendiz["ficha"])',
  "    case 2:",
  '        print("Días de clase:", horario)',
  "    case 3:",
  '        print("Evidencias:", evidencias)',
  '        if "POO" in evidencias:',
  '            print("Ya entregó Programación Orientada a Objetos")',
  "        else:",
  '            print("Tiene pendiente Programación Orientada a Objetos")',
  "    case 4:",
  '        if aprendiz["activo"] and aprendiz["promedio"] >= 3.5:',
  '            print("Estado: Activo y aprobado")',
  "        else:",
  '            print("Estado: Revisar situación académica")',
  "    case _:",
  '        print("Opción no válida")',
].join("\n");

const EXERCISE_7_MENU = [
  "=== MENÚ DE CONSULTA ===",
  "1. Ver datos del aprendiz",
  "2. Ver horario",
  "3. Ver evidencias entregadas",
  "4. Ver estado final",
];

test("ejercicio 7 de la guia: opcion 1 (dict)", () => {
  assert.strictEqual(
    run(EXERCISE_7, "1"),
    EXERCISE_7_MENU.concat([
      "Seleccione una opción: 1",
      "Nombre: María Torres",
      "Grado: 10A",
      "Ficha: 3441939",
    ]).join("\n")
  );
});

test("ejercicio 7 de la guia: opcion 2 (tupla)", () => {
  assert.strictEqual(
    run(EXERCISE_7, "2"),
    EXERCISE_7_MENU.concat([
      "Seleccione una opción: 2",
      "Días de clase: ('Miércoles', 'Viernes')",
    ]).join("\n")
  );
});

test("ejercicio 7 de la guia: opcion 3 (set + in)", () => {
  assert.strictEqual(
    run(EXERCISE_7, "3"),
    EXERCISE_7_MENU.concat([
      "Seleccione una opción: 3",
      "Evidencias: {'Variables', 'Condicionales', 'Listas'}",
      "Tiene pendiente Programación Orientada a Objetos",
    ]).join("\n")
  );
});

test("ejercicio 7 de la guia: opcion 4 (and en dict)", () => {
  assert.strictEqual(
    run(EXERCISE_7, "4"),
    EXERCISE_7_MENU.concat([
      "Seleccione una opción: 4",
      "Estado: Activo y aprobado",
    ]).join("\n")
  );
});

test("ejercicio 7 de la guia: case _ (opcion no valida)", () => {
  assert.strictEqual(
    run(EXERCISE_7, "9"),
    EXERCISE_7_MENU.concat([
      "Seleccione una opción: 9",
      "Opción no válida",
    ]).join("\n")
  );
});

// ── Bloqueos y mensajes de error ──────────────────────────────────────────────

test("import sigue bloqueado con mensaje claro", () => {
  assert.throws(() => run("import math\nprint(1)", ""), /aun no estan disponibles/);
});

test("import os sigue bloqueado por seguridad", () => {
  assert.throws(() => run("import os\nprint(1)", ""), /seguridad/);
});

test("f-string da mensaje claro", () => {
  assert.throws(() => run('nota = 4.5\nprint(f"Nota: {nota}")', ""), /f-strings/);
});

test("los errores llevan el numero de linea", () => {
  const err = (() => {
    try {
      run("x = 1\nprint(noexiste)", "");
    } catch (e) {
      return e;
    }
    return null;
  })();
  assert.ok(err, "debe lanzar error");
  assert.match(err.message, /Linea 2:/);
  assert.match(err.message, /noexiste/);
});

test("metodos de texto basicos: upper, lower, strip", () => {
  const code = [
    'print("hola".upper())',
    'print("MUNDO".lower())',
    'print("  ok  ".strip())',
  ].join("\n");
  assert.strictEqual(run(code, ""), "HOLA\nmundo\nok");
});

test("sorted y list funcionan sobre colecciones", () => {
  const code = [
    "print(sorted([3, 1, 2]))",
    "print(list((1, 2)))",
  ].join("\n");
  assert.strictEqual(run(code, ""), "[1, 2, 3]\n[1, 2]");
});
