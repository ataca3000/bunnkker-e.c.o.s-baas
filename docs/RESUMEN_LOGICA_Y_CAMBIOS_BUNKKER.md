# Resumen de Lógica, Cambios y Mejoras — BUNKKER E.C.O.S.

**Proyecto:** BUNKKER E.C.O.S. (ERP/POS Web Next.js + Companion Nativo Android Kotlin/Compose)  
**Proyecto Firebase Unificado:** `gen-lang-client-0628483139` (`project_number`: `594116889378`)  
**Base de Datos Firestore:** `ai-studio-bunnkkerecosbaas-db35bdf0-a52d-4b3b-b215-439fe64a2b4c`  
**URL Producción / Preview:** `https://ais-pre-htrghfnoo2szdbz5e4cyap-376729163743.us-east1.run.app`

---

## 1. Lógica Principal del Sistema

### 1.1 Arquitectura de IA Híbrida (`PREFER_ON_DEVICE` primero)
Tanto la app Web (`src/lib/firebaseAiLogic.ts`) como el cliente Android (`android-app/.../BunkkerHybridAiEngine.kt`) ejecutan la inferencia siguiendo una cascada de 3 niveles para reducir latencia, proteger privacidad y evitar dependencia obligatoria de una `GEMINI_API_KEY` en el cliente o en operaciones rápidas:

1. **Nivel 1 — On-Device (`on_device`)**:
   - **Web:** Utiliza `InferenceMode.PREFER_ON_DEVICE` vía `firebase/ai` (`getAI(app, { backend: new GoogleAIBackend() })`), detectando capacidades locales con `window.LanguageModel.availability()` / `window.ai?.languageModel` (Chrome Built-in AI / Gemini Nano).
   - **Android:** Utiliza `com.google.firebase:firebase-ai-ondevice` (`OnDeviceConfig(mode = InferenceMode.PREFER_ON_DEVICE)`) para ejecutar sobre **Gemini Nano 4 / AICore** directamente en el teléfono, sin conexión a red.
2. **Nivel 2 — Firebase AI Cloud Fallback (`in_cloud`)**:
   - Si el dispositivo no soporta modelo local o si la tarea requiere análisis pesado (por ejemplo reportes profundos con `>25` registros de auditoría o `>40` órdenes usando `InferenceMode.PREFER_IN_CLOUD`), enruta automáticamente al modelo `gemini-2.5-flash` autenticado mediante las credenciales del proyecto Firebase (`firebase-applet-config.json` / `google-services.json`).
   - En `AdminAsistente.tsx` (`handleTestGeminiLion`), las pruebas diagnósticas de LION ejecutan primero `runDirectFirebaseAiProbe({ mode: InferenceMode.PREFER_ON_DEVICE })` y solo recurren a `/api/ai/lion-test` si el entorno cliente no puede responder.
3. **Nivel 3 — Motor Local Determinístico Offline (`local_rule_engine` / `LOCAL_FALLBACK`)**:
   - Si no hay Internet ni Gemini Nano disponible (o en un celular nuevo sin red configurada), tanto `buildLocalDeterministicReply` / `classifyProductText` en Web como `buildOfflineDeterministicReply` en Android responden localmente con 0 ms y sin errores bloqueantes.

### 1.2 Autenticación, Roles y Sincronización Híbrida (Nube + Red Local)
- **Sesión de Personal y Clientes:**
  - Personal/Administración entra con PIN privado (validado en `POST /api/auth/session` con cookies firmadas HMAC-SHA256 `msj-session`, `msj-role`, `msj-role-sig` verificadas por `src/middleware.ts`) o mediante Google Workspace SSO (`POST /api/auth/sso`).
  - Modo **Demo Admin de 1 clic** autentica con PIN inicial `0000` (`demo-superadmin`) y activa automáticamente la guía rápida de 3 pasos.
