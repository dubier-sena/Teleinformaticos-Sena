/* js/hardware_lab_data_desktop.js
 *
 * Datos del PC de escritorio para el Laboratorio Virtual de Hardware (MVP).
 * Aqui NO hay logica: solo la definicion de piezas, sus dependencias fisicas
 * y las secuencias guiadas de desensamble/ensamble. La logica que interpreta
 * estos datos vive en hardware_lab_engine.js (motor generico, reutilizable
 * para el portatil y para futuros equipos/piezas sin tocar el motor).
 *
 * Modelo de una PIEZA:
 *   id               identificador unico
 *   kind             "component" | "cable"
 *   name             nombre visible
 *   category         agrupacion visual/informativa
 *   location         "external" (tapa) | "internal" (todo lo de adentro)
 *   tool             id de herramienta requerida (ver hardware_lab_tools.js)
 *                    o "hands" si no requiere herramienta
 *   removeRequires   ids de piezas que deben estar AUSENTES/DESCONECTADAS
 *                    antes de poder retirar/desconectar esta pieza
 *   installRequires  ids de piezas que deben estar PRESENTES/CONECTADAS
 *                    antes de poder instalar/conectar esta pieza
 *   removeInstructions / installInstructions   pasos en texto (item 12/13)
 *   info             ficha de "Aprender componentes" (item 11)
 *
 * Una pieza "component" pasa de estado installed <-> removed.
 * Una pieza "cable" pasa de estado connected <-> disconnected.
 * El motor normaliza ambos a un booleano interno "present".
 *
 * Regla especial de armazon: TODAS las piezas con location:"internal" solo
 * pueden tocarse mientras "side-panel" este removida (gabinete abierto). El
 * motor aplica esta regla automaticamente; no hace falta repetirla pieza por
 * pieza (evita 14 copias del mismo requisito).
 */
