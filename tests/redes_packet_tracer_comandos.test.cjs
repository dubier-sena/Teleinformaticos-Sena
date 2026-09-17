// Laboratorios de Cisco Packet Tracer de las 3 guias de Redes (revision sep-2026).
//
// Protege:
//  - js/guide_copy_commands.js: copia SOLO los comandos del bloque (sin espacios
//    sobrantes, con salto final) y reemplaza XXX por los digitos del aprendiz.
//  - El contenido de los bloques: cada bloque IOS tiene su boton, no trae
//    comentarios "!" ni caracteres que la CLI de Packet Tracer rechace, y los
//    botones de un solo comando copian exactamente lo que muestra la guia.
//  - Los datos de configuracion que el laboratorio necesita (S2, ISP, orden
//    DHCP/NAT, router del Lab 3, extraccion de datos en RAP03).
//  - El registro del script y el bundle regenerado en las 12 rutas.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const RAPS = ["01", "02", "03"];
const partial = (n) => read(`partials/guia-redes-rap${n}-content.html`);

function loadCopyCommands() {
  const listeners = [];
  const document = {
    getElementById: () => null,
    createElement: () => ({}),
    head: { appendChild() {} },
    addEventListener: (type, fn) => listeners.push({ type, fn }),
  };
  const window = {};
  vm.runInNewContext(read("js/guide_copy_commands.js"), { window, document, navigator: {}, setTimeout, clearTimeout });
  return { api: window.GuideCopyCommands, listeners };
}

function fakeInput(token, value) {
  return { value, getAttribute: (name) => (name === "data-cmd-var" ? token : null) };
}

function fakeButton({ copyText = null, preText = null, inputs = null }) {
  const scope = inputs ? { querySelectorAll: () => inputs } : null;
  const block = preText === null ? null : { querySelector: (sel) => (sel === "pre" ? { textContent: preText } : null) };
  return {
    hasAttribute: (name) => name === "data-copy-text" && copyText !== null,
    getAttribute: (name) => (name === "data-copy-text" ? copyText : null),
    closest: (sel) => (sel === "[data-cmd-block]" ? block : sel === "[data-cmd-scope]" ? scope : null),
  };
}

function cmdBlocks(html) {
  return [...html.matchAll(/<div class="cmd-block" data-cmd-block>([\s\S]*?)<pre class="cmd-block__code">([\s\S]*?)<\/pre>/g)].map((m) => ({
    head: m[1],
    lines: m[2].split("\n"),
    text: m[2],
  }));
}

function blockFor(html, deviceLabel) {
  const found = cmdBlocks(html).filter((b) => b.head.includes(deviceLabel));
  assert.equal(found.length >= 1, true, `falta el bloque de "${deviceLabel}"`);
  return found[0];
}

test("guide_copy_commands: copia el <pre> limpio, con salto final, y registra un solo listener", () => {
  const { api, listeners } = loadCopyCommands();
  assert.equal(listeners.filter((l) => l.type === "click").length, 1);
  const text = api.textFor(fakeButton({ preText: "enable  \nconfigure terminal\t\n hostname R1\n\n\n" }));
  assert.equal(text, "enable\nconfigure terminal\n hostname R1\n");
  assert.equal(api.textFor(fakeButton({ preText: "\r\nshow ip route\r\n" })), "\nshow ip route\n");
  assert.equal(api.textFor(fakeButton({ preText: "" })), "");
  assert.equal(api.textFor(null), "");
});

test("guide_copy_commands: un solo comando se copia tal cual, sin salto final", () => {
  const { api } = loadCopyCommands();
  assert.equal(api.textFor(fakeButton({ copyText: "ping 192.168.1.1" })), "ping 192.168.1.1");
});

test("guide_copy_commands: XXX se reemplaza por los digitos del aprendiz solo al copiar y saneado", () => {
  const { api } = loadCopyCommands();
  const pre = "hostname R1-XXX\nend";
  assert.equal(api.textFor(fakeButton({ preText: pre, inputs: [fakeInput("XXX", "482")] })), "hostname R1-482\nend\n");
  assert.equal(api.textFor(fakeButton({ preText: pre, inputs: [fakeInput("XXX", " 4 8;2 ")] })), "hostname R1-482\nend\n");
  assert.equal(api.textFor(fakeButton({ preText: pre, inputs: [fakeInput("XXX", "")] })), "hostname R1-XXX\nend\n");
  assert.equal(api.textFor(fakeButton({ preText: pre })), "hostname R1-XXX\nend\n");
});

