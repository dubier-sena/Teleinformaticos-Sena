/* redes_rap02_quiz_bank.js
 * Banco de preguntas del quiz de la Guia 3 - Comprobar la conectividad de la red (RAP 02).
 * Santa Barbara 10A (ficha 3441944) y 10B (ficha 3441950).
 *
 * 3 variantes (A, B, C) de 10 preguntas cada una. El motor (script_redes_quiz.js)
 * elige una al azar al iniciar. Puntaje: 10 por correcta (maximo 100).
 * Cubre: dispositivos de red, TCP/IP, DHCP/DNS/NAT, comandos CLI de diagnostico,
 * procedimiento de resolucion de averias y laboratorio Packet Tracer.
 * Texto sin tildes por consistencia con el motor.
 */
(function () {
  window.REDES_QUIZ_VARIANTS = {
    A: [
      {
        id: "q1",
        topic: "Dispositivos de red",
        prompt: "En la Ferreteria Don Misael hay 5 computadores conectados entre si y todos salen a internet. Cual dispositivo conecta los computadores dentro de la LAN?",
        options: ["Router", "Switch", "Access Point", "Modem"],
        correctIndex: 1,
      },
      {
        id: "q2",
        topic: "Dispositivos de red",
        prompt: "Que dispositivo interconecta la red local (LAN) de la ferreteria con internet?",
        options: ["Switch", "Hub", "Router", "Bridge"],
        correctIndex: 2,
      },
      {
        id: "q3",
        topic: "TCP/IP",
        prompt: "El comando ping usa el protocolo ICMP. En cual capa del modelo TCP/IP opera ICMP?",
        options: ["Capa de Acceso a la red", "Capa de Internet", "Capa de Transporte", "Capa de Aplicacion"],
        correctIndex: 1,
      },
      {
        id: "q4",
        topic: "Comandos CLI",
        prompt: "Un tecnico ejecuta ipconfig /all en un PC y ve que la IP es 169.254.45.10. Que indica ese resultado?",
        options: [
          "El PC tiene una IP estatica configurada manualmente",
          "El PC no pudo obtener IP del servidor DHCP (APIPA)",
          "El PC esta conectado a internet correctamente",
          "El gateway del PC es 169.254.45.1",
        ],
        correctIndex: 1,
      },
      {
        id: "q5",
        topic: "Comandos CLI",
        prompt: "El tecnico hace ping 8.8.8.8 y hay respuesta, pero ping google.com falla. Cual es la causa probable?",
        options: [
          "El cable de red esta desconectado",
          "El gateway no responde",
          "El servicio DNS no esta resolviendo nombres",
          "La tarjeta de red del PC esta danada",
        ],
        correctIndex: 2,
      },
      {
        id: "q6",
        topic: "Procedimiento de averias",
        prompt: "Segun el procedimiento de resolucion de averias, cual es el primer paso al recibir un reporte de falla?",
        options: [
          "Ejecutar tracert al gateway",
          "Identificar el problema: sintoma, dispositivo afectado y desde cuando",
          "Cambiar el cable de red",
          "Reiniciar el router",
        ],
        correctIndex: 1,
      },
      {
        id: "q7",
        topic: "DHCP y DNS",
        prompt: "El router de la ferreteria asigna IP automaticamente a todos los computadores. Que servicio realiza esa funcion?",
        options: ["DNS", "NAT", "DHCP", "Firewall"],
        correctIndex: 2,
      },
      {
        id: "q8",
        topic: "Comandos CLI",
        prompt: "Un tecnico quiere ver la ruta de saltos que siguen los paquetes hasta llegar a 8.8.8.8. Que comando debe usar?",
        options: ["ipconfig /all", "netstat -n", "nslookup 8.8.8.8", "tracert 8.8.8.8"],
        correctIndex: 3,
      },
      {
        id: "q9",
        topic: "NAT e IPs",
        prompt: "Los 5 computadores de la ferreteria tienen IPs privadas (192.168.1.x) pero todos salen a internet con una sola IP publica. Que mecanismo hace posible esto?",
        options: ["DHCP", "DNS", "NAT", "VLAN"],
        correctIndex: 2,
      },
      {
        id: "q10",
        topic: "Packet Tracer",
        prompt: "En el laboratorio de Packet Tracer, PC0 (192.168.1.10) hace ping a PC2 (192.168.2.10) y recibe respuesta. Que confirma esa prueba?",
        options: [
          "Que el DNS esta funcionando",
          "Que el enrutamiento entre las dos redes esta configurado correctamente",
          "Que el switch S1 tiene IP de administracion",
          "Que el acceso Telnet al router esta habilitado",
        ],
        correctIndex: 1,
      },
    ],

    B: [
      {
        id: "q1",
        topic: "Dispositivos de red",
        prompt: "Un Access Point en la ferreteria permite que el portátil del encargado se conecte sin cable. Que tipo de conexion provee el Access Point?",
        options: ["Conexion por fibra optica", "Conexion inalambrica Wi-Fi", "Conexion por cable coaxial", "Conexion por Bluetooth"],
        correctIndex: 1,
      },
      {
        id: "q2",
        topic: "TCP/IP",
        prompt: "Que protocolo de la capa de Transporte garantiza la entrega ordenada y sin errores de los datos?",
        options: ["IP", "ICMP", "UDP", "TCP"],
        correctIndex: 3,
      },
      {
        id: "q3",
        topic: "Comandos CLI",
        prompt: "El primer paso en el diagnostico de conectividad es verificar que la tarjeta de red del propio equipo funciona. Que comando se usa para eso?",
        options: ["ping 8.8.8.8", "tracert 192.168.1.1", "ping 127.0.0.1", "ipconfig /all"],
        correctIndex: 2,
      },
      {
        id: "q4",
        topic: "Comandos CLI",
        prompt: "El tecnico ejecuta nslookup google.com y el servidor responde con una IP. Que confirma ese resultado?",
        options: [
          "Que hay conexion a internet",
          "Que el gateway esta activo",
          "Que el DNS esta resolviendo nombres correctamente",
          "Que el DHCP asigno una IP valida",
        ],
        correctIndex: 2,
      },
      {
        id: "q5",
        topic: "DHCP y DNS",
        prompt: "Dos computadores de la ferreteria tienen internet pero uno no. El tecnico ejecuta ipconfig /all en el equipo sin internet y ve que no tiene gateway. Cual es la causa probable?",
        options: [
          "El DNS fallo en ese equipo",
          "El DHCP no asigno correctamente los parametros de red en ese equipo",
          "El cable del switch esta roto",
          "El router no tiene NAT configurado",
        ],
        correctIndex: 1,
      },
      {
        id: "q6",
        topic: "Procedimiento de averias",
        prompt: "Despues de aplicar una solucion, cual es el siguiente paso en el procedimiento de resolucion de averias?",
        options: [
          "Apagar el equipo para que los cambios tomen efecto",
          "Verificar el funcionamiento completo y documentar",
          "Reiniciar el proceso desde el paso 1",
          "Llamar al proveedor de internet",
        ],
        correctIndex: 1,
      },
      {
        id: "q7",
        topic: "Indicadores luminosos",
        prompt: "El switch de la ferreteria tiene un puerto con luz ambar en lugar de verde. Que debe hacer el tecnico antes de ejecutar cualquier comando?",
        options: [
          "Ejecutar ping al gateway inmediatamente",
          "Revisar fisicamente el cable y el puerto (capa fisica) antes de diagnosticar por software",
          "Reiniciar el switch",
          "Cambiar la IP del equipo conectado a ese puerto",
        ],
        correctIndex: 1,
      },
      {
        id: "q8",
        topic: "Comandos CLI",
        prompt: "El tecnico quiere ver todas las conexiones de red activas, IPs remotas y puertos en uso. Que comando debe ejecutar?",
        options: ["ipconfig /all", "tracert 8.8.8.8", "netstat -n", "ping 127.0.0.1"],
        correctIndex: 2,
      },
      {
        id: "q9",
        topic: "NAT e IPs",
        prompt: "El router tiene dos interfaces IP: una con 192.168.1.1 (LAN) y otra con una IP publica (WAN). Para que sirve la interfaz WAN?",
        options: [
          "Para conectarse al switch de la LAN",
          "Para asignar IPs a los computadores de la red interna",
          "Para conectarse al proveedor de internet y salir a internet",
          "Para crear una VLAN interna",
        ],
        correctIndex: 2,
      },
      {
        id: "q10",
        topic: "Packet Tracer",
        prompt: "En el laboratorio, PC0 intenta acceso Telnet al Router R1 (192.168.1.1) y el login es exitoso con RemotePass02. Que confirma esa prueba?",
        options: [
          "Que el enrutamiento entre plantas funciona",
          "Que el acceso administrativo remoto al router esta habilitado y funciona",
          "Que el DHCP del router esta activo",
          "Que el switch S1 tiene conectividad con el router",
        ],
        correctIndex: 1,
      },
    ],

    C: [
      {
        id: "q1",
        topic: "TCP/IP",
        prompt: "En el modelo TCP/IP, cual capa se encarga del direccionamiento IP y el enrutamiento de paquetes entre redes?",
        options: ["Capa de Acceso a la red", "Capa de Transporte", "Capa de Internet", "Capa de Aplicacion"],
        correctIndex: 2,
      },
      {
        id: "q2",
        topic: "Dispositivos de red",
        prompt: "La camara IP de la ferreteria desaparecio del sistema de vigilancia aunque el cable sigue conectado. Que causa es mas probable?",
        options: [
          "La camara perdio su direccion IP (fallo DHCP o IP estatica mal configurada)",
          "El switch se apago",
          "El router no tiene NAT",
          "El DNS no resuelve el nombre de la camara",
        ],
        correctIndex: 0,
      },
      {
        id: "q3",
        topic: "Comandos CLI",
        prompt: "Un tecnico hace ping 192.168.1.1 (gateway) y no recibe respuesta, pero ping 127.0.0.1 si funciona. Que indica eso?",
        options: [
          "La tarjeta de red del PC esta danada",
          "El DNS no funciona",
          "El PC tiene problema de comunicacion con el router (LAN o cable)",
          "El proveedor de internet tiene una falla",
        ],
        correctIndex: 2,
      },
      {
        id: "q4",
        topic: "DHCP y DNS",
        prompt: "Todos los equipos de la ferreteria muestran IPs 169.254.x.x al mismo tiempo. Cual es la causa mas probable?",
        options: [
          "El DNS se cayo",
          "El servidor DHCP del router fallo y los equipos se asignaron IPs APIPA",
          "El NAT del router esta desactivado",
          "El switch perdio la configuracion de VLAN",
        ],
        correctIndex: 1,
      },
      {
        id: "q5",
        topic: "Comandos CLI",
        prompt: "El tecnico ejecuta tracert 8.8.8.8 y ve que el primer salto responde en 2ms con IP 192.168.1.1. Que representa ese primer salto?",
        options: [
          "El servidor DNS del ISP",
          "El gateway (router) de la red local",
          "El servidor de Google",
          "El switch de la LAN",
        ],
        correctIndex: 1,
      },
      {
        id: "q6",
        topic: "Procedimiento de averias",
        prompt: "Un portátil tiene Wi-Fi conectado pero no abre ninguna pagina web. El tecnico hace ping 8.8.8.8 y funciona. Que fallo?",
        options: [
          "La tarjeta Wi-Fi del portátil",
          "El cable entre el router y el ISP",
          "El servicio DNS no esta resolviendo nombres de dominio",
          "El gateway del portátil esta mal configurado",
        ],
        correctIndex: 2,
      },
      {
        id: "q7",
        topic: "NAT e IPs",
        prompt: "Por que los equipos de la ferreteria usan IPs privadas (192.168.x.x) en lugar de IPs publicas?",
        options: [
          "Porque las IPs publicas son mas lentas",
          "Porque las IPs privadas no pueden usarse en internet y se reservan para redes internas; NAT hace la traduccion",
          "Porque el router no soporta IPs publicas",
          "Porque el DHCP solo asigna IPs privadas por seguridad",
        ],
        correctIndex: 1,
      },
      {
        id: "q8",
        topic: "Packet Tracer",
        prompt: "En el laboratorio, el tecnico configura R1 con 'no ip domain-lookup'. Para que sirve ese comando?",
        options: [
          "Para deshabilitar el DHCP del router",
          "Para evitar que el router intente resolver palabras mal escritas como nombres de dominio (evita demoras en la consola)",
          "Para desactivar el DNS del router",
          "Para bloquear el acceso Telnet al router",
        ],
        correctIndex: 1,
      },
      {
        id: "q9",
        topic: "Comandos CLI",
        prompt: "El tecnico quiere identificar rapidamente la IP, mascara, gateway y servidor DNS de un equipo. Que comando ejecuta?",
        options: ["ping 127.0.0.1", "netstat -n", "ipconfig /all", "tracert 8.8.8.8"],
        correctIndex: 2,
      },
      {
        id: "q10",
        topic: "Packet Tracer",
        prompt: "En el laboratorio, S1 ejecuta ping 192.168.1.1 (Router R1) y hay respuesta. Que confirma esa prueba?",
        options: [
          "Que PC0 puede comunicarse con PC2",
          "Que el switch S1 tiene acceso de administracion al router por la red de planta 1",
          "Que el Telnet esta habilitado en el router",
          "Que el enrutamiento entre plantas esta activo",
        ],
        correctIndex: 1,
      },
    ],
  };
})();
