const PAGE_FILE =
  (window.__RUNTIME_PAGE_FILE__ || window.location.pathname.split("/").pop() || "guia.html").toLowerCase();
const STORAGE_FILE_ALIASES = {
  "grupo-10a-guia-02-herramientas-informaticas-digitales.html": "10a_guia2.html",
  "grupo-10a-guia-02-actividad-4-formulario.html": "10a_guia2.html",
  "grupo-10a-guia-02-actividad-322-matriz.html": "10a_guia2.html",
  "grupo-10b-guia-02-herramientas-informaticas-digitales.html": "10b_guia2.html",
  "grupo-10b-guia-02-actividad-4-formulario.html": "10b_guia2.html",
  "grupo-10b-guia-02-actividad-322-matriz.html": "10b_guia2.html",
  "grupo-11a-guia-05-herramientas-informaticas-digitales.html": "11a_guia.html",
  "grupo-11b-guia-05-herramientas-informaticas-digitales.html": "11b_guia.html",
  "plantilla-grado-11-guia-05-herramientas-informaticas-digitales.html": "grado_guia.html",
};
const GUIDE_DATA_FILE = STORAGE_FILE_ALIASES[PAGE_FILE] || PAGE_FILE;
const PAGE_KEY = GUIDE_DATA_FILE.replace(/[^a-z0-9]+/g, "_") || "guia";
const portalAuth = window.portalAuth || null;
const LEGACY_STORAGE_KEY = `guia_interactiva_${PAGE_KEY}`;
const STORAGE_KEY = portalAuth
  ? portalAuth.getScopedStorageKey(LEGACY_STORAGE_KEY, { area: "guide-data" })
  : LEGACY_STORAGE_KEY;
const STORAGE_META_KEY = `${STORAGE_KEY}__meta`;
const SCOPED_STORAGE_ENABLED = STORAGE_KEY !== LEGACY_STORAGE_KEY;
const CLOUD_SYNC_DELAY_MS = 1200;
const CLOUD_REFRESH_MS = 60000;
const SUPPORT_BASE_PATH = "assets/materiales/guia2/";
const DRIVE_FOLDERS = {
  "3441939": "https://drive.google.com/drive/folders/1SLkk986REOKGEFaCyWV7rSeudj7lnUMs?usp=drive_link",
  "3441942": "https://drive.google.com/drive/folders/1cv0DkFXhkMw22AddqIgC354DhUUHcQck?usp=drive_link",
};

const wordList = [
  "RESTAURACION",
  "VIRUS",
  "ROOT",
  "MEDIO",
  "PORTABLE",
  "PANTALLA AZUL",
  "BACKUP",
  "BIOS",
  "CONSOLA",
  "TERMINAL",
  "COMANDOS",
  "SETUP",
  "ISO",
  "WINDOWS",
  "LINUX",
  "ANDROID",
  "PROGRAMAS",
  "MAC OS",
  "HYPERVISOR",
  "CAPACIDAD",
  "SISTEMA",
  "MS DOS",
  "USUARIO",
  "SUPERUSUARIO",
  "FORMATEO",
];

const conceptOptions = [
  {
    id: "diseno",
    label: "Diseno grafico",
    text: "Plataforma para crear afiches, infografias, presentaciones y piezas visuales con plantillas.",
  },
  {
    id: "analytics",
    label: "Analitica web",
    text: "Herramienta para medir trafico, comportamiento de usuarios y rendimiento de sitios web.",
  },
  {
    id: "cms",
    label: "Gestion de sitios",
    text: "Sistema para crear y administrar sitios web o blogs sin partir de cero.",
  },
  {
    id: "documental",
    label: "Gestion documental",
    text: "Plataforma de Microsoft para organizar archivos, procesos y colaboracion institucional.",
  },
  {
    id: "colaboracion",
    label: "Reuniones y colaboracion",
    text: "Servicios para clases, reuniones virtuales, chat, videollamadas y trabajo en equipo.",
  },
  {
    id: "videoconferencia",
    label: "Videoconferencias avanzadas",
    text: "Plataforma con salas, grabacion y comparticion de pantalla para reuniones remotas.",
  },
  {
    id: "transferencia",
    label: "Envio de archivos",
    text: "Servicio para compartir archivos pesados mediante enlaces temporales.",
  },
  {
    id: "nube",
    label: "Nube colaborativa",
    text: "Almacenamiento en linea para guardar, sincronizar y compartir documentos.",
  },
  {
    id: "email",
    label: "Email marketing",
    text: "Herramienta para crear campanas de correo, listas de contactos y reportes.",
  },
  {
    id: "agenda",
    label: "Agenda digital",
    text: "Calendario para programar eventos, reuniones, recordatorios y tareas.",
  },
];

const matchingTools = [
  { id: "canva", name: "Canva", answer: "diseno" },
  { id: "analytics", name: "Google Analytics", answer: "analytics" },
  { id: "wordpress", name: "WordPress", answer: "cms" },
  { id: "sharepoint", name: "SharePoint", answer: "documental" },
  { id: "meet-teams", name: "Google Meet y Teams", answer: "colaboracion" },
  { id: "zoom", name: "Zoom", answer: "videoconferencia" },
  { id: "wetransfer", name: "WeTransfer", answer: "transferencia" },
  { id: "drive", name: "Google Drive", answer: "nube" },
  { id: "mailchimp", name: "MailChimp", answer: "email" },
  { id: "calendar", name: "Calendar", answer: "agenda" },
];

const extensions = [
  {
    id: "doc",
    ext: ".doc",
    program: "Microsoft Word",
    description:
      "Hace referencia a documentos con contenido tipo texto, puede contener imagenes e hipervinculos.",
  },
  { id: "xlsx", ext: ".xlsx", program: "", description: "" },
  { id: "accdb", ext: ".accdb", program: "", description: "" },
  { id: "mpp", ext: ".mpp", program: "", description: "" },
  { id: "ppt", ext: ".ppt", program: "", description: "" },
  { id: "pub", ext: ".pub", program: "", description: "" },
  { id: "cda", ext: ".cda", program: "", description: "" },
  { id: "ogv", ext: ".ogv", program: "", description: "" },
  { id: "tar", ext: ".tar", program: "", description: "" },
  { id: "exe", ext: ".exe", program: "", description: "", risk: "Revisar seguridad" },
  { id: "pdf", ext: ".pdf", program: "", description: "" },
  { id: "rar", ext: ".rar", program: "", description: "" },
  { id: "wma", ext: ".wma", program: "", description: "" },
  { id: "vssm", ext: ".vssm", program: "", description: "" },
  { id: "txt", ext: ".txt", program: "", description: "" },
  { id: "sys", ext: ".sys", program: "", description: "", risk: "Archivo sensible del sistema" },
  { id: "png", ext: ".png", program: "", description: "" },
  { id: "html", ext: ".html", program: "", description: "" },
];

const EXTENSION_ACTIVITY_STORES = extensions.flatMap((row) => [
  `extension:${row.id}:program`,
  `extension:${row.id}:description`,
]).concat([
  "extensions-category-summary",
  "extensions-category-why",
  "extensions-risk-list",
  "extensions-real-files",
]);

const systems = [
  {
    id: "linux-lite",
    name: "Linux Lite",
    processor: "Intel Centrino o superior",
    ram: "1 GB",
    disk: "100 GB",
    source: "",
  },
  { id: "arcaos", name: "ArcaOS", processor: "", ram: "", disk: "", source: "" },
  { id: "windows-10", name: "Windows 10", processor: "", ram: "", disk: "", source: "" },
  { id: "ubuntu", name: "Ubuntu", processor: "", ram: "", disk: "", source: "" },
  { id: "macos-mojave", name: "macOS Mojave", processor: "", ram: "", disk: "", source: "" },
  { id: "windows-11", name: "Windows 11", processor: "", ram: "", disk: "", source: "" },
  { id: "chromium-os", name: "Chromium OS", processor: "", ram: "", disk: "", source: "" },
  { id: "mac-os-x-leopard", name: "Mac OS X Leopard", processor: "", ram: "", disk: "", source: "" },
];

const SYSTEM_ACTIVITY_STORES = systems.flatMap((row) => [
  `system:${row.id}:processor`,
  `system:${row.id}:ram`,
  `system:${row.id}:disk`,
  `system:${row.id}:source`,
]).concat([
  "systems-lowest",
  "systems-highest",
  "systems-recommendation",
  "systems-peer-feedback",
]);

const collaborativeTools = [
  { id: "microsoft-365", name: "Microsoft 365", detail: "Teams, SharePoint, OneDrive" },
  { id: "google-workspace", name: "Google Workspace", detail: "Meet, Drive, Docs" },
  { id: "zoom", name: "Zoom", detail: "" },
  { id: "wetransfer", name: "WeTransfer", detail: "" },
  { id: "canva", name: "Canva", detail: "" },
];

const COLLABORATIVE_TOOLS_ACTIVITY_STORES = collaborativeTools.flatMap((row) => [
  `collab:${row.id}:function`,
  `collab:${row.id}:advantage`,
  `collab:${row.id}:limit`,
  `collab:${row.id}:license`,
]);

const digitalCompetencyChecklist = [
  { id: "doc-word", label: "Crear y dar formato a documentos en Word (encabezados, tablas, listas, estilos)." },
  { id: "excel-formulas", label: "Aplicar formulas basicas en Excel (SUMA, PROMEDIO, MAX) y crear graficos con titulo y leyenda." },
  { id: "extensiones-archivo", label: "Reconocer extensiones de archivo comunes (.docx, .xlsx, .pdf, .exe, .iso) e identificar riesgos de seguridad." },
  { id: "requerimientos-so", label: "Determinar requerimientos minimos de un sistema operativo (procesador, RAM, espacio en disco)." },
  { id: "drive-permisos", label: "Crear, organizar y compartir carpetas en Google Drive con los permisos adecuados." },
  { id: "docs-colaborativo", label: "Editar documentos colaborativos en Google Docs en tiempo real con otras personas." },
  { id: "reuniones-virtuales", label: "Convocar y administrar reuniones virtuales en Meet, Teams o Zoom (compartir pantalla, chat, grabacion)." },
  { id: "wetransfer", label: "Enviar archivos pesados con WeTransfer y verificar la confirmacion de entrega." },
  { id: "presentaciones", label: "Disenar presentaciones profesionales en Canva o PowerPoint y exportarlas a PDF." },
  { id: "correo-formal", label: "Redactar correos electronicos formales con asunto, saludo, cuerpo claro, adjuntos y despedida profesional." },
  { id: "contrasena-phishing", label: "Crear contrasenas seguras y reconocer correos o mensajes de phishing." },
  { id: "backup-doble", label: "Realizar copias de seguridad de mis archivos en al menos dos ubicaciones (USB y nube)." },
  { id: "comprimir", label: "Comprimir y descomprimir archivos en formatos .zip o .rar para enviarlos o respaldarlos." },
  { id: "busqueda-fuente", label: "Buscar informacion confiable en internet, comparar fuentes y citar la fuente correctamente." },
  { id: "privacidad", label: "Proteger mi informacion personal y laboral en redes sociales, dispositivos compartidos o redes Wi-Fi publicas." },
];

const DIGITAL_CHECKLIST_LEVELS = [
  { value: "domino", label: "Lo domino", emoji: "⭐", color: "#1b5e20", bg: "#e8f5e9" },
  { value: "reforzar", label: "Necesito reforzar", emoji: "📝", color: "#8a5a00", bg: "#fff8e1" },
  { value: "nopracticado", label: "No lo he practicado", emoji: "⚠", color: "#a13029", bg: "#fdecea" },
];

const DIGITAL_CHECKLIST_STORES = digitalCompetencyChecklist.map((item) => `checklist:${item.id}`);

const TRANSFER_RETO_ACTIVITY_STORES = [
  "transfer-reto-uso",
  "transfer-reto-guia",
];

const evidenceRows = [
  {
    phase: "An?lisis",
    project:
      "Diagnosticar necesidades digitales, t?cnicas y de seguridad inform?tica en actores productivos locales (Proyecto 3478260).",
    learning:
      "Actividades 1, 2 y 3: sopa de letras, relaci?n herramienta-funci?n y situaci?n problema de fallo de arranque.",
    evidence:
      "Sopa de letras resuelta, tabla de coincidencias completada y bit?cora de diagn?stico inicial con s?ntomas, causas probables, plan de revisi?n, herramientas digitales propuestas y acci?n que no se realizar?a.",
    criteria:
      "Reconoce terminolog?a b?sica de sistemas operativos, restauraci?n y formateo. Clasifica herramientas digitales seg?n su funci?n. Identifica causas probables de fallos de arranque y propone un plan de revisi?n ordenado.",
    methods:
      "T?cnica: valoraci?n de conocimiento aplicado. Instrumento: Lista de chequeo LC-01.",
  },
  {
    phase: "An?lisis",
    project:
      "Diagnosticar necesidades digitales, t?cnicas y de seguridad inform?tica en actores productivos locales (Proyecto 3478260).",
    learning:
      "Actividad 4: diagn?stico inicial del contexto digital local.",
    evidence:
      "Cuestionario de conocimientos previos resuelto, an?lisis de fichas de casos locales y matriz de diagn?stico digital diligenciada.",
    criteria:
      "Identifica herramientas TIC y su funci?n en contextos reales. Reconoce necesidades digitales de actores productivos locales y propone herramientas pertinentes seg?n el caso.",
    methods:
      "T?cnica: taller diagn?stico. Instrumento: Lista de chequeo LC-01.",
  },
  {
    phase: "An?lisis",
    project:
      "Diagnosticar necesidades digitales, t?cnicas y de seguridad inform?tica en actores productivos locales (Proyecto 3478260).",
    learning:
      "Actividades 5, 6, 7, 8 y 9: extensiones de archivo, requerimientos de sistemas operativos, suite ofim?tica, herramientas colaborativas y ciberseguridad b?sica.",
    evidence:
      "Tabla de extensiones organizada con riesgos identificados, matriz de requerimientos mínimos con fuentes, productos ofimáticos funcionales, práctica colaborativa y guía básica de ciberseguridad con lista de verificación.",
    criteria:
      "Clasifica extensiones de archivo e identifica riesgos de seguridad. Determina requerimientos mínimos de sistemas operativos. Elabora productos ofimáticos funcionales, usa herramientas colaborativas y orienta en buenas prácticas de ciberseguridad adaptadas al contexto local.",
    methods:
      "T?cnica: desempe?o en taller pr?ctico y revisi?n documental. Instrumento: Lista de chequeo LC-02.",
  },
  {
    phase: "An?lisis",
    project:
      "Diagnosticar necesidades digitales, t?cnicas y de seguridad inform?tica en actores productivos locales (Proyecto 3478260).",
    learning:
      "Actividad 10: dise?o y construcci?n de soluci?n digital para actor productivo local.",
    evidence:
      "Perfil digital del actor productivo, herramienta digital personalizada funcional, gu?a de uso r?pido, presentaci?n oral y portafolio digital organizado en Google Drive.",
    criteria:
      "Caracteriza herramientas inform?ticas seg?n el contexto tecnol?gico del actor productivo. Selecciona herramientas pertinentes, construye una soluci?n digital funcional y presenta el proceso con claridad t?cnica y enfoque de usuario.",
    methods:
      "T?cnica: verificaci?n de producto y sustentaci?n. Instrumento: Lista de chequeo LC-03.",
  },
];

const glossaryTerms = [
  ["Arranque (Boot)", "Proceso que realiza el computador al encender para cargar el sistema operativo desde el dispositivo de almacenamiento."],
  ["BIOS / UEFI", "Software b?sico de la placa base que inicia el hardware al encender el equipo. UEFI es su versi?n moderna, m?s segura y r?pida."],
  ["Orden de arranque (Boot Order)", "Prioridad de dispositivos desde los que el equipo intenta iniciar el sistema operativo: disco duro, USB, DVD o red."],
  ["Sistema operativo (SO)", "Software principal que administra el hardware del computador y permite ejecutar aplicaciones. Ejemplos: Windows, Linux y macOS."],
  ["Distribuci?n Linux", "Versi?n de Linux empaquetada con programas y configuraciones propias. Ejemplos: Ubuntu, Linux Lite, Fedora y Debian."],
  ["Imagen ISO", "Archivo que contiene una copia completa de instalaci?n de un sistema operativo, listo para grabar o montar en una m?quina virtual."],
  ["Partici?n", "Divisi?n l?gica del disco duro o SSD para organizar el almacenamiento como si fueran discos independientes."],
  ["/ (ra?z) | /home | /boot | swap", "Particiones est?ndar de Linux: ra?z para archivos esenciales del sistema, home para archivos de usuario, boot para archivos de arranque y swap como memoria virtual en disco."],
  ["M?quina virtual (VM)", "Entorno de computador simulado dentro del equipo real, que permite instalar y probar sistemas operativos sin afectar el sistema anfitri?n."],
  ["VirtualBox", "Programa gratuito de Oracle para crear y administrar m?quinas virtuales en Windows, Linux y macOS."],
  ["Hipervisor", "Software que administra las m?quinas virtuales y controla el acceso a recursos f?sicos como CPU, RAM y disco del equipo anfitri?n."],
  ["Requisitos mínimos de SO", "Características básicas de hardware necesarias para que un sistema operativo funcione: procesador, RAM y espacio en disco."],
  ["Extensi?n de archivo", "Parte final del nombre de un archivo que indica su tipo y el programa con que se abre. Ejemplos: .pdf, .docx, .xlsx, .exe y .png."],
  ["Controlador (Driver)", "Software que permite al sistema operativo comunicarse correctamente con un dispositivo de hardware."],
  ["Suite ofim?tica", "Conjunto de programas para tareas de oficina: procesador de texto, hoja de c?lculo y presentaciones. Ejemplos: Microsoft Office, LibreOffice y Google Workspace."],
  ["Herramienta colaborativa", "Aplicaci?n que permite trabajar simult?neamente con otras personas en documentos o proyectos desde cualquier ubicaci?n. Ejemplos: Google Docs, Teams y Zoom."],
  ["Nube (Cloud)", "Infraestructura de servidores en internet para guardar, acceder y compartir archivos desde cualquier dispositivo conectado."],
  ["Ciberseguridad", "Conjunto de pr?cticas y tecnolog?as para proteger redes, equipos y datos de ataques o accesos no autorizados."],
  ["Malware / Phishing", "Malware es software malicioso que da?a equipos o roba informaci?n. Phishing es un enga?o por correo o enlace falso para obtener contrase?as."],
  ["Copia de seguridad (Backup)", "Duplicado de archivos importantes guardado en lugar seguro para recuperarlos ante p?rdida, da?o o error del sistema."],
  ["Formateo", "Proceso de preparar un disco o partici?n; puede borrar toda la informaci?n si no hay respaldo previo."],
  ["Restauraci?n", "Acci?n de recuperar el sistema o archivos a un estado funcional anterior usando copias de seguridad o puntos de restauraci?n."],
  ["Normas IEEE", "Est?ndares del Instituto de Ingenieros El?ctricos y Electr?nicos para documentar informes t?cnicos con estructura, citas y referencias uniformes."],
  ["Actor productivo", "Persona o grupo que desarrolla actividades econ?micas en una comunidad: comerciante, emprendedor, agricultor, artesano o prestador de servicios."],
];

const supportTemplates = [
  {
    title: "Gu?a 2 base de aprendizaje",
    file: "Guia_2_OperarHerramientas.docx",
    type: "DOCX local",
    description:
      "Documento oficial actualizado con la estructura, actividades y evidencias de la Gu?a 2.",
    cta: "Abrir gu?a",
  },
  {
    title: "Bit?cora para el caso",
    file: "Bitacora_Para_Caso.docx",
    type: "DOCX local",
    description:
      "Plantilla de apoyo para registrar s?ntomas, causas probables y pasos de revisi?n del caso.",
    cta: "Abrir bit?cora",
  },
  {
    title: "Taller 1_Guia2",
    file: "Taller_1_Guia2.docx",
    type: "DOCX local",
    description:
      "Documento complementario de pr?ctica asociado a la Gu?a 2 para reforzar el trabajo del aprendiz.",
    cta: "Abrir taller",
  },
];

const supportDocuments = [
  {
    title: "Manual de usuario de VirtualBox 7.2.6",
    file: "VirtualBox_UserManual_7.2.6.pdf",
    type: "PDF local",
    description:
      "Guia oficial para crear maquinas virtuales, configurar hardware y gestionar discos e imagenes ISO.",
  },
  {
    title: "Diapositivas sobre virtualizacion",
    file: "Virtualization_Lecture_Slides.ppt",
    type: "PPT local",
    description:
      "Presentacion de apoyo para comprender conceptos de hipervisor, maquinas virtuales y escenarios de uso.",
  },
  {
    title: "Notas del proceso de arranque en Linux",
    file: "Linux_Boot_Process_Presentation_Notes.pdf",
    type: "PDF local",
    description:
      "Material para reforzar la secuencia de arranque, particiones y componentes del sistema.",
  },
  {
    title: "Filesystem Hierarchy Standard 3.0",
    file: "FHS_3.0_Filesystem_Hierarchy_Standard.pdf",
    type: "PDF local",
    description:
      "Referencia tecnica sobre la organizacion de directorios y rutas del sistema de archivos en Linux.",
  },
  {
    title: "IEEE Editorial Style Manual",
    file: "IEEE_Editorial_Style_Manual.pdf",
    type: "PDF local",
    description:
      "Guia oficial para estructurar documentos tecnicos y presentar referencias en formato IEEE.",
  },
  {
    title: "Guia rapida para el uso de las normas IEEE",
    file: "Gu\u00eda+r\u00e1pida+para+el+uso+de+las+normas+IEEE.pdf",
    type: "PDF local",
    description:
      "Resumen practico para citar, ordenar bibliografia y presentar el informe tecnico final.",
  },
  {
    title: "CISA - Guia de phishing",
    file: "CISA_Phishing_Guidance.pdf",
    type: "PDF local",
    description:
      "Lectura complementaria para reconocer riesgos de seguridad y fortalecer criterios de prevencion.",
  },
  {
    title: "NIST SP 800-83r1 Malware Incident",
    file: "NIST_SP800-83r1_Malware_Incident.pdf",
    type: "PDF local",
    description:
      "Documento de consulta para respuesta basica ante incidentes relacionados con malware.",
  },
  {
    title: "Cybersecurity Awareness Slides",
    file: "Cybersecurity_Awareness_Slides.pdf",
    type: "PDF local",
    description:
      "Presentacion de sensibilizacion sobre buenas practicas de seguridad digital en el trabajo tecnico.",
  },
  {
    title: "Guia rapida de Microsoft Teams",
    file: "Teams_Quick_Start_Guide.pdf",
    type: "PDF local",
    description:
      "Apoyo para colaboracion, reuniones y comunicacion del equipo durante el desarrollo de evidencias.",
  },
  {
    title: "Guia rapida de SharePoint",
    file: "SharePoint_Quick_Start_Guide.pdf",
    type: "PDF local",
    description:
      "Referencia para gestion documental, organizacion de archivos y trabajo compartido.",
  },
];