for (const n of RAPS) {
  test(`RAP${n}: cada bloque IOS tiene boton y solo contiene comandos pegables`, () => {
    const html = partial(n);
    const blocks = cmdBlocks(html);
    assert.ok(blocks.length >= 2, "se esperaban bloques de comandos");
    assert.equal((html.match(/class="cmd-block__copy" data-copy-commands>\[ Copiar comandos \]<\/button>/g) || []).length, blocks.length);
    for (const b of blocks) {
      assert.match(b.head, /class="cmd-block__device"/, "cada bloque indica el dispositivo");
      assert.doesNotMatch(b.text, /[^\x20-\x7e\n]/, `caracter no ASCII en: ${b.lines[0]}`);
      assert.doesNotMatch(b.text, /(^|\s)!/, `comentario "!" en: ${b.lines[0]}`);
      assert.doesNotMatch(b.text, /[<>&]/, `marcado HTML dentro del bloque: ${b.lines[0]}`);
      assert.doesNotMatch(b.lines[0], /^\s/, "la primera linea no puede empezar con espacios");
      assert.ok(b.lines.every((l) => l.trim() !== ""), `linea vacia dentro del bloque: ${b.lines[0]}`);
      if (b.lines.includes("configure terminal")) {
        assert.ok(b.lines.indexOf("configure terminal") <= 1, "configure terminal debe ir al inicio");
        assert.equal(b.lines[b.lines.length - 1], "write memory", "un bloque de configuracion termina guardando");
      }
    }
  });

  test(`RAP${n}: los botones de un comando copian exactamente el comando mostrado`, () => {
    const html = partial(n);
    const total = (html.match(/class="cmd-copy-one"/g) || []).length;
    const pairs = [...html.matchAll(/<code>([^<]*)<\/code><button type="button" class="cmd-copy-one" data-copy-commands data-copy-text="([^"]*)">Copiar<\/button>/g)];
    assert.ok(total > 0);
    assert.equal(pairs.length, total, "cada boton Copiar va justo despues de su <code>");
    for (const [, shown, copied] of pairs) assert.equal(copied, shown);
  });
}

test("RAP02 3.4.1: bloques completos para R1, S1 y S2 con la tabla de direccionamiento", () => {
  const html = partial("02");
  const r1 = blockFor(html, "R1-XXX &mdash; CLI del router");
  for (const cmd of ["enable", "hostname R1-XXX", "enable secret cisco123", "interface GigabitEthernet0/0/0", " ip address 192.168.1.1 255.255.255.0", "interface GigabitEthernet0/0/1", " ip address 192.168.2.1 255.255.255.0", " no shutdown"]) {
    assert.ok(r1.lines.includes(cmd), `R1 sin "${cmd}"`);
  }
  const s1 = blockFor(html, "S1-XXX &mdash; CLI del switch");
  assert.ok(s1.lines.includes(" ip address 192.168.1.2 255.255.255.0") && s1.lines.includes("ip default-gateway 192.168.1.1"));
  const s2 = blockFor(html, "S2-XXX &mdash; CLI del switch");
  assert.ok(s2.lines.includes("hostname S2-XXX"));
  assert.ok(s2.lines.includes(" ip address 192.168.2.2 255.255.255.0") && s2.lines.includes("ip default-gateway 192.168.2.1"));
  assert.match(html, /data-cmd-var="XXX"/);
});

