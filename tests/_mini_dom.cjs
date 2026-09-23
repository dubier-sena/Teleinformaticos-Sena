// DOM minimo (sin jsdom) para ejecutar scripts REALES del portal que construyen
// HTML con innerHTML y luego lo recorren con querySelector/All.
// Soporta: parseo de etiquetas/atributos/texto, selectores compuestos
// (tag, .clase, #id, [attr], [attr="valor"]) con combinador descendiente,
// getElementById, style, classList, get/set/removeAttribute, eventos basicos.
"use strict";

const VOID_TAGS = new Set(["img", "br", "hr", "input", "meta", "link", "source"]);

function decodeEntities(text) {
  return String(text)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&times;/g, "×")
    .replace(/&amp;/g, "&");
}

class MiniText {
  constructor(text) {
    this.nodeType = 3;
    this.textContent = decodeEntities(text);
    this.parentNode = null;
  }
}

class MiniElement {
  constructor(tagName, ownerDocument) {
    this.nodeType = 1;
    this.tagName = String(tagName).toUpperCase();
    this.ownerDocument = ownerDocument;
    this.attributes = {};
    this.childNodes = [];
    this.parentNode = null;
    this.style = { display: "", setProperty() {}, removeProperty() {} };
    this.listeners = {};
    this.hidden = false;
    const self = this;
    this.classList = {
      add(...names) { self._setClasses(self._classes().concat(names)); },
      remove(...names) { self._setClasses(self._classes().filter((c) => !names.includes(c))); },
      contains(name) { return self._classes().includes(name); },
      toggle(name, force) {
        const has = self._classes().includes(name);
        const want = force === undefined ? !has : !!force;
        if (want && !has) this.add(name);
        if (!want && has) this.remove(name);
        return want;
      },
    };
  }
  _classes() { return String(this.attributes.class || "").split(/\s+/).filter(Boolean); }
  _setClasses(list) { this.attributes.class = Array.from(new Set(list)).join(" "); }
  get className() { return this.attributes.class || ""; }
  set className(value) { this.attributes.class = String(value); }
  get id() { return this.attributes.id || ""; }
  set id(value) { this.attributes.id = String(value); }
  get children() { return this.childNodes.filter((n) => n.nodeType === 1); }
  get firstElementChild() { return this.children[0] || null; }
  get firstChild() { return this.childNodes[0] || null; }
  get textContent() {
    return this.childNodes.map((n) => n.textContent).join("");
  }
  set textContent(value) {
    this.childNodes = [];
    if (value !== "" && value != null) this.appendChild(new MiniText(String(value)));
  }
  get innerHTML() { return this._innerHTML || ""; }
  set innerHTML(html) {
    this._innerHTML = String(html);
    this.childNodes = [];
    parseInto(this, String(html), this.ownerDocument);
  }
  getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  removeAttribute(name) { delete this.attributes[name]; }
  hasAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name); }
  appendChild(node) {
    if (node.parentNode) node.parentNode.removeChild(node);
    node.parentNode = this;
    this.childNodes.push(node);
    return node;
  }
  insertBefore(node, ref) {
    if (node.parentNode) node.parentNode.removeChild(node);
    node.parentNode = this;
    const index = ref ? this.childNodes.indexOf(ref) : -1;
    if (index < 0) this.childNodes.push(node); else this.childNodes.splice(index, 0, node);
    return node;
  }
  removeChild(node) {
    this.childNodes = this.childNodes.filter((n) => n !== node);
    node.parentNode = null;
    return node;
  }
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
  removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter((f) => f !== fn); }
  dispatch(type, extra) {
    const event = Object.assign({ type, target: this, preventDefault() {}, stopPropagation() {} }, extra || {});
    (this.listeners[type] || []).slice().forEach((fn) => fn.call(this, event));
    return event;
  }
  click() { this.dispatch("click"); }
  focus() { this.ownerDocument.activeElement = this; }
  select() {}
  setSelectionRange() {}
  descendants() {
    const out = [];
    const walk = (node) => {
      node.children.forEach((child) => { out.push(child); walk(child); });
    };
    walk(this);
    return out;
  }
  querySelectorAll(selector) { return queryAll(this, selector); }
  querySelector(selector) { return queryAll(this, selector)[0] || null; }
  closest(selector) {
    let node = this;
    while (node && node.nodeType === 1) {
      if (matchesSelector(node, selector)) return node;
      node = node.parentNode;
    }
    return null;
  }
  contains(node) {
    while (node) { if (node === this) return true; node = node.parentNode; }
    return false;
  }
}

