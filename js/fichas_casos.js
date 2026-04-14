/**
 * fichas_casos.js – Fichas de caso para Actividad 3.2 / ACTIVIDAD 4
 * Asignación aleatoria determinista por aprendiz.
 * v=20260414_1
 */

(function () {
  "use strict";

  /* ─── Datos de las fichas ─────────────────────────────────────────── */
  const FICHAS = [
    {
      id: 1,
      titulo: "FICHA DE CASO N.° 01",
      nombre: "Tienda Don Ramiro",
      ubicacion: "Puerto Boyacá, Boyacá – Zona urbana del Magdalena Medio",
      color: "#2563eb",
      colorLight: "#eff6ff",
      emoji: "🏪",
      actor: "Ramiro Gómez (50 años) – tendero y propietario",
      municipio: "Puerto Boyacá",
      actividad:
        "Venta al detal de abarrotes, productos del hogar y artículos de ferretería menor",
      descripcion:
        "Don Ramiro tiene su tienda hace 18 años en el centro de Puerto Boyacá. Atiende a unas 80 personas por día, acepta pagos en efectivo y, desde hace 1 año, también con Nequi. Tiene un computador portátil que compró para que sus hijos estudiaran, pero él casi no lo usa. Sus registros de ventas y cuentas por cobrar los lleva en cuadernos de papel, y dice que «con eso le ha funcionado toda la vida». Sin embargo, en los últimos meses ha tenido problemas: dos veces olvidó registrar deudas de clientes y perdió dinero, no sabe cuánto vende exactamente cada semana, y cuando el banco le pidió un reporte de ingresos para un crédito, no supo cómo presentarlo. Su hijo le sugirió «poner todo en el computador», pero Don Ramiro no sabe por dónde empezar.",
      usa: [
        "Nequi (pagos móviles básicos)",
        "WhatsApp (mensajes con proveedores)",
        "Llamadas telefónicas",
        "Cuadernos de papel para cuentas",
      ],
      desconoce: [
        "Microsoft Excel o LibreOffice Calc",
        "Google Drive o almacenamiento en la nube",
        "Correo electrónico profesional",
        "Formularios de Google para inventarios",
        "Copias de seguridad de información",
        "Facturación electrónica básica",
      ],
      problemas: [
        "Pérdida de información financiera por registros solo en papel (cuadernos que se dañan o pierden).",
        "Imposibilidad de generar reportes de ventas para acceder a créditos o hacer seguimiento del negocio.",
        "No tiene copia de seguridad de ningún tipo — si el cuaderno se pierde, se pierde todo.",
        "Dificultad para comunicarse con proveedores de manera formal (solo WhatsApp informal).",
        "Desconoce que las herramientas que necesita son gratuitas y accesibles desde su celular o computador.",
      ],
      preguntas: [
        "¿Qué herramienta digital usarías para que Don Ramiro lleve el control de sus ventas diarias? ¿Por qué esa y no otra?",
        "¿Cómo le explicarías a Don Ramiro qué es «guardar en la nube» de manera que lo entienda sin formación técnica?",
        "¿Qué herramienta le recomendarías para que pueda presentar un reporte de ingresos al banco? ¿Cómo la configuraría?",
        "¿Cuál es la primera herramienta que le enseñarías a usar y cuántas sesiones necesitarías para que la domine básicamente?",
      ],
    },
    {
      id: 2,
      titulo: "FICHA DE CASO N.° 02",
      nombre: "Cultivo Familiar La Esperanza",
      ubicacion: "Otanche, Boyacá – Zona rural del Occidente de Boyacá",
      color: "#16a34a",
      colorLight: "#f0fdf4",
      emoji: "🌱",
      actor: "Familia Rincón – agricultores (padre 48 años, hija 22 años)",
      municipio: "Otanche",
      actividad:
        "Cultivo y comercialización de cacao, plátano y yuca – producción familiar de 3 hectáreas",
      descripcion:
        "La familia Rincón lleva tres generaciones cultivando cacao en Otanche. El señor Héctor Rincón se encarga del trabajo en el campo y su hija Valentina, quien estudió hasta el bachillerato, ayuda con las ventas y la comunicación con compradores. Venden su cacao a un intermediario que paga precios bajos, pero no saben cómo contactar directamente a las cooperativas o empresas chocolateras de la región. Valentina tiene smartphone y usa WhatsApp, pero no tiene correo electrónico ni sabe cómo crear uno. El año pasado, el SENA ofreció capacitación sobre registro de predios agrícolas en una plataforma del Ministerio de Agricultura, pero no pudieron participar porque «eso es muy complicado con computador». El cultivo tiene potencial para vender directamente, pero la familia no tiene visibilidad digital ni documentación organizada de su producción.",
      usa: [
        "WhatsApp (comunicación con familia y un comprador)",
        "Llamadas telefónicas",
        "Registros en papel (cuadernos de cosecha)",
        "Facebook personal (Valentina, uso básico)",
      ],
      desconoce: [
        "Correo electrónico",
        "Google Maps o ubicación del predio",
        "Plataformas del Ministerio de Agricultura (UPRA, AgroNet)",
        "Google Sheets para registrar cosechas y ventas",
        "WhatsApp Business para contacto comercial formal",
        "Canva para crear catálogo básico de productos",
        "Almacenamiento en la nube para documentos del predio",
      ],
      problemas: [
        "No tienen correo electrónico, lo que les impide registrarse en plataformas institucionales o recibir comunicaciones formales.",
        "Sus registros de producción y ventas están en papel y no permiten analizar tendencias ni demostrar capacidad productiva a compradores.",
        "Valentina no sabe cómo usar el computador más allá del celular — la transición es la barrera principal.",
        "No tienen presencia digital, por lo que dependen exclusivamente del intermediario y no pueden acceder a mejores precios.",
        "La familia desconoce que herramientas gratuitas como WhatsApp Business o Google Sheets podrían transformar su negocio.",
      ],
      preguntas: [
        "¿Por cuál herramienta empezarías: el correo electrónico o WhatsApp Business? ¿Por qué esa es la puerta de entrada?",
        "¿Cómo ayudarías a Valentina a llevar el registro de cosechas usando Google Sheets desde su celular?",
        "¿Qué herramienta usarías para que la familia pueda presentar su producción a una cooperativa sin necesidad de ir en persona?",
        "¿Cuáles son los riesgos de ciberseguridad que deberías explicarle a Valentina al darle acceso a plataformas institucionales?",
      ],
    },
    {
      id: 3,
      titulo: "FICHA DE CASO N.° 03",
      nombre: "Artesanías Tejidos de Paz",
      ubicacion: "Pauna, Boyacá – Emprendimiento comunitario del Occidente de Boyacá",
      color: "#9333ea",
      colorLight: "#faf5ff",
      emoji: "🧶",
      actor: "Rosa Ávila (38 años) – líder del grupo de artesanas (8 mujeres)",
      municipio: "Pauna",
      actividad:
        "Confección y venta de artesanías en fique, cerámica pintada y productos tejidos a mano",
      descripcion:
        "Rosa lidera un grupo de 8 mujeres que elaboran artesanías en fique, cerámica pintada y tejidos a mano en Pauna. El emprendimiento nació como proyecto productivo de reintegración social y ha logrado sobrevivir gracias a ventas en ferias locales y pedidos de conocidos. Rosa tiene smartphone y sabe tomar buenas fotos de sus productos con el celular, pero no sabe cómo mostrarlos a más personas. Intentó abrir una cuenta en Instagram pero no sabe cómo escribir textos que vendan ni cómo organizarla. El emprendimiento ganó un apoyo del municipio para participar en una feria artesanal en Chiquinquirá, pero el formulario de inscripción debía enviarse por correo electrónico y Rosa no tenía uno. Lo llenaron a mano y lo enviaron con un vecino. Además, no llevan ningún registro de sus costos ni ganancias, y al final del año no saben si el emprendimiento les genera beneficio real.",
      usa: [
        "WhatsApp (pedidos y comunicación con clientes)",
        "Cámara del celular (fotos de productos)",
        "Facebook personal (publicaciones ocasionales sin estrategia)",
        "Papel para anotar pedidos y algunos costos",
      ],
      desconoce: [
        "Correo electrónico",
        "Google Drive para archivar documentos del emprendimiento",
        "Canva para crear catálogos y publicidad visual",
        "Instagram Business con perfil organizado",
        "Google Sheets para control de costos y ganancias",
        "WhatsApp Business con catálogo de productos",
        "Formularios de Google para recibir pedidos",
        "Plataformas de venta en línea (Etsy, Mercado Libre artesanías)",
      ],
      problemas: [
        "No tienen correo electrónico, lo que les impide participar en convocatorias, ferias y programas de apoyo institucional.",
        "Sin registro de costos y ganancias, no pueden saber si el emprendimiento es rentable ni cuánto cobrar por cada pieza.",
        "Sus fotos de productos son buenas pero no tienen material publicitario organizado para atraer compradores fuera del municipio.",
        "Dependen de ventas presenciales en ferias y no tienen canal digital para recibir pedidos de otras ciudades.",
        "El grupo no tiene ninguna documentación del emprendimiento (ni catálogo, ni lista de precios, ni registro de clientes).",
      ],
      preguntas: [
        "¿Qué herramienta usarías primero para que Rosa pueda participar en convocatorias y ferias sin dificultades técnicas?",
        "¿Cómo le ayudarías a crear un catálogo visual de sus productos usando Canva? ¿Qué necesita tener antes de empezar?",
        "¿Qué hoja de cálculo sencilla diseñarías para que Rosa lleve el control de costos y ganancias de forma autónoma?",
        "¿Qué le recomendarías para ampliar sus ventas más allá de Pauna usando herramientas digitales gratuitas?",
      ],
    },
  ];

  /* ─── Asignación determinista ─────────────────────────────────────── */
  const FICHA_ASIGNADA_KEY = "guia2_ficha_caso_idx"; // 0-based, stored in localStorage

  function hashString(str) {
    // djb2 hash – fast, deterministic, good distribution
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) + h) ^ str.charCodeAt(i);
      h = h >>> 0; // keep unsigned
    }
    return h;
  }

  function getAssignedFichaIdx() {
    // Try to load saved assignment first
    const saved = localStorage.getItem(FICHA_ASIGNADA_KEY);
    if (saved !== null) {
      const idx = parseInt(saved, 10);
      if (idx >= 0 && idx < FICHAS.length) return idx;
    }

    // Derive from username for determinism
    const session = window.portalAuth?.getCurrentSession?.();
    const seed =
      session?.user?.usernameKey ||
      session?.user?.username ||
      session?.usernameKey ||
      "";

    const idx = seed
      ? hashString(seed) % FICHAS.length
      : Math.floor(Math.random() * FICHAS.length);

    localStorage.setItem(FICHA_ASIGNADA_KEY, String(idx));
    return idx;
  }

  /* ─── Renderizado ─────────────────────────────────────────────────── */
  function renderFicha(ficha, container) {
    const usaItems = ficha.usa.map((t) => `<li>${_esc(t)}</li>`).join("");
    const desconoceItems = ficha.desconoce.map((t) => `<li>${_esc(t)}</li>`).join("");
    const problemasItems = ficha.problemas
      .map((t, i) => `<li><strong>${i + 1}.</strong> ${_esc(t)}</li>`)
      .join("");
    const preguntasItems = ficha.preguntas
      .map((t, i) => `<li><strong>${String.fromCharCode(65 + i)})</strong> ${_esc(t)}</li>`)
      .join("");

    container.innerHTML = `
<div class="ficha-caso-card" style="
  border: 2px solid ${ficha.color};
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 20px;
  background: #fff;
  box-shadow: 0 2px 12px rgba(0,0,0,.08);
">
  <!-- Header -->
  <div style="
    background: ${ficha.color};
    color: #fff;
    padding: 14px 18px;
    display: flex;
    align-items: center;
    gap: 12px;
  ">
    <span style="font-size:2rem; line-height:1;">${ficha.emoji}</span>
    <div>
      <div style="font-size:.78rem; font-weight:600; opacity:.85; letter-spacing:.06em; text-transform:uppercase;">${_esc(ficha.titulo)}</div>
      <div style="font-size:1.18rem; font-weight:700; line-height:1.2;">${_esc(ficha.nombre)}</div>
      <div style="font-size:.82rem; opacity:.9; margin-top:2px;">${_esc(ficha.ubicacion)}</div>
    </div>
  </div>

  <!-- Meta info -->
  <div style="
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 0;
    border-bottom: 1px solid ${ficha.color}33;
    background: ${ficha.colorLight};
  ">
    <div style="padding:10px 16px; border-right:1px solid ${ficha.color}22;">
      <div style="font-size:.72rem; font-weight:700; color:${ficha.color}; text-transform:uppercase; margin-bottom:3px;">👤 Actor productivo</div>
      <div style="font-size:.9rem; color:#1e293b;">${_esc(ficha.actor)}</div>
    </div>
    <div style="padding:10px 16px; border-right:1px solid ${ficha.color}22;">
      <div style="font-size:.72rem; font-weight:700; color:${ficha.color}; text-transform:uppercase; margin-bottom:3px;">📍 Municipio</div>
      <div style="font-size:.9rem; color:#1e293b;">${_esc(ficha.municipio)}</div>
    </div>
    <div style="padding:10px 16px;">
      <div style="font-size:.72rem; font-weight:700; color:${ficha.color}; text-transform:uppercase; margin-bottom:3px;">🏭 Actividad económica</div>
      <div style="font-size:.9rem; color:#1e293b;">${_esc(ficha.actividad)}</div>
    </div>
  </div>

  <!-- Descripción -->
  <div style="padding:14px 18px; border-bottom:1px solid #e2e8f0;">
    <div style="font-size:.78rem; font-weight:700; color:${ficha.color}; text-transform:uppercase; margin-bottom:6px;">📋 Descripción de la situación</div>
    <p style="font-size:.92rem; color:#334155; line-height:1.65; margin:0; text-align:justify;">${_esc(ficha.descripcion)}</p>
  </div>

  <!-- Herramientas -->
  <div style="
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
    border-bottom: 1px solid #e2e8f0;
  ">
    <div style="padding:12px 16px; background:#f0fdf4; border-right:1px solid #e2e8f0;">
      <div style="font-size:.75rem; font-weight:700; color:#16a34a; text-transform:uppercase; margin-bottom:6px;">✅ Herramientas que USA</div>
      <ul style="margin:0; padding-left:18px; font-size:.88rem; color:#1e293b; line-height:1.7;">${usaItems}</ul>
    </div>
    <div style="padding:12px 16px; background:#fef2f2;">
      <div style="font-size:.75rem; font-weight:700; color:#dc2626; text-transform:uppercase; margin-bottom:6px;">❌ Herramientas que DESCONOCE</div>
      <ul style="margin:0; padding-left:18px; font-size:.88rem; color:#1e293b; line-height:1.7;">${desconoceItems}</ul>
    </div>
  </div>

  <!-- Problemas -->
  <div style="padding:12px 18px; border-bottom:1px solid #e2e8f0; background:#fffbeb;">
    <div style="font-size:.75rem; font-weight:700; color:#d97706; text-transform:uppercase; margin-bottom:6px;">⚠️ Problemas tecnológicos identificados</div>
    <ul style="margin:0; padding-left:18px; font-size:.88rem; color:#1e293b; line-height:1.75;">${problemasItems}</ul>
  </div>

  <!-- Preguntas -->
  <div style="padding:14px 18px; background:${ficha.colorLight};">
    <div style="font-size:.75rem; font-weight:700; color:${ficha.color}; text-transform:uppercase; margin-bottom:8px;">💬 Preguntas guía para tu equipo</div>
    <ol style="margin:0; padding-left:0; list-style:none; font-size:.9rem; color:#1e293b; line-height:1.75;">
      ${preguntasItems}
    </ol>
  </div>
</div>`;
  }

  function _esc(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ─── Punto de entrada ────────────────────────────────────────────── */
  function initFichasAsignadas() {
    const container = document.getElementById("ficha-asignada-display");
    if (!container) return;

    const idx = getAssignedFichaIdx();
    const ficha = FICHAS[idx];

    // Badge header
    const badge = document.getElementById("ficha-asignada-badge");
    if (badge) {
      badge.style.background = ficha.colorLight;
      badge.style.borderColor = ficha.color;
      badge.innerHTML = `
        <span style="font-size:1.3rem;">${ficha.emoji}</span>
        <div>
          <div style="font-size:.72rem; font-weight:700; color:${ficha.color}; text-transform:uppercase; letter-spacing:.05em;">Tu ficha asignada</div>
          <div style="font-size:1rem; font-weight:700; color:#1e293b;">${_esc(ficha.nombre)}</div>
          <div style="font-size:.8rem; color:#64748b;">${_esc(ficha.ubicacion)}</div>
        </div>`;
    }

    renderFicha(ficha, container);
  }

  // Run after DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initFichasAsignadas);
  } else {
    initFichasAsignadas();
  }

  // Expose for admin/reporting purposes
  window.fichasCasos = {
    FICHAS,
    getAssignedFichaIdx,
    FICHA_ASIGNADA_KEY,
  };
})();
