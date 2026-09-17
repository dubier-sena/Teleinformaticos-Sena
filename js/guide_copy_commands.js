/* js/guide_copy_commands.js
 *
 * Bloques de comandos copiables para los laboratorios de Cisco Packet Tracer
 * de las guias de Redes (RAP01, RAP02, RAP03).
 *
 * Por que existe (revision de laboratorios, sep-2026): los comandos Cisco IOS
 * estaban en bloques <pre> sin boton de copiar, mezclados con comentarios
 * ("! ...") que la CLI no acepta pegados en la misma linea, y sin indicar en
 * que dispositivo se ejecutaba cada bloque. El aprendiz los tenia que teclear
 * a mano (con errores) o copiar a mano incluyendo texto que no es comando.
 *
 * Marcado que atiende (el contenido vive en los partials de cada guia):
 *
 *   Bloque IOS (varias lineas, se pega de una vez en la CLI del dispositivo):
 *     <div class="cmd-block" data-cmd-block>
 *       <div class="cmd-block__head">
 *         <span class="cmd-block__device">R1 — CLI</span>
 *         <button type="button" class="cmd-block__copy" data-copy-commands>[ Copiar comandos ]</button>
 *       </div>
 *       <pre class="cmd-block__code">enable
 *   configure terminal
 *   ...</pre>
 *     </div>
 *
 *   Comando unico (Command Prompt de un PC, que ejecuta un comando a la vez):
 *     <button type="button" class="cmd-copy-one" data-copy-commands data-copy-text="ping 192.168.1.1">Copiar</button>
 *
 * Lo copiado es EXACTAMENTE el texto del <pre> (o de data-copy-text): solo
 * comandos. Al bloque IOS se le agrega un salto de linea final para que, al
 * pegarlo en la CLI, tambien se ejecute la ultima linea.
 *
 * Funciona con contenido inyectado despues de cargar la pagina (los partials
 * llegan por guide_runtime_loader.js): escucha los clics en `document`.
 */