const supportTools = [
  {
    title: "VirtualBox 7.2.6a para Windows",
    href: "https://drive.google.com/drive/folders/19AY6LsSHM--2VVXp4_Bzzjz2SVyAiSMc?usp=sharing",
    type: "Drive",
    description:
      "Instalador del hipervisor usado para practicar virtualizacion e instalaciones controladas.",
    cta: "Abrir en Drive ↗",
  },
];

const GUIDE2_DRIVE_ACTIVITY_TARGETS = [
  {
    activityNumber: "3.1.3",
    panelKey: "guide2-3-1-3",
    deadlineActivityId: "analisis313",
    description:
      "Cuando termines la bitácora o el documento final de análisis, súbelo a la carpeta de Drive correspondiente a tu ficha.",
    note: "Entrega sugerida: bitácora individual o informe final de análisis del caso.",
  },
  {
    activityNumber: "3.3.3",
    panelKey: "guide2-3-3-3",
    deadlineActivityId: "suite333",
    description:
      "Sube a Drive el diagn?stico digital del negocio, el archivo de Excel, la carpeta compartida y las evidencias colaborativas de la actividad ofim?tica.",
    note:
      "Entrega sugerida: documento .docx, archivo .xlsx, enlace de Drive y correo formal de entrega.",
  },
  {
    activityNumber: "3.3.4",
    panelKey: "guide2-3-3-4",
    deadlineActivityId: "colaborativas334",
    description:
      "Sube a Drive la tabla comparativa, la evidencia de Meet o Teams, la presentacion en PDF, la captura de WeTransfer y la lista de verificacion.",
    note:
      "Entrega sugerida: tabla comparativa, PDF de presentacion, captura de confirmacion y bitacora de competencias digitales.",
  },
  {
    activityNumber: "3.4.1",
    panelKey: "guide2-3-4-1",
    deadlineActivityId: "transferReto341",
    description:
      "Sube a Drive el perfil digital, la herramienta construida, la gu?a de uso r?pido y la presentaci?n final de la soluci?n digital.",
    note: "Entrega sugerida: portafolio final organizado en las carpetas 01 a 04 y compartido con el instructor.",
  },
];

const ACTIVITY_QR_DATA = {
  "guia2-relaciona": {
    title: "Actividad 2: Relaciona la herramienta con su funci?n",
    url: "https://es.educaplay.com/juego/27988974-operar_herramientas_informaticas_y_digitales_de_acuerdo_con_protocolos_y_manuales_tecnicos.html",
    image: "assets/img/guia2-qr-relaciona-concepto.png",
    cta: "Abrir ACTIVIDAD 2 en Educaplay",
  },
};

const WORD_SEARCH_ACTIVITY_ID = "guia2-sopa";
const WORD_SEARCH_STATE_KEY = "wordSearch:guia2-sopa";
const WORD_SEARCH_MAX_SCORE = 10000;
const WORD_SEARCH_ERROR_PENALTY = 200;
const WORD_SEARCH_GRID_SIZE = 15;
const WORD_SEARCH_VARIANT_COUNT = 2;
const WORD_SEARCH_FOUND_COLOR_COUNT = 8;
const WORD_SEARCH_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const WORD_SEARCH_LEADERBOARD_SCOPE = "leaderboard:guia2-sopa";
const WORD_SEARCH_LOCAL_LEADERBOARD_KEY = `guia2_word_search_leaderboard_${PAGE_KEY}_${WORD_SEARCH_ACTIVITY_ID}`;
const MATCHING_GAME_ACTIVITY_ID = "guia2-relaciona";
const MATCHING_GAME_STATE_KEY = "matchingGame:guia2-relaciona";
const MATCHING_GAME_MAX_SCORE = 10000;
const MATCHING_GAME_ERROR_PENALTY = 250;
const MATCHING_GAME_VARIANT_COUNT = 2;
const MATCHING_GAME_LEADERBOARD_SCOPE = "leaderboard:guia2-relaciona";
const MATCHING_GAME_LOCAL_LEADERBOARD_KEY = `guia2_matching_game_leaderboard_${PAGE_KEY}_${MATCHING_GAME_ACTIVITY_ID}`;
const MATCHING_GAME_VARIANTS = [
  {
    id: 1,
    label: "Version 1",
    pairs: [
      {
        id: "google-drive",
        tool: "Google Drive",
        answer: "Almacenar y compartir archivos en la nube.",
      },
      {
        id: "microsoft-excel",
        tool: "Microsoft Excel",
        answer: "Organizar datos en tablas y hacer calculos.",
      },
      {
        id: "canva",
        tool: "Canva",
        answer: "Crear presentaciones e imagenes visuales.",
      },
      {
        id: "whatsapp-business",
        tool: "WhatsApp Business",
        answer: "Comunicarse con clientes de un negocio.",
      },
      {
        id: "microsoft-word",
        tool: "Microsoft Word",
        answer: "Redactar y dar formato a documentos.",
      },
      {
        id: "google-meet",
        tool: "Google Meet",
        answer: "Realizar reuniones o clases virtuales.",
      },
      {
        id: "gmail",
        tool: "Gmail",
        answer: "Enviar y recibir correos electronicos.",
      },
      {
        id: "google-forms",
        tool: "Google Forms",
        answer: "Crear cuestionarios y recolectar respuestas.",
      },
    ],
  },
  {
    id: 2,
    label: "Version 2",
    pairs: [
      {
        id: "libreoffice-writer",
        tool: "LibreOffice Writer",
        answer: "Crear documentos de texto.",
      },
      {
        id: "powerpoint",
        tool: "Microsoft PowerPoint",
        answer: "Crear presentaciones con diapositivas.",
      },
      {
        id: "google-calendar",
        tool: "Google Calendar",
        answer: "Programar eventos y recordatorios.",
      },
      {
        id: "zoom",
        tool: "Zoom",
        answer: "Realizar videollamadas y compartir pantalla.",
      },
      {
        id: "onedrive",
        tool: "OneDrive",
        answer: "Guardar archivos en la nube de Microsoft.",
      },
      {
        id: "microsoft-teams",
        tool: "Microsoft Teams",
        answer: "Chat, reuniones y trabajo colaborativo.",
      },
      {
        id: "google-sheets",
        tool: "Google Sheets",
        answer: "Crear hojas de calculo colaborativas.",
      },
      {
        id: "trello",
        tool: "Trello",
        answer: "Organizar tareas en tableros.",
      },
    ],
  },
];

let state = loadState();
let cloudStateSyncTimer = null;
let cloudStateRetryTimer = null;
let pendingCloudStateSnapshot = null;
let wordSearchPuzzleCache = {};
let wordSearchSelectionStart = null;
let wordSearchLastSelectionCells = [];
let wordSearchFullscreenActive = false;
let wordSearchFullscreenPlaceholder = null;
let wordSearchIsDragging = false;
let wordSearchTimer = null;
let wordSearchCountdownTimer = null;
let wordSearchCountdownValue = 0;
let wordSearchCountdownVariant = 0;
let wordSearchCountdownPhase = "idle";
let matchingGameSelectedTool = "";
let matchingGameWrongPair = null;
let matchingGameTimer = null;
let matchingGameCountdownTimer = null;
let matchingGameCountdownValue = 0;
let matchingGameCountdownVariant = 0;
let matchingGameCountdownPhase = "idle";
const ACTIVITY4_IDENTITY_NAME_KEY = "actividad4:nombre_completo";
const ACTIVITY4_IDENTITY_FICHA_KEY = "actividad4:ficha";
let guia2Booted = false;

function initGuia2() {
  if (guia2Booted) {
    return;
  }

  guia2Booted = true;
  renderStatefulSections();
  renderConceptLegend();
  renderEvidenceTable();
  renderGlossary();
  renderDigitalChecklist();
  renderSupportMaterials();
  renderDriveDeliveryPanel();
  prefillActivity4Identity();
  hydrateFields();
  updateDigitalChecklistSummary();
  applyDigitalChecklistRowColors();
  applyExtensionesLock();
  applySistemasLock();
  applyColaborativasLock();
  applyTransferRetoLock();
  renderQuizHerramientasStatus();
  initializeWordSearchGame();
  initializeMatchingGame();
  bindEvents();
  syncActivity4IdentityUi();
  updateProgress();
  setupScrollSpy();
  initializeCloudStateSync();
}

window.initGuia2 = initGuia2;

if (!window.__PAGE_CONTEXT__) {
  document.addEventListener("DOMContentLoaded", initGuia2);
}

document.addEventListener("guide-activity-check-change", () => {
  window.requestAnimationFrame(() => updateProgress());
});

window.switchTab = function (button, panelId) {
  const tabs = button.closest(".game-tabs");
  const activity = button.closest(".activity-body");
  if (!tabs || !activity) {
    return;
  }

  tabs.querySelectorAll(".game-tab").forEach((tab) => tab.classList.remove("active"));
  button.classList.add("active");
  activity.querySelectorAll(".game-panel").forEach((panel) => {
    panel.style.display = panel.id === panelId ? "block" : "none";
  });
};

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved) || {};
    }

    if (SCOPED_STORAGE_ENABLED) {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        const parsed = JSON.parse(legacy) || {};
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        return parsed;
      }
    }

    return {};
  } catch {
    return {};
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  saveStateMeta({
    updatedAt: new Date().toISOString(),
    updatedBy: getCloudActor(),
  });
  updateProgress();
  pendingCloudStateSnapshot = buildCloudStateSnapshot();
  scheduleCloudStateSync();
}

function renderStatefulSections() {
  renderWordBank();
  renderWordSearchGame();
  renderMatchingGame();
  renderMatchingTable();
  renderExtensionTable();
  renderSystemTable();
}

function readStateMeta() {
  try {
    const saved = localStorage.getItem(STORAGE_META_KEY);
    return saved ? JSON.parse(saved) || {} : {};
  } catch {
    return {};
  }
}

function saveStateMeta(meta) {
  try {
    if (!meta) {
      localStorage.removeItem(STORAGE_META_KEY);
      return;
    }
    localStorage.setItem(STORAGE_META_KEY, JSON.stringify(meta));
  } catch {
  }
}

function getCloudScopeKey() {
  const session = portalAuth?.getCurrentSession?.();
  if (!session) {
    return "";
  }

  if (session.role === "admin") {
    return `admin:${session.usernameKey || session.user?.usernameKey || "admin"}`;
  }

  if (session.role === "student") {
    return `student:${session.user?.usernameKey || session.usernameKey || ""}`;
  }

  return "";
}

function getCloudActor() {
  const session = portalAuth?.getCurrentSession?.();
  return session?.user?.fullName || session?.user?.username || "Administrador";
}

function hasMeaningfulState(source) {
  return Object.values(source || {}).some((value) => {
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "number") {
      return !Number.isNaN(value);
    }
    return String(value ?? "").trim().length > 0;
  });
}

function snapshotTime(value) {
  const parsed = Date.parse(value?.updatedAt || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function localSnapshotTime() {
  return snapshotTime(readStateMeta());
}

function buildCloudStateSnapshot() {
  return {
    scopeKey: getCloudScopeKey(),
    fileName: GUIDE_DATA_FILE,
    updatedAt: new Date().toISOString(),
    updatedBy: getCloudActor(),
    state: { ...state },
  };
}

function applyCloudStateSnapshot(snapshot) {
  state = snapshot?.state && typeof snapshot.state === "object" ? { ...snapshot.state } : {};
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  saveStateMeta({
    updatedAt: snapshot?.updatedAt || new Date().toISOString(),
    updatedBy: snapshot?.updatedBy || getCloudActor(),
  });
  renderStatefulSections();
  hydrateFields();
  updateDigitalChecklistSummary();
  applyDigitalChecklistRowColors();
  applyExtensionesLock();
  applySistemasLock();
  renderQuizHerramientasStatus();
  updateProgress();
  window.dispatchEvent(new CustomEvent("guia2-state-applied", { detail: { fileName: GUIDE_DATA_FILE } }));
}

async function loadCloudState(force) {
  const scopeKey = getCloudScopeKey();
  if (!scopeKey || !window._firebaseDb || typeof window._firebaseDb.cloudGetGuideData !== "function") {
    return null;
  }
  if (!force && window._firebaseDb?.shouldDeferCloudReads?.()) {
    return null;
  }

  if (force && typeof window._firebaseDb.resetCache === "function") {
    window._firebaseDb.resetCache();
  }

  try {
    return await window._firebaseDb.cloudGetGuideData(scopeKey, GUIDE_DATA_FILE);
  } catch {
    return null;
  }
}

function scheduleCloudStateSync() {
  if (!getCloudScopeKey()) {
    return;
  }

  window.clearTimeout(cloudStateSyncTimer);
  window.clearTimeout(cloudStateRetryTimer);
  cloudStateSyncTimer = window.setTimeout(() => {
    syncCloudState(false);
  }, CLOUD_SYNC_DELAY_MS);
}

function scheduleCloudStateRetry() {
  if (!getCloudScopeKey() || !pendingCloudStateSnapshot) {
    return;
  }

  window.clearTimeout(cloudStateRetryTimer);
  cloudStateRetryTimer = window.setTimeout(() => {
    syncCloudState(true);
  }, 3000);
}

async function syncCloudState(force) {
  const scopeKey = getCloudScopeKey();
  if (!scopeKey || !window._firebaseDb || typeof window._firebaseDb.cloudSaveGuideData !== "function") {
    return false;
  }

  const snapshot = pendingCloudStateSnapshot || buildCloudStateSnapshot();
  pendingCloudStateSnapshot = snapshot;

  try {
      const saved = await window._firebaseDb.cloudSaveGuideData(scopeKey, GUIDE_DATA_FILE, snapshot);
    if (!saved) {
      scheduleCloudStateRetry();
      return false;
    }

    pendingCloudStateSnapshot = null;
    window.clearTimeout(cloudStateRetryTimer);
    saveStateMeta({
      updatedAt: snapshot.updatedAt,
      updatedBy: snapshot.updatedBy,
    });
    return true;
  } catch {
    scheduleCloudStateRetry();
    return false;
  }
}

function flushCloudStateSync() {
  if (!getCloudScopeKey() || (!pendingCloudStateSnapshot && !hasMeaningfulState(state))) {
    return;
  }

  pendingCloudStateSnapshot = pendingCloudStateSnapshot || buildCloudStateSnapshot();
  syncCloudState(true);
}

async function initializeCloudStateSync() {
  const scopeKey = getCloudScopeKey();
  if (!scopeKey) {
    return;
  }

  const remoteSnapshot = await loadCloudState(true);
  const localHasData = hasMeaningfulState(state);
  const remoteIsNewer = snapshotTime(remoteSnapshot) > localSnapshotTime();

  if (remoteSnapshot && (!localHasData || remoteIsNewer)) {
    applyCloudStateSnapshot(remoteSnapshot);
  } else if (localHasData) {
    pendingCloudStateSnapshot = buildCloudStateSnapshot();
    scheduleCloudStateSync();
  }

  window.setInterval(async () => {
    if (document.hidden) {
      return;
    }

    if (pendingCloudStateSnapshot) {
      return;
    }

    const nextSnapshot = await loadCloudState(false);
    if (!nextSnapshot) {
      return;
    }

    if (snapshotTime(nextSnapshot) > localSnapshotTime()) {
      applyCloudStateSnapshot(nextSnapshot);
    }
  }, CLOUD_REFRESH_MS);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[char];
  });
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function normalizeWordSearchText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

function hashString(value) {
  let hash = 2166136261;
  String(value || "").split("").forEach((char) => {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  });
  return hash >>> 0;
}

function createSeededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function getWordSearchTargets() {
  return wordList
    .map((label) => ({
      label,
      word: normalizeWordSearchText(label),
    }))
    .filter((item) => item.word.length > 0)
    .sort((a, b) => b.word.length - a.word.length || a.label.localeCompare(b.label));
}

function normalizeWordSearchVariant(value) {
  const variant = Number(value) || 1;
  if (variant < 1 || variant > WORD_SEARCH_VARIANT_COUNT) {
    return 1;
  }
  return Math.floor(variant);
}

function pickWordSearchVariant() {
  return Math.floor(Math.random() * WORD_SEARCH_VARIANT_COUNT) + 1;
}

function buildWordSearchPuzzle(variant) {
  const variantId = normalizeWordSearchVariant(variant);
  const size = WORD_SEARCH_GRID_SIZE;
  const grid = Array.from({ length: size }, () => Array(size).fill(""));
  const placements = {};
  const targets = getWordSearchTargets();
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [-1, 1],
    [0, -1],
    [-1, 0],
    [-1, -1],
    [1, -1],
  ];
  const random = createSeededRandom(
    hashString(`${WORD_SEARCH_ACTIVITY_ID}:variant-${variantId}:${wordList.join("|")}`)
  );

  const canPlace = (word, row, col, rowStep, colStep) => {
    for (let index = 0; index < word.length; index += 1) {
      const nextRow = row + rowStep * index;
      const nextCol = col + colStep * index;
      if (nextRow < 0 || nextRow >= size || nextCol < 0 || nextCol >= size) {
        return false;
      }
      if (grid[nextRow][nextCol] && grid[nextRow][nextCol] !== word[index]) {
        return false;
      }
    }
    return true;
  };

  const place = (target, row, col, rowStep, colStep) => {
    placements[target.word] = {
      label: target.label,
      cells: [],
    };
    for (let index = 0; index < target.word.length; index += 1) {
      const nextRow = row + rowStep * index;
      const nextCol = col + colStep * index;
      grid[nextRow][nextCol] = target.word[index];
      placements[target.word].cells.push({ row: nextRow, col: nextCol });
    }
  };

  targets.forEach((target) => {
    let placed = false;

    for (let attempt = 0; attempt < 2000 && !placed; attempt += 1) {
      const [rowStep, colStep] = directions[Math.floor(random() * directions.length)];
      const row = Math.floor(random() * size);
      const col = Math.floor(random() * size);
      if (canPlace(target.word, row, col, rowStep, colStep)) {
        place(target, row, col, rowStep, colStep);
        placed = true;
      }
    }

    for (let row = 0; row < size && !placed; row += 1) {
      for (let col = 0; col < size && !placed; col += 1) {
        for (let index = 0; index < directions.length && !placed; index += 1) {
          const [rowStep, colStep] = directions[index];
          if (canPlace(target.word, row, col, rowStep, colStep)) {
            place(target, row, col, rowStep, colStep);
            placed = true;
          }
        }
      }
    }
  });

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (!grid[row][col]) {
        grid[row][col] = WORD_SEARCH_ALPHABET[Math.floor(random() * WORD_SEARCH_ALPHABET.length)];
      }
    }
  }

  return {
    variant: variantId,
    size,
    grid,
    targets: targets.filter((target) => placements[target.word]),
    placements,
  };
}

function getWordSearchPuzzle(variant) {
  const variantId = normalizeWordSearchVariant(variant);
  if (!wordSearchPuzzleCache[variantId]) {
    wordSearchPuzzleCache[variantId] = buildWordSearchPuzzle(variantId);
  }
  return wordSearchPuzzleCache[variantId];
}

function getWordSearchFoundColorClass(word, foundWords) {
  const index = (foundWords || []).indexOf(word);
  if (index < 0) {
    return "";
  }
  return `word-found-color-${(index % WORD_SEARCH_FOUND_COLOR_COUNT) + 1}`;
}

function getWordSearchState() {
  const saved =
    state[WORD_SEARCH_STATE_KEY] && typeof state[WORD_SEARCH_STATE_KEY] === "object"
      ? state[WORD_SEARCH_STATE_KEY]
      : {};
  const variant = normalizeWordSearchVariant(saved.variant || 1);
  const puzzle = getWordSearchPuzzle(variant);
  const validWords = new Set(puzzle.targets.map((target) => target.word));
  const found = Array.from(
    new Set(
      (Array.isArray(saved.found) ? saved.found : [])
        .map((word) => normalizeWordSearchText(word))
        .filter((word) => validWords.has(word))
    )
  );
  const mistakes = Math.max(0, Number(saved.mistakes) || 0);

  return {
    found,
    foundLabels: found.map((word) => puzzle.placements[word]?.label || word),
    variant,
    mistakes,
    score: calculateWordSearchScore(found.length, puzzle.targets.length, mistakes),
    startedAt: saved.startedAt || "",
    completedAt: saved.completedAt || "",
    elapsedMs: Number(saved.elapsedMs) || 0,
    leaderboardPublishedAt: saved.leaderboardPublishedAt || "",
    playerKey: saved.playerKey || "",
    playerName: saved.playerName || "",
    ficha: saved.ficha || "",
    grupo: saved.grupo || "",
    inst: saved.inst || "",
    updatedAt: saved.updatedAt || "",
  };
}