test("RAP02 3.4.2: ISP, DHCP y NAT completos y en el orden que exige IOS", () => {
  const html = partial("02");
  const isp = blockFor(html, "ISP &mdash; CLI del router");
  assert.ok(isp.lines.includes(" ip address 200.15.10.2 255.255.255.252") && isp.lines.includes(" no shutdown"));
  const r1 = blockFor(html, "R1-CoopAndes &mdash; CLI del router");
  assert.ok(r1.lines.includes(" ip address 192.168.20.1 255.255.255.0") && r1.lines.includes(" ip address 200.15.10.1 255.255.255.252"));
  const s1 = blockFor(html, "S1-CoopAndes &mdash; CLI del switch");
  assert.ok(s1.lines.includes("ip default-gateway 192.168.20.1"));

  const dhcp = cmdBlocks(html).find((b) => b.lines.includes("ip dhcp pool VISITANTES"));
  assert.ok(dhcp, "falta el bloque DHCP");
  const lastExcluded = Math.max(...dhcp.lines.map((l, i) => (l.startsWith("ip dhcp excluded-address") ? i : -1)));
  assert.ok(lastExcluded >= 0 && lastExcluded < dhcp.lines.indexOf("ip dhcp pool VISITANTES"), "las exclusiones van antes del pool");

  const nat = cmdBlocks(html).find((b) => b.lines.some((l) => l.startsWith("ip nat inside source")));
  assert.ok(nat, "falta el bloque NAT");
  assert.ok(nat.lines.indexOf("access-list 1 permit 192.168.20.0 0.0.0.255") < nat.lines.findIndex((l) => l.startsWith("ip nat inside source list 1")));
  assert.ok(nat.lines.includes(" ip nat inside") && nat.lines.includes(" ip nat outside"));

  // El AP del laboratorio es un WRT300N: su DHCP propio debe apagarse.
  assert.match(html, /DHCP Server: Disabled/);
});

test("RAP01 Lab 3: gateway 192.168.20.1 para ambos modelos de router y apoyo de fibra/Wi-Fi", () => {
  const html = partial("01");
  const lab3 = html.slice(html.indexOf("<!-- LAB 3 -->"));
  const r4321 = blockFor(lab3, "Router 4321");
  const r2911 = blockFor(lab3, "Router 2911");
  assert.ok(r4321.lines.includes("interface GigabitEthernet0/0/0") && r2911.lines.includes("interface GigabitEthernet0/0"));
  for (const b of [r4321, r2911]) assert.ok(b.lines.includes(" ip address 192.168.20.1 255.255.255.0") && b.lines.includes(" no shutdown"));
  assert.match(lab3, /PT-SWITCH-NM-1FGE/);
  assert.match(lab3, /WPC300N/);
  const between = html.slice(html.indexOf("<!-- LAB 2 -->"), html.indexOf("<!-- LAB 3 -->"));
  assert.doesNotMatch(between, /data-ignore-progress/);
});

test("RAP03: bloque de extraccion de datos sin enable dentro y con terminal length 0 primero", () => {
  const html = partial("03");
  const blocks = cmdBlocks(html);
  assert.equal(blocks.length, 2);
  for (const b of blocks) {
    assert.equal(b.lines[0], "terminal length 0");
    assert.ok(!b.lines.includes("enable"), "enable pegado se come la linea siguiente como contrasena");
    assert.ok(b.lines.includes("show version") && b.lines.includes("show running-config"));
  }
  assert.match(html, /data-copy-text="ipconfig \/all"/);
});

