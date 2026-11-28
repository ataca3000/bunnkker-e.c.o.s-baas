# BUNKKER E.C.O.S. — Módulo Android Multiplataforma (Firebase AI Logic)

Este módulo nativo de Android (Kotlin + Jetpack Compose) comparte el proyecto Firebase **`gen-lang-client-0628483139`** con la aplicación Web Next.js para ejecutar inferencia híbrida multiplataforma bajo `#BuildHybridAI`:

- **On-Device primero (`InferenceMode.PREFER_ON_DEVICE`)**: ejecuta resúmenes rápidos de reparto (PoD), almacén y caja directamente con **Gemini Nano 4** en dispositivos Android compatibles (sin red ni costo).
- **Respaldo automático en nube (`PREFER_IN_CLOUD` / fallback)**: delega análisis extensos o dispositivos sin AICore/Gemini Nano hacia **`gemini-2.5-flash`** mediante `com.google.firebase:firebase-ai`.
- **Respaldo determinístico offline**: si el repartidor entra en zona sin señal, responde con reglas locales de operación.

## Configuración rápida en Android Studio

1. El archivo `google-services.json` ya está configurado exactamente en **`android-app/app/google-services.json`** con `package_name`: `com.BunkkerERP` (alineado con `applicationId` en `android-app/app/build.gradle.kts`).
2. **Proyecto Firebase unificado (`#BuildHybridAI`)**: tanto Android (`android-app/app/google-services.json`) como Web (`firebase-applet-config.json`) apuntan al mismo proyecto Firebase **`gen-lang-client-0628483139`** (`project_number`: `594116889378`).
3. Abre la carpeta `android-app/` en Android Studio Ladybug / Meerkat o ejecuta `./gradlew assembleDebug` con Android SDK 35 instalado.