function calculateWordSearchScore(foundCount, total, mistakes) {
  if (!total) {
    return 0;
  }
  const baseScore = Math.round((foundCount / total) * WORD_SEARCH_MAX_SCORE);
  const penalty = Math.max(0, Number(mistakes) || 0) * WORD_SEARCH_ERROR_PENALTY;
  return Math.max(0, Math.min(WORD_SEARCH_MAX_SCORE, baseScore - penalty));
}

function getWordSearchElapsedMs(gameState) {
  if (!gameState?.startedAt) {
    return Math.max(0, Number(gameState?.elapsedMs) || 0);
  }

  if (gameState.completedAt && gameState.elapsedMs) {
    return Math.max(0, Number(gameState.elapsedMs) || 0);
  }

  const started = Date.parse(gameState.startedAt);
  if (!Number.isFinite(started)) {
    return Math.max(0, Number(gameState.elapsedMs) || 0);
  }

  const finished = Date.parse(gameState.completedAt || "");
  const endTime = Number.isFinite(finished) ? finished : Date.now();
  return Math.max(0, endTime - started);
}

function formatWordSearchTime(ms) {
  const totalSeconds = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const two = (value) => String(value).padStart(2, "0");
  return hours ? `${hours}:${two(minutes)}:${two(seconds)}` : `${two(minutes)}:${two(seconds)}`;
}

function buildWordSearchPlayerMeta() {
  const session = portalAuth?.getCurrentSession?.();
  const selection = getGuideSelection();
  const usernameKey = session?.user?.usernameKey || session?.usernameKey || "";
  const playerName =
    session?.user?.fullName ||
    session?.user?.username ||
    state[ACTIVITY4_IDENTITY_NAME_KEY] ||
    "Aprendiz";
  const ficha = session?.user?.ficha || state[ACTIVITY4_IDENTITY_FICHA_KEY] || selection.ficha || "";
  const grupo = session?.user?.grupo || selection.grupo || "";
  const inst = session?.user?.inst || selection.inst || "";

  return {
    playerKey: usernameKey || `${PAGE_KEY}:${normalizeWordSearchText(playerName)}:${ficha}`,
    playerName,
    ficha,
    grupo,
    inst,
  };
}

function setWordSearchState(next) {
  const current = getWordSearchState();
  const variant = normalizeWordSearchVariant(next.variant || current.variant || 1);
  const puzzle = getWordSearchPuzzle(variant);
  const found = Array.isArray(next.found)
    ? Array.from(
        new Set(
          next.found
            .map((word) => normalizeWordSearchText(word))
            .filter((word) => puzzle.placements[word])
        )
      )
    : current.found;
  const mistakes =
    Object.prototype.hasOwnProperty.call(next, "mistakes")
      ? Math.max(0, Number(next.mistakes) || 0)
      : current.mistakes;

  state[WORD_SEARCH_STATE_KEY] = {
    ...current,
    ...next,
    found,
    foundLabels: found.map((word) => puzzle.placements[word]?.label || word),
    variant,
    mistakes,
    score: calculateWordSearchScore(found.length, puzzle.targets.length, mistakes),
    updatedAt: new Date().toISOString(),
  };
  saveState();
  renderWordSearchGame();
}

function getWordSearchLineCells(start, end) {
  const gameState = getWordSearchState();
  const puzzle = getWordSearchPuzzle(gameState.variant);
  const rowDiff = end.row - start.row;
  const colDiff = end.col - start.col;
  const rowStep = Math.sign(rowDiff);
  const colStep = Math.sign(colDiff);
  const isStraight = rowDiff === 0 || colDiff === 0 || Math.abs(rowDiff) === Math.abs(colDiff);

  if (!isStraight) {
    return [];
  }

  const length = Math.max(Math.abs(rowDiff), Math.abs(colDiff)) + 1;
  return Array.from({ length }, (_, index) => ({
    row: start.row + rowStep * index,
    col: start.col + colStep * index,
    letter: puzzle.grid[start.row + rowStep * index]?.[start.col + colStep * index] || "",
  }));
}

function findWordSearchMatch(cells) {
  const gameState = getWordSearchState();
  const puzzle = getWordSearchPuzzle(gameState.variant);
  const foundWords = new Set(gameState.found);
  const letters = cells.map((cell) => cell.letter).join("");
  const reversed = letters.split("").reverse().join("");

  return puzzle.targets.find((target) => {
    if (foundWords.has(target.word)) {
      return false;
    }
    return target.word === letters || target.word === reversed;
  });
}

function sameWordSearchCell(a, b) {
  return a && b && Number(a.row) === Number(b.row) && Number(a.col) === Number(b.col);
}

function matchWordSearchPlacementInCells(cells, placementCells) {
  if (!Array.isArray(cells) || !Array.isArray(placementCells) || cells.length < placementCells.length) {
    return null;
  }

  for (let offset = 0; offset <= cells.length - placementCells.length; offset += 1) {
    const slice = cells.slice(offset, offset + placementCells.length);
    const forward = slice.every((cell, index) => sameWordSearchCell(cell, placementCells[index]));
    if (forward) {
      return slice;
    }

    const backward = slice.every((cell, index) =>
      sameWordSearchCell(cell, placementCells[placementCells.length - 1 - index])
    );
    if (backward) {
      return slice;
    }
  }

  return null;
}

function findWordSearchSelectionMatch(cells) {
  const gameState = getWordSearchState();
  const puzzle = getWordSearchPuzzle(gameState.variant);
  const foundWords = new Set(gameState.found);
  const exactMatch = findWordSearchMatch(cells);

  if (exactMatch) {
    return {
      target: exactMatch,
      cells: puzzle.placements[exactMatch.word]?.cells || cells,
    };
  }

  for (const target of puzzle.targets) {
    if (foundWords.has(target.word)) {
      continue;
    }

    const matchedCells = matchWordSearchPlacementInCells(
      cells,
      puzzle.placements[target.word]?.cells || []
    );
    if (matchedCells) {
      return {
        target,
        cells: matchedCells,
      };
    }
  }

  return null;
}

function cellKey(cell) {
  return `${cell.row}:${cell.col}`;
}

function clearWordSearchSelection() {
  document
    .querySelectorAll(".word-search-cell.is-selected")
    .forEach((cell) => cell.classList.remove("is-selected"));
}

function markWordSearchSelection(cells) {
  clearWordSearchSelection();
  const keys = new Set(cells.map(cellKey));
  document.querySelectorAll(".word-search-cell").forEach((button) => {
    const row = Number(button.dataset.row);
    const col = Number(button.dataset.col);
    button.classList.toggle("is-selected", keys.has(`${row}:${col}`));
  });
}

function setWordSearchStatus(message) {
  const status = document.getElementById("wordSearchStatus");
  if (status) {
    status.textContent = message;
  }
}

function pulseWordSearchMetric(element) {
  const metric = element?.closest?.(".word-search-stat") || element;
  if (!metric) {
    return;
  }

  metric.classList.remove("is-updating");
  void metric.offsetWidth;
  metric.classList.add("is-updating");
  window.setTimeout(() => {
    metric.classList.remove("is-updating");
  }, 420);
}

function updateWordSearchMetric(id, value, options) {
  const element = document.getElementById(id);
  if (!element) {
    return;
  }

  const nextValue = String(value);
  if (element.textContent !== nextValue) {
    element.textContent = nextValue;
    if (!options || options.pulse !== false) {
      pulseWordSearchMetric(element);
    }
  }
}

function clearWordSearchCountdown() {
  window.clearInterval(wordSearchCountdownTimer);
  wordSearchCountdownTimer = null;
  wordSearchCountdownValue = 0;
  wordSearchCountdownVariant = 0;
  wordSearchCountdownPhase = "idle";
}

function startWordSearchCountdown(variant) {
  clearWordSearchCountdown();
  wordSearchCountdownVariant = normalizeWordSearchVariant(variant);
  wordSearchCountdownValue = 3;
  wordSearchCountdownPhase = "countdown";
  renderWordSearchGame();
  setWordSearchStatus("Cuenta regresiva: 3 segundos para iniciar.");

  wordSearchCountdownTimer = window.setInterval(() => {
    wordSearchCountdownValue -= 1;
    if (wordSearchCountdownValue <= 0) {
      finishWordSearchCountdown();
      return;
    }

    renderWordSearchGame();
    setWordSearchStatus(`Cuenta regresiva: ${wordSearchCountdownValue} segundos para iniciar.`);
  }, 1000);
}

function finishWordSearchCountdown() {
  const variant = wordSearchCountdownVariant || getWordSearchState().variant || 1;
  wordSearchCountdownPhase = "go";
  clearWordSearchCountdown();
  setWordSearchState({
    ...buildWordSearchPlayerMeta(),
    variant,
    startedAt: new Date().toISOString(),
    countdownStartedAt: "",
  });
  setWordSearchStatus("Cronometro activo. Arrastra desde la primera hasta la ultima letra de cada palabra.");
}

function startWordSearchGame() {
  const current = getWordSearchState();
  if (current.completedAt) {
    setWordSearchStatus("Actividad completada. Puedes reiniciar si deseas mejorar el tiempo.");
    return;
  }

  if (wordSearchCountdownTimer) {
    setWordSearchStatus(`Cuenta regresiva: ${wordSearchCountdownValue} segundos para iniciar.`);
    return;
  }

  if (current.startedAt) {
    setWordSearchStatus("La actividad ya esta en curso. Arrastra desde la primera hasta la ultima letra.");
    return;
  }

  const variant = pickWordSearchVariant();
  wordSearchSelectionStart = null;
  wordSearchLastSelectionCells = [];
  wordSearchIsDragging = false;
  setWordSearchState({
    ...buildWordSearchPlayerMeta(),
    variant,
    found: [],
    foundLabels: [],
    startedAt: "",
    countdownStartedAt: new Date().toISOString(),
    completedAt: "",
    elapsedMs: 0,
    mistakes: 0,
    leaderboardPublishedAt: "",
  });
  startWordSearchCountdown(variant);
}

function resetWordSearchGame() {
  const current = getWordSearchState();
  if ((current.startedAt || current.found.length) && !window.confirm("Se reiniciara la sopa de letras y el tiempo. Deseas continuar?")) {
    return;
  }

  clearWordSearchCountdown();
  wordSearchSelectionStart = null;
  wordSearchLastSelectionCells = [];
  wordSearchIsDragging = false;
  state[WORD_SEARCH_STATE_KEY] = {
    found: [],
    foundLabels: [],
    variant: normalizeWordSearchVariant(current.variant),
    score: 0,
    startedAt: "",
    countdownStartedAt: "",
    completedAt: "",
    elapsedMs: 0,
    leaderboardPublishedAt: "",
    mistakes: 0,
    updatedAt: new Date().toISOString(),
  };
  saveState();
  renderWordSearchGame();
  setWordSearchStatus("Pulsa Comenzar para activar la cuenta regresiva.");
}

function moveWordSearchToFullscreenLayer(container) {
  if (!container || container.parentElement === document.body) {
    return;
  }

  if (!wordSearchFullscreenPlaceholder) {
    wordSearchFullscreenPlaceholder = document.createElement("div");
    wordSearchFullscreenPlaceholder.className = "word-search-fullscreen-placeholder";
    wordSearchFullscreenPlaceholder.setAttribute("aria-hidden", "true");
  }

  if (!wordSearchFullscreenPlaceholder.parentNode) {
    container.parentNode.insertBefore(wordSearchFullscreenPlaceholder, container);
  }
  document.body.appendChild(container);
}

function restoreWordSearchFromFullscreenLayer(container) {
  if (!container || !wordSearchFullscreenPlaceholder?.parentNode) {
    return;
  }

  wordSearchFullscreenPlaceholder.parentNode.insertBefore(container, wordSearchFullscreenPlaceholder);
  wordSearchFullscreenPlaceholder.remove();
}

function setWordSearchFullscreen(active) {
  const container = document.querySelector(`[data-word-search="${WORD_SEARCH_ACTIVITY_ID}"]`);
  const button = document.getElementById("wordSearchFullscreen");
  if (!container) {
    return;
  }

  wordSearchFullscreenActive = Boolean(active);
  if (wordSearchFullscreenActive) {
    moveWordSearchToFullscreenLayer(container);
  } else {
    restoreWordSearchFromFullscreenLayer(container);
  }

  container.classList.toggle("is-fullscreen", wordSearchFullscreenActive);
  document.documentElement.classList.toggle("word-search-fullscreen-lock", wordSearchFullscreenActive);
  document.body.classList.toggle("word-search-fullscreen-lock", wordSearchFullscreenActive);

  if (button) {
    button.textContent = wordSearchFullscreenActive ? "Salir pantalla completa" : "Pantalla completa";
    button.setAttribute("aria-pressed", String(wordSearchFullscreenActive));
  }

  if (wordSearchFullscreenActive) {
    window.setTimeout(() => {
      container.scrollTo({ top: 0, left: 0 });
    }, 80);
  }
}

function toggleWordSearchFullscreen() {
  setWordSearchFullscreen(!wordSearchFullscreenActive);
}

function getWordSearchCellFromPointerEvent(event) {
  const element = document.elementFromPoint(event.clientX, event.clientY);
  return element?.closest?.(".word-search-cell") || null;
}

function getWordSearchCellPosition(button) {
  const row = Number(button?.dataset?.row);
  const col = Number(button?.dataset?.col);
  if (!Number.isFinite(row) || !Number.isFinite(col)) {
    return null;
  }

  return { row, col };
}

function canSelectWordSearch(gameState) {
  if (wordSearchCountdownTimer) {
    setWordSearchStatus(`Cuenta regresiva: ${wordSearchCountdownValue} segundos para iniciar.`);
    return false;
  }

  if (!gameState.startedAt) {
    setWordSearchStatus("Primero pulsa Comenzar y espera la cuenta regresiva.");
    return false;
  }

  if (gameState.completedAt) {
    setWordSearchStatus("Ya encontraste todas las palabras. Reinicia solo si quieres mejorar el tiempo.");
    return false;
  }

  return true;
}

function beginWordSearchSelection(button) {
  const gameState = getWordSearchState();
  if (!canSelectWordSearch(gameState)) {
    return false;
  }

  const start = getWordSearchCellPosition(button);
  if (!start) {
    return false;
  }

  wordSearchSelectionStart = start;
  wordSearchLastSelectionCells = [start];
  wordSearchIsDragging = true;
  markWordSearchSelection([start]);
  setWordSearchStatus("Sigue arrastrando hasta la ultima letra y suelta para validar.");
  return true;
}

function previewWordSearchSelection(button) {
  if (!wordSearchIsDragging || !wordSearchSelectionStart) {
    return;
  }

  const end = getWordSearchCellPosition(button);
  if (!end) {
    return;
  }

  const selectedCells = getWordSearchLineCells(wordSearchSelectionStart, end);
  if (selectedCells.length) {
    wordSearchLastSelectionCells = selectedCells;
    markWordSearchSelection(selectedCells);
  }
}

function finishWordSearchSelection(button) {
  let gameState = getWordSearchState();
  if (!wordSearchIsDragging || !wordSearchSelectionStart || !canSelectWordSearch(gameState)) {
    wordSearchIsDragging = false;
    wordSearchSelectionStart = null;
    return;
  }

  const end = getWordSearchCellPosition(button);
  const start = wordSearchSelectionStart;
  wordSearchIsDragging = false;
  wordSearchSelectionStart = null;

  let selectedCells = end ? getWordSearchLineCells(start, end) : [];
  if (!selectedCells.length && wordSearchLastSelectionCells.length > 1) {
    selectedCells = wordSearchLastSelectionCells;
  }

  if (!selectedCells.length) {
    clearWordSearchSelection();
    wordSearchLastSelectionCells = [];
    setWordSearchStatus("No se conto como error. Intenta soltar el dedo sobre la ultima letra de la palabra.");
    return;
  }

  if (selectedCells.length <= 1) {
    clearWordSearchSelection();
    wordSearchLastSelectionCells = [];
    setWordSearchStatus("Arrastra sobre varias letras para seleccionar una palabra completa.");
    return;
  }

  markWordSearchSelection(selectedCells);
  const matchedSelection = findWordSearchSelectionMatch(selectedCells);
  if (!matchedSelection) {
    setWordSearchState({
      mistakes: gameState.mistakes + 1,
    });
    wordSearchLastSelectionCells = [];
    window.setTimeout(clearWordSearchSelection, 350);
    setWordSearchStatus(`Esa seleccion no coincide: -${WORD_SEARCH_ERROR_PENALTY} puntos. Intenta con otra palabra.`);
    return;
  }

  const match = matchedSelection.target;
  markWordSearchSelection(matchedSelection.cells);
  const found = [...gameState.found, match.word];
  const puzzle = getWordSearchPuzzle(gameState.variant);
  const completed = found.length >= puzzle.targets.length;
  const now = new Date().toISOString();
  const elapsedMs = completed ? getWordSearchElapsedMs(gameState) : gameState.elapsedMs;

  setWordSearchState({
    ...buildWordSearchPlayerMeta(),
    found,
    completedAt: completed ? now : "",
    elapsedMs,
    leaderboardPublishedAt: completed ? now : gameState.leaderboardPublishedAt,
    lastFoundAt: now,
  });

  if (completed) {
    publishWordSearchLeaderboard(getWordSearchState());
    setWordSearchStatus("Excelente. Completaste la sopa y tu puntaje entro al ranking.");
    wordSearchLastSelectionCells = [];
    return;
  }

  wordSearchLastSelectionCells = [];
  setWordSearchStatus(`Encontraste: ${match.label}. Sigue buscando.`);
}

function renderWordSearchBoard(gameState) {
  const board = document.getElementById("wordSearchBoard");
  if (!board) {
    return;
  }

  const puzzle = getWordSearchPuzzle(gameState.variant);
  const foundCells = new Map();
  gameState.found.forEach((word) => {
    const colorClass = getWordSearchFoundColorClass(word, gameState.found);
    puzzle.placements[word]?.cells.forEach((cell) => foundCells.set(cellKey(cell), colorClass));
  });

  board.style.setProperty("--word-search-size", String(puzzle.size));
  board.classList.toggle("is-waiting", !gameState.startedAt);
  board.classList.toggle("is-countdown", Boolean(wordSearchCountdownTimer));

  if (!gameState.startedAt) {
    board.innerHTML = wordSearchCountdownTimer
      ? renderWordSearchCountdownOverlay()
      : `
        <div class="word-search-ready">
          <strong>Sopa 15 x 15</strong>
          <span>Pulsa Comenzar para recibir una de las 2 sopas disponibles.</span>
        </div>
      `;
    return;
  }

  board.innerHTML = puzzle.grid
    .map((row, rowIndex) =>
      row
        .map((letter, colIndex) => {
          const foundColorClass = foundCells.get(`${rowIndex}:${colIndex}`) || "";
          return `
            <button
              class="word-search-cell ${foundColorClass ? "is-found " + foundColorClass : ""}"
              type="button"
              data-row="${rowIndex}"
              data-col="${colIndex}"
              data-found-color="${escapeHtml(foundColorClass)}"
              aria-label="Fila ${rowIndex + 1}, columna ${colIndex + 1}, letra ${letter}"
            >${escapeHtml(letter)}</button>
          `;
        })
        .join("")
    )
    .join("");
}

function renderWordSearchFound(gameState) {
  const foundBox = document.getElementById("wordSearchFound");
  if (!foundBox) {
    return;
  }

  if (!gameState.foundLabels.length) {
    foundBox.textContent = "Aun no hay palabras encontradas.";
    return;
  }

  foundBox.innerHTML = gameState.foundLabels
    .map(
      (label, index) =>
        `<span class="found-word word-found-color-${(index % WORD_SEARCH_FOUND_COLOR_COUNT) + 1}">${escapeHtml(label)}</span>`
    )
    .join("");
}

function renderWordSearchTargets(gameState) {
  const targetBox = document.getElementById("wordSearchTargets");
  if (!targetBox) {
    return;
  }

  const foundWords = new Set(gameState.found);
  targetBox.innerHTML = getWordSearchPuzzle(gameState.variant).targets
    .map((target) => {
      const isFound = foundWords.has(target.word);
      const colorClass = getWordSearchFoundColorClass(target.word, gameState.found);
      return `
        <span class="target-word ${isFound ? "is-found " + colorClass : ""}">
          ${escapeHtml(target.label)}
        </span>
      `;
    })
    .join("");
}

function renderWordSearchCountdownOverlay() {
  const value = Math.max(1, Number(wordSearchCountdownValue) || 1);

  return `
    <div class="word-search-countdown" aria-live="polite" data-countdown-phase="${escapeHtml(wordSearchCountdownPhase)}">
      <span>Cuenta regresiva</span>
      <strong id="wordSearchCountdownMeter" aria-label="${escapeHtml(`Faltan ${value} segundos`)}">
        <b>${escapeHtml(value)}</b>
      </strong>
      <em>Prepara el mouse o el dedo para comenzar.</em>
    </div>
  `;
}

function refreshWordSearchTime() {
  const gameState = getWordSearchState();
  const time = document.getElementById("wordSearchTime");
  const isLive = Boolean(gameState.startedAt && !gameState.completedAt);

  if (time) {
    const nextTime = formatWordSearchTime(getWordSearchElapsedMs(gameState));
    const stat = time.closest(".word-search-stat");
    stat?.classList.toggle("is-timer-live", isLive);
    updateWordSearchMetric("wordSearchTime", nextTime, { pulse: isLive });
  }
}

