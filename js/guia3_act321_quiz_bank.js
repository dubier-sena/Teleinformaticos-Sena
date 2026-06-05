/* guia3_act321_quiz_bank.js
 * Banco de preguntas del quiz de la ACTIVIDAD 3.2.1 "Estudio de contenidos
 * tematicos" de la Guia 3 - Implementar componentes de las herramientas
 * tecnologicas. SOLO para el grupo 10B (Jhon F. Kennedy, ficha 3441942).
 *
 * 3 variantes (A, B, C) de 10 preguntas cada una. El motor (script_redes_quiz.js)
 * elige una al azar al iniciar. Puntaje: 10 por correcta (maximo 100).
 * Cubre el Bloque A (Herramientas Tecnologicas) y el Bloque B (Documentacion
 * Tecnica) de la actividad. Texto sin tildes por consistencia con el motor.
 */
(function () {
  window.GUIA3_ACT321_QUIZ_VARIANTS = {
    A: [
      {
        id: "q1",
        topic: "Manual tecnico",
        prompt: "El tecnico de una empresa va a instalar un equipo nuevo y no sabe los pasos exactos. Que documento debe consultar primero?",
        options: [
          "El manual tecnico del equipo o del software",
          "Una publicacion de redes sociales",
          "El historial del navegador",
          "La factura de compra",
        ],
        correctIndex: 0,
      },
      {
        id: "q2",
        topic: "Instalacion de software",
        prompt: "Antes de instalar una suite ofimatica en los equipos de la organizacion, cual es el procedimiento mas seguro?",
        options: [
          "Descargar el primer enlace que aparezca en internet",
          "Descargar desde el sitio oficial del fabricante y verificar requisitos",
          "Copiar el instalador de un USB sin revisarlo",
          "Instalar sin leer los terminos de la licencia",
        ],
        correctIndex: 1,
      },
      {
        id: "q3",
        topic: "Licenciamiento",
        prompt: "Una empresa quiere usar ofimatica sin pagar licencias por equipo. Que opcion de licenciamiento le conviene?",
        options: [
          "Software propietario con licencia por usuario",
          "Software pirata para ahorrar dinero",
          "Software libre o de codigo abierto como LibreOffice",
          "Una version de prueba que caduca a los 30 dias",
        ],
        correctIndex: 2,
      },
      {
        id: "q4",
        topic: "Diagnostico",
        prompt: "El soporte tecnico necesita revisar el estado del disco, la memoria y los procesos de un equipo Windows. Que tipo de herramienta usa?",
        options: [
          "Herramientas de diagnostico del sistema (Administrador de tareas, monitor de recursos)",
          "Un editor de imagenes",
          "Una hoja de calculo",
          "Un reproductor de musica",
        ],
        correctIndex: 0,
      },
      {
        id: "q5",
        topic: "Documentacion tecnica",
        prompt: "Que es una ficha tecnica de un equipo?",
        options: [
          "Un documento con las caracteristicas y especificaciones del equipo",
          "Un mensaje de correo electronico",
          "Una contrasena de administrador",
          "Un archivo temporal del sistema",
        ],
        correctIndex: 0,
      },
      {
        id: "q6",
        topic: "Inventario",
        prompt: "Para que sirve mantener un inventario de activos de software y hardware en una empresa?",
        options: [
          "Para decorar la oficina",
          "Para saber que recursos existen, su estado y su ubicacion",
          "Para borrar archivos antiguos automaticamente",
          "Para aumentar la velocidad de internet",
        ],
        correctIndex: 1,
      },
      {
        id: "q7",
        topic: "Checklist",
        prompt: "Cual es la principal ventaja de usar una lista de chequeo (checklist) en el mantenimiento de equipos?",
        options: [
          "Hace el trabajo mas lento a proposito",
          "Asegura que no se olvide ningun paso del procedimiento",
          "Reemplaza al tecnico por completo",
          "Sirve solo para imprimir en color",
        ],
        correctIndex: 1,
      },
      {
        id: "q8",
        topic: "Versionado",
        prompt: "Siguiendo una buena convencion de nombres, cual es el nombre mas adecuado para la segunda version de un resumen?",
        options: [
          "documento final final.docx",
          "resumen (2).docx",
          "BloqueA_Resumen_JuanPerez_v2.0.pdf",
          "sin nombre.pdf",
        ],
        correctIndex: 2,
      },
      {
        id: "q9",
        topic: "Gestion de informacion",
        prompt: "Cual es una buena practica para proteger la informacion tecnica de una empresa?",
        options: [
          "Guardar una sola copia en un solo equipo",
          "Hacer copias de respaldo periodicas en otro medio o en la nube",
          "Compartir las contrasenas con todos",
          "Eliminar los respaldos para ahorrar espacio",
        ],
        correctIndex: 1,
      },
      {
        id: "q10",
        topic: "Buenas practicas",
        prompt: "Segun las buenas practicas de documentacion, como debe ser un registro tecnico?",
        options: [
          "Claro, completo, fechado y con responsable identificado",
          "Escrito de memoria varios dias despues",
          "Sin fecha y sin autor",
          "Solo verbal, sin dejar nada por escrito",
        ],
        correctIndex: 0,
      },
    ],
    B: [
      {
        id: "q1",
        topic: "Instalacion de software",
        prompt: "Durante la instalacion de un programa, el sistema pide aceptar el acuerdo de licencia (EULA). Que se recomienda hacer?",
        options: [
          "Aceptar sin leer siempre",
          "Leer las condiciones y aceptarlas solo si se cumplen",
          "Cancelar la instalacion de cualquier software",
          "Apagar el equipo",
        ],
        correctIndex: 1,
      },
      {
        id: "q2",
        topic: "Diagnostico",
        prompt: "Un equipo arranca muy lento. Que herramienta ayuda a ver que programas se inician con el sistema?",
        options: [
          "El Administrador de tareas (pestana Inicio)",
          "La calculadora",
          "El reproductor de video",
          "El bloc de notas",
        ],
        correctIndex: 0,
      },
      {
        id: "q3",
        topic: "Busqueda tecnica",
        prompt: "Cual es un uso eficiente de un motor de busqueda para resolver un error tecnico?",
        options: [
          "Buscar solo imagenes bonitas",
          "Copiar el mensaje de error exacto entre comillas y filtrar por fuentes confiables",
          "Escribir 'ayuda porfa' sin detalles",
          "Esperar a que el error se resuelva solo",
        ],
        correctIndex: 1,
      },
      {
        id: "q4",
        topic: "Plataformas de gestion",
        prompt: "Que plataformas permiten gestionar correo, documentos y trabajo colaborativo en la nube de una organizacion?",
        options: [
          "Google Workspace y Microsoft 365",
          "Paint y WordPad",
          "Solo el explorador de archivos",
          "La papelera de reciclaje",
        ],
        correctIndex: 0,
      },
      {
        id: "q5",
        topic: "Compatibilidad",
        prompt: "Un archivo creado en LibreOffice Writer debe abrirse en Microsoft Word. Que formato favorece la compatibilidad?",
        options: [
          "Un formato propietario que solo abre LibreOffice",
          "Guardar como .docx o exportar a PDF",
          "Cambiar la extension manualmente a .exe",
          "Comprimir el archivo en .zip y nada mas",
        ],
        correctIndex: 1,
      },
      {
        id: "q6",
        topic: "Documentacion tecnica",
        prompt: "Que es la hoja de vida de un equipo?",
        options: [
          "El registro historico de mantenimientos, fallas y cambios del equipo",
          "Un curriculum del tecnico",
          "Una red social del equipo",
          "El cargador del equipo",
        ],
        correctIndex: 0,
      },
      {
        id: "q7",
        topic: "Formatos y plantillas",
        prompt: "Para que sirve usar plantillas y formatos de registro tecnico estandarizados?",
        options: [
          "Para que cada persona invente su propio formato",
          "Para registrar la informacion de forma uniforme y facil de comparar",
          "Para gastar mas papel",
          "Para ocultar la informacion",
        ],
        correctIndex: 1,
      },
      {
        id: "q8",
        topic: "Versionado",
        prompt: "Que significa el control de versiones de un documento?",
        options: [
          "Borrar las versiones anteriores siempre",
          "Llevar un registro ordenado de los cambios y de cada version del archivo",
          "Cambiar el color del documento",
          "Imprimir el documento muchas veces",
        ],
        correctIndex: 1,
      },
      {
        id: "q9",
        topic: "Gestion de informacion",
        prompt: "La regla de respaldo 3-2-1 recomienda tener al menos:",
        options: [
          "3 copias, en 2 medios distintos y 1 fuera del sitio",
          "1 copia en un solo USB",
          "Ninguna copia para ahorrar espacio",
          "Solo la copia en la nube",
        ],
        correctIndex: 0,
      },
      {
        id: "q10",
        topic: "Cuentas corporativas",
        prompt: "Cual es una buena practica en la gestion de cuentas de acceso corporativas?",
        options: [
          "Usar la misma contrasena para todos los servicios",
          "Asignar permisos minimos necesarios y contrasenas fuertes por usuario",
          "Compartir una cuenta entre todo el personal",
          "Anotar las contrasenas en una nota pegada al monitor",
        ],
        correctIndex: 1,
      },
    ],
    C: [
      {
        id: "q1",
        topic: "Manual tecnico",
        prompt: "Que informacion suele incluir un manual tecnico de software?",
        options: [
          "Requisitos del sistema, instalacion, uso y solucion de problemas",
          "Recetas de cocina",
          "Solo el precio del producto",
          "Chistes para el usuario",
        ],
        correctIndex: 0,
      },
      {
        id: "q2",
        topic: "Licenciamiento y almacenamiento",
        prompt: "Una organizacion usa documentos en la nube. Que parametro de almacenamiento debe vigilar?",
        options: [
          "El color de los iconos",
          "La capacidad disponible y la politica de respaldo del servicio",
          "El nombre del navegador",
          "La marca del teclado",
        ],
        correctIndex: 1,
      },
      {
        id: "q3",
        topic: "Busqueda tecnica",
        prompt: "Al buscar la solucion a un problema tecnico, como se evalua si una fuente es confiable?",
        options: [
          "Porque tiene muchos colores",
          "Por la reputacion del sitio, la fecha y que coincida con la documentacion oficial",
          "Porque aparece de primera siempre",
          "Porque tiene publicidad",
        ],
        correctIndex: 1,
      },
      {
        id: "q4",
        topic: "Plataformas de gestion",
        prompt: "Microsoft Teams se usa principalmente para:",
        options: [
          "Editar fotografias profesionales",
          "Comunicacion, reuniones y trabajo colaborativo en equipo",
          "Formatear discos duros",
          "Jugar videojuegos pesados",
        ],
        correctIndex: 1,
      },
      {
        id: "q5",
        topic: "Compatibilidad",
        prompt: "Que formato es el mas universal para entregar un documento que NO debe modificarse?",
        options: [
          ".pdf",
          ".exe",
          ".tmp",
          ".bat",
        ],
        correctIndex: 0,
      },
      {
        id: "q6",
        topic: "Cuentas corporativas",
        prompt: "Cuando un empleado deja la empresa, que se debe hacer con su cuenta de acceso?",
        options: [
          "Dejarla activa por si vuelve",
          "Deshabilitarla o eliminarla y revocar sus permisos",
          "Compartirla con otro empleado",
          "Publicar la contrasena",
        ],
        correctIndex: 1,
      },
      {
        id: "q7",
        topic: "Inventario",
        prompt: "Que dato NO deberia faltar en un inventario de activos tecnologicos?",
        options: [
          "El identificador del equipo, su estado y su responsable",
          "El signo zodiacal del usuario",
          "El color favorito del tecnico",
          "La marca de cafe de la oficina",
        ],
        correctIndex: 0,
      },
      {
        id: "q8",
        topic: "Checklist",
        prompt: "Una lista de chequeo de instalacion deberia, entre otras cosas:",
        options: [
          "Verificar requisitos, respaldo previo, instalacion y pruebas finales",
          "Incluir solo el nombre del tecnico",
          "Tener una sola casilla sin texto",
          "Cambiar de orden cada vez al azar",
        ],
        correctIndex: 0,
      },
      {
        id: "q9",
        topic: "Tipos documentales",
        prompt: "Cual de estos es un tipo documental tecnico usado en soporte?",
        options: [
          "La ficha tecnica o el reporte de mantenimiento",
          "Una novela de ficcion",
          "Un afiche publicitario de un evento",
          "Una lista de compras del mercado",
        ],
        correctIndex: 0,
      },
      {
        id: "q10",
        topic: "Buenas practicas",
        prompt: "Por que conviene documentar cada cambio o mantenimiento que se hace a un equipo?",
        options: [
          "Para tener trazabilidad y poder dar seguimiento ante fallas futuras",
          "Para perder tiempo",
          "Porque lo exige una red social",
          "No conviene documentar nada",
        ],
        correctIndex: 0,
      },
    ],
  };
})();
