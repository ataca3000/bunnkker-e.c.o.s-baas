# Technical Migration Roadmap: Server-Side `GEMINI_API_KEY` to On-Device Firebase AI Logic

**Project:** BUNKKER E.C.O.S. (Web ERP/POS + Native Android Companion)  
**Unified Firebase Project ID:** `gen-lang-client-0628483139` (`project_number`: `594116889378`)  
**Firestore Database ID:** `ai-studio-bunnkkerecosbaas-db35bdf0-a52d-4b3b-b215-439fe64a2b4c`  
**Last Audited:** 2026-11-26

---

## 1. Executive Summary & Target Architecture

BUNKKER E.C.O.S. is transitioning from centralized server-side Gemini calls (`@google/genai` authenticated with `process.env.GEMINI_API_KEY`) to a **client-first hybrid inference architecture** powered by **Firebase AI Logic**:

1. **Tier 1 — On-Device (`on_device`)**: Executes low-latency, zero-cost, privacy-preserving prompts locally via **Gemini Nano** (Chrome Built-in AI Prompt API on Web; Google AICore / Gemini Nano 4 via `firebase-ai-ondevice` on Android) using `InferenceMode.PREFER_ON_DEVICE`.
2. **Tier 2 — Firebase AI Cloud Fallback (`in_cloud`)**: Automatically routes heavy multi-record audits (`InferenceMode.PREFER_IN_CLOUD`) or devices without local Nano support to `gemini-2.5-flash` through Firebase AI Logic (`firebase/ai` on Web, `com.google.firebase:firebase-ai` on Android) authenticated by Firebase project credentials and **Firebase App Check**—without storing or proxying a server-side `GEMINI_API_KEY`.
3. **Tier 3 — Deterministic Local Rule Engine (`local_rule_engine`)**: Executes offline with 0 ms network dependency when neither local Nano nor cloud connectivity is available.

---

## 2. Current Implementation Audit (Verified Codebase Baseline)

### 2.1 Components Already Using Firebase AI Logic (No `GEMINI_API_KEY` Required)

| Surface | File(s) | Inference Mechanism | Cloud Model / Local Model |
| :--- | :--- | :--- | :--- |
| **Web Hybrid Orchestrator** | `src/lib/firebaseAiLogic.ts` | `getAI(app, { backend: new GoogleAIBackend() })` + `getGenerativeModel(ai, hybridParams)` | `gemini-nano-on-device` / `gemini-2.5-flash` |
| **LION Multi-Role Assistant** | `src/components/AdminAsistente.tsx` | Calls `runHybridFirebaseInference()` with `PREFER_ON_DEVICE` | On-Device first; falls back to `/api/ai/chat` only on failure |
| **Warehouse Auto-Classifier** | `src/app/dashboard/inventory/page.tsx` | Calls `runHybridProductClassification()` with `PREFER_ON_DEVICE` | On-Device JSON schema first; falls back to `/api/ai/classify-product` |
| **Operational Summaries & Diagnostics** | `src/components/ai/HybridOperationalSummaryCard.tsx`, `src/components/admin/FirebaseAiDiagnosticsPanel.tsx` | Calls `runHybridOperationalSummary()`, `probeFirebaseAiDiagnostics()`, and `runDirectFirebaseAiProbe()` | `PREFER_ON_DEVICE` for short briefs; `PREFER_IN_CLOUD` for audits (`>25` entries or `>40` orders) |
| **Android Companion Engine** | `android-app/app/src/main/java/com/bunkker/ecos/hybridai/BunkkerHybridAiEngine.kt` | `Firebase.ai(backend = GenerativeBackend.googleAI())` + `OnDeviceConfig(mode)` | `gemini-nano-4-on-device` / `gemini-2.5-flash` / `bunkker-android-local-rules` |

### 2.2 Remaining Server-Side `GEMINI_API_KEY` Dependencies