function renderWordSearchGame() {
  const container = document.querySelector(`[data-word-search="${WORD_SEARCH_ACTIVITY_ID}"]`);
  if (!container) {
    return;
  }

  const gameState = getWordSearchState();
  const puzzle = getWordSearchPuzzle(gameState.variant);
  const startButton = document.getElementById("wordSearchStart");

  container.classList.toggle("is-counting-down", Boolean(wordSearchCountdownTimer));
  container.classList.toggle("is-running", Boolean(gameState.startedAt && !gameState.completedAt));
  container.classList.toggle("is-completed", Boolean(gameState.completedAt));

  renderWordSearchBoard(gameState);
  renderWordSearchTargets(gameState);
  renderWordSearchFound(gameState);
  renderWordSearchLeaderboard(readWordSearchLeaderboard());
  refreshWordSearchTime();
  setWordSearchFullscreen(wordSearchFullscreenActive);

  updateWordSearchMetric("wordSearchScore", gameState.score);
  updateWordSearchMetric("wordSearchCount", `${gameState.found.length} / ${puzzle.targets.length}`);
  updateWordSearchMetric("wordSearchMistakes", gameState.mistakes);

  if (startButton) {
    startButton.disabled = Boolean(wordSearchCountdownTimer || (gameState.startedAt && !gameState.completedAt));
    startButton.textContent =
      wordSearchCountdownTimer
        ? `Comienza en ${wordSearchCountdownValue}`
        : gameState.completedAt
        ? "Actividad completada"
        : gameState.startedAt
          ? "Actividad en curso"
          : "Comenzar";
  }
}

function normalizeWordSearchLeaderboardEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const score = Number(entry.score) || 0;
  const elapsedMs = Math.max(0, Number(entry.elapsedMs) || 0);
  if (score <= 0) {
    return null;
  }

  return {
    id: entry.id || `${entry.playerKey || "anon"}:${entry.completedAt || entry.updatedAt || Date.now()}`,
    playerKey: entry.playerKey || entry.id || "",
    playerName: entry.playerName || "Aprendiz",
    ficha: entry.ficha || "",
    grupo: entry.grupo || "",
    inst: entry.inst || "",
    variant: normalizeWordSearchVariant(entry.variant || 1),
    score,
    elapsedMs,
    foundCount: Number(entry.foundCount) || 0,
    totalWords: Number(entry.totalWords) || getWordSearchPuzzle(1).targets.length,
    completedAt: entry.completedAt || "",
    updatedAt: entry.updatedAt || entry.completedAt || "",
  };
}

function isBetterWordSearchEntry(candidate, current) {
  if (!current) {
    return true;
  }
  if (candidate.score !== current.score) {
    return candidate.score > current.score;
  }
  if (candidate.elapsedMs !== current.elapsedMs) {
    return candidate.elapsedMs < current.elapsedMs;
  }
  return Date.parse(candidate.updatedAt || "") > Date.parse(current.updatedAt || "");
}

function mergeWordSearchLeaderboard(...lists) {
  const bestByPlayer = new Map();
  lists
    .flat()
    .map(normalizeWordSearchLeaderboardEntry)
    .filter(Boolean)
    .forEach((entry) => {
      const key = entry.playerKey || entry.id;
      const current = bestByPlayer.get(key);
      if (isBetterWordSearchEntry(entry, current)) {
        bestByPlayer.set(key, entry);
      }
    });

  return Array.from(bestByPlayer.values()).sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (a.elapsedMs !== b.elapsedMs) {
      return a.elapsedMs - b.elapsedMs;
    }
    return String(a.playerName).localeCompare(String(b.playerName));
  });
}

function readWordSearchLeaderboard() {
  try {
    const saved = JSON.parse(localStorage.getItem(WORD_SEARCH_LOCAL_LEADERBOARD_KEY) || "[]");
    return mergeWordSearchLeaderboard(Array.isArray(saved) ? saved : []).slice(0, 20);
  } catch {
    return [];
  }
}

function saveWordSearchLeaderboard(entries) {
  try {
    localStorage.setItem(
      WORD_SEARCH_LOCAL_LEADERBOARD_KEY,
      JSON.stringify(mergeWordSearchLeaderboard(entries).slice(0, 20))
    );
  } catch {
  }
}

function buildWordSearchLeaderboardEntry(gameState) {
  const meta = buildWordSearchPlayerMeta();
  return {
    id: `${meta.playerKey}:${gameState.completedAt || new Date().toISOString()}`,
    ...meta,
    score: gameState.score,
    elapsedMs: getWordSearchElapsedMs(gameState),
    foundCount: gameState.found.length,
    totalWords: getWordSearchPuzzle(gameState.variant).targets.length,
    variant: gameState.variant,
    completedAt: gameState.completedAt || "",
    updatedAt: new Date().toISOString(),
  };
}

function renderWordSearchLeaderboard(entries) {
  const leaderboard = document.getElementById("wordSearchLeaderboard");
  if (!leaderboard) {
    return;
  }

  const topEntries = mergeWordSearchLeaderboard(entries).slice(0, 5);
  if (!topEntries.length) {
    leaderboard.innerHTML = "<li>Sin registros todavia.</li>";
    return;
  }

  leaderboard.innerHTML = topEntries
    .map(
      (entry) => `
        <li>
          <strong>${escapeHtml(entry.playerName)}</strong>
          ${escapeHtml(String(entry.score))} pts
          <span>(${escapeHtml(formatWordSearchTime(entry.elapsedMs))})</span>
        </li>
      `
    )
    .join("");
}

async function loadWordSearchLeaderboard() {
  renderWordSearchLeaderboard(readWordSearchLeaderboard());
  if (!window._firebaseDb || typeof window._firebaseDb.cloudGetGuideData !== "function") {
    return;
  }

  try {
    const snapshot = await window._firebaseDb.cloudGetGuideData(
      WORD_SEARCH_LEADERBOARD_SCOPE,
      GUIDE_DATA_FILE
    );
    const cloudEntries = Array.isArray(snapshot?.state?.entries) ? snapshot.state.entries : [];
    const merged = mergeWordSearchLeaderboard(readWordSearchLeaderboard(), cloudEntries).slice(0, 20);
    saveWordSearchLeaderboard(merged);
    renderWordSearchLeaderboard(merged);
  } catch {
  }
}

async function publishWordSearchLeaderboard(gameState) {
  const entry = buildWordSearchLeaderboardEntry(gameState);
  const localEntries = mergeWordSearchLeaderboard(readWordSearchLeaderboard(), [entry]).slice(0, 20);
  saveWordSearchLeaderboard(localEntries);
  renderWordSearchLeaderboard(localEntries);

  if (
    !window._firebaseDb ||
    typeof window._firebaseDb.cloudGetGuideData !== "function" ||
    typeof window._firebaseDb.cloudSaveGuideData !== "function"
  ) {
    return;
  }

  try {
    const snapshot = await window._firebaseDb.cloudGetGuideData(
      WORD_SEARCH_LEADERBOARD_SCOPE,
      GUIDE_DATA_FILE
    );
    const cloudEntries = Array.isArray(snapshot?.state?.entries) ? snapshot.state.entries : [];
    const merged = mergeWordSearchLeaderboard(cloudEntries, localEntries, [entry]).slice(0, 20);
    const saved = await window._firebaseDb.cloudSaveGuideData(
      WORD_SEARCH_LEADERBOARD_SCOPE,
      GUIDE_DATA_FILE,
      {
        scopeKey: WORD_SEARCH_LEADERBOARD_SCOPE,
        fileName: GUIDE_DATA_FILE,
        updatedAt: new Date().toISOString(),
        updatedBy: "leaderboard",
        state: { entries: merged },
      }
    );
    if (saved) {
      saveWordSearchLeaderboard(merged);
      renderWordSearchLeaderboard(merged);
    }
  } catch {
  }
}

function initializeWordSearchGame() {
  const container = document.querySelector(`[data-word-search="${WORD_SEARCH_ACTIVITY_ID}"]`);
  if (!container) {
    return;
  }

  renderWordSearchGame();
  if (container.dataset.wordSearchReady === "1") {
    return;
  }

  container.dataset.wordSearchReady = "1";
  document.getElementById("wordSearchStart")?.addEventListener("click", startWordSearchGame);
  document.getElementById("wordSearchReset")?.addEventListener("click", resetWordSearchGame);
  document.getElementById("wordSearchFullscreen")?.addEventListener("click", toggleWordSearchFullscreen);

  // En móvil (<600 px) activar pantalla completa automáticamente para que
  // las celdas sean más grandes y la selección táctil sea precisa.
  if (window.innerWidth < 600 && !wordSearchFullscreenActive) {
    window.setTimeout(() => setWordSearchFullscreen(true), 300);
  }
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && wordSearchFullscreenActive) {
      setWordSearchFullscreen(false);
    }
  });
  const board = document.getElementById("wordSearchBoard");
  board?.addEventListener("pointerdown", (event) => {
    const button = getWordSearchCellFromPointerEvent(event);
    if (!button || !beginWordSearchSelection(button)) {
      return;
    }
    board.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });
  board?.addEventListener("pointermove", (event) => {
    if (!wordSearchIsDragging) {
      return;
    }
    const button = getWordSearchCellFromPointerEvent(event);
    if (button) {
      previewWordSearchSelection(button);
    }
    event.preventDefault();
  });
  board?.addEventListener("pointerup", (event) => {
    const button = getWordSearchCellFromPointerEvent(event);
    finishWordSearchSelection(button);
    if (board.hasPointerCapture?.(event.pointerId)) {
      board.releasePointerCapture(event.pointerId);
    }
    event.preventDefault();
  });
  board?.addEventListener("pointercancel", () => {
    wordSearchIsDragging = false;
    wordSearchSelectionStart = null;
    wordSearchLastSelectionCells = [];
    clearWordSearchSelection();
  });
  window.clearInterval(wordSearchTimer);
  wordSearchTimer = window.setInterval(refreshWordSearchTime, 1000);
  loadWordSearchLeaderboard();
}

function normalizeMatchingGameVariant(value) {
  const variant = Number(value) || 1;
  if (variant < 1 || variant > MATCHING_GAME_VARIANT_COUNT) {
    return 1;
  }
  return Math.floor(variant);
}

function pickMatchingGameVariant() {
  return Math.floor(Math.random() * MATCHING_GAME_VARIANT_COUNT) + 1;
}

function getMatchingGameVariant(variant) {
  const variantId = normalizeMatchingGameVariant(variant);
  return MATCHING_GAME_VARIANTS.find((item) => item.id === variantId) || MATCHING_GAME_VARIANTS[0];
}

function getMatchingGamePairs(variant) {
  return getMatchingGameVariant(variant).pairs;
}

function getMatchingGameOptions(variant) {
  const pairs = getMatchingGamePairs(variant);
  const random = createSeededRandom(hashString(`${MATCHING_GAME_ACTIVITY_ID}:options:${variant}`));
  return pairs
    .map((pair) => ({ ...pair, sort: random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ sort, ...pair }) => pair);
}

function sanitizeMatchingGameMatches(source, variant) {
  const pairs = getMatchingGamePairs(variant);
  const validIds = new Set(pairs.map((pair) => pair.id));
  const matches = {};

  Object.entries(source || {}).forEach(([toolId, optionId]) => {
    if (validIds.has(toolId) && toolId === optionId) {
      matches[toolId] = optionId;
    }
  });

  return matches;
}

function calculateMatchingGameScore(correctCount, total, mistakes) {
  if (!total) {
    return 0;
  }
  const baseScore = Math.round((correctCount / total) * MATCHING_GAME_MAX_SCORE);
  const penalty = Math.max(0, Number(mistakes) || 0) * MATCHING_GAME_ERROR_PENALTY;
  return Math.max(0, Math.min(MATCHING_GAME_MAX_SCORE, baseScore - penalty));
}

function getMatchingGameMatchedPairs(variant, matches) {
  return getMatchingGamePairs(variant)
    .filter((pair) => matches[pair.id] === pair.id)
    .map((pair) => ({
      tool: pair.tool,
      answer: pair.answer,
    }));
}

function getMatchingGameState() {
  const saved =
    state[MATCHING_GAME_STATE_KEY] && typeof state[MATCHING_GAME_STATE_KEY] === "object"
      ? state[MATCHING_GAME_STATE_KEY]
      : {};
  const variant = normalizeMatchingGameVariant(saved.variant || 1);
  const pairs = getMatchingGamePairs(variant);
  const matches = sanitizeMatchingGameMatches(saved.matches, variant);
  const correctCount = Object.keys(matches).length;
  const mistakes = Math.max(0, Number(saved.mistakes) || 0);

  return {
    variant,
    matches,
    matchedPairs: getMatchingGameMatchedPairs(variant, matches),
    correctCount,
    totalPairs: pairs.length,
    mistakes,
    score: calculateMatchingGameScore(correctCount, pairs.length, mistakes),
    startedAt: saved.startedAt || "",
    completedAt: saved.completedAt || "",
    elapsedMs: Number(saved.elapsedMs) || 0,
    leaderboardPublishedAt: saved.leaderboardPublishedAt || "",
    playerKey: saved.playerKey || "",
    playerName: saved.playerName || "",
    ficha: saved.ficha || "",
    grupo: saved.grupo || "",
    inst: saved.inst || "",
    updatedAt: saved.updatedAt || "",
  };
}

function getMatchingGameElapsedMs(gameState) {
  if (!gameState?.startedAt) {
    return Math.max(0, Number(gameState?.elapsedMs) || 0);
  }

  if (gameState.completedAt && gameState.elapsedMs) {
    return Math.max(0, Number(gameState.elapsedMs) || 0);
  }

  const started = Date.parse(gameState.startedAt);
  if (!Number.isFinite(started)) {
    return Math.max(0, Number(gameState.elapsedMs) || 0);
  }

  const finished = Date.parse(gameState.completedAt || "");
  const endTime = Number.isFinite(finished) ? finished : Date.now();
  return Math.max(0, endTime - started);
}

function buildMatchingGamePlayerMeta() {
  return buildWordSearchPlayerMeta();
}

function setMatchingGameState(next) {
  const current = getMatchingGameState();
  const variant = normalizeMatchingGameVariant(next.variant || current.variant || 1);
  const matches = Object.prototype.hasOwnProperty.call(next, "matches")
    ? sanitizeMatchingGameMatches(next.matches, variant)
    : sanitizeMatchingGameMatches(current.matches, variant);
  const pairs = getMatchingGamePairs(variant);
  const correctCount = Object.keys(matches).length;
  const mistakes =
    Object.prototype.hasOwnProperty.call(next, "mistakes")
      ? Math.max(0, Number(next.mistakes) || 0)
      : current.mistakes;

  state[MATCHING_GAME_STATE_KEY] = {
    ...current,
    ...next,
    variant,
    matches,
    matchedPairs: getMatchingGameMatchedPairs(variant, matches),
    correctCount,
    totalPairs: pairs.length,
    mistakes,
    score: calculateMatchingGameScore(correctCount, pairs.length, mistakes),
    updatedAt: new Date().toISOString(),
  };
  saveState();
  renderMatchingGame();
}

function setMatchingGameStatus(message) {
  const status = document.getElementById("matchingGameStatus");
  if (status) {
    status.textContent = message;
  }
}

function pulseMatchingGameMetric(element) {
  const metric = element?.closest?.(".matching-game-stat") || element;
  if (!metric) {
    return;
  }

  metric.classList.remove("is-updating");
  void metric.offsetWidth;
  metric.classList.add("is-updating");
  window.setTimeout(() => {
    metric.classList.remove("is-updating");
  }, 420);
}

function updateMatchingGameMetric(id, value, options) {
  const element = document.getElementById(id);
  if (!element) {
    return;
  }

  const nextValue = String(value);
  if (element.textContent !== nextValue) {
    element.textContent = nextValue;
    if (!options || options.pulse !== false) {
      pulseMatchingGameMetric(element);
    }
  }
}

function clearMatchingGameCountdown() {
  window.clearInterval(matchingGameCountdownTimer);
  matchingGameCountdownTimer = null;
  matchingGameCountdownValue = 0;
  matchingGameCountdownVariant = 0;
  matchingGameCountdownPhase = "idle";
}

function isMatchingGameCountingDown() {
  return Boolean(matchingGameCountdownTimer || matchingGameCountdownPhase === "countdown");
}

function startMatchingGameCountdown(variant) {
  clearMatchingGameCountdown();
  matchingGameCountdownVariant = normalizeMatchingGameVariant(variant);
  matchingGameCountdownValue = 3;
  matchingGameCountdownPhase = "countdown";
  renderMatchingGame();
  setMatchingGameStatus("Cuenta regresiva: 3 segundos para iniciar.");

  matchingGameCountdownTimer = window.setInterval(() => {
    matchingGameCountdownValue -= 1;
    if (matchingGameCountdownValue <= 0) {
      finishMatchingGameCountdown();
      return;
    }

    renderMatchingGame();
    setMatchingGameStatus(`Cuenta regresiva: ${matchingGameCountdownValue} segundos para iniciar.`);
  }, 1000);
}

function finishMatchingGameCountdown() {
  const variant = matchingGameCountdownVariant || getMatchingGameState().variant || 1;
  clearMatchingGameCountdown();
  setMatchingGameState({
    ...buildMatchingGamePlayerMeta(),
    variant,
    startedAt: new Date().toISOString(),
    countdownStartedAt: "",
  });
  setMatchingGameStatus("Cronometro activo. Selecciona una herramienta y luego su funcion.");
}

function startMatchingGame() {
  const current = getMatchingGameState();
  if (current.completedAt) {
    setMatchingGameStatus("Actividad completada. Puedes reiniciar si deseas mejorar el tiempo.");
    return;
  }

  if (isMatchingGameCountingDown()) {
    setMatchingGameStatus(`Cuenta regresiva: ${matchingGameCountdownValue} segundos para iniciar.`);
    return;
  }

  if (current.startedAt) {
    setMatchingGameStatus("La actividad ya esta en curso. Completa las parejas pendientes.");
    return;
  }

  const variant = pickMatchingGameVariant();
  matchingGameSelectedTool = "";
  matchingGameWrongPair = null;
  setMatchingGameState({
    ...buildMatchingGamePlayerMeta(),
    variant,
    matches: {},
    matchedPairs: [],
    startedAt: "",
    countdownStartedAt: new Date().toISOString(),
    completedAt: "",
    elapsedMs: 0,
    mistakes: 0,
    leaderboardPublishedAt: "",
  });
  startMatchingGameCountdown(variant);
}

function resetMatchingGame() {
  const current = getMatchingGameState();
  const hasProgress = current.startedAt || current.correctCount || current.mistakes;
  if (hasProgress && !window.confirm("Se reiniciara la Actividad 2 y el tiempo. Deseas continuar?")) {
    return;
  }

  clearMatchingGameCountdown();
  matchingGameSelectedTool = "";
  matchingGameWrongPair = null;
  state[MATCHING_GAME_STATE_KEY] = {
    variant: normalizeMatchingGameVariant(current.variant),
    matches: {},
    matchedPairs: [],
    correctCount: 0,
    totalPairs: getMatchingGamePairs(current.variant).length,
    score: 0,
    startedAt: "",
    countdownStartedAt: "",
    completedAt: "",
    elapsedMs: 0,
    leaderboardPublishedAt: "",
    mistakes: 0,
    updatedAt: new Date().toISOString(),
  };
  saveState();
  renderMatchingGame();
  setMatchingGameStatus("Pulsa Comenzar para activar la cuenta regresiva.");
}

function canUseMatchingGame(gameState) {
  if (isMatchingGameCountingDown()) {
    setMatchingGameStatus(`Cuenta regresiva: ${matchingGameCountdownValue} segundos para iniciar.`);
    return false;
  }

  if (!gameState.startedAt) {
    setMatchingGameStatus("Primero pulsa Comenzar y espera la cuenta regresiva.");
    return false;
  }

  if (gameState.completedAt) {
    setMatchingGameStatus("Ya completaste todas las parejas. Reinicia solo si quieres mejorar el tiempo.");
    return false;
  }

  return true;
}

function selectMatchingTool(toolId) {
  const gameState = getMatchingGameState();
  if (!canUseMatchingGame(gameState)) {
    return;
  }

  const pair = getMatchingGamePairs(gameState.variant).find((item) => item.id === toolId);
  if (!pair) {
    return;
  }

  if (gameState.matches[toolId]) {
    setMatchingGameStatus(`${pair.tool} ya esta relacionado correctamente.`);
    return;
  }

  matchingGameSelectedTool = toolId;
  matchingGameWrongPair = null;
  renderMatchingGame();
  setMatchingGameStatus(`Seleccionaste ${pair.tool}. Ahora elige su funcion.`);
}

function selectMatchingAnswer(answerId) {
  let gameState = getMatchingGameState();
  if (!canUseMatchingGame(gameState)) {
    return;
  }

  if (!matchingGameSelectedTool) {
    setMatchingGameStatus("Haz clic primero en una herramienta y luego en su funcion.");
    return;
  }

  if (Object.values(gameState.matches).includes(answerId)) {
    setMatchingGameStatus("Esa funcion ya fue usada correctamente. Elige otra opcion.");
    return;
  }

  const selectedPair = getMatchingGamePairs(gameState.variant).find(
    (pair) => pair.id === matchingGameSelectedTool
  );
  const selectedOption = getMatchingGamePairs(gameState.variant).find((pair) => pair.id === answerId);
  if (!selectedPair || !selectedOption) {
    return;
  }

  if (selectedPair.id !== answerId) {
    matchingGameWrongPair = {
      toolId: selectedPair.id,
      optionId: answerId,
    };
    setMatchingGameState({
      mistakes: gameState.mistakes + 1,
    });
    setMatchingGameStatus(
      `Relacion incorrecta: -${MATCHING_GAME_ERROR_PENALTY} puntos. Revisa la funcion de ${selectedPair.tool}.`
    );
    window.setTimeout(() => {
      matchingGameWrongPair = null;
      renderMatchingGame();
    }, 560);
    return;
  }

  const matches = {
    ...gameState.matches,
    [selectedPair.id]: answerId,
  };
  const completed = Object.keys(matches).length >= gameState.totalPairs;
  const now = new Date().toISOString();
  const elapsedMs = completed ? getMatchingGameElapsedMs(gameState) : gameState.elapsedMs;
  matchingGameSelectedTool = "";
  matchingGameWrongPair = null;

  setMatchingGameState({
    ...buildMatchingGamePlayerMeta(),
    matches,
    completedAt: completed ? now : "",
    elapsedMs,
    leaderboardPublishedAt: completed ? now : gameState.leaderboardPublishedAt,
    lastMatchedAt: now,
  });

  if (completed) {
    publishMatchingGameLeaderboard(getMatchingGameState());
    setMatchingGameStatus("Excelente. Completaste las relaciones y tu puntaje entro al ranking.");
    return;
  }

  setMatchingGameStatus(`Correcto: ${selectedPair.tool} se relaciona con "${selectedPair.answer}"`);
}

