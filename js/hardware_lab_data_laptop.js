/* js/hardware_lab_data_laptop.js
 *
 * Datos del computador portatil para el Laboratorio Virtual de Hardware.
 * Mismo formato que hardware_lab_data_desktop.js (motor 100% reutilizado,
 * ver hardware_lab_engine.js) con las diferencias reales de un portatil:
 *   - La tapa inferior es la pieza "caseGate" (equivalente a la tapa lateral
 *     del escritorio).
 *   - La bateria va conectada con su propio cable y, a diferencia del
 *     escritorio (donde basta desconectar la pared), en un portatil hay que
 *     desconectar ese cable de bateria ANTES de tocar cualquier otra pieza
 *     interna: es la primera accion real tras abrir la tapa, y por eso casi
 *     todas las demas piezas la exigen en su removeRequires.
 *   - Las antenas Wi-Fi corren hasta el bisel de la pantalla: por eso deben
 *     desconectarse antes de separar la pantalla, y solo pueden conectarse
 *     de vuelta cuando la pantalla YA esta instalada.
 */
(function (root) {
  "use strict";

  var PARTS = {
    "bottom-cover": {
      id: "bottom-cover",
      kind: "component",
      name: "Tapa inferior",
      category: "chasis",
      location: "external",
      icon: "\u{1F5B4}️",
      zone: "power",
      tool: "phillips",
      removeRequires: [],
      installRequires: [],
      removeInstructions: [
        "Retira todos los tornillos de la tapa inferior (suelen ser de distinto tamano: no los mezcles).",
        "Usa la herramienta plastica de apertura para liberar los seguros a presion del borde.",
        "Levanta la tapa con cuidado, sin forzar los cables que puedan estar pegados con cinta.",
      ],
      installInstructions: [
        "Verifica que ningun cable quede atrapado entre la tapa y el chasis.",
        "Encaja la tapa por los seguros a presion primero, luego coloca los tornillos.",
        "No aprietes los tornillos de mas: el plastico de la tapa se puede fisurar.",
      ],
      info: {
        function: "Protege los componentes internos y permite el acceso para mantenimiento.",
        characteristics: "Lamina plastica o metalica sujeta con tornillos pequenos y seguros a presion.",
        location: "Parte inferior del portatil.",
        connectionType: "Tornillos + seguros a presion en el borde.",
        precautions: "Los tornillos de un portatil casi nunca son todos iguales: separalos por posicion.",
        compatibility: "Especifica de cada modelo.",
        commonErrors: "Forzar la tapa sin retirar un tornillo escondido (a veces bajo una goma o etiqueta) puede quebrar el plastico.",
      },
    },

    "cable-battery": {
      id: "cable-battery",
      kind: "cable",
      name: "Cable de la bateria",
      category: "cableado",
      location: "internal",
      icon: "\u{1F50C}",
      zone: "power",
      tool: "hands",
      removeRequires: [],
      installRequires: ["motherboard", "battery"],
      removeInstructions: [
        "Localiza el conector de la bateria en la tarjeta madre (cerca del borde de la bateria).",
        "Con cuidado, haz palanca con la una o un spudger para desconectarlo (nunca tires del cable).",
      ],
      installInstructions: [
        "Alinea el conector con el socket de la tarjeta madre.",
        "Presiona parejo hasta que asiente por completo.",
      ],
      info: {
        function: "Alimenta el equipo desde la bateria y es el PRIMER punto que se desconecta al intervenir un portatil.",
        characteristics: "Conector pequeno, a veces con cinta adhesiva de refuerzo encima.",
        location: "Junto al borde de la bateria, sobre la tarjeta madre.",
        connectionType: "Conector a presion.",
        precautions: "A diferencia del escritorio (donde basta desconectar la pared), en un portatil la bateria sigue alimentando el equipo aunque este desconectado de la corriente: por eso este cable se desconecta SIEMPRE primero.",
        compatibility: "Especifica de cada modelo.",
        commonErrors: "Tocar RAM, SSD o cualquier otra pieza antes de desconectar este cable puede provocar un corto o danar el componente.",
      },
    },

    battery: {
      id: "battery",
      kind: "component",
      name: "Bateria",
      category: "alimentacion",
      location: "internal",
      icon: "\u{1F50B}",
      zone: "power",
      tool: "phillips",
      removeRequires: ["cable-battery"],
      installRequires: ["motherboard"],
      removeInstructions: [
        "Verifica que el cable de la bateria ya este desconectado.",
        "Retira los tornillos que la fijan al chasis.",
        "Levanta la bateria con cuidado; si esta hinchada, no la presiones ni perfores.",
      ],
      installInstructions: [
        "Coloca la bateria en su bahia, alineando los orificios de tornillo.",
        "Ajusta los tornillos de fijacion.",
      ],
      info: {
        function: "Almacena energia para que el portatil funcione sin estar conectado a la corriente.",
        characteristics: "Celda de iones de litio, sellada; se degrada con el tiempo y el numero de ciclos de carga.",
        location: "Ocupa gran parte del area inferior del chasis.",
        connectionType: "Tornillos de fijacion + cable-battery.",
        precautions: "Nunca perfores, dobles ni expongas una bateria de litio a altas temperaturas: riesgo de incendio.",
        compatibility: "Especifica de cada modelo; no todas son removibles en portatiles ultradelgados.",
        commonErrors: "Una bateria hinchada (se ve abultada) debe manipularse con extremo cuidado y reportarse antes de continuar.",
      },
    },

    ram: {
      id: "ram",
      kind: "component",
      name: "Memoria RAM (SO-DIMM)",
      category: "memoria",
      location: "internal",
      icon: "\u{1F7E9}",
      zone: "board",
      tool: "hands",
      removeRequires: ["cable-battery"],
      installRequires: ["motherboard"],
      removeInstructions: [
        "Verifica que el cable de la bateria ya este desconectado.",
        "Libera los seguros laterales del slot presionandolos hacia afuera.",
        "El modulo se levanta en angulo; sujetalo por los bordes y retiralo.",
      ],
      installInstructions: [
        "Inserta el modulo en el slot con un angulo de unos 30 grados, respetando la muesca.",
        "Presiona el modulo hacia abajo hasta que los seguros laterales lo sujeten con un clic.",
      ],
      info: {
        function: "Igual que en el escritorio: memoria de trabajo temporal para la CPU.",
        characteristics: "Formato SO-DIMM (mas pequeno que el DIMM de escritorio), DDR4 o DDR5 segun el modelo.",
        location: "Uno o dos slots visibles al retirar la tapa inferior.",
        connectionType: "A presion, en angulo, con seguros laterales.",
        precautions: "Manipula solo por los bordes.",
        compatibility: "SO-DIMM no es compatible fisicamente con los slots DIMM de escritorio.",
        commonErrors: "Igual que en escritorio: un modulo mal asentado es causa comun de que no arranque o no de imagen.",
      },
    },

    "ssd-m2": {
      id: "ssd-m2",
      kind: "component",
      name: "SSD M.2",
      category: "almacenamiento",
      location: "internal",
      icon: "\u{1F4BE}",
      zone: "board",
      tool: "phillips",
      removeRequires: ["cable-battery"],
      installRequires: ["motherboard"],
      removeInstructions: [
        "Verifica que el cable de la bateria ya este desconectado.",
        "Retira el unico tornillo que fija el extremo libre de la unidad.",
        "La unidad se levanta en angulo (como la RAM); retirala deslizandola del slot.",
      ],
      installInstructions: [
        "Inserta la unidad en el slot M.2 en angulo, respetando la muesca de la ranura.",
        "Baja la unidad y ajusta el tornillo de fijacion del extremo libre.",
      ],
      info: {
        function: "Almacenamiento permanente, igual funcion que el SSD SATA de escritorio pero sin cables.",
        characteristics: "Tarjeta delgada tipo 'chicle'; se conecta directo al slot M.2 de la placa, sin cables SATA.",
        location: "Slot M.2 de la tarjeta madre, generalmente visible al abrir la tapa.",
        connectionType: "Ranura M.2 + un tornillo de fijacion (no usa cables como el SATA).",
        precautions: "No dobles la tarjeta al insertarla o retirarla.",
        compatibility: "Verifica la clave del slot (M o B+M) y el tipo de unidad (NVMe o SATA M.2) antes de reemplazar.",
        commonErrors: "Olvidar el tornillo de fijacion deja la unidad floja y puede provocar desconexiones intermitentes.",
      },
    },

    "wifi-antenna-1": {
      id: "wifi-antenna-1",
      kind: "cable",
      name: "Antena Wi-Fi 1 (blanca)",
      category: "cableado",
      location: "internal",
      icon: "\u{1F4F6}",
      zone: "board",
      tool: "tweezers",
      removeRequires: ["cable-battery"],
      installRequires: ["wifi-card", "screen-assembly"],
      removeInstructions: [
        "Con las pinzas, sujeta el pequeno conector (no el cable) junto a la tarjeta Wi-Fi.",
        "Hazlo palanca hacia arriba con cuidado hasta que se suelte.",
      ],
      installInstructions: [
        "Alinea el conector sobre su pin en la tarjeta Wi-Fi.",
        "Presiona con cuidado (con las pinzas o la una) hasta que asiente.",
      ],
      info: {
        function: "Lleva la senal de Wi-Fi entre la tarjeta inalambrica y la antena fisica ubicada en el bisel de la pantalla.",
        characteristics: "Cable coaxial muy delgado con un conector diminuto tipo IPEX/U.FL.",
        location: "Un extremo en la tarjeta Wi-Fi, el otro corre hacia la bisagra y la pantalla.",
        connectionType: "Conector a presion, extremadamente delicado.",
        precautions: "Nunca tires del cable directamente: se desprende el conductor central y el cable queda inservible.",
        compatibility: "El color (blanco/negro o principal/auxiliar) debe respetarse al reconectar.",
        commonErrors: "Forzar el conector con un destornillador metalico puede cortocircuitar la tarjeta.",
      },
    },

    "wifi-antenna-2": {
      id: "wifi-antenna-2",
      kind: "cable",
      name: "Antena Wi-Fi 2 (negra)",
      category: "cableado",
      location: "internal",
      icon: "\u{1F4F6}",
      zone: "board",
      tool: "tweezers",
      removeRequires: ["cable-battery"],
      installRequires: ["wifi-card", "screen-assembly"],
      removeInstructions: [
        "Con las pinzas, sujeta el pequeno conector (no el cable) junto a la tarjeta Wi-Fi.",
        "Hazlo palanca hacia arriba con cuidado hasta que se suelte.",
      ],
      installInstructions: [
        "Alinea el conector sobre su pin en la tarjeta Wi-Fi.",
        "Presiona con cuidado (con las pinzas o la una) hasta que asiente.",
      ],
      info: {
        function: "Segunda antena del sistema Wi-Fi (mejora la recepcion en configuraciones 2x2 MIMO).",
        characteristics: "Igual al cable de la antena 1, identificado con un color distinto (normalmente negro).",
        location: "Un extremo en la tarjeta Wi-Fi, el otro en el bisel de la pantalla.",
        connectionType: "Conector a presion, extremadamente delicado.",
        precautions: "Igual que la antena 1: nunca tirar del cable.",
        compatibility: "Respetar el color al reconectar (evita cruzar antena principal y auxiliar).",
        commonErrors: "Confundir esta antena con la 1 no impide que funcione, pero puede afectar el rendimiento del Wi-Fi.",
      },
    },

    "wifi-card": {
      id: "wifi-card",
      kind: "component",
      name: "Tarjeta Wi-Fi",
      category: "conectividad",
      location: "internal",
      icon: "\u{1F4E1}",
      zone: "board",
      tool: "phillips",
      removeRequires: ["cable-battery", "wifi-antenna-1", "wifi-antenna-2"],
      installRequires: ["motherboard"],
      removeInstructions: [
        "Verifica que ambas antenas ya esten desconectadas.",
        "Retira el tornillo de fijacion.",
        "La tarjeta se levanta en angulo; retirala del slot M.2 correspondiente.",
      ],
      installInstructions: [
        "Inserta la tarjeta en el slot M.2 en angulo.",
        "Baja la tarjeta y ajusta el tornillo de fijacion.",
      ],
      info: {
        function: "Provee conectividad inalambrica (Wi-Fi y Bluetooth) al portatil.",
        characteristics: "Tarjeta pequena en formato M.2, con dos conectores de antena.",
        location: "Slot M.2 dedicado, separado del slot del SSD.",
        connectionType: "Ranura M.2 + tornillo + 2 conectores de antena.",
        precautions: "Desconecta siempre las antenas antes de retirar la tarjeta.",
        compatibility: "Debe coincidir con el estandar de antena (2 o mas cables) que traiga el chasis.",
        commonErrors: "Retirar la tarjeta con las antenas aun conectadas puede romper los conectores IPEX.",
      },
    },

    "cable-cpu-fan-laptop": {
      id: "cable-cpu-fan-laptop",
      kind: "cable",
      name: "Cable del ventilador",
      category: "cableado",
      location: "internal",
      icon: "\u{1F50C}",
      zone: "board",
      tool: "hands",
      removeRequires: ["cable-battery"],
      installRequires: ["motherboard", "cooler"],
      removeInstructions: [
        "Localiza el conector pequeno del ventilador junto al modulo de refrigeracion.",
        "Sujeta el conector (no el cable) y desconectalo tirando hacia arriba.",
      ],
      installInstructions: [
        "Ubica el header del ventilador en la tarjeta madre.",
        "Conecta el cable con cuidado hasta que asiente.",
      ],
      info: {
        function: "Igual que en escritorio: permite que la placa controle y monitoree el ventilador.",
        characteristics: "Conector pequeno de 2 a 4 pines.",
        location: "Junto al modulo de refrigeracion (heatpipe + ventilador).",
        connectionType: "Conector a presion.",
        precautions: "Desconectalo antes de retirar el modulo de refrigeracion, nunca despues.",
        compatibility: "Especifico de cada modelo.",
        commonErrors: "Un ventilador desconectado provoca sobrecalentamiento y apagados por proteccion termica.",
      },
    },

    cooler: {
      id: "cooler",
      kind: "component",
      name: "Modulo de refrigeracion (heatpipe + ventilador)",
      category: "refrigeracion",
      location: "internal",
      icon: "\u{1F4A8}",
      zone: "board",
      tool: "phillips",
      removeRequires: ["cable-battery", "cable-cpu-fan-laptop"],
      installRequires: ["cpu"],
      removeInstructions: [
        "Verifica que el cable del ventilador ya este desconectado.",
        "Afloja los tornillos en el orden inverso al numerado en el propio heatpipe (suelen estar numerados).",
        "Levanta el modulo con cuidado; puede requerir un giro suave si la pasta termica lo pega al procesador.",
      ],
      installInstructions: [
        "Aplica pasta termica nueva en el procesador si se reutiliza el modulo.",
        "Coloca el heatpipe alineado y ajusta los tornillos en el orden numerado (o en cruz si no estan numerados).",
      ],
      info: {
        function: "Extrae el calor del procesador (y a veces de la GPU integrada) mediante tubos de calor y un ventilador compacto.",
        characteristics: "Mas delgado y compacto que el disipador de escritorio; suele cubrir CPU y chipset a la vez.",
        location: "Sobre el procesador, generalmente cerca del borde del chasis para expulsar el aire.",
        connectionType: "Tornillos numerados + cable del ventilador.",
        precautions: "Afloja los tornillos en el orden indicado para no deformar el heatpipe.",
        compatibility: "Especifico de cada modelo y procesador.",
        commonErrors: "Pasta termica reseca es causa comun de sobrecalentamiento en portatiles con varios anos de uso.",
      },
    },

    cpu: {
      id: "cpu",
      kind: "component",
      name: "Procesador (CPU)",
      category: "procesamiento",
      location: "internal",
      icon: "⬛",
      zone: "board",
      tool: "hands",
      removeRequires: ["cable-battery", "cooler"],
      installRequires: ["motherboard"],
      removeInstructions: [
        "Verifica que el modulo de refrigeracion ya este retirado y la pasta termica limpia.",
        "En los modelos con socket (no soldados), libera la palanca o el seguro y retira el procesador por los bordes.",
      ],
      installInstructions: [
        "Alinea la muesca del procesador con la marca del socket.",
        "Colocalo sin presionar y asegura la palanca o el seguro del socket.",
      ],
      info: {
        function: "Igual que en escritorio: ejecuta las instrucciones de los programas.",
        characteristics: "En muchos portatiles modernos viene soldado (BGA) y no es removible; este equipo lo modela como removible con fines de practica.",
        location: "Bajo el modulo de refrigeracion.",
        connectionType: "Socket con seguro (cuando es removible) o soldado directamente a la placa (BGA).",
        precautions: "Nunca toques los contactos ni fuerces la orientacion.",
        compatibility: "Debe coincidir con el socket/BGA especifico de la placa.",
        commonErrors: "Intentar retirar un procesador soldado (BGA) sin el equipo adecuado destruye la tarjeta madre.",
      },
    },

    "cable-keyboard-flex": {
      id: "cable-keyboard-flex",
      kind: "cable",
      name: "Cable flex del teclado",
      category: "cableado",
      location: "internal",
      icon: "\u{1F50C}",
      zone: "input",
      tool: "spudger",
      removeRequires: ["cable-battery"],
      installRequires: ["motherboard", "keyboard"],
      removeInstructions: [
        "Localiza el conector ZIF (de cierre) del cable flex del teclado en la placa.",
        "Con el spudger, levanta con cuidado la traba del conector ZIF antes de retirar el cable.",
      ],
      installInstructions: [
        "Con la traba del conector ZIF abierta, inserta el cable flex hasta el fondo.",
        "Cierra la traba para asegurar el cable.",
      ],
      info: {
        function: "Transmite las pulsaciones del teclado a la tarjeta madre.",
        characteristics: "Cable plano flexible (FPC) que se asegura con un conector de cierre (ZIF).",
        location: "Bajo el teclado, conectado a un header ZIF de la placa.",
        connectionType: "Conector ZIF (con traba abatible, no se tira directamente).",
        precautions: "Nunca tires del cable flex sin abrir primero la traba: se rompen las pistas internas.",
        compatibility: "Especifico de cada modelo y distribucion de teclado.",
        commonErrors: "Un cable flex mal asentado provoca que algunas teclas no respondan.",
      },
    },

    keyboard: {
      id: "keyboard",
      kind: "component",
      name: "Teclado",
      category: "entrada",
      location: "internal",
      icon: "\u{2328}️",
      zone: "input",
      tool: "phillips",
      removeRequires: ["cable-battery", "cable-keyboard-flex"],
      installRequires: [],
      removeInstructions: [
        "Verifica que el cable flex ya este desconectado.",
        "Retira los tornillos de fijacion visibles desde la parte inferior del chasis.",
        "Levanta el teclado con cuidado desde el borde correspondiente.",
      ],
      installInstructions: [
        "Encaja el teclado en su marco, respetando el borde de insercion.",
        "Ajusta los tornillos de fijacion desde abajo.",
      ],
      info: {
        function: "Permite la entrada de texto y comandos directamente en el equipo.",
        characteristics: "Ensamble delgado tipo membrana o mecanismo de tijera, integrado con el flex.",
        location: "Cara superior del chasis, visible al abrir la pantalla.",
        connectionType: "Tornillos desde abajo + cable flex ZIF.",
        precautions: "Maneja el conjunto por los bordes: el mecanismo de tijera de cada tecla es fragil.",
        compatibility: "El idioma/distribucion (QWERTY en espanol, etc.) debe coincidir con el modelo.",
        commonErrors: "Forzar el teclado fuera de su marco sin retirar todos los tornillos puede quebrar las pestanas de sujecion.",
      },
    },

    "cable-touchpad-flex": {
      id: "cable-touchpad-flex",
      kind: "cable",
      name: "Cable flex del touchpad",
      category: "cableado",
      location: "internal",
      icon: "\u{1F50C}",
      zone: "input",
      tool: "hands",
      removeRequires: ["cable-battery"],
      installRequires: ["motherboard", "touchpad"],
      removeInstructions: [
        "Localiza el conector del touchpad en la placa.",
        "Abre la traba del conector (si es tipo ZIF) y retira el cable con cuidado.",
      ],
      installInstructions: [
        "Inserta el cable flex en el conector con la traba abierta.",
        "Cierra la traba para asegurarlo.",
      ],
      info: {
        function: "Transmite los movimientos y clics del touchpad a la tarjeta madre.",
        characteristics: "Cable flex plano, similar al del teclado pero mas corto.",
        location: "Bajo el reposamanos, conectado a la placa.",
        connectionType: "Conector ZIF o a presion segun el modelo.",
        precautions: "Igual que el flex del teclado: nunca tirar directamente.",
        compatibility: "Especifico de cada modelo.",
        commonErrors: "Un touchpad que 'no responde' casi siempre es este cable mal asentado, no el touchpad danado.",
      },
    },

    touchpad: {
      id: "touchpad",
      kind: "component",
      name: "Touchpad",
      category: "entrada",
      location: "internal",
      icon: "\u{1F5B1}️",
      zone: "input",
      tool: "phillips",
      removeRequires: ["cable-battery", "cable-touchpad-flex"],
      installRequires: [],
      removeInstructions: [
        "Verifica que el cable flex ya este desconectado.",
        "Retira los tornillos de fijacion del touchpad.",
        "Levanta el modulo con cuidado.",
      ],
      installInstructions: [
        "Coloca el touchpad en su hueco del reposamanos.",
        "Ajusta los tornillos de fijacion.",
      ],
      info: {
        function: "Dispositivo señalador integrado que reemplaza al mouse.",
        characteristics: "Superficie tactil con boton(es) integrados o clic por presion.",
        location: "Bajo el reposamanos, debajo del teclado.",
        connectionType: "Tornillos + cable flex.",
        precautions: "Evita presionar directamente sobre la superficie al manipularlo.",
        compatibility: "Especifico de cada modelo.",
        commonErrors: "Instalarlo sin alinear bien el marco deja un touchpad 'flojo' o desalineado con el reposamanos.",
      },
    },

    "cable-screen-flex": {
      id: "cable-screen-flex",
      kind: "cable",
      name: "Cable flex de pantalla (eDP)",
      category: "cableado",
      location: "internal",
      icon: "\u{1F50C}",
      zone: "screen",
      tool: "hands",
      removeRequires: ["cable-battery"],
      installRequires: ["motherboard", "screen-assembly"],
      removeInstructions: [
        "Localiza el conector del cable de pantalla en la placa (suele tener cinta adhesiva encima).",
        "Retira la cinta con cuidado y desconecta el cable tirando en linea recta desde el conector.",
      ],
      installInstructions: [
        "Conecta el cable al puerto correspondiente en la placa.",
        "Asegura con cinta adhesiva si el diseno original la lleva.",
      ],
      info: {
        function: "Transmite la señal de video desde la tarjeta madre hasta el panel de la pantalla.",
        characteristics: "Cable plano (eDP o LVDS segun el modelo) que corre por la bisagra.",
        location: "Desde la placa, a traves de la bisagra, hasta la parte trasera del panel.",
        connectionType: "Conector a presion, a veces reforzado con cinta.",
        precautions: "No dobles el cable en el mismo punto repetidamente: se puede fracturar el conductor interno.",
        compatibility: "Especifico de cada modelo y resolucion de pantalla.",
        commonErrors: "Una pantalla que enciende pero no muestra imagen (con luz de fondo visible) suele ser este cable mal asentado.",
      },
    },

    "screen-assembly": {
      id: "screen-assembly",
      kind: "component",
      name: "Pantalla (conjunto completo)",
      category: "salida",
      location: "internal",
      icon: "\u{1F5A5}️",
      zone: "screen",
      tool: "phillips",
      removeRequires: ["cable-battery", "cable-screen-flex", "wifi-antenna-1", "wifi-antenna-2"],
      installRequires: ["motherboard"],
      removeInstructions: [
        "Verifica que el cable de pantalla y ambas antenas ya esten desconectados.",
        "Retira los tornillos de las bisagras a ambos lados del chasis.",
        "Separa el conjunto de pantalla del cuerpo base con cuidado.",
      ],
      installInstructions: [
        "Alinea las bisagras con el chasis base.",
        "Ajusta los tornillos de las bisagras.",
      ],
      info: {
        function: "Muestra la imagen generada por el equipo; incluye el panel, el bisel y las bisagras.",
        characteristics: "Incluye el panel LCD/OLED, el bisel plastico y, en la mayoria de modelos, las antenas Wi-Fi integradas en el bisel.",
        location: "Parte superior del portatil, unida al cuerpo base por bisagras.",
        connectionType: "Bisagras (tornillos) + cable de pantalla + antenas Wi-Fi.",
        precautions: "Desconecta SIEMPRE el cable de pantalla y las antenas antes de separar las bisagras.",
        compatibility: "Especifico de cada modelo; el conector y la resolucion deben coincidir al reemplazar el panel.",
        commonErrors: "Forzar las bisagras sin retirar el cable de pantalla puede romperlo o rasgar el bisel.",
      },
    },

    motherboard: {
      id: "motherboard",
      kind: "component",
      name: "Tarjeta madre",
      category: "chasis",
      location: "internal",
      icon: "\u{1F9E9}",
      zone: "board",
      tool: "phillips",
      removeRequires: [
        "cable-battery",
        "wifi-card",
        "cable-keyboard-flex",
        "cable-touchpad-flex",
        "cable-screen-flex",
        "cable-cpu-fan-laptop",
        "cooler",
      ],
      installRequires: [],
      removeInstructions: [
        "Verifica que todos los cables y la tarjeta Wi-Fi ya esten desconectados/retirados, y el modulo de refrigeracion fuera.",
        "Retira los tornillos que fijan la placa al chasis.",
        "Levanta la placa con cuidado, sujetandola por los bordes.",
      ],
      installInstructions: [
        "Coloca la placa alineando los puertos con las aberturas del chasis.",
        "Ajusta los tornillos de fijacion sin forzar ninguno primero.",
      ],
      info: {
        function: "Igual que en escritorio: integra y conecta todos los demas componentes del portatil.",
        characteristics: "Mucho mas compacta y densa que una placa de escritorio; casi todo esta soldado excepto RAM, almacenamiento y Wi-Fi.",
        location: "Ocupa gran parte del chasis base, bajo el teclado y el touchpad.",
        connectionType: "Tornillos de montaje + todos los cables y modulos del equipo.",
        precautions: "Manipula siempre por los bordes.",
        compatibility: "Especifica de cada modelo; no es intercambiable entre marcas ni casi nunca entre modelos distintos.",
        commonErrors: "Retirarla sin desconectar todos los cables puede arrancar un conector de la placa.",
      },
    },
  };

  var SAFETY_STEPS = [
    {
      id: "safety-power-off",
      kind: "safety",
      title: "Apagar el equipo correctamente",
      instructions: [
        "Guarda tu trabajo y cierra el sistema operativo desde el menu de apagado.",
        "Espera a que el equipo termine de apagarse por completo.",
      ],
    },
    {
      id: "safety-unplug",
      kind: "safety",
      title: "Desconectar el cargador",
      instructions: [
        "Desconecta el cargador de la toma de corriente y del portatil.",
        "Nunca trabajes dentro del equipo con el cargador conectado.",
      ],
    },
    {
      id: "safety-peripherals",
      kind: "safety",
      title: "Retirar perifericos",
      instructions: [
        "Desconecta mouse, USB y cualquier dispositivo externo.",
        "Cierra la pantalla y voltea el equipo boca abajo sobre una superficie limpia y plana.",
      ],
    },
    {
      id: "safety-strap",
      kind: "safety",
      title: "Colocarse la proteccion antiestatica",
      tool: "antistatic-strap",
      instructions: [
        "Coloca la pulsera antiestatica en tu muneca.",
        "Conecta la pinza de la pulsera a una superficie metalica sin pintura.",
      ],
    },
    {
      id: "safety-discharge",
      kind: "safety",
      title: "Descargar energia residual",
      instructions: [
        "Con el cargador desconectado, manten presionado el boton de encendido por 15 segundos.",
        "Esto ayuda a descargar la energia residual de los capacitores antes de continuar.",
      ],
    },
  ];

  var VERIFY_STEPS = [
    {
      id: "verify-peripherals",
      kind: "safety",
      title: "Reconectar perifericos y cargador",
      instructions: [
        "Conecta el cargador y espera unos segundos antes de encender.",
        "Conecta cualquier periferico externo que uses habitualmente.",
      ],
    },
    {
      id: "verify-power-on",
      kind: "safety",
      title: "Encender y comprobar el funcionamiento",
      instructions: [
        "Enciende el equipo y observa si arranca con normalidad.",
        "Verifica pantalla, teclado, touchpad y conexion Wi-Fi.",
      ],
    },
  ];

  var DISASSEMBLY_SEQUENCE = SAFETY_STEPS.concat([
    { kind: "action", action: "remove", partId: "bottom-cover" },
    { kind: "action", action: "disconnect", partId: "cable-battery" },
    { kind: "action", action: "remove", partId: "battery" },
    { kind: "action", action: "remove", partId: "ram" },
    { kind: "action", action: "remove", partId: "ssd-m2" },
    { kind: "action", action: "disconnect", partId: "cable-cpu-fan-laptop" },
    { kind: "action", action: "remove", partId: "cooler" },
    { kind: "action", action: "remove", partId: "cpu" },
    { kind: "action", action: "disconnect", partId: "wifi-antenna-1" },
    { kind: "action", action: "disconnect", partId: "wifi-antenna-2" },
    { kind: "action", action: "remove", partId: "wifi-card" },
    { kind: "action", action: "disconnect", partId: "cable-keyboard-flex" },
    { kind: "action", action: "remove", partId: "keyboard" },
    { kind: "action", action: "disconnect", partId: "cable-touchpad-flex" },
    { kind: "action", action: "remove", partId: "touchpad" },
    { kind: "action", action: "disconnect", partId: "cable-screen-flex" },
    { kind: "action", action: "remove", partId: "screen-assembly" },
    { kind: "action", action: "remove", partId: "motherboard" },
  ]);

  var ASSEMBLY_SEQUENCE = [
    { kind: "action", action: "install", partId: "motherboard" },
    { kind: "action", action: "install", partId: "cpu" },
    { kind: "action", action: "install", partId: "cooler" },
    { kind: "action", action: "connect", partId: "cable-cpu-fan-laptop" },
    { kind: "action", action: "install", partId: "ram" },
    { kind: "action", action: "install", partId: "ssd-m2" },
    { kind: "action", action: "install", partId: "keyboard" },
    { kind: "action", action: "connect", partId: "cable-keyboard-flex" },
    { kind: "action", action: "install", partId: "touchpad" },
    { kind: "action", action: "connect", partId: "cable-touchpad-flex" },
    { kind: "action", action: "install", partId: "screen-assembly" },
    { kind: "action", action: "connect", partId: "cable-screen-flex" },
    { kind: "action", action: "install", partId: "wifi-card" },
    { kind: "action", action: "connect", partId: "wifi-antenna-1" },
    { kind: "action", action: "connect", partId: "wifi-antenna-2" },
    { kind: "action", action: "install", partId: "battery" },
    { kind: "action", action: "connect", partId: "cable-battery" },
    { kind: "action", action: "install", partId: "bottom-cover" },
  ].concat(VERIFY_STEPS);

  var LAPTOP_EQUIPMENT = {
    id: "laptop",
    name: "Computador portatil",
    icon: "\u{1F4BB}",
    parts: PARTS,
    caseGatePartId: "bottom-cover",
    caseOpenActionLabel: "retirar la tapa inferior del portatil",
    closedLabel: "Portatil cerrado",
    zones: [
      { id: "power", title: "Alimentacion" },
      { id: "board", title: "Tarjeta madre y modulos" },
      { id: "input", title: "Teclado y touchpad" },
      { id: "screen", title: "Pantalla" },
    ],
    initialStateDisassembly: buildInitialState(true),
    initialStateAssembly: buildInitialState(false),
    sequences: {
      disassembly: DISASSEMBLY_SEQUENCE,
      assembly: ASSEMBLY_SEQUENCE,
    },
  };

  function buildInitialState(allPresent) {
    var state = {};
    Object.keys(PARTS).forEach(function (id) {
      state[id] = allPresent;
    });
    return state;
  }

  var api = { LAPTOP_EQUIPMENT: LAPTOP_EQUIPMENT };

  root.HardwareLab = root.HardwareLab || {};
  root.HardwareLab.DataLaptop = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : this);