| File / Endpoint | Current Usage | Migration Action Required |
| :--- | :--- | :--- |
| `src/lib/geminiClient.ts` | Instantiates `new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })` with `DEFAULT_GEMINI_MODEL = 'gemini-4-hydrogen'` | Retain temporarily only for optional server fallbacks; remove in Phase 3 once Web/Android cloud fallback & App Check are verified |
| `src/app/api/ai/lion-test/route.ts` | Returns HTTP `503` if `GEMINI_API_KEY` is unset; invoked by `handleTestGeminiLion()` in `src/components/AdminAsistente.tsx` | Replace assistant diagnostic trigger with client-side `runDirectFirebaseAiProbe()` |
| `src/app/api/ai/chat/route.ts` | Tier-2 server fallback invoked via `serverFallbackFetcher` in `AdminAsistente.tsx` and `runHybridOperationalSummary()` | Phase out client fallback dependency or restrict solely to headless/offline-bridge environments |
| `src/app/api/ai/classify-product/route.ts` | Tier-2 server fallback for `runHybridProductClassification()` | Phase out Gemini server branch; keep deterministic `classifyProductText()` for offline/API clients |
| `src/app/api/ai/lion-config/route.ts` | Uses `getServerGeminiClient()` for natural-language NL-to-config preview before `commit` | Move NL parsing to client-side `runHybridFirebaseInference()`; keep server strictly for validation (`sanitizeLionOperations`), RBAC, and SHA-256 audit logging |
| `src/app/api/ai-agents/config/route.ts` & `src/app/sys-admin/page.tsx` | Reports `engine: hasServerGeminiKey() ? 'gemini' : 'local'` and renders `GEMINI_API_KEY` status copy | Update status reporting to reflect Firebase AI Logic hybrid readiness |
| `.env.example` | Declares `GEMINI_API_KEY=` | Mark optional/legacy in Phase 2; remove in Phase 3 upon `@google/genai` retirement |

---

## 3. Android Configuration (`android-app/`)

### 3.1 Verified Current Gradle & Firebase Setup

- **`android-app/build.gradle.kts`** already declares the Google Services plugin:
  ```kotlin
  plugins {
      id("com.android.application") version "8.7.3" apply false
      id("org.jetbrains.kotlin.android") version "2.1.0" apply false
      id("org.jetbrains.kotlin.plugin.compose") version "2.1.0" apply false
      id("com.google.gms.google-services") version "4.6.0" apply false
  }
  ```
- **`android-app/app/google-services.json`** is bound to `gen-lang-client-0628483139` (`project_number`: `594116889378`, `package_name`: `com.BunkkerERP`, `mobilesdk_app_id`: `1:594116889378:android:8d55b9d77d3f0f7446737b`), matching `applicationId = "com.BunkkerERP"` in `android-app/app/build.gradle.kts`.
- **`android-app/app/build.gradle.kts`** already pins Firebase BoM `35.2.0` and the core hybrid AI artifacts:
  ```kotlin
  implementation(platform("com.google.firebase:firebase-bom:35.2.0"))
  implementation("com.google.firebase:firebase-ai")
  implementation("com.google.firebase:firebase-ai-ondevice")
  ```

### 3.2 Required Additions & Hardening in `android-app/app/build.gradle.kts`

To ensure **Firebase AI Logic Cloud fallback** works securely in production without `401 App Check` rejections or R8 stripping issues, apply the following updates to `android-app/app/build.gradle.kts`:

1. **Add Firebase App Check dependencies** (inside `dependencies { ... }`):
   ```kotlin
   dependencies {
       implementation(platform("com.google.firebase:firebase-bom:35.2.0"))
       implementation("com.google.firebase:firebase-ai")
       implementation("com.google.firebase:firebase-ai-ondevice")

       // Required for Firebase AI Logic Cloud fallback attestation in production & debug builds
       implementation("com.google.firebase:firebase-appcheck-playintegrity")
       debugImplementation("com.google.firebase:firebase-appcheck-debug")
       // ...
   }
   ```
2. **Initialize App Check at app startup** (create an `Application` subclass or initialize before first `Firebase.ai(...)` call in `MainActivity.kt`):
   ```kotlin
   Firebase.initialize(context = this)
   val appCheck = Firebase.appCheck
   appCheck.installAppCheckProviderFactory(
       if (BuildConfig.DEBUG) DebugAppCheckProviderFactory.getInstance()
       else PlayIntegrityAppCheckProviderFactory.getInstance()
   )
   ```
3. **Verify `buildFeatures` & Release Minification**:
   - Set `buildConfig = true` inside `buildFeatures { ... }` if referencing `BuildConfig.DEBUG`.
   - When enabling `isMinifyEnabled = true` for release APKs/AABs, include consumer ProGuard rules from Firebase AI / Gson / Kotlinx Serialization so `InferenceMode`, `OnDeviceConfig`, and structured response models are preserved.
4. **Firebase Console Android Prerequisites**:
   - Add debug and release **SHA-256** signing certificates to app `1:594116889378:android:8d55b9d77d3f0f7446737b` in Firebase Console.
   - Register **Play Integrity** under **App Check -> Apps** for `com.BunkkerERP`.
   - Confirm target devices have Google Play Services + **AICore** enabled for `firebase-ai-ondevice` (`minSdk = 26` is already set).