function renderMatchingGameBoard(gameState) {
  const board = document.getElementById("matchingGameBoard");
  if (!board) {
    return;
  }

  const isCountingDown = isMatchingGameCountingDown();
  board.classList.toggle("is-waiting", !gameState.startedAt);
  board.classList.toggle("is-countdown", isCountingDown);

  if (!gameState.startedAt) {
    board.innerHTML = isCountingDown
      ? renderMatchingGameCountdownOverlay()
      : `
        <div class="matching-game-ready">
          <strong>Actividad 2</strong>
          <span>Pulsa Comenzar para recibir una de las 2 versiones disponibles.</span>
        </div>
      `;
    return;
  }

  board.innerHTML = getMatchingGamePairs(gameState.variant)
    .map((pair, index) => {
      const isMatched = gameState.matches[pair.id] === pair.id;
      const isSelected = matchingGameSelectedTool === pair.id;
      const isWrong = matchingGameWrongPair?.toolId === pair.id;
      return `
        <button
          class="matching-game-tool ${isMatched ? "is-locked" : ""} ${isSelected ? "is-selected" : ""} ${isWrong ? "is-wrong" : ""}"
          type="button"
          data-matching-tool="${escapeHtml(pair.id)}"
          ${isMatched ? "disabled" : ""}
          style="--matching-index:${index}"
        >
          <span>${escapeHtml(pair.tool)}</span>
          <em>${isMatched ? escapeHtml(pair.answer) : isSelected ? "Elige una funcion disponible" : "Pendiente por relacionar"}</em>
        </button>
      `;
    })
    .join("");
}

function renderMatchingGameOptions(gameState) {
  const options = document.getElementById("matchingGameOptions");
  if (!options) {
    return;
  }

  if (!gameState.startedAt) {
    options.innerHTML = '<p class="matching-game-placeholder">Las funciones aparecen despues de la cuenta regresiva.</p>';
    return;
  }

  const usedOptions = new Set(Object.values(gameState.matches));
  options.innerHTML = getMatchingGameOptions(gameState.variant)
    .map((pair, index) => {
      const isUsed = usedOptions.has(pair.id);
      const isWrong = matchingGameWrongPair?.optionId === pair.id;
      return `
        <button
          class="matching-game-option ${isUsed ? "is-used" : ""} ${isWrong ? "is-wrong" : ""}"
          type="button"
          data-matching-option="${escapeHtml(pair.id)}"
          ${isUsed ? "disabled" : ""}
          style="--matching-index:${index}"
        >
          ${escapeHtml(pair.answer)}
        </button>
      `;
    })
    .join("");
}

function renderMatchingGameCountdownOverlay() {
  const value = Math.max(1, Number(matchingGameCountdownValue) || 1);

  return `
    <div class="matching-game-countdown" aria-live="polite" data-countdown-phase="${escapeHtml(matchingGameCountdownPhase)}">
      <span>Cuenta regresiva</span>
      <strong aria-label="${escapeHtml(`Faltan ${value} segundos`)}">
        <b>${escapeHtml(value)}</b>
      </strong>
      <em>Observa las herramientas y prepara la primera relacion.</em>
    </div>
  `;
}

function refreshMatchingGameTime() {
  const gameState = getMatchingGameState();
  const time = document.getElementById("matchingGameTime");
  const isLive = Boolean(gameState.startedAt && !gameState.completedAt);

  if (time) {
    const nextTime = formatWordSearchTime(getMatchingGameElapsedMs(gameState));
    const stat = time.closest(".matching-game-stat");
    stat?.classList.toggle("is-timer-live", isLive);
    updateMatchingGameMetric("matchingGameTime", nextTime, { pulse: isLive });
  }
}

function renderMatchingGame() {
  const container = document.querySelector(`[data-matching-game="${MATCHING_GAME_ACTIVITY_ID}"]`);
  if (!container) {
    return;
  }

  const gameState = getMatchingGameState();
  const startButton = document.getElementById("matchingGameStart");
  const isCountingDown = isMatchingGameCountingDown();

  container.classList.toggle("is-counting-down", isCountingDown);
  container.classList.toggle("is-running", Boolean(gameState.startedAt && !gameState.completedAt));
  container.classList.toggle("is-completed", Boolean(gameState.completedAt));

  renderMatchingGameBoard(gameState);
  renderMatchingGameOptions(gameState);
  renderMatchingGameLeaderboard(readMatchingGameLeaderboard());
  refreshMatchingGameTime();

  updateMatchingGameMetric("matchingGameScore", gameState.score);
  updateMatchingGameMetric("matchingGameCorrect", `${gameState.correctCount} / ${gameState.totalPairs}`);
  updateMatchingGameMetric("matchingGameMistakes", gameState.mistakes);

  if (startButton) {
    startButton.disabled = Boolean(isCountingDown || (gameState.startedAt && !gameState.completedAt));
    startButton.textContent =
      isCountingDown
        ? `Comienza en ${matchingGameCountdownValue}`
        : gameState.completedAt
        ? "Actividad completada"
        : gameState.startedAt
          ? "Actividad en curso"
          : "Comenzar";
  }
}

function normalizeMatchingGameLeaderboardEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const score = Number(entry.score) || 0;
  const elapsedMs = Math.max(0, Number(entry.elapsedMs) || 0);
  if (score <= 0) {
    return null;
  }

  return {
    id: entry.id || `${entry.playerKey || "anon"}:${entry.completedAt || entry.updatedAt || Date.now()}`,
    playerKey: entry.playerKey || entry.id || "",
    playerName: entry.playerName || "Aprendiz",
    ficha: entry.ficha || "",
    grupo: entry.grupo || "",
    inst: entry.inst || "",
    variant: normalizeMatchingGameVariant(entry.variant || 1),
    score,
    elapsedMs,
    correctCount: Number(entry.correctCount) || 0,
    totalPairs: Number(entry.totalPairs) || getMatchingGamePairs(1).length,
    mistakes: Number(entry.mistakes) || 0,
    completedAt: entry.completedAt || "",
    updatedAt: entry.updatedAt || entry.completedAt || "",
  };
}

function isBetterMatchingGameEntry(candidate, current) {
  if (!current) {
    return true;
  }
  if (candidate.score !== current.score) {
    return candidate.score > current.score;
  }
  if (candidate.elapsedMs !== current.elapsedMs) {
    return candidate.elapsedMs < current.elapsedMs;
  }
  return Date.parse(candidate.updatedAt || "") > Date.parse(current.updatedAt || "");
}

function mergeMatchingGameLeaderboard(...lists) {
  const bestByPlayer = new Map();
  lists
    .flat()
    .map(normalizeMatchingGameLeaderboardEntry)
    .filter(Boolean)
    .forEach((entry) => {
      const key = entry.playerKey || entry.id;
      const current = bestByPlayer.get(key);
      if (isBetterMatchingGameEntry(entry, current)) {
        bestByPlayer.set(key, entry);
      }
    });

  return Array.from(bestByPlayer.values()).sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (a.elapsedMs !== b.elapsedMs) {
      return a.elapsedMs - b.elapsedMs;
    }
    return String(a.playerName).localeCompare(String(b.playerName));
  });
}

function readMatchingGameLeaderboard() {
  try {
    const saved = JSON.parse(localStorage.getItem(MATCHING_GAME_LOCAL_LEADERBOARD_KEY) || "[]");
    return mergeMatchingGameLeaderboard(Array.isArray(saved) ? saved : []).slice(0, 20);
  } catch {
    return [];
  }
}

function saveMatchingGameLeaderboard(entries) {
  try {
    localStorage.setItem(
      MATCHING_GAME_LOCAL_LEADERBOARD_KEY,
      JSON.stringify(mergeMatchingGameLeaderboard(entries).slice(0, 20))
    );
  } catch {
  }
}

function buildMatchingGameLeaderboardEntry(gameState) {
  const meta = buildMatchingGamePlayerMeta();
  return {
    id: `${meta.playerKey}:${gameState.completedAt || new Date().toISOString()}`,
    ...meta,
    score: gameState.score,
    elapsedMs: getMatchingGameElapsedMs(gameState),
    correctCount: gameState.correctCount,
    totalPairs: gameState.totalPairs,
    mistakes: gameState.mistakes,
    variant: gameState.variant,
    completedAt: gameState.completedAt || "",
    updatedAt: new Date().toISOString(),
  };
}

function renderMatchingGameLeaderboard(entries) {
  const leaderboard = document.getElementById("matchingGameLeaderboard");
  if (!leaderboard) {
    return;
  }

  const topEntries = mergeMatchingGameLeaderboard(entries).slice(0, 5);
  if (!topEntries.length) {
    leaderboard.innerHTML = "<li>Sin registros todavia.</li>";
    return;
  }

  leaderboard.innerHTML = topEntries
    .map(
      (entry) => `
        <li>
          <strong>${escapeHtml(entry.playerName)}</strong>
          ${escapeHtml(String(entry.score))} pts
          <span>(${escapeHtml(formatWordSearchTime(entry.elapsedMs))})</span>
        </li>
      `
    )
    .join("");
}

async function loadMatchingGameLeaderboard() {
  renderMatchingGameLeaderboard(readMatchingGameLeaderboard());
  if (!window._firebaseDb || typeof window._firebaseDb.cloudGetGuideData !== "function") {
    return;
  }

  try {
    const snapshot = await window._firebaseDb.cloudGetGuideData(
      MATCHING_GAME_LEADERBOARD_SCOPE,
      GUIDE_DATA_FILE
    );
    const cloudEntries = Array.isArray(snapshot?.state?.entries) ? snapshot.state.entries : [];
    const merged = mergeMatchingGameLeaderboard(readMatchingGameLeaderboard(), cloudEntries).slice(0, 20);
    saveMatchingGameLeaderboard(merged);
    renderMatchingGameLeaderboard(merged);
  } catch {
  }
}

async function publishMatchingGameLeaderboard(gameState) {
  const entry = buildMatchingGameLeaderboardEntry(gameState);
  const localEntries = mergeMatchingGameLeaderboard(readMatchingGameLeaderboard(), [entry]).slice(0, 20);
  saveMatchingGameLeaderboard(localEntries);
  renderMatchingGameLeaderboard(localEntries);

  if (
    !window._firebaseDb ||
    typeof window._firebaseDb.cloudGetGuideData !== "function" ||
    typeof window._firebaseDb.cloudSaveGuideData !== "function"
  ) {
    return;
  }

  try {
    const snapshot = await window._firebaseDb.cloudGetGuideData(
      MATCHING_GAME_LEADERBOARD_SCOPE,
      GUIDE_DATA_FILE
    );
    const cloudEntries = Array.isArray(snapshot?.state?.entries) ? snapshot.state.entries : [];
    const merged = mergeMatchingGameLeaderboard(cloudEntries, localEntries, [entry]).slice(0, 20);
    const saved = await window._firebaseDb.cloudSaveGuideData(
      MATCHING_GAME_LEADERBOARD_SCOPE,
      GUIDE_DATA_FILE,
      {
        scopeKey: MATCHING_GAME_LEADERBOARD_SCOPE,
        fileName: GUIDE_DATA_FILE,
        updatedAt: new Date().toISOString(),
        updatedBy: "leaderboard",
        state: { entries: merged },
      }
    );
    if (saved) {
      saveMatchingGameLeaderboard(merged);
      renderMatchingGameLeaderboard(merged);
    }
  } catch {
  }
}

function initializeMatchingGame() {
  const container = document.querySelector(`[data-matching-game="${MATCHING_GAME_ACTIVITY_ID}"]`);
  if (!container) {
    return;
  }

  renderMatchingGame();
  if (container.dataset.matchingGameReady === "1") {
    return;
  }

  container.dataset.matchingGameReady = "1";
  document.getElementById("matchingGameStart")?.addEventListener("click", startMatchingGame);
  document.getElementById("matchingGameReset")?.addEventListener("click", resetMatchingGame);
  document.getElementById("matchingGameBoard")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-matching-tool]");
    if (!button) {
      return;
    }
    selectMatchingTool(button.dataset.matchingTool || "");
  });
  document.getElementById("matchingGameOptions")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-matching-option]");
    if (!button) {
      return;
    }
    selectMatchingAnswer(button.dataset.matchingOption || "");
  });
  window.clearInterval(matchingGameTimer);
  matchingGameTimer = window.setInterval(refreshMatchingGameTime, 1000);
  loadMatchingGameLeaderboard();
}

function renderWordBank() {
  const bank = document.getElementById("wordBank");
  if (!bank) {
    return;
  }
  bank.innerHTML = wordList
    .map((word) => {
      const key = `word:${slugify(word)}`;
      const active = Boolean(state[key]);
      return `
        <button
          type="button"
          class="chip ${active ? "is-active" : ""}"
          data-word-key="${key}"
          data-track-button="${active}"
        >
          ${escapeHtml(word)}
        </button>
      `;
    })
    .join("");
}

function renderConceptLegend() {
  const legend = document.getElementById("conceptLegend");
  if (!legend) {
    return;
  }
  legend.innerHTML = conceptOptions
    .map(
      (option) => `
        <article class="concept-card">
          <strong>${escapeHtml(option.label)}</strong>
          <p>${escapeHtml(option.text)}</p>
        </article>
      `
    )
    .join("");
}