(function (root) {
  "use strict";

  var PARTS = {
    "side-panel": {
      id: "side-panel",
      kind: "component",
      name: "Tapa lateral",
      category: "chasis",
      location: "external",
      icon: "\u{1F5C4}️",
      zone: "case",
      tool: "phillips",
      removeRequires: [],
      installRequires: [],
      removeInstructions: [
        "Ubica los tornillos traseros que sujetan la tapa lateral izquierda.",
        "Retira los tornillos con el destornillador Phillips y guardalos en un lugar seguro.",
        "Desliza la tapa hacia atras y separala del gabinete.",
      ],
      installInstructions: [
        "Alinea la tapa con los rieles del gabinete.",
        "Deslizala hacia adelante hasta que encaje.",
        "Coloca y ajusta los tornillos traseros.",
      ],
      info: {
        function: "Cubre y protege el interior del gabinete; su retiro es el primer paso de cualquier intervencion.",
        characteristics: "Lamina metalica o de vidrio templado, sujeta con 1 a 3 tornillos Phillips o thumbscrews.",
        location: "Lateral izquierdo del gabinete (visto desde el frente).",
        connectionType: "Mecanica: tornillos + rieles deslizantes.",
        precautions: "Sujetala por los bordes; los modelos con vidrio templado se pueden fracturar con golpes.",
        compatibility: "Especifica de cada modelo de gabinete.",
        commonErrors: "Forzar la tapa sin retirar todos los tornillos puede doblar los rieles.",
      },
    },

    "cable-front-panel": {
      id: "cable-front-panel",
      kind: "cable",
      name: "Conectores del panel frontal",
      category: "cableado",
      location: "internal",
      icon: "\u{1F50C}",
      zone: "board",
      tool: "hands",
      removeRequires: [],
      installRequires: ["motherboard"],
      removeInstructions: [
        "Localiza el bloque de pines pequenos en la esquina de la placa (power SW, reset, LEDs, audio frontal, USB).",
        "Anota o fotografia la posicion de cada conector antes de retirarlo.",
        "Retira cada conector con cuidado, sujetandolo por el plastico, no por los cables.",
      ],
      installInstructions: [
        "Ubica el bloque de pines del panel frontal en la placa madre.",
        "Conecta cada cable respetando polaridad (+/-) segun el manual de la placa.",
        "Verifica que ningun pin quedo doblado o sin conectar.",
      ],
      info: {
        function: "Conecta el boton de encendido, reinicio, LEDs y puertos frontales del gabinete a la placa madre.",
        characteristics: "Grupo de conectores pequenos de 2 a 4 pines cada uno.",
        location: "Esquina inferior de la tarjeta madre, cerca del borde frontal del gabinete.",
        connectionType: "Pines individuales o bloque plastico segun el gabinete.",
        precautions: "Un conector en la posicion equivocada puede impedir que el equipo encienda.",
        compatibility: "El diagrama exacto de pines varia por fabricante de placa madre: siempre revisa el manual.",
        commonErrors: "Confundir Power SW con Reset, o invertir la polaridad de los LEDs (no danan el equipo, pero el LED no enciende).",
      },
    },

    "cable-atx": {
      id: "cable-atx",
      kind: "cable",
      name: "Cable ATX 24 pines",
      category: "cableado",
      location: "internal",
      icon: "\u{1F50C}",
      zone: "board",
      tool: "hands",
      removeRequires: [],
      installRequires: ["psu", "motherboard"],
      removeInstructions: [
        "Presiona el seguro plastico del conector ATX de 24 pines en la placa madre.",
        "Tira del conector en linea recta, sin forzar hacia los lados.",
      ],
      installInstructions: [
        "Alinea el conector ATX de 24 pines con su socket en la placa madre (encaja en un solo sentido).",
        "Empuja firme y derecho hasta escuchar el clic del seguro.",
      ],
      info: {
        function: "Entrega la alimentacion principal de la fuente de poder a la tarjeta madre.",
        characteristics: "Conector de 24 pines (20+4 en fuentes modulares antiguas).",
        location: "Borde derecho de la tarjeta madre.",
        connectionType: "Conector con seguro plastico, polarizado (solo entra en un sentido).",
        precautions: "Nunca lo conectes ni desconectes con el equipo encendido o conectado a la corriente.",
        compatibility: "Estandar ATX; universal entre fuentes y placas ATX/microATX/mini-ITX.",
        commonErrors: "No presionar el seguro antes de tirar puede romper el conector de la placa.",
      },
    },

    "cable-cpu-eps": {
      id: "cable-cpu-eps",
      kind: "cable",
      name: "Cable CPU / EPS 8 pines",
      category: "cableado",
      location: "internal",
      icon: "\u{1F50C}",
      zone: "board",
      tool: "hands",
      removeRequires: [],
      installRequires: ["psu", "motherboard"],
      removeInstructions: [
        "Ubica el conector de 4+4 u 8 pines cerca del socket del procesador (arriba de la placa).",
        "Presiona el seguro y retira el conector en linea recta.",
      ],
      installInstructions: [
        "Ubica el socket EPS/CPU de 8 pines junto al procesador.",
        "Conecta el cable hasta escuchar el clic del seguro.",
      ],
      info: {
        function: "Alimenta exclusivamente al procesador; es un circuito distinto al ATX principal.",
        characteristics: "Conector de 8 pines (o 4+4 separable), distinto en forma al ATX de 24 pines.",
        location: "Esquina superior de la tarjeta madre, junto al socket del procesador.",
        connectionType: "Conector con seguro plastico, polarizado.",
        precautions: "No debe confundirse con el conector PCIe de la tarjeta grafica (misma forma, distinta funcion).",
        compatibility: "Estandar EPS12V; casi todas las placas ATX modernas lo requieren.",
        commonErrors: "Dejarlo desconectado impide que el equipo complete el arranque aunque el ATX si este conectado (ver Caso 7 de diagnostico).",
      },
    },

    "cable-sata-data": {
      id: "cable-sata-data",
      kind: "cable",
      name: "Cable SATA de datos",
      category: "cableado",
      location: "internal",
      icon: "\u{1F50C}",
      zone: "storage",
      tool: "hands",
      removeRequires: [],
      installRequires: ["motherboard", "ssd"],
      removeInstructions: [
        "Sujeta el conector SATA (no el cable) en ambos extremos.",
        "Tira suavemente en linea recta para desconectarlo de la placa y de la unidad.",
      ],
      installInstructions: [
        "Conecta un extremo al puerto SATA de la tarjeta madre.",
        "Conecta el otro extremo al puerto de datos de la unidad SSD/HDD.",
      ],
      info: {
        function: "Transporta los datos entre la unidad de almacenamiento y la tarjeta madre.",
        characteristics: "Cable delgado en forma de L, conectores pequenos de 7 pines.",
        location: "Puerto SATA de la placa madre <-> puerto de datos de la unidad.",
        connectionType: "Conector a friccion, sin seguro mecanico en la mayoria de cables.",
        precautions: "Es distinto del cable SATA de alimentacion (mas ancho, viene de la fuente).",
        compatibility: "SATA III (6 Gb/s) es retrocompatible con SATA I/II.",
        commonErrors: "Confundirlo con el cable de alimentacion SATA por el nombre similar.",
      },
    },

    "cable-sata-power": {
      id: "cable-sata-power",
      kind: "cable",
      name: "Cable SATA de alimentacion",
      category: "cableado",
      location: "internal",
      icon: "\u{1F50C}",
      zone: "storage",
      tool: "hands",
      removeRequires: [],
      installRequires: ["psu", "ssd"],
      removeInstructions: [
        "Sujeta el conector ancho y plano que sale de la fuente de poder.",
        "Tira en linea recta para separarlo del puerto de alimentacion de la unidad.",
      ],
      installInstructions: [
        "Conecta el extremo plano del cable al puerto de alimentacion de la unidad SSD/HDD.",
      ],
      info: {
        function: "Entrega alimentacion electrica (5V y 12V) a la unidad de almacenamiento.",
        characteristics: "Conector ancho y plano de 15 pines, proviene directo de la fuente.",
        location: "Puerto de alimentacion de la unidad (junto al puerto de datos, mas ancho).",
        connectionType: "Conector a friccion.",
        precautions: "No mezclar con adaptadores Molex antiguos sin verificar polaridad.",
        compatibility: "Estandar SATA power; todas las unidades SATA modernas lo usan.",
        commonErrors: "Si la unidad no aparece en el sistema, revisa PRIMERO este cable y el de datos (ver Caso 4 de diagnostico).",
      },
    },

    "cable-gpu-power": {
      id: "cable-gpu-power",
      kind: "cable",
      name: "Cable de alimentacion GPU",
      category: "cableado",
      location: "internal",
      icon: "\u{1F50C}",
      zone: "gpu",
      tool: "hands",
      removeRequires: [],
      installRequires: ["psu", "gpu"],
      removeInstructions: [
        "Presiona el seguro plastico del conector PCIe de 6/8 pines en la tarjeta grafica.",
        "Tira en linea recta para desconectarlo.",
      ],
      installInstructions: [
        "Conecta el cable PCIe de 6/8 pines de la fuente al conector de la tarjeta grafica.",
        "Verifica que quede asegurado con el clip plastico.",
      ],
      info: {
        function: "Entrega alimentacion adicional a tarjetas graficas que la requieren (mas alla de la ranura PCIe).",
        characteristics: "Conector de 6 u 8 pines (o 6+2), similar en forma al EPS pero con distinto conteo/uso.",
        location: "Extremo de la tarjeta grafica, orientado hacia atras del gabinete.",
        connectionType: "Conector con seguro plastico.",
        precautions: "No todas las GPU lo requieren: las de bajo consumo se alimentan solo desde la ranura PCIe.",
        compatibility: "Depende del consumo (TDP) de la tarjeta; revisar cuantos conectores exige el fabricante.",
        commonErrors: "Olvidar este cable es la causa mas comun de 'enciende pero sin imagen por GPU' (ver Caso 6).",
      },
    },

    "cable-cpu-fan": {
      id: "cable-cpu-fan",
      kind: "cable",
      name: "Cable del ventilador CPU",
      category: "cableado",
      location: "internal",
      icon: "\u{1F50C}",
      zone: "board",
      tool: "hands",
      removeRequires: [],
      installRequires: ["motherboard", "cooler"],
      removeInstructions: [
        "Localiza el conector de 4 pines que sale del disipador.",
        "Sujeta el conector (no el cable) y tira hacia arriba para desconectarlo del header CPU_FAN.",
      ],
      installInstructions: [
        "Ubica el header CPU_FAN en la tarjeta madre (cerca del socket del procesador).",
        "Conecta el cable del ventilador respetando la orientacion de la muesca.",
      ],
      info: {
        function: "Permite que la tarjeta madre controle y monitoree la velocidad del ventilador del procesador.",
        characteristics: "Conector de 4 pines (PWM) con muesca de orientacion.",
        location: "Header 'CPU_FAN' de la tarjeta madre, junto al socket del procesador.",
        connectionType: "Conector a friccion con muesca.",
        precautions: "Nunca lo conectes a un header distinto de CPU_FAN o la placa puede no vigilar la temperatura del procesador.",
        compatibility: "Estandar de 3 o 4 pines; los de 4 pines controlan velocidad por PWM.",
        commonErrors: "Un CPU_FAN desconectado suele disparar una advertencia de la BIOS o apagado por seguridad (ver Caso 5).",
      },
    },

    ram: {
      id: "ram",
      kind: "component",
      name: "Memoria RAM",
      category: "memoria",
      location: "internal",
      icon: "\u{1F7E9}",
      zone: "board",
      tool: "hands",
      removeRequires: [],
      installRequires: ["motherboard"],
      removeInstructions: [
        "Libera los seguros laterales del slot presionandolos hacia afuera.",
        "El modulo se levanta solo un poco al liberar los seguros.",
        "Sujeta el modulo por sus bordes (nunca toques los contactos dorados) y retiralo en linea recta.",
      ],
      installInstructions: [
        "Abre los seguros laterales del slot.",
        "Alinea la muesca del modulo con la muesca del slot (solo entra en un sentido).",
        "Presiona parejo en ambos extremos hasta escuchar el clic de los seguros.",
      ],
      info: {
        function: "Almacena temporalmente los datos que la CPU necesita usar de inmediato; determina cuanto puede 'tener abierto' el sistema a la vez.",
        characteristics: "Modulos DDR4 o DDR5 segun la placa; se instalan en slots (2 o 4 segun el modelo).",
        location: "Slots junto al socket del procesador, identificados por colores alternos para Dual Channel.",
        connectionType: "A presion, con seguros laterales y muesca polarizada.",
        precautions: "Manipula solo por los bordes; la electricidad estatica puede danar los circuitos.",
        compatibility: "DDR4 y DDR5 NO son intercambiables entre si (muesca en distinta posicion); revisar la velocidad maxima soportada por la placa.",
        commonErrors: "Un modulo mal asentado (seguros no cerrados del todo) es la causa mas comun de que el equipo no de imagen (ver Caso 2 de diagnostico).",
      },
    },

    ssd: {
      id: "ssd",
      kind: "component",
      name: "SSD SATA",
      category: "almacenamiento",
      location: "internal",
      icon: "\u{1F4BE}",
      zone: "storage",
      tool: "phillips",
      removeRequires: ["cable-sata-data", "cable-sata-power"],
      installRequires: [],
      removeInstructions: [
        "Verifica que los cables SATA de datos y de alimentacion ya esten desconectados.",
        "Retira los tornillos de la bahia de 2.5 pulgadas.",
        "Desliza la unidad fuera de la bahia.",
      ],
      installInstructions: [
        "Desliza la unidad dentro de la bahia de 2.5 pulgadas.",
        "Alinea los orificios de tornillo con la bahia.",
        "Ajusta los tornillos sin forzar (la carcasa es de plastico/metal delgado).",
      ],
      info: {
        function: "Almacena de forma permanente el sistema operativo, programas y archivos.",
        characteristics: "Sin partes moviles; mucho mas rapido que un disco duro mecanico tradicional.",
        location: "Bahia de 2.5 pulgadas, generalmente en la parte trasera de la bandeja de la placa o en el fondo del gabinete.",
        connectionType: "SATA de datos + SATA de alimentacion (dos cables independientes).",
        precautions: "No requiere manejo tan cuidadoso como un HDD mecanico, pero evita golpes con los contactos.",
        compatibility: "Formato 2.5' estandar; velocidad limitada por el puerto SATA III (6 Gb/s) de la placa.",
        commonErrors: "Un SSD que no aparece en el sistema casi siempre es un cable de datos o alimentacion suelto, no la unidad danada (ver Caso 4).",
      },
    },

    "ssd-m2": {
      id: "ssd-m2",
      kind: "component",
      name: "SSD M.2",
      category: "almacenamiento",
      location: "internal",
      icon: "\u{1F4BE}",
      zone: "storage",
      tool: "phillips",
      removeRequires: [],
      installRequires: ["motherboard"],
      removeInstructions: [
        "Retira el unico tornillo que fija el extremo libre de la unidad.",
        "La unidad se levanta en angulo; retirala deslizandola del slot M.2.",
      ],
      installInstructions: [
        "Inserta la unidad en el slot M.2 en angulo, respetando la muesca de la ranura.",
        "Baja la unidad y ajusta el tornillo de fijacion del extremo libre.",
      ],
      info: {
        function: "Almacenamiento permanente de alta velocidad, conectado directo a la placa sin cables.",
        characteristics: "Tarjeta delgada tipo 'chicle' (sin carcasa como el SSD SATA); usa el bus PCIe, mucho mas rapido que SATA.",
        location: "Slot M.2 de la tarjeta madre, generalmente cerca del socket del procesador.",
        connectionType: "Ranura M.2 + un tornillo de fijacion (no usa cables como el SSD SATA).",
        precautions: "No dobles la tarjeta al insertarla o retirarla; no toques los contactos dorados.",
        compatibility: "Verifica la clave del slot (M o B+M) y el tipo de unidad (NVMe o SATA M.2) antes de reemplazar.",
        commonErrors: "Un SSD M.2 que no aparece en el sistema casi siempre esta mal asentado en la ranura, no danado (ver Caso 9).",
      },
    },

    cooler: {
      id: "cooler",
      kind: "component",
      name: "Disipador y ventilador CPU",
      category: "refrigeracion",
      location: "internal",
      icon: "\u{1F4A8}",
      zone: "board",
      tool: "phillips",
      removeRequires: ["cable-cpu-fan"],
      installRequires: ["cpu"],
      removeInstructions: [
        "Verifica que el cable del ventilador CPU ya este desconectado.",
        "Afloja los 4 tornillos (o libera el clip a presion) en cruz, un poco cada uno por turnos.",
        "Levanta el disipador en linea recta; puede requerir un giro suave si la pasta termica lo pega al procesador.",
      ],
      installInstructions: [
        "Aplica una porcion pequena de pasta termica nueva en el centro del procesador (si se reutiliza, limpia primero la pasta vieja).",
        "Coloca el disipador alineado con los orificios de montaje.",
        "Ajusta los 4 tornillos en cruz y por turnos, sin apretar uno solo por completo antes que los demas.",
      ],
      info: {
        function: "Extrae el calor generado por el procesador y lo disipa con un ventilador, evitando que el sistema se sobrecaliente.",
        characteristics: "Base de metal en contacto con el procesador + aletas + ventilador; puede ser por aire o liquido (AIO).",
        location: "Directamente sobre el socket del procesador.",
        connectionType: "Mecanica (tornillos o clip) + cable de 4 pines al header CPU_FAN.",
        precautions: "Nunca lo retires con el equipo encendido; afloja los tornillos en cruz para no deformar la base.",
        compatibility: "Debe coincidir con el socket del procesador (AM4, AM5, LGA1700, etc.).",
        commonErrors: "Pasta termica vieja, resecada o mal aplicada es causa comun de sobrecalentamiento (ver Caso 8).",
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
      removeRequires: ["cooler"],
      installRequires: ["motherboard"],
      removeInstructions: [
        "Verifica que el disipador ya este retirado y la pasta termica limpia.",
        "Levanta la palanca metalica del socket hasta liberar el marco de retencion.",
        "Sujeta el procesador por los bordes (nunca toques los pines/contactos) y retiralo en linea recta.",
      ],
      installInstructions: [
        "Con la palanca del socket abierta, ubica la muesca/triangulo dorado del procesador con la marca del socket.",
        "Coloca el procesador sin presionar; debe caer por su propio peso en la orientacion correcta.",
        "Cierra el marco de retencion y baja la palanca hasta que quede asegurada.",
      ],
      info: {
        function: "Ejecuta las instrucciones de los programas; es el 'cerebro' del computador.",
        characteristics: "Chip de silicio con cientos o miles de pines/contactos en su parte inferior.",
        location: "Socket central de la tarjeta madre, bajo el disipador.",
        connectionType: "Socket con palanca de retencion (LGA) o pines directos en el procesador (PGA, menos comun hoy).",
        precautions: "Es el componente mas delicado del sistema: nunca toques los contactos ni fuerces la orientacion.",
        compatibility: "Debe coincidir exactamente con el socket de la placa madre (no hay adaptadores).",
        commonErrors: "Forzar el procesador en una orientacion incorrecta puede doblar pines y dejarlo inservible.",
      },
    },

    gpu: {
      id: "gpu",
      kind: "component",
      name: "Tarjeta grafica (GPU)",
      category: "expansion",
      location: "internal",
      icon: "\u{1F3AE}",
      zone: "gpu",
      tool: "phillips",
      removeRequires: ["cable-gpu-power"],
      installRequires: ["motherboard"],
      removeInstructions: [
        "Verifica que el cable de alimentacion PCIe ya este desconectado.",
        "Retira el tornillo que fija el soporte de la tarjeta al gabinete.",
        "Presiona el seguro de la ranura PCIe y tira de la tarjeta hacia arriba en linea recta.",
      ],
      installInstructions: [
        "Alinea la tarjeta con la ranura PCIe x16 y con la abertura del soporte del gabinete.",
        "Presiona parejo hasta escuchar el clic del seguro de la ranura.",
        "Ajusta el tornillo del soporte al gabinete.",
      ],
      info: {
        function: "Procesa y genera la imagen que se muestra en el monitor; en tareas graficas exigentes, descarga ese trabajo del procesador.",
        characteristics: "Ocupa una o mas ranuras de expansion; suele tener su propio sistema de refrigeracion.",
        location: "Ranura PCIe x16 principal de la tarjeta madre.",
        connectionType: "Ranura PCIe con seguro + cable de alimentacion PCIe (6/8 pines) si la tarjeta lo requiere.",
        precautions: "Sujeta siempre por los bordes; el peso de tarjetas grandes puede forzar la ranura si no se apoya bien.",
        compatibility: "Estandar PCIe (retrocompatible entre versiones); verificar que la fuente entregue suficiente potencia.",
        commonErrors: "No liberar el seguro de la ranura antes de tirar puede romper la ranura PCIe de la placa (ver Caso 6).",
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
        "gpu",
        "cable-atx",
        "cable-cpu-eps",
        "cable-front-panel",
        "cable-sata-data",
        "cable-cpu-fan",
      ],
      installRequires: [],
      removeInstructions: [
        "Verifica que la tarjeta grafica este retirada y todos los cables desconectados de la placa.",
        "Retira los tornillos que la fijan a los separadores del gabinete (guardalos aparte).",
        "Levanta la placa con cuidado, sujetandola por los bordes, y sacala del gabinete.",
      ],
      installInstructions: [
        "Verifica que los separadores metalicos del gabinete coincidan con los orificios de la placa.",
        "Coloca el panel I/O (si es independiente) antes de la placa.",
        "Apoya la placa sobre los separadores y ajusta los tornillos en cruz, sin forzar ninguno primero.",
      ],
      info: {
        function: "Conecta e integra todos los demas componentes: procesador, memoria, almacenamiento, expansion y alimentacion.",
        characteristics: "Circuito impreso con sockets, slots, chipset y puertos traseros.",
        location: "Montada sobre separadores metalicos en el panel lateral del gabinete.",
        connectionType: "Tornillos de montaje + todos los cables y componentes del sistema.",
        precautions: "Manipulala siempre por los bordes; nunca la apoyes sobre superficies conductoras (antiestatico) o metalicas.",
        compatibility: "El factor de forma (ATX, microATX, mini-ITX) debe coincidir con el gabinete; el socket debe coincidir con el procesador.",
        commonErrors: "Instalarla sin todos los separadores correctos puede provocar cortocircuito contra el gabinete.",
      },
    },

    psu: {
      id: "psu",
      kind: "component",
      name: "Fuente de poder",
      category: "alimentacion",
      location: "internal",
      icon: "\u{1F50B}",
      zone: "psu",
      tool: "phillips",
      removeRequires: ["cable-atx", "cable-cpu-eps", "cable-gpu-power", "cable-sata-power"],
      installRequires: [],
      removeInstructions: [
        "Verifica que TODOS los cables que salen de la fuente esten desconectados (ATX, CPU/EPS, GPU, SATA).",
        "Retira los 4 tornillos traseros que la fijan al gabinete.",
        "Sujeta la fuente firmemente y deslizala hacia afuera del gabinete.",
      ],
      installInstructions: [
        "Ubica la fuente en su bahia con el ventilador orientado segun el gabinete (hacia abajo o hacia la rejilla).",
        "Alinea los orificios traseros y ajusta los 4 tornillos.",
        "Conecta primero los cables internos antes de energizar el sistema.",
      ],
      info: {
        function: "Convierte la corriente alterna de la toma electrica en las distintas corrientes continuas que necesita cada componente.",
        characteristics: "Caja metalica sellada con un ventilador propio; entrega varios voltajes (+12V, +5V, +3.3V).",
        location: "Bahia trasera superior o inferior del gabinete, segun el diseno.",
        connectionType: "Cable de poder a la pared + multiples conectores internos (ATX, CPU/EPS, SATA, PCIe).",
        precautions: "Nunca la abras: almacena carga electrica peligrosa incluso desconectada. Desconecta siempre de la pared antes de manipular cualquier cable interno.",
        compatibility: "La potencia (vatios) debe cubrir el consumo de CPU + GPU + resto de componentes con margen.",
        commonErrors: "Confundir el switch trasero 0/1 con el boton de encendido del gabinete (ver Caso 1 de diagnostico).",
      },
    },
  };

  // Herramienta de seguridad requerida para "colocarse la pulsera" no es una
  // pieza del equipo: se maneja como paso de procedimiento (ver SAFETY_STEPS).
  var SAFETY_STEPS = [
    {
      id: "safety-power-off",
      kind: "safety",
      title: "Apagar el equipo correctamente",
      instructions: [
        "Guarda tu trabajo y cierra el sistema operativo desde el menu de apagado.",
        "Espera a que el equipo termine de apagarse por completo (sin luces de actividad).",
      ],
    },
    {
      id: "safety-unplug",
      kind: "safety",
      title: "Desconectar la alimentacion electrica",
      instructions: [
        "Desconecta el cable de poder de la toma de corriente (no solo de la fuente).",
        "Nunca trabajes dentro del gabinete con el cable de poder conectado, aunque el equipo este apagado.",
      ],
    },
    {
      id: "safety-peripherals",
      kind: "safety",
      title: "Retirar perifericos",
      instructions: [
        "Desconecta monitor, teclado, mouse y cualquier dispositivo USB.",
        "Deja el area de trabajo despejada para manipular el gabinete con comodidad.",
      ],
    },
    {
      id: "safety-strap",
      kind: "safety",
      title: "Colocarse la proteccion antiestatica",
      tool: "antistatic-strap",
      instructions: [
        "Coloca la pulsera antiestatica en tu muneca.",
        "Conecta la pinza de la pulsera a una parte metalica sin pintura del gabinete.",
      ],
    },
    {
      id: "safety-discharge",
      kind: "safety",
      title: "Descargar energia residual",
      instructions: [
        "Con el equipo desconectado, manten presionado el boton de encendido del gabinete por 5 segundos.",
        "Esto descarga los capacitores de la fuente y previene un choque electrico o dano al hardware.",
      ],
    },
  ];

  var VERIFY_STEPS = [
    {
      id: "verify-peripherals",
      kind: "safety",
      title: "Reconectar perifericos",
      instructions: [
        "Conecta de nuevo monitor, teclado y mouse.",
        "Conecta el cable de poder a la toma de corriente.",
      ],
    },
    {
      id: "verify-power-on",
      kind: "safety",
      title: "Encender y comprobar el funcionamiento",
      instructions: [
        "Enciende el equipo y observa si arranca con normalidad.",
        "Verifica que el monitor reciba imagen y que no haya pitidos (beeps) de error.",
      ],
    },
  ];

  // Orden valido de desensamble: cada paso ya cumple, en ese punto, todas las
  // dependencias declaradas arriba (removeRequires). El motor lo vuelve a
  // validar en tiempo real; este orden es la referencia para el modo guiado.
  var DISASSEMBLY_SEQUENCE = SAFETY_STEPS.concat([
    { kind: "action", action: "remove", partId: "side-panel" },
    { kind: "action", action: "disconnect", partId: "cable-gpu-power" },
    { kind: "action", action: "remove", partId: "gpu" },
    { kind: "action", action: "disconnect", partId: "cable-sata-data" },
    { kind: "action", action: "disconnect", partId: "cable-sata-power" },
    { kind: "action", action: "remove", partId: "ssd" },
    { kind: "action", action: "remove", partId: "ssd-m2" },
    { kind: "action", action: "remove", partId: "ram" },
    { kind: "action", action: "disconnect", partId: "cable-cpu-fan" },
    { kind: "action", action: "remove", partId: "cooler" },
    { kind: "action", action: "remove", partId: "cpu" },
    { kind: "action", action: "disconnect", partId: "cable-atx" },
    { kind: "action", action: "disconnect", partId: "cable-cpu-eps" },
    { kind: "action", action: "disconnect", partId: "cable-front-panel" },
    { kind: "action", action: "remove", partId: "motherboard" },
    { kind: "action", action: "remove", partId: "psu" },
  ]);

  // Orden valido de ensamble: reconstruye desde el gabinete vacio. Cada paso
  // cumple, en ese punto, installRequires. La tapa lateral se cierra al final
  // (regla de motor: nada interno se puede tocar con el gabinete cerrado).
  var ASSEMBLY_SEQUENCE = [
    { kind: "action", action: "install", partId: "motherboard" },
    { kind: "action", action: "install", partId: "psu" },
    { kind: "action", action: "connect", partId: "cable-atx" },
    { kind: "action", action: "connect", partId: "cable-cpu-eps" },
    { kind: "action", action: "connect", partId: "cable-front-panel" },
    { kind: "action", action: "install", partId: "cpu" },
    { kind: "action", action: "install", partId: "cooler" },
    { kind: "action", action: "connect", partId: "cable-cpu-fan" },
    { kind: "action", action: "install", partId: "ram" },
    { kind: "action", action: "install", partId: "ssd" },
    { kind: "action", action: "install", partId: "ssd-m2" },
    { kind: "action", action: "connect", partId: "cable-sata-data" },
    { kind: "action", action: "connect", partId: "cable-sata-power" },
    { kind: "action", action: "install", partId: "gpu" },
    { kind: "action", action: "connect", partId: "cable-gpu-power" },
    { kind: "action", action: "install", partId: "side-panel" },
  ].concat(VERIFY_STEPS);

  var DESKTOP_EQUIPMENT = {
    id: "desktop",
    name: "PC de escritorio",
    icon: "\u{1F5A5}️",
    parts: PARTS,
    // Pieza que gobierna el acceso a las piezas "internal" (ver motor).
    caseGatePartId: "side-panel",
    caseOpenActionLabel: "abrir la tapa lateral del gabinete",
    // Zonas visuales para agrupar piezas en la UI (hardware_lab_ui.js).
    zones: [
      { id: "psu", title: "Fuente de poder" },
      { id: "board", title: "Tarjeta madre" },
      { id: "gpu", title: "Tarjeta grafica" },
      { id: "storage", title: "Almacenamiento" },
    ],
    // Estado inicial para desensamble: todo instalado/conectado.
    initialStateDisassembly: buildInitialState(true),
    // Estado inicial para ensamble: todo removido/desconectado (gabinete vacio).
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

  var api = { DESKTOP_EQUIPMENT: DESKTOP_EQUIPMENT };

  root.HardwareLab = root.HardwareLab || {};
  root.HardwareLab.DataDesktop = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : this);