// El bloque de apoyo de RAP03 llego a listar solo 8 pruebas (faltaban el tracert
// y el telnet) mientras la Plantilla 3, la exportacion a Word y el laboratorio
// de origen (RAP02) tienen 10. Las cuatro fuentes deben coincidir prueba a prueba.
test("RAP03: el bloque de apoyo lista las mismas 10 pruebas que la Plantilla 3, RAP02 y el Word", () => {
  const { api } = loadCopyCommands();
  const rap03 = partial("03");
  const asList = (rows) => rows.map((r) => `${r.pc}: ${r.cmd}`);

  const plantilla = [...rap03.matchAll(/<label><span>(\d+)\. (PC\d): ([a-z]+ [0-9.]+) \([^<]*\)<\/span><textarea[^>]*data-store="g5r_p3_r(\d+)"/g)]
    .map((m) => ({ n: Number(m[1]), pc: m[2], cmd: m[3], field: Number(m[4]) }));
  assert.equal(plantilla.length, 10, "la Plantilla 3 tiene 10 campos");
  plantilla.forEach((r, i) => assert.ok(r.n === i + 1 && r.field === i + 1, `campo ${i + 1} fuera de orden`));

  const start = rap03.indexOf("<strong>Pruebas de la Plantilla 3</strong>");
  assert.ok(start > 0, "falta la lista de pruebas en el bloque de apoyo");
  const lista = rap03.slice(start, rap03.indexOf("</ol>", start));
  assert.ok(start > rap03.indexOf('class="info-box cmd-scope cmd-box"') && start < rap03.indexOf('activity-num">3.3.2.1'), "la lista vive en el bloque de apoyo");
  const apoyo = [...lista.matchAll(/<li><strong>(PC\d)<\/strong>: <code>([^<]+)<\/code><button type="button" class="cmd-copy-one" data-copy-commands data-copy-text="([^"]+)">Copiar<\/button>/g)]
    .map((m) => ({ pc: m[1], cmd: m[2], copy: m[3] }));
  assert.equal((lista.match(/<li>/g) || []).length, 10, "10 elementos en la lista");
  assert.equal(apoyo.length, 10, "10 pruebas con boton Copiar");
  assert.deepEqual(asList(apoyo), asList(plantilla), "mismo dispositivo y comando, en el mismo orden");
  assert.ok(apoyo.some((r) => r.pc === "PC0" && r.cmd === "tracert 192.168.2.13"));
  assert.ok(apoyo.some((r) => r.pc === "PC4" && r.cmd === "telnet 192.168.1.1"));

  for (const r of apoyo) {
    const button = fakeButton({ copyText: r.copy });
    assert.equal(api.textFor(button), r.cmd, `Copiar de ${r.pc} debe copiar solo "${r.cmd}"`);
  }

  const origen = [...partial("02").matchAll(/<tr><td>(\d+)<\/td><td>(PC\d): <code>([^<]+)<\/code><button[^>]*data-copy-text="([^"]+)"/g)]
    .map((m) => ({ pc: m[2], cmd: m[3] }));
  assert.deepEqual(asList(origen), asList(plantilla), "coinciden con las 10 pruebas del laboratorio de RAP02");

  const declarations = read("js/guide_declarations.js");
  const word = [...declarations.matchAll(/label: "(\d+)\. (PC\d): ([a-z]+ [0-9.]+) \([^"]*\)", storeKey: "g5r_p3_r(\d+)"/g)]
    .map((m) => ({ pc: m[2], cmd: m[3] }));
  assert.equal(word.length, 20, "2 registros (Santa Barbara y Kennedy) x 10 secciones de Word");
  assert.deepEqual(asList(word.slice(0, 10)), asList(plantilla));
  assert.deepEqual(asList(word.slice(10)), asList(plantilla));

  // La nota de telnet usa las credenciales que ya define el laboratorio de RAP02.
  const telnetItem = lista.slice(lista.indexOf("telnet 192.168.1.1"));
  const r1 = blockFor(partial("02"), "R1-XXX &mdash; CLI del router");
  const vty = r1.lines.indexOf("line vty 0 4");
  assert.equal(r1.lines[vty + 1], " password cisco");
  assert.ok(r1.lines.includes("enable secret cisco123"));
  for (const token of ["<code>cisco</code>", "<code>enable</code>", "<code>cisco123</code>", "<code>exit</code>"]) {
    assert.ok(telnetItem.includes(token), `la nota de telnet debe indicar ${token}`);
  }
});

test("Router y paginas de las 12 guias de redes cargan el script y el bundle regenerado", () => {
  const router = read("js/guia_router.js");
  const entries = [...router.matchAll(/"partials\/guia-redes-rap0([123])-bundle\.js\?v=([0-9_]+)",\s*\n\s*"js\/guide_copy_commands\.js\?v=([0-9_]+)"/g)];
  assert.equal(entries.length, 12);
  assert.equal((router.match(/guia-redes-rap0[123]-bundle\.js/g) || []).length, 12);
  const version = entries[0][3];
  assert.ok(fs.existsSync(path.join(ROOT, "js/guide_copy_commands.js")));

  const shells = fs.readdirSync(path.join(ROOT, "pages/guias")).filter((f) => /redes-rap0[123]\.html$/.test(f));
  assert.equal(shells.length, 12);
  for (const f of shells) {
    const html = read(`pages/guias/${f}`);
    assert.match(html, new RegExp(`<script defer src="js/guide_copy_commands\\.js\\?v=${version}"></script>`), f);
  }

  for (const n of RAPS) {
    const src = `partials/guia-redes-rap${n}-content.html`;
    const ctx = {};
    ctx.window = ctx;
    vm.runInNewContext(read(`partials/guia-redes-rap${n}-bundle.js`), ctx);
    assert.ok(ctx.__PAGE_RUNTIME_PARTIALS__[src] === partial(n), `bundle RAP${n} desactualizado: regeneralo desde ${src}`);
  }
});