function renderMatchingTable() {
  const tbody = document.getElementById("matchingTable");
  if (!tbody) {
    return;
  }
  tbody.innerHTML = matchingTools
    .map((tool) => {
      const storeKey = `matching:${tool.id}`;
      const value = state[storeKey] || "";
      return `
        <tr class="match-row">
          <th scope="row">${escapeHtml(tool.name)}</th>
          <td>
            <select data-store="${storeKey}" data-track data-match="${tool.id}">
              <option value="">Selecciona un concepto</option>
              ${conceptOptions
                .map(
                  (option) => `
                    <option value="${option.id}" ${value === option.id ? "selected" : ""}>
                      ${escapeHtml(option.label)}
                    </option>
                  `
                )
                .join("")}
            </select>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderExtensionTable() {
  const tbody = document.getElementById("extensionTable");
  if (!tbody) {
    return;
  }
  tbody.innerHTML = extensions
    .map((row) => {
      const programKey = `extension:${row.id}:program`;
      const descriptionKey = `extension:${row.id}:description`;
      const program = state[programKey] ?? row.program;
      const description = state[descriptionKey] ?? row.description;

      return `
        <tr>
          <th scope="row">
            <span class="extension-tag">${escapeHtml(row.ext)}</span>
          </th>
          <td>
            <input
              type="text"
              list="programSuggestions"
              data-store="${programKey}"
              data-track
              placeholder="Programa asociado"
              value="${escapeHtml(program)}"
            >
          </td>
          <td>
            <textarea
              rows="3"
              data-store="${descriptionKey}"
              data-track
              placeholder="Describe el tipo de archivo o su uso principal."
            >${escapeHtml(description)}</textarea>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderSystemTable() {
  const tbody = document.getElementById("systemTable");
  if (!tbody) {
    return;
  }
  tbody.innerHTML = systems
    .map((row) => {
      const processorKey = `system:${row.id}:processor`;
      const ramKey = `system:${row.id}:ram`;
      const diskKey = `system:${row.id}:disk`;
      const sourceKey = `system:${row.id}:source`;

      return `
        <tr>
          <th scope="row">${escapeHtml(row.name)}</th>
          <td>
            <input
              type="text"
              data-store="${processorKey}"
              data-track
              placeholder="Procesador minimo"
              value="${escapeHtml(state[processorKey] ?? row.processor)}"
            >
          </td>
          <td>
            <input
              type="text"
              data-store="${ramKey}"
              data-track
              placeholder="Memoria RAM"
              value="${escapeHtml(state[ramKey] ?? row.ram)}"
            >
          </td>
          <td>
            <input
              type="text"
              data-store="${diskKey}"
              data-track
              placeholder="Espacio en disco"
              value="${escapeHtml(state[diskKey] ?? row.disk)}"
            >
          </td>
          <td class="source-cell">
            <input
              type="text"
              data-store="${sourceKey}"
              data-track
              placeholder="Fuente consultada"
              value="${escapeHtml(state[sourceKey] ?? row.source)}"
            >
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderEvidenceTable() {
  const tbody = document.getElementById("evidenceTable");
  if (!tbody) {
    return;
  }
  tbody.innerHTML = evidenceRows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.phase)}</td>
          <td>${escapeHtml(row.project)}</td>
          <td>${escapeHtml(row.learning)}</td>
          <td>${escapeHtml(row.evidence)}</td>
          <td>${escapeHtml(row.criteria)}</td>
          <td>${escapeHtml(row.methods)}</td>
        </tr>
      `
    )
    .join("");
}

function renderSupportMaterials() {
  renderMaterialGroup("supportTemplatesGrid", supportTemplates);
  renderMaterialGroup("supportDocsGrid", supportDocuments);
  renderMaterialGroup("supportToolsGrid", supportTools);
}

function getDriveFolderUrl() {
  const selection = getGuideSelection();
  const ficha = selection.ficha || localStorage.getItem("sena_ficha") || "";
  return ficha ? DRIVE_FOLDERS[ficha] || "" : "";
}

function showDriveSelectionAlert() {
  window.alert(
    "No se encontro la carpeta de Drive para esta ficha. Regresa al portal y verifica que el grupo seleccionado sea el correcto."
  );
}

function ensureDriveQrModal() {
  let modal = document.getElementById("drive-qr-modal");
  if (modal) {
    return modal;
  }

  modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.id = "drive-qr-modal";
  modal.innerHTML = `
    <div class="modal-box" style="text-align:center;max-width:320px;padding:28px 28px 24px">
      <h3 id="drive-qr-title" style="font-size:16px;margin-bottom:4px">Abrir carpeta de Drive</h3>
      <p style="font-size:12px;color:var(--text-muted);margin-bottom:0">Escanea este codigo QR desde el celular.</p>
      <img id="drive-qr-img" class="qr-modal-img" src="" alt="Codigo QR de la carpeta de Drive">
      <div class="qr-url-text" id="drive-qr-url"></div>
      <button class="modal-btn-ok" type="button" style="width:100%" id="drive-qr-close">Cerrar</button>
    </div>
  `;

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeDriveFolderQR();
    }
  });

  document.body.appendChild(modal);
  document.getElementById("drive-qr-close")?.addEventListener("click", closeDriveFolderQR);
  return modal;
}

function openDriveFolder() {
  const url = getDriveFolderUrl();
  if (!url) {
    showDriveSelectionAlert();
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

function openExtensionesWordDelivery() {
  const delivery = window.sharedAppsScriptDelivery;
  if (!delivery || typeof delivery.openDeliveryModal !== "function") {
    alert("No se encontro disponible el formulario seguro de entrega. Recarga la pagina e intenta de nuevo.");
    return;
  }

  delivery.openDeliveryModal({
    guideLabel: "Guia 2",
    activityNumber: "3.3.1",
    activityTitle: "Actividad 5: Extensiones de archivo - Que hay detras del punto",
    activityLabel: "Actividad 5 - Extensiones de archivo",
    allowedExtensions: [".doc", ".docx"],
    fileNamePrefix: "Actividad_5_Extensiones",
    learnerNameMode: "full",
  });
}

window.openExtensionesWordDelivery = openExtensionesWordDelivery;

function openSistemasWordDelivery() {
  const delivery = window.sharedAppsScriptDelivery;
  if (!delivery || typeof delivery.openDeliveryModal !== "function") {
    alert("No se encontro disponible el formulario seguro de entrega. Recarga la pagina e intenta de nuevo.");
    return;
  }

  delivery.openDeliveryModal({
    guideLabel: "Guia 2",
    activityNumber: "3.3.2",
    activityTitle: "Actividad 6: Requerimientos mínimos de sistemas operativos",
    activityLabel: "Actividad 6 - Requerimientos mínimos de sistemas operativos",
    allowedExtensions: [".doc", ".docx"],
    fileNamePrefix: "Actividad_6_Requerimientos_SO",
    learnerNameMode: "full",
  });
}

window.openSistemasWordDelivery = openSistemasWordDelivery;

const GUIA2_SUPPORT_PANEL_CONTENTS = {
  "collab-tools": {
    title: "Cuadro comparativo - herramientas colaborativas",
    html: `
      <div class="tp-sec">
        <p class="tp-h">Tabla base para completar en el cuaderno</p>
        <div class="tp-card">
          <p style="margin:0 0 12px;color:#455a64;line-height:1.6">
            Usa esta comparacion como material de apoyo. El instructor puede pedirte
            ampliar o ajustar la informacion segun el negocio o caso trabajado.
          </p>
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #cfe3d4;font-size:.86rem">
              <thead>
                <tr style="background:#0b6b35;color:#fff">
                  <th style="padding:10px;text-align:left;border:1px solid #0b6b35">Herramienta</th>
                  <th style="padding:10px;text-align:left;border:1px solid #0b6b35">Funcion principal</th>
                  <th style="padding:10px;text-align:left;border:1px solid #0b6b35">Ventaja clave</th>
                  <th style="padding:10px;text-align:left;border:1px solid #0b6b35">Limitacion o cuidado</th>
                  <th style="padding:10px;text-align:left;border:1px solid #0b6b35">Precio / licencia</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th style="padding:10px;border:1px solid #d8e6dc;text-align:left">Microsoft 365<br><small>Teams, SharePoint, OneDrive</small></th>
                  <td style="padding:10px;border:1px solid #d8e6dc">Comunicacion, reuniones, almacenamiento, documentos compartidos y gestion de archivos institucionales.</td>
                  <td style="padding:10px;border:1px solid #d8e6dc">Integra correo, videollamadas, archivos y permisos en un ecosistema empresarial.</td>
                  <td style="padding:10px;border:1px solid #d8e6dc">Requiere cuenta, conexion estable y buena configuracion de permisos para evitar fugas de informacion.</td>
                  <td style="padding:10px;border:1px solid #d8e6dc">Suscripcion institucional o empresarial; algunas instituciones educativas tienen licencias academicas.</td>
                </tr>
                <tr style="background:#f7fbf8">
                  <th style="padding:10px;border:1px solid #d8e6dc;text-align:left">Google Workspace<br><small>Meet, Drive, Docs</small></th>
                  <td style="padding:10px;border:1px solid #d8e6dc">Trabajo colaborativo en documentos, almacenamiento en nube, videollamadas y formularios.</td>
                  <td style="padding:10px;border:1px solid #d8e6dc">Permite editar en tiempo real desde varios dispositivos y compartir enlaces rapidamente.</td>
                  <td style="padding:10px;border:1px solid #d8e6dc">Se debe controlar quien puede ver, editar o descargar los archivos compartidos.</td>
                  <td style="padding:10px;border:1px solid #d8e6dc">Cuenta gratuita con limites; planes pagos para organizaciones y educacion.</td>
                </tr>
                <tr>
                  <th style="padding:10px;border:1px solid #d8e6dc;text-align:left">Herramientas independientes<br><small>Zoom, WeTransfer, Canva</small></th>
                  <td style="padding:10px;border:1px solid #d8e6dc">Soluciones puntuales para reuniones, envio de archivos pesados y diseno de piezas visuales.</td>
                  <td style="padding:10px;border:1px solid #d8e6dc">Son faciles de usar y resuelven tareas concretas sin configurar todo un ecosistema.</td>
                  <td style="padding:10px;border:1px solid #d8e6dc">Cada herramienta maneja cuentas, permisos y vencimientos distintos; hay que revisar privacidad y enlaces.</td>
                  <td style="padding:10px;border:1px solid #d8e6dc">Versiones gratuitas con limites; planes pagos segun capacidad, tiempo o funciones avanzadas.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="tp-sec">
        <p class="tp-h">Como elegir para un negocio local</p>
        <div class="tp-card">
          <ul style="margin:0;padding-left:18px;line-height:1.7;color:#37474f">
            <li>Si el negocio ya usa correo institucional de Microsoft, Microsoft 365 puede ser mas ordenado.</li>
            <li>Si el equipo necesita editar documentos al mismo tiempo y compartir enlaces, Google Workspace es muy practico.</li>
            <li>Si solo se necesita una tarea puntual, como enviar un archivo pesado o disenar una pieza, una herramienta independiente puede ser suficiente.</li>
          </ul>
        </div>
      </div>
    `,
  },
  "activity7-cases": {
    title: "Casos para la Actividad 7",
    html: `
      <div class="tp-sec">
        <p class="tp-h">Casos para trabajar Word, Excel y Drive</p>
        <div class="tp-card">
          <p style="margin:0;color:#455a64;line-height:1.6">
            Selecciona uno de estos casos y usalo durante toda la Actividad 7: diagnostico en Word,
            control de ventas en Excel, carpeta colaborativa en Drive, correo de entrega y respaldo final.
          </p>
        </div>
      </div>

      <div class="tp-sec">
        <p class="tp-h">Caso 1</p>
        <div class="tp-card">
          <h3 style="margin:0 0 8px;color:#0b6b35">Cafeteria El Descanso - Puerto Boyaca</h3>
          <p><strong>Actividad del negocio:</strong> vende desayunos, almuerzos sencillos, bebidas frias y productos de panaderia cerca de una institucion educativa.</p>
          <p><strong>Herramientas actuales:</strong> libreta de ventas, calculadora, WhatsApp para pedidos y fotos sueltas de productos en el celular.</p>
          <p><strong>Dificultades:</strong> no conoce con claridad cuanto vende por producto, que dias tiene mas movimiento ni que compras debe priorizar.</p>
          <p><strong>Para Word:</strong> describe el negocio, sus necesidades digitales y propone herramientas actuales vs. recomendadas.</p>
          <p><strong>Para Excel:</strong> registra 15 ventas ficticias de desayunos, bebidas y panaderia; calcula total, resumen y grafico.</p>
          <p><strong>Para Drive:</strong> crea la carpeta Proyecto_Digital_Cafeteria_El_Descanso con diagnostico, control de ventas y plan de accion.</p>
        </div>
      </div>

      <div class="tp-sec">
        <p class="tp-h">Caso 2</p>
        <div class="tp-card">
          <h3 style="margin:0 0 8px;color:#0b6b35">Miscelanea San Miguel - Otanche</h3>
          <p><strong>Actividad del negocio:</strong> vende productos de aseo, papeleria, accesorios basicos para celular y recargas.</p>
          <p><strong>Herramientas actuales:</strong> cuaderno de fiados, mensajes de WhatsApp, recibos impresos y lista de precios pegada en el mostrador.</p>
          <p><strong>Dificultades:</strong> mezcla ventas de contado con fiados, no identifica productos de baja rotacion y a veces pierde datos de clientes.</p>
          <p><strong>Para Word:</strong> redacta el diagnostico digital y concluye dos acciones urgentes para ordenar ventas y clientes.</p>
          <p><strong>Para Excel:</strong> crea 15 ventas ficticias con productos variados, precios unitarios, cantidades y total por venta.</p>
          <p><strong>Para Drive:</strong> organiza Proyecto_Digital_Miscelanea_San_Miguel y comparte evidencias con tu equipo.</p>
        </div>
      </div>

      <div class="tp-sec">
        <p class="tp-h">Caso 3</p>
        <div class="tp-card">
          <h3 style="margin:0 0 8px;color:#0b6b35">Confecciones Luz Marina - Pauna</h3>
          <p><strong>Actividad del negocio:</strong> realiza arreglos de ropa, uniformes escolares, cortinas y pedidos pequenos por encargo.</p>
          <p><strong>Herramientas actuales:</strong> toma medidas en hojas sueltas, guarda fotos en el celular y acuerda entregas por llamadas.</p>
          <p><strong>Dificultades:</strong> no tiene control de pedidos, fechas de entrega, abonos ni materiales pendientes por comprar.</p>
          <p><strong>Para Word:</strong> elabora el diagnostico digital con descripcion del servicio y tabla de herramientas recomendadas.</p>
          <p><strong>Para Excel:</strong> registra 15 ventas o pedidos ficticios con producto, cantidad, precio unitario y total.</p>
          <p><strong>Para Drive:</strong> crea Proyecto_Digital_Confecciones_Luz_Marina con archivos, plan de accion y respaldo final.</p>
        </div>
      </div>
    `,
  },
  "activity10-cases": {
    title: "Casos para la Actividad 10",
    html: `
      <div class="tp-sec">
        <p class="tp-h">Escoge un caso para desarrollar la solucion digital</p>
        <div class="tp-card">
          <p style="margin:0;color:#455a64;line-height:1.6">
            Estos casos son exclusivos de la Actividad 10. Selecciona uno y usalo para construir el perfil digital,
            definir el problema, disenar la herramienta, preparar la guia de uso rapido y organizar la entrega final.
          </p>
        </div>
      </div>

      <div class="tp-sec">
        <p class="tp-h">Caso 1</p>
        <div class="tp-card">
          <h3 style="margin:0 0 8px;color:#0b6b35">Papeleria La Esperanza - Puerto Boyaca</h3>
          <p><strong>Actor productivo:</strong> negocio familiar que vende utiles escolares, impresiones, fotocopias y recargas.</p>
          <p><strong>Situacion actual:</strong> registra ventas en una libreta, no separa productos por categoria y pierde tiempo buscando precios. Usa WhatsApp para pedidos, pero no conserva un historial ordenado.</p>
          <p><strong>Problema principal:</strong> no tiene control claro de ventas, inventario ni productos mas vendidos.</p>
          <p><strong>Solucion sugerida:</strong> plantilla en Excel o Calc con registro de ventas, inventario basico, resumen mensual y alertas de productos por reponer.</p>
          <p><strong>Producto final esperado:</strong> archivo funcional, guia rapida para registrar ventas y una presentacion breve mostrando como se usa.</p>
        </div>
      </div>

      <div class="tp-sec">
        <p class="tp-h">Caso 2</p>
        <div class="tp-card">
          <h3 style="margin:0 0 8px;color:#0b6b35">Asociacion Semillas del Campo - Otanche</h3>
          <p><strong>Actor productivo:</strong> grupo comunitario que comercializa productos agricolas locales por encargos.</p>
          <p><strong>Situacion actual:</strong> los pedidos llegan por llamadas y mensajes. Cada integrante guarda informacion en su celular y a veces se duplican pedidos o se olvidan entregas.</p>
          <p><strong>Problema principal:</strong> falta una estructura compartida para registrar pedidos, clientes, fechas de entrega y responsables.</p>
          <p><strong>Solucion sugerida:</strong> carpeta organizada en Google Drive con hoja de pedidos, formato de clientes, control de entregas y documento de instrucciones para el equipo.</p>
          <p><strong>Producto final esperado:</strong> estructura de carpetas, hoja de seguimiento colaborativa, guia rapida y presentacion del flujo de trabajo.</p>
        </div>
      </div>

      <div class="tp-sec">
        <p class="tp-h">Caso 3</p>
        <div class="tp-card">
          <h3 style="margin:0 0 8px;color:#0b6b35">Taller Creativo Manos de Pauna - Pauna</h3>
          <p><strong>Actor productivo:</strong> emprendimiento que elabora arreglos, decoraciones y detalles personalizados para fechas especiales.</p>
          <p><strong>Situacion actual:</strong> publica productos en redes sociales, pero no tiene catalogo organizado ni formato para cotizaciones. Responde precios de memoria y eso causa errores.</p>
          <p><strong>Problema principal:</strong> necesita presentar productos y cotizaciones de forma clara, rapida y profesional.</p>
          <p><strong>Solucion sugerida:</strong> catalogo sencillo en presentacion o documento, plantilla de cotizacion en Word y carpeta de evidencias con fotos clasificadas.</p>
          <p><strong>Producto final esperado:</strong> catalogo editable, formato de cotizacion, guia de uso rapido y presentacion final del sistema creado.</p>
        </div>
      </div>
    `,
  },
  "activity9-cases": {
    title: "Casos para la Actividad 9",
    html: "",
  },
};

const ACTIVITY_CASE_ASSIGNMENTS = {
  "activity7-cases": {
    storageKey: "guia2_activity7_case_idx",
    intro:
      "Este es tu caso asignado para trabajar toda la Actividad 7: diagnostico en Word, control de ventas en Excel, carpeta colaborativa en Drive, correo de entrega y respaldo final.",
    cases: [
      {
        number: 1,
        title: "Cafeteria El Descanso - Puerto Boyaca",
        lines: [
          ["Actividad del negocio", "Vende desayunos, almuerzos sencillos, bebidas frias y productos de panaderia cerca de una institucion educativa."],
          ["Herramientas actuales", "Libreta de ventas, calculadora, WhatsApp para pedidos y fotos sueltas de productos en el celular."],
          ["Dificultades", "No conoce con claridad cuanto vende por producto, que dias tiene mas movimiento ni que compras debe priorizar."],
          ["Para Word", "Describe el negocio, sus necesidades digitales y propone herramientas actuales vs. recomendadas."],
          ["Para Excel", "Registra 15 ventas ficticias de desayunos, bebidas y panaderia; calcula total, resumen y grafico."],
          ["Para Drive", "Crea la carpeta Proyecto_Digital_Cafeteria_El_Descanso con diagnostico, control de ventas y plan de accion."],
        ],
      },
      {
        number: 2,
        title: "Miscelanea San Miguel - Otanche",
        lines: [
          ["Actividad del negocio", "Vende productos de aseo, papeleria, accesorios basicos para celular y recargas."],
          ["Herramientas actuales", "Cuaderno de fiados, mensajes de WhatsApp, recibos impresos y lista de precios pegada en el mostrador."],
          ["Dificultades", "Mezcla ventas de contado con fiados, no identifica productos de baja rotacion y a veces pierde datos de clientes."],
          ["Para Word", "Redacta el diagnostico digital y concluye dos acciones urgentes para ordenar ventas y clientes."],
          ["Para Excel", "Crea 15 ventas ficticias con productos variados, precios unitarios, cantidades y total por venta."],
          ["Para Drive", "Organiza Proyecto_Digital_Miscelanea_San_Miguel y comparte evidencias con tu equipo."],
        ],
      },
      {
        number: 3,
        title: "Confecciones Luz Marina - Pauna",
        lines: [
          ["Actividad del negocio", "Realiza arreglos de ropa, uniformes escolares, cortinas y pedidos pequenos por encargo."],
          ["Herramientas actuales", "Toma medidas en hojas sueltas, guarda fotos en el celular y acuerda entregas por llamadas."],
          ["Dificultades", "No tiene control de pedidos, fechas de entrega, abonos ni materiales pendientes por comprar."],
          ["Para Word", "Elabora el diagnostico digital con descripcion del servicio y tabla de herramientas recomendadas."],
          ["Para Excel", "Registra 15 ventas o pedidos ficticios con producto, cantidad, precio unitario y total."],
          ["Para Drive", "Crea Proyecto_Digital_Confecciones_Luz_Marina con archivos, plan de accion y respaldo final."],
        ],
      },
    ],
  },
  "activity9-cases": {
    storageKey: "guia2_activity9_case_idx",
    intro:
      "Este es tu caso asignado para analizar amenazas, crear una guia de ciberseguridad, revisar un mensaje de phishing y preparar una lista de verificacion de 10 items.",
    cases: [
      {
        number: 1,
        title: "Minimercado Los Pinos - Puerto Boyaca",
        lines: [
          ["Actor productivo", "Negocio de barrio que recibe pedidos por WhatsApp, maneja pagos por Nequi y guarda cuentas en un computador compartido."],
          ["Riesgos principales", "Phishing por mensajes de supuestos bancos, contrasenas debiles, computador sin antivirus actualizado y ausencia de copia de seguridad."],
          ["Situacion critica", "El propietario suele abrir enlaces que llegan por WhatsApp para revisar pagos y promociones de proveedores."],
          ["Para la guia", "Incluye recomendaciones sobre verificacion de enlaces, contrasenas seguras, respaldo semanal y bloqueo de pantalla."],
          ["Lista de verificacion", "Revisa antivirus, contrasenas distintas, copia de seguridad, permisos del computador y confirmacion de pagos por canales oficiales."],
        ],
      },
      {
        number: 2,
        title: "Agroinsumos La Cosecha - Otanche",
        lines: [
          ["Actor productivo", "Local que vende semillas, fertilizantes y herramientas pequenas a productores rurales."],
          ["Riesgos principales", "Archivos de proveedores descargados sin revisar, memorias USB de clientes, equipos compartidos y redes Wi-Fi publicas sin proteccion."],
          ["Situacion critica", "Un proveedor envia listas de precios en archivos comprimidos y el negocio los descarga en el computador de caja."],
          ["Para la guia", "Explica como revisar archivos antes de abrirlos, evitar extensiones peligrosas y separar equipo personal del equipo del negocio."],
          ["Lista de verificacion", "Incluye revision de extensiones, antivirus activo, copias en Drive, permisos de usuarios y cuidado con USB desconocidas."],
        ],
      },
      {
        number: 3,
        title: "Estudio Creativo Brillo Digital - Pauna",
        lines: [
          ["Actor productivo", "Emprendimiento que diseña piezas para redes sociales, maneja fotos de clientes y comparte archivos por enlaces."],
          ["Riesgos principales", "Enlaces publicos sin control, uso de cuentas personales para trabajo, contrasenas repetidas y perdida de archivos de clientes."],
          ["Situacion critica", "La emprendedora comparte carpetas completas con clientes y deja enlaces abiertos sin fecha de cierre."],
          ["Para la guia", "Incluye recomendaciones sobre permisos de Drive, privacidad de datos, contrasenas distintas y separacion entre cuentas personales y laborales."],
          ["Lista de verificacion", "Evalua permisos de enlaces, respaldo de proyectos, autenticacion en dos pasos, orden de carpetas y eliminacion de accesos antiguos."],
        ],
      },
    ],
  },
  "activity10-cases": {
    storageKey: "guia2_activity10_case_idx",
    intro:
      "Este es tu caso asignado para construir el perfil digital, definir el problema, disenar la herramienta, preparar la guia de uso rapido y organizar la entrega final.",
    cases: [
      {
        number: 1,
        title: "Papeleria La Esperanza - Puerto Boyaca",
        lines: [
          ["Actor productivo", "Negocio familiar que vende utiles escolares, impresiones, fotocopias y recargas."],
          ["Situacion actual", "Registra ventas en una libreta, no separa productos por categoria y pierde tiempo buscando precios. Usa WhatsApp para pedidos, pero no conserva un historial ordenado."],
          ["Problema principal", "No tiene control claro de ventas, inventario ni productos mas vendidos."],
          ["Solucion sugerida", "Plantilla en Excel o Calc con registro de ventas, inventario basico, resumen mensual y alertas de productos por reponer."],
          ["Producto final esperado", "Archivo funcional, guia rapida para registrar ventas y una presentacion breve mostrando como se usa."],
        ],
      },
      {
        number: 2,
        title: "Asociacion Semillas del Campo - Otanche",
        lines: [
          ["Actor productivo", "Grupo comunitario que comercializa productos agricolas locales por encargos."],
          ["Situacion actual", "Los pedidos llegan por llamadas y mensajes. Cada integrante guarda informacion en su celular y a veces se duplican pedidos o se olvidan entregas."],
          ["Problema principal", "Falta una estructura compartida para registrar pedidos, clientes, fechas de entrega y responsables."],
          ["Solucion sugerida", "Carpeta organizada en Google Drive con hoja de pedidos, formato de clientes, control de entregas y documento de instrucciones para el equipo."],
          ["Producto final esperado", "Estructura de carpetas, hoja de seguimiento colaborativa, guia rapida y presentacion del flujo de trabajo."],
        ],
      },
      {
        number: 3,
        title: "Taller Creativo Manos de Pauna - Pauna",
        lines: [
          ["Actor productivo", "Emprendimiento que elabora arreglos, decoraciones y detalles personalizados para fechas especiales."],
          ["Situacion actual", "Publica productos en redes sociales, pero no tiene catalogo organizado ni formato para cotizaciones. Responde precios de memoria y eso causa errores."],
          ["Problema principal", "Necesita presentar productos y cotizaciones de forma clara, rapida y profesional."],
          ["Solucion sugerida", "Catalogo sencillo en presentacion o documento, plantilla de cotizacion en Word y carpeta de evidencias con fotos clasificadas."],
          ["Producto final esperado", "Catalogo editable, formato de cotizacion, guia de uso rapido y presentacion final del sistema creado."],
        ],
      },
    ],
  },
};

function getActivityCaseSeed(key) {
  const session = window.portalAuth?.getCurrentSession?.();
  const selection = getGuideSelection();
  return [
    key,
    session?.user?.usernameKey || session?.user?.username || session?.usernameKey || "",
    selection.grupo || "",
    selection.ficha || "",
  ].join("|");
}

function getAssignedActivityCase(key) {
  const config = ACTIVITY_CASE_ASSIGNMENTS[key];
  if (!config) {
    return null;
  }

  const saved = localStorage.getItem(config.storageKey);
  if (saved !== null) {
    const idx = parseInt(saved, 10);
    if (idx >= 0 && idx < config.cases.length) {
      return config.cases[idx];
    }
  }

  const seed = getActivityCaseSeed(key);
  const idx = seed.trim()
    ? hashString(seed) % config.cases.length
    : Math.floor(Math.random() * config.cases.length);
  localStorage.setItem(config.storageKey, String(idx));
  return config.cases[idx];
}

function buildAssignedActivityCaseHtml(key) {
  const config = ACTIVITY_CASE_ASSIGNMENTS[key];
  const selectedCase = getAssignedActivityCase(key);
  if (!config || !selectedCase) {
    return "";
  }

  const lines = selectedCase.lines
    .map(
      ([label, value]) => `
        <p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`
    )
    .join("");

  return `
    <div class="tp-sec">
      <p class="tp-h">Caso asignado al aprendiz</p>
      <div class="tp-card">
        <p style="margin:0;color:#455a64;line-height:1.6">${escapeHtml(config.intro)}</p>
      </div>
    </div>
    <div class="tp-sec">
      <p class="tp-h">Caso ${selectedCase.number}</p>
      <div class="tp-card">
        <h3 style="margin:0 0 8px;color:#0b6b35">${escapeHtml(selectedCase.title)}</h3>
        ${lines}
      </div>
    </div>
  `;
}

function openGuia2SupportPanel(key) {
  const panel = document.getElementById("guia2-support-panel");
  const backdrop = document.getElementById("guia2-support-backdrop");
  const title = document.getElementById("guia2-support-panel-title");
  const body = document.getElementById("guia2-support-panel-body");
  const content = GUIA2_SUPPORT_PANEL_CONTENTS[key];
  if (!panel || !backdrop || !title || !body || !content) {
    return;
  }

  title.textContent = content.title;
  body.innerHTML = ACTIVITY_CASE_ASSIGNMENTS[key]
    ? buildAssignedActivityCaseHtml(key)
    : content.html;
  panel.style.transform = "translateX(0)";
  backdrop.style.opacity = "1";
  backdrop.style.pointerEvents = "auto";
  document.body.style.overflow = "hidden";
}

function closeGuia2SupportPanel() {
  const panel = document.getElementById("guia2-support-panel");
  const backdrop = document.getElementById("guia2-support-backdrop");
  if (!panel || !backdrop) {
    return;
  }

  panel.style.transform = "translateX(110%)";
  backdrop.style.opacity = "0";
  backdrop.style.pointerEvents = "none";
  document.body.style.overflow = "";
}

window.openGuia2SupportPanel = openGuia2SupportPanel;
window.closeGuia2SupportPanel = closeGuia2SupportPanel;

function showDriveFolderQR() {
  const url = getDriveFolderUrl();
  if (!url) {
    showDriveSelectionAlert();
    return;
  }

  const selection = getGuideSelection();
  ensureDriveQrModal();
  document.getElementById("drive-qr-title").textContent = selection.grupo
    ? `Portafolio Drive - Grupo ${selection.grupo}`
    : "Portafolio de evidencias en Drive";
  document.getElementById("drive-qr-url").textContent = url;
  document.getElementById("drive-qr-img").src =
    "https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=" +
    encodeURIComponent(url);
  document.getElementById("drive-qr-modal").classList.add("open");
}

function closeDriveFolderQR() {
  const modal = document.getElementById("drive-qr-modal");
  if (!modal) {
    return;
  }

  modal.classList.remove("open");
  const image = document.getElementById("drive-qr-img");
  if (image) {
    image.src = "";
  }
}

function ensureActivityQrModal() {
  let modal = document.getElementById("activity-qr-modal");
  if (modal) {
    return modal;
  }

  modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.id = "activity-qr-modal";
  modal.innerHTML = `
    <div class="modal-box" style="text-align:center;max-width:360px;padding:28px 28px 24px">
      <h3 id="activity-qr-title" style="font-size:16px;margin-bottom:4px">Abrir actividad en movil</h3>
      <p style="font-size:12px;color:var(--text-muted);margin-bottom:0">Escanea este codigo QR desde el celular.</p>
      <img id="activity-qr-img" class="qr-modal-img" src="" alt="Codigo QR de la actividad">
      <a id="activity-qr-link" class="activity-qr-link" href="#" target="_blank" rel="noopener noreferrer"></a>
      <div class="qr-url-text" id="activity-qr-url"></div>
      <button class="modal-btn-ok" type="button" style="width:100%" id="activity-qr-close">Cerrar</button>
    </div>
  `;

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeActivityQR();
    }
  });

  document.body.appendChild(modal);
  document.getElementById("activity-qr-close")?.addEventListener("click", closeActivityQR);
  return modal;
}