---

## 4. Frontend (Next.js Web) Configuration

### 4.1 SDK & Project Configuration (`firebase-applet-config.json` & `src/lib/firebase.ts`)

The Web frontend uses `firebase@^12.15.0` (`package.json`) and loads credentials in `src/lib/firebase.ts` from `NEXT_PUBLIC_FIREBASE_*` environment variables with fallback to `firebase-applet-config.json`:

```json
{
  "projectId": "gen-lang-client-0628483139",
  "appId": "1:594116889378:web:fed4f0460f14b84446737b",
  "apiKey": "AIzaSyCNgSwvzrT2pRViFSMFJIcNX3T20pqOzHE",
  "authDomain": "gen-lang-client-0628483139.firebaseapp.com",
  "firestoreDatabaseId": "ai-studio-bunnkkerecosbaas-db35bdf0-a52d-4b3b-b215-439fe64a2b4c",
  "storageBucket": "gen-lang-client-0628483139.firebasestorage.app",
  "messagingSenderId": "594116889378",
  "measurementId": "",
  "oAuthClientId": "594116889378-ktnim6ruvtnk2mhc7422020cam2autit.apps.googleusercontent.com",
  "recaptchaSiteKey": ""
}
```

### 4.2 Required Frontend App Check Wiring (Resolves `401` on Cloud Fallback)

Currently, `"recaptchaSiteKey"` in `firebase-applet-config.json` is empty (`""`) and `src/lib/firebase.ts` does not initialize `firebase/app-check`. When App Check is enforced on Firebase AI Logic (`firebasevertexai.googleapis.com`), browser Cloud fallback calls fail with `401 App Check token is invalid`.

**Required changes:**

1. **Obtain a reCAPTCHA v3 (or reCAPTCHA Enterprise) site key** registered in Google Cloud / Firebase Console -> **App Check -> Apps** for Web App `1:594116889378:web:fed4f0460f14b84446737b` (allowlisting `localhost` and production Run/hosting domains).
2. **Populate site key configuration**:
   - Set `"recaptchaSiteKey"` in `firebase-applet-config.json`, **or**
   - Expose `NEXT_PUBLIC_FIREBASE_RECAPTCHA_SITE_KEY` in `.env.example` / runtime environment and read it inside `src/lib/firebase.ts`.
3. **Initialize App Check in `src/lib/firebase.ts`** inside the `if (typeof window !== 'undefined' && hasRealCredentials)` guard:
   ```ts
   import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

   const recaptchaSiteKey =
     process.env.NEXT_PUBLIC_FIREBASE_RECAPTCHA_SITE_KEY ||
     typedAppletConfig?.recaptchaSiteKey ||
     '';

   if (recaptchaSiteKey) {
     if (process.env.NODE_ENV !== 'production') {
       (window as unknown as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
     }
     initializeAppCheck(app, {
       provider: new ReCaptchaV3Provider(recaptchaSiteKey),
       isTokenAutoRefreshEnabled: true,
     });
   }
   ```
   *(If `recaptchaSiteKey` is not yet provisioned during initial staging, temporarily set App Check enforcement to **Unenforced** for Firebase AI Logic in Firebase Console `project/gen-lang-client-0628483139/appcheck/apis`.)*

### 4.3 Web Browser On-Device Prerequisites & API Key Restrictions

- **Chrome Built-in AI (On-Device `gemini-nano-on-device`)**:
  - Detected at runtime by `detectFirebaseAiCapabilities()` and `probeFirebaseAiDiagnostics()` via `window.LanguageModel.availability()` (with fallback to `window.ai?.languageModel?.capabilities()`).
  - For local workstation testing on Chrome Desktop without default Nano enrollment, enable:
    - `chrome://flags/#prompt-api-for-gemini-nano`
    - `chrome://flags/#optimization-guide-on-device-model`
- **Google Cloud API Key Restrictions**:
  - Ensure the public Firebase Web API key (`apiKey` in `firebase-applet-config.json`) permits **`firebasevertexai.googleapis.com`** (Firebase AI Logic / Gemini Developer API) alongside Identity Toolkit and Firestore, and restrict HTTP referrers to `http://localhost:3000/*` and authorized deployment domains.
- **No `NEXT_PUBLIC_GEMINI_API_KEY`**:
  - Never expose a raw Gemini Developer API key in `NEXT_PUBLIC_*`. Only public Firebase App coordinates protected by App Check + referrer restrictions belong in client bundles.

---

## 5. Phased Migration Roadmap