function parseAttributes(source) {
  const attrs = {};
  const re = /([^\s=/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m;
  while ((m = re.exec(source))) {
    const value = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : "";
    attrs[m[1]] = decodeEntities(value);
  }
  return attrs;
}

function parseInto(root, html, doc) {
  const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+)/g;
  const stack = [root];
  let m;
  while ((m = re.exec(html))) {
    const current = stack[stack.length - 1];
    if (m[0].startsWith("<!--")) continue;
    if (m[4] !== undefined) {
      if (m[4].trim()) current.appendChild(new MiniText(m[4]));
      continue;
    }
    const closing = m[1] === "/";
    const tag = m[2].toLowerCase();
    if (closing) {
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tagName === tag.toUpperCase()) { stack.length = i; break; }
      }
      continue;
    }
    const el = new MiniElement(tag, doc);
    const rawAttrs = m[3] || "";
    el.attributes = parseAttributes(rawAttrs.replace(/\/\s*$/, ""));
    if (Object.prototype.hasOwnProperty.call(el.attributes, "hidden")) el.hidden = true;
    const styleAttr = el.attributes.style || "";
    const display = styleAttr.match(/display\s*:\s*([a-z-]+)/i);
    if (display) el.style.display = display[1];
    current.appendChild(el);
    if (!VOID_TAGS.has(tag) && !/\/\s*$/.test(rawAttrs)) stack.push(el);
  }
}

function matchesCompound(el, compound) {
  const re = /([a-zA-Z][a-zA-Z0-9-]*)|\.([\w-]+)|#([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]/g;
  let m;
  let consumed = 0;
  while ((m = re.exec(compound))) {
    consumed += m[0].length;
    if (m[1] && el.tagName !== m[1].toUpperCase()) return false;
    if (m[2] && !el.classList.contains(m[2])) return false;
    if (m[3] && el.id !== m[3]) return false;
    if (m[4]) {
      if (!el.hasAttribute(m[4])) return false;
      if (m[5] !== undefined && el.getAttribute(m[4]) !== m[5]) return false;
    }
  }
  if (consumed !== compound.length) throw new Error("mini_dom: selector no soportado: " + compound);
  return true;
}

function matchesSelector(el, selector) {
  return selector.split(",").some((part) => {
    const chain = part.trim().split(/\s+/);
    if (!matchesCompound(el, chain[chain.length - 1])) return false;
    let node = el.parentNode;
    for (let i = chain.length - 2; i >= 0; i--) {
      while (node && node.nodeType === 1 && !matchesCompound(node, chain[i])) node = node.parentNode;
      if (!node || node.nodeType !== 1) return false;
      node = node.parentNode;
    }
    return true;
  });
}

function queryAll(root, selector) {
  return root.descendants().filter((el) => matchesSelector(el, selector));
}

function createDocument() {
  const doc = {
    readyState: "complete",
    listeners: {},
    activeElement: null,
    createElement(tag) { return new MiniElement(tag, doc); },
    createRange() { return { selectNodeContents() {} }; },
    getElementById(id) { return doc.documentElement.descendants().find((el) => el.id === id) || null; },
    querySelectorAll(selector) { return queryAll(doc.documentElement, selector); },
    querySelector(selector) { return queryAll(doc.documentElement, selector)[0] || null; },
    addEventListener(type, fn) { (doc.listeners[type] = doc.listeners[type] || []).push(fn); },
    removeEventListener(type, fn) { doc.listeners[type] = (doc.listeners[type] || []).filter((f) => f !== fn); },
    dispatchEvent(event) { (doc.listeners[event.type] || []).slice().forEach((fn) => fn(event)); },
    execCommand() { return false; },
  };
  doc.documentElement = new MiniElement("html", doc);
  doc.head = doc.documentElement.appendChild(new MiniElement("head", doc));
  doc.body = doc.documentElement.appendChild(new MiniElement("body", doc));
  return doc;
}

function isRendered(el) {
  let node = el;
  while (node && node.nodeType === 1) {
    if (node.style.display === "none" || node.hidden) return false;
    node = node.parentNode;
  }
  return true;
}

module.exports = { createDocument, MiniElement, isRendered };