function showActivityQR(key) {
  const data = ACTIVITY_QR_DATA[key];
  if (!data) {
    return;
  }

  ensureActivityQrModal();
  document.getElementById("activity-qr-title").textContent = data.title;
  document.getElementById("activity-qr-url").textContent = data.url;
  document.getElementById("activity-qr-img").src = data.image;
  const link = document.getElementById("activity-qr-link");
  if (link) {
    link.textContent = data.cta;
    link.href = data.url;
  }
  document.getElementById("activity-qr-modal").classList.add("open");
}

function closeActivityQR() {
  const modal = document.getElementById("activity-qr-modal");
  if (!modal) {
    return;
  }

  modal.classList.remove("open");
  const image = document.getElementById("activity-qr-img");
  if (image) {
    image.src = "";
  }
}

function renderDriveDeliveryPanel() {
  window.sharedDriveDelivery?.appendDriveDeliveryPanels({
    targets: GUIDE2_DRIVE_ACTIVITY_TARGETS,
    helperSuffix: "La carpeta se define automaticamente segun la ficha activa.",
    hideQr: true,
    onDriveClick: openDriveFolder,
  });
}

function renderMaterialGroup(containerId, items) {
  const container = document.getElementById(containerId);
  if (!container) {
    return;
  }

  container.innerHTML = items.map(renderMaterialCard).join("");
}

function renderMaterialCard(item) {
  const href = buildMaterialHref(item);
  const cta = item.cta || "Abrir archivo";

  return `
    <article class="resource-card">
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.description)}</p>
      <p class="resource-meta">${escapeHtml(item.type)}</p>
      <a href="${href}" target="_blank" rel="noopener noreferrer">${escapeHtml(cta)}</a>
    </article>
  `;
}

function buildMaterialHref(item) {
  if (item.href) {
    return item.href;
  }

  return encodeURI(`${SUPPORT_BASE_PATH}${item.file}`);
}

const guide5ExportConfig = {
  extensions: {
    title: "Actividad 5: Extensiones de archivo",
    filePrefix: "Guia2_Actividad5_Extensiones_Archivo",
    description: "Exporta la tabla diligenciada de extensiones de archivo a un documento Word.",
  },
  systems: {
    title: "Actividad 6: Requerimientos mínimos de sistemas operativos",
    filePrefix: "Guia2_Actividad6_Requerimientos_Minimos",
    description:
      "Exporta la matriz diligenciada de requerimientos mínimos de sistemas operativos a un documento Word.",
  },
  collaborative: {
    title: "Actividad 8: Herramientas colaborativas y comunicacion digital",
    filePrefix: "Guia2_Actividad8_Herramientas_Colaborativas",
    description:
      "Exporta la tabla comparativa diligenciada de herramientas colaborativas a un documento Word.",
  },
};

let guide5ExportMode = "extensions";

function getGuideSelection() {
  const body = document.body;
  const defaults = {
    ficha: body.dataset.defaultFicha || "",
    inst: body.dataset.defaultInst || "",
    grupo: body.dataset.defaultGrupo || "",
  };

  return portalAuth ? portalAuth.getCurrentSelection(defaults) : defaults;
}

function getCurrentLearnerName() {
  const session = portalAuth?.getCurrentSession?.();
  return String(session?.user?.fullName || session?.user?.username || "").trim();
}

function getActivity4IdentityFields() {
  return {
    name: document.querySelector(`[data-store="${ACTIVITY4_IDENTITY_NAME_KEY}"]`),
    ficha: document.querySelector(`[data-store="${ACTIVITY4_IDENTITY_FICHA_KEY}"]`),
  };
}

function hasActivity4Identity() {
  const fullName = String(state[ACTIVITY4_IDENTITY_NAME_KEY] ?? "").trim();
  const ficha = String(state[ACTIVITY4_IDENTITY_FICHA_KEY] ?? "").trim();
  return Boolean(fullName && ficha);
}

function prefillActivity4Identity() {
  const fields = getActivity4IdentityFields();
  if (!fields.name && !fields.ficha) {
    return;
  }

  const session = portalAuth?.getCurrentSession?.();
  const selection = getGuideSelection();
  let changed = false;

  const suggestedName = session?.user?.fullName || "";
  const suggestedFicha = session?.user?.ficha || selection.ficha || "";

  if (!String(state[ACTIVITY4_IDENTITY_NAME_KEY] ?? "").trim() && suggestedName) {
    state[ACTIVITY4_IDENTITY_NAME_KEY] = suggestedName;
    changed = true;
  }

  if (!String(state[ACTIVITY4_IDENTITY_FICHA_KEY] ?? "").trim() && suggestedFicha) {
    state[ACTIVITY4_IDENTITY_FICHA_KEY] = suggestedFicha;
    changed = true;
  }

  if (changed) {
    saveState();
  }
}

function syncActivity4IdentityUi() {
  const note = document.getElementById("activity4IdentityNote");
  const questionnaire = document.getElementById("activity4Questionnaire");
  if (!note && !questionnaire) {
    return;
  }

  const ready = hasActivity4Identity();

  if (note) {
    note.textContent = ready
      ? "Identificacion lista. Ya puedes responder el cuestionario."
      : "Completa nombre completo y numero de ficha para comenzar.";
    note.classList.toggle("is-ready", ready);
  }

  if (!questionnaire) {
    return;
  }

  questionnaire.classList.toggle("is-locked", !ready);
  questionnaire.setAttribute("aria-disabled", ready ? "false" : "true");
  questionnaire.querySelectorAll("[data-store], input, textarea, select, button").forEach((field) => {
    field.disabled = !ready;
  });
}

function sanitizeFileName(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9\u00C0-\u024F\s_-]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

function getGuide5ExportConfig(mode) {
  return guide5ExportConfig[mode] || guide5ExportConfig.extensions;
}

function buildGuide5ExportFileName(mode, learnerName, ficha) {
  const config = getGuide5ExportConfig(mode);
  const safeName = sanitizeFileName(learnerName) || "Nombre";
  const safeFicha = sanitizeFileName(ficha) || "SinFicha";
  return `${config.filePrefix}_${safeName}_${safeFicha}.doc`;
}

function updateGuide5ExportFilenamePreview() {
  const input = document.getElementById("guide5-export-name");
  const preview = document.getElementById("guide5-export-filename");
  if (!input || !preview) {
    return;
  }

  input.classList.remove("error");
  document.getElementById("guide5-export-error")?.classList.remove("visible");

  const selection = getGuideSelection();
  preview.textContent = buildGuide5ExportFileName(
    guide5ExportMode,
    input.value,
    selection.ficha
  );
}

function setGuide5ExportModalState() {
  const selection = getGuideSelection();
  const warn = document.getElementById("guide5-export-warn");
  const ok = document.getElementById("guide5-export-ok");
  const button = document.getElementById("guide5-export-ok-btn");
  const hasFicha = Boolean(selection.ficha);

  if (warn) {
    warn.style.display = hasFicha ? "none" : "";
  }
  if (ok) {
    ok.style.display = hasFicha ? "" : "none";
  }
  if (button) {
    button.disabled = !hasFicha;
  }
}

function escapeWordValue(value) {
  const text = String(value || "").trim();
  return escapeHtml(text || "(Sin respuesta)");
}

const GUIDE2_WORD_METADATA = {
  guideName: "Guía 2 - Operar herramientas informáticas y digitales",
  program: "Sistemas Teleinformáticos",
  competencia:
    "220501121 - Operar herramientas informáticas y digitales de acuerdo con protocolos y manuales técnicos.",
  resultado:
    "RAP 01 - Caracterizar herramientas informáticas según el contexto tecnológico de la organización.",
};

function getSenaLogoUrl() {
  try {
    return new URL("assets/img/sena-logo.png", window.location.href).href;
  } catch (_) {
    return "assets/img/sena-logo.png";
  }
}

function buildInstitutionalWordHeader(title, learnerName, selection, today) {
  return `
  <div class="word-logo-line">
    <img src="${escapeHtml(getSenaLogoUrl())}" alt="Logo SENA" width="36" height="36" style="width:36pt;height:36pt;" />
    <strong>Servicio Nacional de Aprendizaje - SENA</strong>
  </div>
  <table class="institutional-header" width="100%" align="left" style="width:100%;margin-left:0;margin-right:0;">
    <tr><td class="label">Programa</td><td>${escapeWordValue(GUIDE2_WORD_METADATA.program)}</td></tr>
    <tr><td class="label">Fecha de elaboración</td><td>${escapeWordValue(today)}</td></tr>
    <tr><td class="label">Guía</td><td>${escapeWordValue(GUIDE2_WORD_METADATA.guideName)}</td></tr>
    <tr><td class="label">Actividad</td><td>${escapeWordValue(title)}</td></tr>
    <tr><td class="label">Competencia</td><td>${escapeWordValue(GUIDE2_WORD_METADATA.competencia)}</td></tr>
    <tr><td class="label">Resultado de aprendizaje</td><td>${escapeWordValue(GUIDE2_WORD_METADATA.resultado)}</td></tr>
    <tr><td class="label">Nombre completo del aprendiz</td><td>${escapeWordValue(learnerName)}</td></tr>
    <tr><td class="label">Número de ficha</td><td>${escapeWordValue(selection.ficha)}</td></tr>
    <tr><td class="label">Grado</td><td>${escapeWordValue(selection.grupo)}</td></tr>
    <tr><td class="label">Institución</td><td>${escapeWordValue(selection.inst)}</td></tr>
  </table>`;
}

function buildGuide5ExtensionsRows() {
  return extensions
    .map((row) => {
      const program =
        document.querySelector(`[data-store="extension:${row.id}:program"]`)?.value ?? row.program;
      const description =
        document.querySelector(`[data-store="extension:${row.id}:description"]`)?.value ??
        row.description;
      const extensionLabel = row.risk ? `${row.ext} (${row.risk})` : row.ext;

      return `
        <tr>
          <td>${escapeWordValue(extensionLabel)}</td>
          <td>${escapeWordValue(program)}</td>
          <td>${escapeWordValue(description)}</td>
        </tr>
      `;
    })
    .join("");
}

function buildGuide5SystemsRows() {
  return systems
    .map((row) => {
      const processor =
        document.querySelector(`[data-store="system:${row.id}:processor"]`)?.value ?? row.processor;
      const ram = document.querySelector(`[data-store="system:${row.id}:ram"]`)?.value ?? row.ram;
      const disk =
        document.querySelector(`[data-store="system:${row.id}:disk"]`)?.value ?? row.disk;
      const source =
        document.querySelector(`[data-store="system:${row.id}:source"]`)?.value ?? row.source;

      return `
        <tr>
          <td>${escapeWordValue(row.name)}</td>
          <td>${escapeWordValue(processor)}</td>
          <td>${escapeWordValue(ram)}</td>
          <td>${escapeWordValue(disk)}</td>
          <td>${escapeWordValue(source)}</td>
        </tr>
      `;
    })
    .join("");
}

function buildGuide5CollaborativeRows() {
  return collaborativeTools
    .map((row) => {
      const label = row.detail ? `${row.name} (${row.detail})` : row.name;
      const mainFunction =
        document.querySelector(`[data-store="collab:${row.id}:function"]`)?.value ?? "";
      const advantage =
        document.querySelector(`[data-store="collab:${row.id}:advantage"]`)?.value ?? "";
      const limit =
        document.querySelector(`[data-store="collab:${row.id}:limit"]`)?.value ?? "";
      const license =
        document.querySelector(`[data-store="collab:${row.id}:license"]`)?.value ?? "";

      return `
        <tr>
          <td>${escapeWordValue(label)}</td>
          <td>${escapeWordValue(mainFunction)}</td>
          <td>${escapeWordValue(advantage)}</td>
          <td>${escapeWordValue(limit)}</td>
          <td>${escapeWordValue(license)}</td>
        </tr>
      `;
    })
    .join("");
}

function buildGuide5ChecklistSection() {
  const levelLabels = {
    domino: "Lo domino",
    reforzar: "Necesito reforzar",
    nopracticado: "No lo he practicado",
  };
  const counts = { domino: 0, reforzar: 0, nopracticado: 0, pendiente: 0 };
  const rows = digitalCompetencyChecklist
    .map((item, index) => {
      const raw = document.querySelector(`[data-store="checklist:${item.id}"]`)?.value
        || String(state[`checklist:${item.id}`] || "");
      const value = String(raw).trim();
      if (value && levelLabels[value]) {
        counts[value] += 1;
      } else {
        counts.pendiente += 1;
      }
      const levelText = levelLabels[value] || "(sin marcar)";
      return `
        <tr>
          <td style="text-align:center;width:36pt">${index + 1}</td>
          <td>${escapeWordValue(item.label)}</td>
          <td style="width:120pt">${escapeWordValue(levelText)}</td>
        </tr>
      `;
    })
    .join("");
  const total = digitalCompetencyChecklist.length;
  return `
    <h2 style="margin-top:18pt;margin-bottom:6pt;color:#1b5e20">Lista de verificacion de competencias digitales (${total} items)</h2>
    <p style="margin:0 0 8pt;font-size:10.5pt;color:#4b5563">Autoevaluacion del aprendiz. Marca el nivel actual en cada competencia trabajada en la Guia 2.</p>
    <table class="data">
      <thead>
        <tr>
          <th>#</th>
          <th>Competencia digital</th>
          <th>Mi nivel</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin-top:8pt;font-size:10.5pt">
      <strong>Resumen:</strong>
      Domino: ${counts.domino} / ${total} &middot;
      A reforzar: ${counts.reforzar} / ${total} &middot;
      No practicado: ${counts.nopracticado} / ${total} &middot;
      Sin marcar: ${counts.pendiente} / ${total}.
    </p>
  `;
}