### Phase 1 — Infrastructure, App Check & Hybrid Probe Sign-Off
1. Enable **Firebase AI Logic (Gemini Developer API)** in Firebase Console for `gen-lang-client-0628483139` (`firebasevertexai.googleapis.com`).
2. Configure **App Check**:
   - Web: Add reCAPTCHA v3 key to `firebase-applet-config.json` / `NEXT_PUBLIC_FIREBASE_RECAPTCHA_SITE_KEY` and wire `initializeAppCheck()` in `src/lib/firebase.ts`.
   - Android: Add `firebase-appcheck-playintegrity` + `firebase-appcheck-debug` in `android-app/app/build.gradle.kts` and register SHA-256 certificates in Firebase Console.
3. Verify `/dashboard/enterprise?tab=hybrid-ai` (`FirebaseAiDiagnosticsPanel`):
   - Both **`PREFER_ON_DEVICE`** and **`ONLY_IN_CLOUD`** diagnostic probes must return `ok: true` with zero `401` or `403` errors.

### Phase 2 — Migrate Remaining `GEMINI_API_KEY` Endpoints & UI Triggers
1. **`AdminAsistente.tsx` (`handleTestGeminiLion`)**:
   - Replace `POST /api/ai/lion-test` with direct client-side `runDirectFirebaseAiProbe({ mode: InferenceMode.PREFER_ON_DEVICE })` + local tenant snapshot context so LION self-test passes with zero server `GEMINI_API_KEY`.
2. **`/api/ai/lion-config` Natural Language Parsing**:
   - Run NL-to-`LionConfigOperation[]` generation client-side via `runHybridFirebaseInference()` with a strict JSON system instruction.
   - Keep `POST /api/ai/lion-config` (`action: 'commit'`) strictly as an authenticated, role-gated (`superadmin`), deterministic validation + `appendImmutableAudit()` persistence endpoint (`sanitizeLionOperations`).
3. **`/sys-admin/page.tsx` & `/api/ai-agents/config`**:
   - Update status indicators to report **Firebase AI Logic Hybrid (`on_device` / `in_cloud`)** as the primary engine instead of requiring `GEMINI_API_KEY`.

### Phase 3 — Retire `GEMINI_API_KEY` & `@google/genai` (Optional Keep vs Full Removal)
1. **Verify Coverage Parity**: Confirm all interactive flows (chat, inventory classification, operational summaries, NL configurator) work reliably across target Chrome desktops, Android devices, and offline local-rule fallback.
2. **Choose Decommissioning Mode**:
   - **Option A (Full Client-Only AI — Zero API Keys)**:
     - Remove `serverFallbackFetcher` Gemini calls from `/api/ai/chat` and `/api/ai/classify-product` (leave deterministic local engines `generateLocalIntelligentReply` / `classifyProductText` for server-side headless tests).
     - Delete `src/lib/geminiClient.ts` and `src/app/api/ai/lion-test/route.ts`.
     - Remove `@google/genai` from `package.json` and remove `GEMINI_API_KEY=` from `.env.example`.
   - **Option B (Optional Emergency Server Fallback)**:
     - Keep `/api/ai/chat` and `/api/ai/classify-product` reading optional `GEMINI_API_KEY` only when browsers lack Built-in AI and corporate firewalls block `firebasevertexai.googleapis.com`, while documenting `GEMINI_API_KEY` as **optional** in `.env.example`.

---

## 6. Verification & Acceptance Checklist

| Check | Target | Command / Path | Expected Result |
| :--- | :--- | :--- | :--- |
| **Web Hybrid Unit Tests** | `src/lib/firebaseAiLogic.ts` | `npx vitest run src/__tests__/firebase_ai_logic.test.ts` | All tests pass; system instructions never leak `GEMINI_API_KEY` |
| **Web Build & Lint** | Next.js App Router | `npm run build && npm run lint` | Build succeeds with `0` ESLint errors |
| **Web Live Hybrid Probe** | `FirebaseAiDiagnosticsPanel` | `/dashboard/enterprise?tab=hybrid-ai` | `on_device` (when Chrome Nano is enabled) or `in_cloud` (`gemini-2.5-flash`) returns `200 OK` |
| **Android Gradle Build** | `android-app/` | `./gradlew assembleDebug` | Compiles cleanly with `firebase-bom:35.2.0`, `firebase-ai`, `firebase-ai-ondevice`, and `firebase-appcheck-*` |
| **No Secret Leakage** | Source & Config | `grep -rn "NEXT_PUBLIC_GEMINI" src` | Zero matches |