- **Separación Segura Nube (HTTPS) vs. Red Local Wi-Fi (LAN):**
  - La función pura `shouldConnectLocalLanSocket(hostname, protocol, explicitUrl)` en `src/lib/testerFeedback.ts` controla `LocalRadio.tsx` y `CartContext.tsx`.
  - Cuando un celular abre la app desde `https://` público sin servidor local configurado (`NEXT_PUBLIC_LAN_BRIDGE_URL` vacío), los sockets LAN hacia `:3001` y `:3002` **no se intentan abrir**, evitando bloqueos por *mixed content* y errores de conexión rechazada en dispositivos nuevos.

---

## 2. Resumen de Cambios y Mejoras Implementadas

### 2.1 Onboarding Móvil y Modo Demo 1-Clic
- **`src/app/login/page.tsx`:** Botón destacado **"Entrar como Admin Demo (Guía 3 pasos)"** (`data-testid="demo-admin-login-btn"`) que inicia sesión demo sin configurar empresa desde cero, guardando el disparador de bienvenida (`?welcome=1` y `sessionStorage`) sin colisionar con redirecciones de sesión.
- **`src/components/LionAssistantTour.tsx`:** Implementación del modal `BunkAssistantTour` (`data-testid="mobile-welcome-tour"`) con 3 pasos táctiles para móvil:
  1. *Caja y Punto de Venta Rápido* (`/dashboard/sales`)
  2. *Almacén con Escáner QR* (`/dashboard/inventory`)
  3. *IA Híbrida y Reporte Beta* (`/dashboard/enterprise?tab=hybrid-ai`)
- **`android-app/.../MainActivity.kt`:** Tarjeta de bienvenida rápida de 3 pasos con botones **"Siguiente"**, **"Probar Demo"** y **"Saltar"**.

### 2.2 Privacidad, Términos y Eliminación de Cuenta (Requisitos Google Play)
- **`src/app/login/page.tsx`:** Enlaces directos y visibles a **Política de Privacidad**, **Términos de Servicio** y **Eliminar cuenta** tanto en el panel de Personal/Admin (`data-testid="login-legal-links"`) como en el Portal de Clientes (inicio y registro).
- **`src/app/privacidad/page.tsx` & `src/components/legal/AccountDeletionForm.tsx`:**
  - Sección aclaratoria explícita sobre qué datos viajan a **Firebase / Google Cloud** (`gen-lang-client-0628483139`), qué opera únicamente en **red local Wi-Fi (LAN)** y almacenamiento offline (`IndexedDB`), y cómo se procesa la **IA Híbrida** (On-Device primero vs. Cloud).
  - Formulario interactivo en `/privacidad#eliminacion-cuenta` (`data-testid="account-deletion-form"`) que registra solicitudes con folio `DEL-XXXX` vía `POST /api/tickets` y ofrece respaldo directo por correo (`luishalo69@gmail.com`).
- **`android-app/.../MainActivity.kt`:** Enlaces directos a **Privacidad**, **Términos** y **Eliminar cuenta** apuntando a las URLs de producción.

### 2.3 Botón Discreto de Feedback / Soporte para Testers (14 días Play Console)
- **`src/components/enterprise/EnterpriseSuiteBar.tsx` & `src/components/enterprise/QuickFeedbackModal.tsx`:**
  - Botón discreto **"Reportar falla"** (`data-testid="dashboard-feedback-btn"`) junto a **"Escanear"** y **"Alertas"** en la barra superior del dashboard.
  - Modal rápido con categorías (*Falla técnica*, *Pantalla móvil*, *Sugerencia*), captura automática de ruta actual, rol y resolución de pantalla, envío a `/api/tickets` (folio `BETA-XXXX`) y cola local offline (`_bunkker_pending_tester_feedback`) si no hay red.
- **`android-app/.../MainActivity.kt`:** Botón **"Reportar falla"** con diálogo modal que abre cliente de correo hacia `luishalo69@gmail.com` prellenado con diagnóstico del flujo beta.

