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
  // useDriveAsPrimary con ruteo POR COLECCION (ver firebase_db.js):
  //   - Colecciones de CUENTA/AUTH (users, user_auth, user_meta, roles) SIEMPRE
  //     van a Firestore. Son de bajo volumen (~400 lecturas/dia) y no saturan
  //     la cuota. Asi el admin siempre ve los aprendices y el login funciona.
  //   - Colecciones de DATOS (progress, guide_state, calendar, groups, tutoring)
  //     van a Drive. Son el alto volumen que saturaba la cuota.
  // El admin debe ejecutar el backfill UNA vez para poblar Drive con los datos
  // existentes: en consola -> await window._firebaseDb.backfillToDrive()
  useDriveAsPrimary: true,
};
