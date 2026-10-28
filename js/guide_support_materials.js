/* js/guide_support_materials.js
 *
 * Material de apoyo alojado en Google Drive para las guias que se cargan con
 * guide_runtime_loader.js (Redes RAP01/02/03 en las seis fichas).
 *
 * Contexto (auditoria 2026-10-22): la seccion "Material de Apoyo" de Redes
 * RAP01 pintaba tarjetas sin enlace (file: "") y RAP02/RAP03 no tenian la
 * seccion, aunque el material real existe en Drive
 * (Portal_SENA_Material_Apoyo/10_Redes_Grado11, publico). El catalogo vive en
 * data/guide_support_materials.js; este modulo solo lo presenta.
 *
 * - Filtra por ficha: un recurso con audience = ["3168850", ...] solo se
 *   muestra a esas fichas; "all" se muestra a todas.
 * - Si la guia ya tiene #material-apoyo, agrega el bloque dentro de esa
 *   tarjeta; si no, crea la seccion antes de "Glosario"/"Referentes" (o al
 *   final del contenido). Idempotente: no duplica si se monta dos veces.
 * - Sin lecturas a Firestore: solo HTML local y enlaces /view de Drive.
 */
(function () {
  "use strict";

  var BLOCK_ATTR = "data-guide-support-materials";
  var TYPE_ICON = { pdf: "&#128214;", docx: "&#128196;", pptx: "&#128202;", pka: "&#127918;", xlsx: "&#128202;" };
  var TYPE_LABEL = { pdf: "PDF", docx: "Word", pptx: "Presentación", pka: "Actividad Packet Tracer", xlsx: "Excel" };

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function driveViewUrl(id) {
    return "https://drive.google.com/file/d/" + encodeURIComponent(id) + "/view?usp=sharing";
  }

  function resolveFicha(context) {
    if (context && context.ficha) return String(context.ficha);
    try {
      var auth = window.portalAuth;
      var user = auth && typeof auth.getCurrentUser === "function" ? auth.getCurrentUser() : null;
      var ficha = user && user.ficha;
      if (ficha) return String(ficha);
    } catch (e) {}
    return "";
  }

  function visibleFor(item, ficha) {
    if (!item || !item.driveId) return false;
    if (item.audience === "all" || item.audience == null) return true;
    return Array.isArray(item.audience) && ficha !== "" && item.audience.indexOf(ficha) !== -1;
  }

  function groupsFor(template, ficha) {
    var catalog = window.__GUIDE_SUPPORT_MATERIALS__;
    var groups = catalog && catalog.templates && catalog.templates[template];
    if (!Array.isArray(groups)) return [];
    return groups
      .map(function (g) {
        // rightsPending: material de terceros sin derechos verificados; no se publica (candidata 2026-10-28).
        return { group: g.group, items: (g.items || []).filter(function (it) { return !it.rightsPending && visibleFor(it, ficha); }) };
      })
      .filter(function (g) { return g.items.length > 0; });
  }

  function renderItem(item) {
    var type = String(item.type || "").toLowerCase();
    var note = item.note ? '<p class="resource-meta">' + escapeHtml(item.note) + "</p>" : "";
    return (
      '<div class="resource-card">' +
        '<span class="resource-icon">' + (TYPE_ICON[type] || "&#128206;") + "</span>" +
        '<div class="resource-info">' +
          "<strong>" + escapeHtml(item.title) + "</strong>" +
          "<p>" + escapeHtml(TYPE_LABEL[type] || type.toUpperCase()) + " · " + escapeHtml(item.file) + "</p>" +
          note +
          '<a href="' + escapeHtml(driveViewUrl(item.driveId)) + '" target="_blank" rel="noopener noreferrer">Abrir en Drive &#8599;</a>' +
        "</div>" +
      "</div>"
    );
  }

  function renderGroups(groups) {
    return groups.map(function (g) {
      return '<div class="material-heading">' + escapeHtml(g.group) + "</div>" +
        '<div class="resource-grid">' + g.items.map(renderItem).join("") + "</div>";
    }).join("");
  }

  function buildSection(innerHtml) {
    var wrap = document.createElement("div");
    wrap.innerHTML =
      '<div id="material-apoyo" class="section-title">Material de Apoyo</div>' +
      '<div class="card open">' +
        '<div class="card-header" onclick="toggleCard(this.parentElement)">' +
          '<div class="card-header-left">' +
            '<div class="card-icon" style="background:#e8f0fe">&#128194;</div>' +
            "<div><h3>Material de Apoyo y Recursos</h3><p>Documentos de consulta, laboratorios y recursos en Drive para esta gu&iacute;a</p></div>" +
          "</div>" +
          '<span class="card-toggle">&#9662;</span>' +
        "</div>" +
        '<div class="card-body">' + innerHtml + "</div>" +
      "</div>";
    return wrap;
  }

  function mount(root, context) {
    root = root || document.getElementById("page-root") || document.body;
    if (!root || !context || !context.template) return 0;
    if (root.querySelector("[" + BLOCK_ATTR + "]")) return 0;
    var groups = groupsFor(context.template, resolveFicha(context));
    if (!groups.length) return 0;
    var count = groups.reduce(function (n, g) { return n + g.items.length; }, 0);
    var block = document.createElement("div");
    block.setAttribute(BLOCK_ATTR, context.template);
    block.innerHTML = '<div class="material-heading">Material de apoyo en Drive</div>' + renderGroups(groups);

    var existing = root.querySelector("#material-apoyo");
    var existingBody = existing && existing.nextElementSibling && existing.nextElementSibling.querySelector(".card-body");
    if (existingBody) {
      existingBody.insertBefore(block, existingBody.firstChild);
      return count;
    }
    var section = buildSection("");
    section.querySelector(".card-body").appendChild(block);
    var before = root.querySelector("#glosario") || root.querySelector("#referencias");
    var parent = before ? before.parentNode : (root.querySelector(".content") || root);
    while (section.firstChild) parent.insertBefore(section.firstChild, before || null);
    return count;
  }

  window.GuideSupportMaterials = { mount: mount, groupsFor: groupsFor, driveViewUrl: driveViewUrl };
})();