### 2.4 Estabilidad de Hidratación, UI Móvil y Acceso Rápido de Inventario
- **`src/context/AuthContext.tsx`:** Se difirió la lectura de `localStorage` (`getStaffSession`) y `window.location` a `useEffect` post-montaje para igualar SSR y primer render en cliente, eliminando errores de *Hydration Mismatch* en `/dashboard`.
- **`src/components/AdminAsistente.tsx`:** Se ocultó el botón flotante `🦁` en `/login` para evitar que tape el botón **"ENTRAR AL DASHBOARD"** en pantallas móviles estrechas (`390px`), y se actualizó `handleTestGeminiLion` para priorizar Firebase AI Logic `PREFER_ON_DEVICE`.
- **`src/components/LionAssistantTour.tsx`, `QuickFeedbackModal.tsx` y `QuickInventoryLookupModal.tsx`:** Se montaron mediante `createPortal(..., document.body)` con `z-[12000]` y centrado vertical en móvil para evitar que el dock inferior (`AdminDock`) o los botones flotantes bloqueen los controles del modal.
- **Dashboard e Inventario (sesiones previas consolidadas):** Tarjeta resumen **"Total Product Value"** (`valor = sum(stock * price)`) en Inventario, botón rápido **"Escanear"** (`dashboard-qr-lookup-btn`) en `EnterpriseSuiteBar` y hoja de ruta técnica en `docs/FIREBASE_AI_LOGIC_MIGRATION_ROADMAP.md`.
- **Pruebas unitarias (`src/__tests__/tester_feedback.test.ts`, `firebase_ai_logic.test.ts`, `inventory_*.test.ts`):** Cobertura automatizada de validación de feedback, payloads, gating de sockets LAN en HTTPS, métricas de inventario y cascada híbrida de IA.

---

## 3. Mejoras Pendientes y Qué Falta para Producción

| Prioridad | Área | Acción Necesaria | Motivo / Impacto |
| :--- | :--- | :--- | :--- |
| **Alta** | **Web App Check** | Registrar clave **reCAPTCHA v3** en Firebase Console (`gen-lang-client-0628483139`), asignarla a `recaptchaSiteKey` en `firebase-applet-config.json` y llamar `initializeAppCheck()` en `src/lib/firebase.ts`. | Evita errores `401` cuando App Check se exija en el fallback Cloud Web de Firebase AI Logic. |
| **Alta** | **Android Build & App Check** | Agregar `firebase-appcheck-playintegrity` y `firebase-appcheck-debug` en `android-app/app/build.gradle.kts`, inicializar App Check al arranque y registrar los **SHA-256** de firma en Firebase Console. | Requisito para que el APK/AAB firmado consulte Firebase AI Cloud y Play Integrity en producción. |
| **Alta** | **Prueba en Teléfono Limpio (APK/AAB)** | Compilar con Android Studio / Gradle (`./gradlew bundleRelease`), instalar en un dispositivo físico limpio (sin caché ni red Wi-Fi local) y probar modo avión + Gemini Nano / AICore. | El entorno Web/Node no contiene SDK de Android; solo un teléfono real valida permisos, cámara y descarga de AICore. |
| **Media** | **Ficha Google Play Console** | Configurar en Play Console la URL de Privacidad (`/privacidad`), URL obligatoria de Eliminación de Cuenta (`/privacidad#eliminacion-cuenta`) y formulario *Data Safety*. | Obligatorio para aprobar acceso a producción tras las pruebas cerradas de 14 días. |
| **Media** | **Retiro Total de `GEMINI_API_KEY`** | Migrar el parser NL de `/api/ai/lion-config` (`action: 'preview'`) al cliente con `runHybridFirebaseInference()` y dejar `src/lib/geminiClient.ts` solo como respaldo opcional de servidor (Fase 2–3 del roadmap). | Completa la independencia total de `GEMINI_API_KEY` en endpoints de configuración y administración. |