function buildGuide5ExportDocument(mode, learnerName) {
  const config = getGuide5ExportConfig(mode);
  const selection = getGuideSelection();
  const today = new Date().toLocaleDateString("es-CO");
  const tableHead =
    mode === "collaborative"
      ? `
        <tr>
          <th>Nombre</th>
          <th>Funcion principal</th>
          <th>Ventaja clave</th>
          <th>Limitacion</th>
          <th>Precio / licencia</th>
        </tr>
      `
      : mode === "systems"
      ? `
        <tr>
          <th>Sistema operativo</th>
          <th>Procesador</th>
          <th>RAM</th>
          <th>Espacio en disco</th>
          <th>Fuente</th>
        </tr>
      `
      : `
        <tr>
          <th>Extension</th>
          <th>Programa / referencia</th>
          <th>Descripcion o tipo de archivo</th>
        </tr>
      `;
  const tableRows =
    mode === "collaborative"
      ? buildGuide5CollaborativeRows()
      : mode === "systems"
      ? buildGuide5SystemsRows()
      : buildGuide5ExtensionsRows();

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>${escapeHtml(config.title)} - ${escapeHtml(learnerName)}</title>
<!--[if gte mso 9]><xml>
<w:WordDocument>
  <w:View>Print</w:View>
  <w:Zoom>90</w:Zoom>
  <w:DoNotOptimizeForBrowser/>
</w:WordDocument>
</xml><![endif]-->
<style>
  /* Hoja base centralizada (export_styles.js): A4, márgenes 2.54cm,
     tipografía Times 12pt y seguridad de tabla. Fallback inline para
     no romper la exportación si el helper no se cargó. */
  ${(window.senaExportStyles && window.senaExportStyles.getBaseStyles && window.senaExportStyles.getBaseStyles()) || '@page { size: A4; margin: 2.54cm; } body { font-family: "Times New Roman", Times, serif; font-size: 12pt; line-height: 1.5; color: #1a1a1a; } table { width: 100%; max-width: 100%; border-collapse: collapse; table-layout: fixed; overflow-wrap: anywhere; word-break: break-word; } th, td { padding: 6pt; vertical-align: top; border: 1px solid #b7c9bc; overflow-wrap: anywhere; word-break: break-word; }'}
  /* Overrides locales (solo cosméticos): .meta y .data heredan
     la seguridad de tabla de la hoja base. */
  .header { text-align: center; border-bottom: 2px solid #1b5e20; padding-bottom: 8pt; margin-bottom: 14pt; }
  .header h1 { margin: 0 0 4pt; }
  .header p { margin: 2pt 0; }
  .meta td { font-size: 10.5pt; }
  .meta .label { width: 28%; font-weight: 700; background: #f3f4f6; }
  .data th, .data td { font-size: 10pt; }
  .note { margin-top: 12pt; font-size: 10pt; color: #4b5563; }
</style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(config.title)}</h1>
    <p>${escapeWordValue(GUIDE2_WORD_METADATA.guideName)}</p>
  </div>

  ${buildInstitutionalWordHeader(config.title, learnerName, selection, today)}

  <table class="data">
    <thead>
      ${tableHead}
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  ${mode === "collaborative" ? buildGuide5ChecklistSection() : ""}

  <p class="note">Documento exportado desde la guia interactiva. Verifica y complementa la informacion antes de la entrega final.</p>
</body>
</html>`;
}

function openGuide5ExportModal(mode) {
  const modal = document.getElementById("guide5-export-modal");
  const title = document.getElementById("guide5-export-title");
  const description = document.getElementById("guide5-export-description");
  const input = document.getElementById("guide5-export-name");
  const error = document.getElementById("guide5-export-error");
  if (!modal || !title || !description || !input || !error) {
    return;
  }

  const config = getGuide5ExportConfig(mode);
  guide5ExportMode = mode;
  title.textContent = `📄 Exportar ${config.title}`;
  description.textContent = config.description;
  input.value = getCurrentLearnerName();
  input.classList.remove("error");
  error.classList.remove("visible");
  modal.classList.add("open");
  setGuide5ExportModalState();
  updateGuide5ExportFilenamePreview();

  if (!document.getElementById("guide5-export-ok-btn")?.disabled) {
    setTimeout(() => input.focus(), 80);
  }
}

function closeGuide5ExportModal() {
  document.getElementById("guide5-export-modal")?.classList.remove("open");
}

function doGuide5ExportWord() {
  const input = document.getElementById("guide5-export-name");
  const error = document.getElementById("guide5-export-error");
  if (!input || !error) {
    return;
  }

  const learnerName = input.value.trim() || getCurrentLearnerName();
  if (!learnerName) {
    input.classList.add("error");
    error.classList.add("visible");
    input.focus();
    return;
  }

  const selection = getGuideSelection();
  const html = buildGuide5ExportDocument(guide5ExportMode, learnerName);
  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  input.classList.remove("error");
  error.classList.remove("visible");

  a.href = url;
  a.download = buildGuide5ExportFileName(guide5ExportMode, learnerName, selection.ficha);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  closeGuide5ExportModal();
}

function renderGlossary() {
  const grid = document.getElementById("glossaryGrid");
  if (!grid) {
    return;
  }
  grid.innerHTML = glossaryTerms
    .map(
      ([term, definition]) => `
        <article class="glossary-card" data-search="${escapeHtml(
          `${term} ${definition}`.toLowerCase()
        )}">
          <strong>${escapeHtml(term)}</strong>
          <p>${escapeHtml(definition)}</p>
        </article>
      `
    )
    .join("");
}

function renderDigitalChecklist() {
  const tbody = document.getElementById("digitalChecklistBody");
  if (!tbody) {
    return;
  }
  const options = DIGITAL_CHECKLIST_LEVELS
    .map((level) => `<option value="${level.value}">${level.emoji}  ${escapeHtml(level.label)}</option>`)
    .join("");
  tbody.innerHTML = digitalCompetencyChecklist
    .map((item, index) => `
      <tr data-checklist-row="${escapeHtml(item.id)}">
        <td style="text-align:center;font-weight:700;color:#1b5e20">${index + 1}</td>
        <td>${escapeHtml(item.label)}</td>
        <td>
          <select data-store="checklist:${escapeHtml(item.id)}" data-track data-checklist-select aria-label="Mi nivel: ${escapeHtml(item.label)}" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #bcd2c0;background:#fff;font-family:inherit;font-size:.9rem">
            <option value="">— Selecciona —</option>
            ${options}
          </select>
        </td>
      </tr>
    `)
    .join("");
  updateDigitalChecklistSummary();
  applyDigitalChecklistRowColors();
}

function applyDigitalChecklistRowColors() {
  digitalCompetencyChecklist.forEach((item) => {
    const row = document.querySelector(`[data-checklist-row="${item.id}"]`);
    if (!row) {
      return;
    }
    const select = row.querySelector(`[data-store="checklist:${item.id}"]`);
    const value = select ? select.value : "";
    const level = DIGITAL_CHECKLIST_LEVELS.find((entry) => entry.value === value);
    row.style.background = level ? level.bg : "";
  });
}

function updateDigitalChecklistSummary() {
  const summary = document.getElementById("digitalChecklistSummary");
  if (!summary) {
    return;
  }
  const counts = { domino: 0, reforzar: 0, nopracticado: 0, pendiente: 0 };
  digitalCompetencyChecklist.forEach((item) => {
    const value = String(state[`checklist:${item.id}`] || "").trim();
    if (value === "domino" || value === "reforzar" || value === "nopracticado") {
      counts[value] += 1;
    } else {
      counts.pendiente += 1;
    }
  });
  Object.keys(counts).forEach((key) => {
    const target = summary.querySelector(`[data-summary="${key}"]`);
    if (target) {
      target.textContent = String(counts[key]);
    }
  });
}

function hydrateFields() {
  document.querySelectorAll("[data-store]").forEach((field) => {
    const key = field.dataset.store;
    if (!(key in state)) {
      return;
    }

    if (field.type === "checkbox") {
      field.checked = Boolean(state[key]);
      return;
    }

    if (field.type === "radio") {
      field.checked = String(state[key]) === String(field.value);
      return;
    }

    field.value = state[key];
  });
}

function readStoreValue(key) {
  const field = document.querySelector(`[data-store="${key}"]`);
  if (!field) {
    return String(state[key] || "").trim();
  }
  if (field.type === "checkbox") {
    return field.checked ? "true" : "";
  }
  return String(field.value || "").trim();
}

function applyOptionalDeadlineGate(activityId, options) {
  if (!window.activityDeadlineManager?.applyAvailability) {
    return { blocked: false, state: "none", hasDeadline: false };
  }
  return window.activityDeadlineManager.applyAvailability({
    pageFile: GUIDE_DATA_FILE,
    activityId,
    ...options,
  });
}

function applyExtensionesLock() {
  const locked = Boolean(state["extensiones331-locked"]);
  applyOptionalDeadlineGate("extensiones331", {
    isLocked: locked,
    fieldSelector: EXTENSION_ACTIVITY_STORES.map((key) => `[data-store="${key}"]`).join(","),
    buttonId: "btnGuardarExtensiones",
    statusId: "extensionesStatus331",
    activeButtonText: "Guardar respuestas",
    lockedButtonText: "Respuestas enviadas",
    closedButtonText: "Entrega cerrada",
    adminMount: { mountSelector: "#extensiones331DeadlineControls" },
    noticeMount: { mountSelector: "#extensiones331DeadlineControls" },
  });
  const status = document.getElementById("extensionesStatus331");
  if (status) {
    status.style.display = locked ? "block" : "none";
  }
}

function guardarExtensiones331() {
  if (!window.activityDeadlineManager?.canSubmit({ pageFile: GUIDE_DATA_FILE, activityId: "extensiones331" })) {
    return;
  }
  const empty = EXTENSION_ACTIVITY_STORES.filter((key) => !readStoreValue(key));
  if (empty.length > 0) {
    alert("Por favor completa la tabla y los campos de analisis antes de guardar.");
    return;
  }

  EXTENSION_ACTIVITY_STORES.forEach((key) => {
    state[key] = readStoreValue(key);
  });
  state["extensiones331-locked"] = true;
  saveState();
  applyExtensionesLock();
}

window.guardarExtensiones331 = guardarExtensiones331;

function applySistemasLock() {
  const locked = Boolean(state["sistemas332-locked"]);
  applyOptionalDeadlineGate("sistemas332", {
    isLocked: locked,
    fieldSelector: SYSTEM_ACTIVITY_STORES.map((key) => `[data-store="${key}"]`).join(","),
    buttonId: "btnGuardarSistemas",
    statusId: "sistemasStatus332",
    activeButtonText: "Guardar respuestas",
    lockedButtonText: "Respuestas enviadas",
    closedButtonText: "Entrega cerrada",
    adminMount: { mountSelector: "#sistemas332DeadlineControls" },
    noticeMount: { mountSelector: "#sistemas332DeadlineControls" },
  });
  const status = document.getElementById("sistemasStatus332");
  if (status) {
    status.style.display = locked ? "block" : "none";
  }
}

function guardarSistemas332() {
  if (!window.activityDeadlineManager?.canSubmit({ pageFile: GUIDE_DATA_FILE, activityId: "sistemas332" })) {
    return;
  }
  const empty = SYSTEM_ACTIVITY_STORES.filter((key) => !readStoreValue(key));
  if (empty.length > 0) {
    alert("Por favor completa la tabla y los campos de analisis antes de guardar.");
    return;
  }

  SYSTEM_ACTIVITY_STORES.forEach((key) => {
    state[key] = readStoreValue(key);
  });
  state["sistemas332-locked"] = true;
  saveState();
  applySistemasLock();
}

window.guardarSistemas332 = guardarSistemas332;

function applyColaborativasLock() {
  const locked = Boolean(state["colaborativas334-locked"]);
  const fieldKeys = COLLABORATIVE_TOOLS_ACTIVITY_STORES.concat(DIGITAL_CHECKLIST_STORES);
  applyOptionalDeadlineGate("colaborativas334", {
    isLocked: locked,
    fieldSelector: fieldKeys.map((key) => `[data-store="${key}"]`).join(","),
    buttonId: "btnGuardarColaborativas",
    statusId: "colaborativasStatus334",
    activeButtonText: "Guardar respuestas",
    lockedButtonText: "Respuestas enviadas",
    closedButtonText: "Entrega cerrada",
    adminMount: { mountSelector: "#colaborativas334DeadlineControls" },
    noticeMount: { mountSelector: "#colaborativas334DeadlineControls" },
  });
  const status = document.getElementById("colaborativasStatus334");
  if (status) {
    status.style.display = locked ? "" : "none";
  }
}

function guardarColaborativas334() {
  if (!window.activityDeadlineManager?.canSubmit({ pageFile: GUIDE_DATA_FILE, activityId: "colaborativas334" })) {
    return;
  }
  const emptyTable = COLLABORATIVE_TOOLS_ACTIVITY_STORES.filter((key) => !readStoreValue(key));
  if (emptyTable.length > 0) {
    alert("Por favor completa la tabla comparativa antes de guardar.");
    return;
  }
  const emptyChecklist = DIGITAL_CHECKLIST_STORES.filter((key) => !readStoreValue(key));
  if (emptyChecklist.length > 0) {
    alert(
      "Antes de guardar, marca tu nivel en los 15 items de la lista de verificacion de competencias digitales. Faltan " +
        emptyChecklist.length +
        " por marcar."
    );
    const firstPending = document.querySelector(`[data-store="${emptyChecklist[0]}"]`);
    if (firstPending && typeof firstPending.scrollIntoView === "function") {
      firstPending.scrollIntoView({ behavior: "smooth", block: "center" });
      firstPending.focus();
    }
    return;
  }

  COLLABORATIVE_TOOLS_ACTIVITY_STORES.concat(DIGITAL_CHECKLIST_STORES).forEach((key) => {
    state[key] = readStoreValue(key);
  });
  state["colaborativas334-locked"] = true;
  saveState();
  applyColaborativasLock();
  updateDigitalChecklistSummary();
  applyDigitalChecklistRowColors();
}

window.guardarColaborativas334 = guardarColaborativas334;

function applyTransferRetoLock() {
  const locked = Boolean(state["transfer-reto-locked"]);
  applyOptionalDeadlineGate("transferReto341", {
    isLocked: locked,
    fieldSelector: TRANSFER_RETO_ACTIVITY_STORES.map((key) => `[data-store="${key}"]`).join(","),
    buttonId: "btnGuardarTransferReto",
    statusId: "transferRetoStatus",
    activeButtonText: "Guardar respuestas",
    lockedButtonText: "Respuestas enviadas",
    closedButtonText: "Entrega cerrada",
    adminMount: { mountSelector: "#transferReto341DeadlineControls" },
    noticeMount: { mountSelector: "#transferReto341DeadlineControls" },
  });
  const btn = document.getElementById("btnGuardarTransferReto");
  if (btn) {
    btn.textContent = locked ? "Respuestas enviadas" : btn.textContent;
  }
  const status = document.getElementById("transferRetoStatus");
  if (status) {
    status.style.display = locked ? "" : "none";
  }
}

function guardarTransferReto341() {
  if (!window.activityDeadlineManager?.canSubmit({ pageFile: GUIDE_DATA_FILE, activityId: "transferReto341" })) {
    return;
  }
  const empty = TRANSFER_RETO_ACTIVITY_STORES.filter((key) => !readStoreValue(key));
  if (empty.length > 0) {
    alert("Por favor responde las dos preguntas del reto antes de guardar.");
    return;
  }

  TRANSFER_RETO_ACTIVITY_STORES.forEach((key) => {
    state[key] = readStoreValue(key);
  });
  state["transfer-reto-locked"] = true;
  saveState();
  applyTransferRetoLock();
}

window.guardarTransferReto341 = guardarTransferReto341;

window.addEventListener("activity-deadlines-updated", () => {
  applyExtensionesLock();
  applySistemasLock();
  applyColaborativasLock();
  applyTransferRetoLock();
});

function bindEvents() {
  document.addEventListener("input", (event) => {
    const field = event.target.closest("[data-store]");
    if (!field) {
      return;
    }

    if (field.type === "radio" && !field.checked) {
      return;
    }

    state[field.dataset.store] = field.type === "checkbox" ? field.checked : field.value;
    saveState();
    if (
      field.dataset.store === ACTIVITY4_IDENTITY_NAME_KEY ||
      field.dataset.store === ACTIVITY4_IDENTITY_FICHA_KEY
    ) {
      syncActivity4IdentityUi();
    }
  });

  document.addEventListener("change", (event) => {
    const field = event.target.closest("[data-store]");
    if (!field) {
      return;
    }

    if (field.type === "radio" && !field.checked) {
      return;
    }

    state[field.dataset.store] = field.type === "checkbox" ? field.checked : field.value;
    if (field.matches("[data-match]")) {
      field.closest("tr")?.classList.remove("is-correct", "is-wrong");
      const matchingFeedback = document.getElementById("matchingFeedback");
      if (matchingFeedback) {
        matchingFeedback.textContent = "";
      }
    }
    if (field.matches("[data-checklist-select]")) {
      updateDigitalChecklistSummary();
      applyDigitalChecklistRowColors();
    }
    saveState();
    if (
      field.dataset.store === ACTIVITY4_IDENTITY_NAME_KEY ||
      field.dataset.store === ACTIVITY4_IDENTITY_FICHA_KEY
    ) {
      syncActivity4IdentityUi();
    }
  });

  const wordBank = document.getElementById("wordBank");
  if (wordBank) {
    wordBank.addEventListener("click", (event) => {
      const button = event.target.closest("[data-word-key]");
      if (!button) {
        return;
      }

      const key = button.dataset.wordKey;
      const active = !button.classList.contains("is-active");
      button.classList.toggle("is-active", active);
      button.dataset.trackButton = String(active);
      state[key] = active;
      saveState();
    });
  }

  document.getElementById("checkMatching")?.addEventListener("click", verifyMatching);

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-activity-qr]");
    if (!button) {
      return;
    }

    showActivityQR(button.dataset.activityQr);
  });

  const glossarySearch = document.getElementById("glossarySearch");
  if (glossarySearch) {
    glossarySearch.addEventListener("input", (event) => {
      const query = event.target.value.trim().toLowerCase();
      document.querySelectorAll(".glossary-card").forEach((card) => {
        card.classList.toggle("is-hidden", !card.dataset.search.includes(query));
      });
    });
  }

  const printButton = document.querySelector("[data-print]");
  if (printButton) {
    printButton.addEventListener("click", () => {
      window.print();
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeGuide5ExportModal();
      closeDriveFolderQR();
      closeActivityQR();
    }
  });

  const resetProgress = document.getElementById("resetProgress");
  if (resetProgress) {
    resetProgress.addEventListener("click", async () => {
      const confirmed = window.confirm(
        "Se borraran las respuestas guardadas localmente. Deseas continuar?"
      );
      if (!confirmed) {
        return;
      }

      window.clearGuideActivityChecks?.();
      window.clearGuideLayoutState?.();
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      localStorage.removeItem(STORAGE_META_KEY);
      state = {};
      pendingCloudStateSnapshot = buildCloudStateSnapshot();
      await window.syncGuideUiStateImmediately?.();
      await syncCloudState(true);
      window.location.reload();
    });
  }
}

function verifyMatching() {
  const feedback = document.getElementById("matchingFeedback");
  if (!feedback) {
    return;
  }

  let correct = 0;

  matchingTools.forEach((tool) => {
    const select = document.querySelector(`[data-match="${tool.id}"]`);
    if (!select) {
      return;
    }
    const row = select.closest("tr");
    const isCorrect = select.value === tool.answer;
    row.classList.toggle("is-correct", isCorrect);
    row.classList.toggle("is-wrong", !isCorrect && select.value !== "");
    if (isCorrect) {
      correct += 1;
    }
  });

  feedback.textContent =
    correct === matchingTools.length
      ? "Excelente: todas las relaciones son correctas."
      : `Llevas ${correct} de ${matchingTools.length} relaciones correctas. Ajusta las filas marcadas y vuelve a verificar.`;
}

function updateProgress() {
  const trackedFields = Array.from(document.querySelectorAll("[data-track]"));
  const trackedButtons = Array.from(document.querySelectorAll("[data-track-button]"));
  const activityChecks = Array.from(document.querySelectorAll(".activity-check"));
  const wordSearchGames = Array.from(document.querySelectorAll("[data-word-search]"));
  const matchingGames = Array.from(document.querySelectorAll("[data-matching-game]"));
  const radioStoreKeys = new Set(
    trackedFields.filter((field) => field.type === "radio").map((field) => field.dataset.store)
  );

  const completedNonRadioFields = trackedFields.filter((field) => {
    if (field.type === "radio") {
      return false;
    }
    if (field.type === "checkbox") {
      return field.checked;
    }
    return field.value.trim().length > 0;
  }).length;

  const completedRadioGroups = Array.from(radioStoreKeys).filter((key) =>
    trackedFields.some((field) => field.type === "radio" && field.dataset.store === key && field.checked)
  ).length;

  const completedButtons = trackedButtons.filter(
    (button) => button.dataset.trackButton === "true"
  ).length;
  const completedChecks = activityChecks.filter((button) =>
    button.classList.contains("checked")
  ).length;
  const completedWordSearchGames = wordSearchGames.filter(() => {
    const gameState = getWordSearchState();
    return Boolean(gameState.completedAt);
  }).length;
  const completedMatchingGames = matchingGames.filter(() => {
    const gameState = getMatchingGameState();
    return Boolean(gameState.completedAt);
  }).length;

  const total =
    trackedFields.filter((field) => field.type !== "radio").length +
    radioStoreKeys.size +
    trackedButtons.length +
    activityChecks.length +
    wordSearchGames.length +
    matchingGames.length;
  const completed =
    completedNonRadioFields +
    completedRadioGroups +
    completedButtons +
    completedChecks +
    completedWordSearchGames +
    completedMatchingGames;
  const rawPercent = total ? Math.round((completed / total) * 100) : 0;
  const percent = completed > 0 && rawPercent === 0 ? 1 : rawPercent;

  const label = `${percent}%`;
  const value = document.getElementById("progressValue");
  const bar = document.getElementById("progressBar");
  if (value) {
    value.textContent = label;
  }
  if (bar) {
    bar.style.width = label;
  }
  portalAuth?.writeGuideProgress?.(PAGE_FILE, { completed, total, percent });
  const wordCount = document.getElementById("wordCount");
  if (wordCount) {
    wordCount.textContent = `${completedButtons} / ${wordList.length}`;
  }
}

window.updateGuideProgress = updateProgress;
window.addEventListener("pageshow", () => updateProgress());
window.addEventListener("pagehide", flushCloudStateSync);
window.addEventListener("beforeunload", flushCloudStateSync);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    flushCloudStateSync();
    return;
  }

  updateProgress();
});

function setupScrollSpy() {
  const links = Array.from(document.querySelectorAll(".sidebar a[href^='#']"));
  const sectionMap = new Map(
    links.map((link) => [link.getAttribute("href"), document.querySelector(link.getAttribute("href"))])
  );

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        const id = `#${entry.target.id}`;
        links.forEach((link) => link.classList.toggle("is-current", link.getAttribute("href") === id));
      });
    },
    {
      threshold: 0.15,
      rootMargin: "-20% 0px -55% 0px",
    }
  );

  sectionMap.forEach((section) => {
    if (section) {
      observer.observe(section);
    }
  });
}

function getActivity4ReportSnapshot() {
  return {
    pageFile: PAGE_FILE,
    guideDataFile: GUIDE_DATA_FILE,
    state: { ...state },
    meta: readStateMeta(),
    identity: {
      fullName: String(state[ACTIVITY4_IDENTITY_NAME_KEY] ?? "").trim(),
      ficha: String(state[ACTIVITY4_IDENTITY_FICHA_KEY] ?? "").trim(),
    },
    selection: getGuideSelection(),
  };
}

window.guia2Activity4ReportSource = {
  isActivity4FormPage() {
    return document.body?.classList.contains("activity4-form-page") || false;
  },
  getSnapshot: getActivity4ReportSnapshot,
};

const QUIZ_PAGE_URLS = {
  "grupo-10a-guia-02-herramientas-informaticas-digitales.html": "pages/auxiliares/grupo-10a-guia-02-herramientas-quiz.html",
  "grupo-10b-guia-02-herramientas-informaticas-digitales.html": "pages/auxiliares/grupo-10b-guia-02-herramientas-quiz.html",
};

function renderQuizHerramientasStatus() {
  const panel = document.getElementById("quizHerramientasStatus");
  const actionLink = document.getElementById("quizHerramientasActionLink");
  if (!actionLink) return;

  const quizUrl = QUIZ_PAGE_URLS[PAGE_FILE] || "";
  if (quizUrl) actionLink.setAttribute("href", quizUrl);

  const attempt = state?.["quiz-guia2-342"];
  if (!panel) return;

  if (!attempt || typeof attempt !== "object") {
    panel.style.display = "none";
    actionLink.innerHTML = "&#128218; Presentar quiz aleatorio";
    return;
  }

  const statusLabel = attempt.locked || attempt.status === "completed"
    ? "Completado"
    : attempt.status === "terminated_visibility"
    ? "Finalizado por visibilidad"
    : attempt.startedAt ? "En progreso" : "Pendiente";

  const variant = String(attempt.variant || "Sin asignar");
  const warnings = Number(attempt.warningCount) || 0;
  const score = Number(attempt.score) || 0;
  const maxScore = Number(attempt.maxScore) || 100;

  panel.style.display = "block";
  panel.innerHTML =
    `<div class="label">&#128221; Estado del quiz 3.4.2</div>` +
    `<p style="margin:8px 0 0"><strong>Estado:</strong> ${statusLabel} | ` +
    `<strong>Variante:</strong> ${variant} | ` +
    `<strong>Advertencias:</strong> ${warnings} / 2</p>` +
    (attempt.locked
      ? `<p style="margin:8px 0 0"><strong>Puntaje:</strong> ${score} / ${maxScore}</p>`
      : `<p style="margin:8px 0 0">Tienes un intento iniciado. Al volver continuaras con la misma variante.</p>`);

  if (attempt.locked) {
    actionLink.innerHTML = "&#128065; Ver quiz presentado";
  } else {
    actionLink.innerHTML = "&#9205; Continuar quiz";
  }
}

window.guia2WordSearch = {
  getPuzzle: getWordSearchPuzzle,
  foundColorCount: WORD_SEARCH_FOUND_COLOR_COUNT,
  getFoundColorClass: getWordSearchFoundColorClass,
};

// Expone una función para forzar sincronización inmediata con Firestore
// (usada por guardarFormulario() al finalizar la Actividad 4)
window.guia2SyncNow = () => syncCloudState(true);