(function () {
  "use strict";

  if (typeof window === "undefined" || window.GuideCopyCommands) return;

  var STYLE_ID = "guide-copy-commands-style";
  var CSS = [
    ".cmd-block{border:1px solid #c5cae9;border-radius:10px;overflow:hidden;margin:10px 0;background:#fff}",
    ".cmd-block__head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;background:#e8eaf6;border-bottom:1px solid #c5cae9}",
    ".cmd-block__device{font-weight:700;font-size:.84rem;color:#1a237e}",
    ".cmd-block__device small{display:block;font-weight:500;color:#3949ab;font-size:.76rem}",
    ".cmd-block__copy,.cmd-copy-one{font:inherit;font-size:.8rem;font-weight:700;cursor:pointer;border-radius:8px;border:1.5px solid #1565c0;background:#e3f2fd;color:#1565c0;padding:6px 12px;min-height:34px}",
    ".cmd-copy-one{padding:2px 8px;min-height:28px;font-size:.74rem;margin-left:6px;vertical-align:middle}",
    ".cmd-block__copy:hover,.cmd-copy-one:hover{background:#bbdefb}",
    ".cmd-block__copy:focus-visible,.cmd-copy-one:focus-visible{outline:3px solid #ffb300;outline-offset:2px}",
    ".cmd-block__copy.is-copied,.cmd-copy-one.is-copied{background:#e8f5e9;border-color:#2e7d32;color:#1b5e20}",
    ".cmd-block__copy.is-failed,.cmd-copy-one.is-failed{background:#ffebee;border-color:#c62828;color:#b71c1c}",
    ".cmd-block__code{margin:0;background:#1a237e;color:#e8eaf6;padding:12px 14px;font-size:.82rem;line-height:1.5;overflow-x:auto;white-space:pre}",
    ".cmd-block__note{margin:0;padding:8px 12px;font-size:.8rem;color:#37474f;background:#fafafa;border-top:1px solid #e0e0e0}",
    ".cmd-steps{margin:8px 0;padding-left:1.2rem;font-size:.86rem;line-height:1.7}",
    // Clases de maquetacion de los bloques de apoyo (en vez de style="..." inline,
    // que el trinquete CSP de tests/csp_hardening.test.cjs no deja aumentar).
    ".cmd-steps--disc{list-style:disc}",
    ".cmd-card{margin-top:12px}",
    ".cmd-box{margin:14px 0}",
    ".cmd-lead{margin:0 0 6px;font-size:.88rem}",
    ".cmd-lead--gap{margin-top:12px}",
    ".cmd-h4{margin:14px 0 6px;color:#1e3a8a;font-size:.95rem}",
    ".cmd-hint{margin:6px 0 0;font-size:.8rem;color:#475569}",
  ].join("\n");

  function injectStyles() {
    if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  /**
   * Variables del laboratorio: un <input data-cmd-var="XXX"> dentro del mismo
   * [data-cmd-scope] reemplaza ese marcador AL COPIAR (el bloque en pantalla
   * sigue mostrando "XXX", tal como lo pide la guia). Asi `hostname R1-XXX`
   * se pega ya con los digitos del aprendiz. Solo letras, numeros y guion.
   */
  function applyVars(text, button) {
    var scope = button.closest ? button.closest("[data-cmd-scope]") : null;
    if (!scope) return text;
    var inputs = scope.querySelectorAll("input[data-cmd-var]");
    Array.prototype.forEach.call(inputs, function (input) {
      var token = String(input.getAttribute("data-cmd-var") || "");
      var value = String(input.value || "").trim().replace(/[^A-Za-z0-9-]/g, "");
      if (token && value) text = text.split(token).join(value);
    });
    return text;
  }

  /** Texto a copiar para un boton. */
  function textFor(button) {
    if (!button) return "";
    if (button.hasAttribute && button.hasAttribute("data-copy-text")) {
      return applyVars(String(button.getAttribute("data-copy-text") || ""), button);
    }
    var block = button.closest ? button.closest("[data-cmd-block]") : null;
    var pre = block ? block.querySelector("pre") : null;
    if (!pre) return "";
    var text = String(pre.textContent || "").replace(/\r\n?/g, "\n");
    // Sin espacios sobrantes al final de cada linea ni lineas vacias al final;
    // un unico salto final para que la CLI ejecute la ultima linea.
    text = text.split("\n").map(function (line) { return line.replace(/[ \t]+$/, ""); }).join("\n").replace(/\n+$/, "");
    return text ? applyVars(text, button) + "\n" : "";
  }

  function fallbackCopy(text) {
    var area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (err) { ok = false; }
    document.body.removeChild(area);
    return ok;
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallbackCopy(text); });
    }
    return Promise.resolve(fallbackCopy(text));
  }

  function showResult(button, ok) {
    if (!button.getAttribute("data-label")) button.setAttribute("data-label", button.textContent);
    var label = button.getAttribute("data-label");
    button.classList.remove("is-copied", "is-failed");
    button.classList.add(ok ? "is-copied" : "is-failed");
    button.textContent = ok ? "✓ Copiado" : "No se pudo copiar: selecciona el texto";
    clearTimeout(button.__copyTimer);
    button.__copyTimer = setTimeout(function () {
      button.classList.remove("is-copied", "is-failed");
      button.textContent = label;
    }, 1800);
  }

  function onClick(event) {
    var target = event.target;
    var button = target && target.closest ? target.closest("[data-copy-commands]") : null;
    if (!button) return;
    event.preventDefault();
    var text = textFor(button);
    if (!text) return;
    copyText(text).then(function (ok) { showResult(button, ok); });
  }

  window.GuideCopyCommands = { textFor: textFor };

  if (typeof document !== "undefined") {
    injectStyles();
    document.addEventListener("click", onClick);
  }
})();
