// Configuracion de Firebase para el Portal SENA.
// Este archivo se carga antes de firebase_db.js para activar la sincronizacion
// en la nube de usuarios y progreso de aprendices.
// La apiKey de Firebase es publica por diseno; la seguridad se gestiona
// en las Firestore Rules del proyecto.
//
// useDriveAsPrimary:
//   true  -> Firestore se usa SOLO para login/signup/cambio de contrasena
//            (Firebase Auth, cuota independiente). Todas las lecturas y
//            escrituras de datos van a Apps Script/Drive. Latencia ~1-2 s.
//            Cero riesgo de bloqueo diario.
//   false -> Comportamiento normal: Firestore primario con failover a Drive.
window.PORTAL_FIREBASE_CONFIG = {
  enabled: true,
  projectId: "sena-portal",
  apiKey: "AIzaSyC0zKUJGVcT0aYcujZyrRBtsbVo1VjBkAA",
  // IMPORTANTE: dejar en false hasta haber migrado TODOS los datos de
  // Firestore a Drive. Activarlo con Drive vacio deja al admin sin lista
  // de aprendices. El gate + failover (fase 2) ya protegen contra bloqueos
  // sin necesidad de este flag.
  useDriveAsPrimary: false,
};
