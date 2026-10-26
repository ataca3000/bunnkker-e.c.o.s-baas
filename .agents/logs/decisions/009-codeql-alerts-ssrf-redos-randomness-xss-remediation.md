# ADR 009: Remediación Integral de Alertas de Seguridad CodeQL (SSRF, ReDoS, Insecure Randomness, XSS, DOM Injection & Open Redirect)

## Estado
Aceptado y Aplicado.

## Contexto
El análisis estático avanzado de CodeQL en GitHub detectó 9 alertas críticas y altas en el repositorio:
1. **Alertas #17, #18, #19 (Críticas - Server-Side Request Forgery)** en `src/app/api/omnipulse/dispatch/route.ts`:
   - Uso de URLs y tokens sin sanitizar en llamadas `fetch` salientes (Telegram bot API, Discord webhooks, instancias de Mastodon).
2. **Alerta #16 (Alta - Polynomial Regular Expression / ReDoS)** en `src/lib/omnipulse/spintax.ts`:
   - Expresiones regulares anidadas / polinomiales (`\{([^}]+)\}` y `\{\{(\w+)\}\}`) evaluadas sobre plantillas de longitud arbitraria no controlada.
3. **Alerta #26 (Alta - Insecure Randomness)** en `src/app/dashboard/sales/page.tsx`:
   - Empleo de `Math.random()` pseudoaleatorio para generar identificadores de sesión de leases POS en IndexedDB / backend.
4. **Alerta #23 & #27 (Alta / Media - Client-Side Cross-Site Scripting & Open Redirect)** en `src/app/cuenta/page.tsx`:
   - Asignación directa de `window.location.href = searchParams.get('redirect')` susceptible a inyección `javascript:...` y redirecciones arbitrarias fuera de la aplicación.
5. **Alertas #24 & #25 (Altas - DOM Text Reinterpreted as HTML)** en `ecos-core/frontend/src/components/ui/forms/ecos-image-upload.tsx` y `ecos-core/frontend/src/components/ui/image-upload-field.tsx`:
   - Propagación de URLs externas sin validar esquema al atributo `src` de etiquetas `<img>`.

## Decisiones de Arquitectura

1. **Defensa SSRF Fail-Closed (`dispatch/route.ts`):**
   - Telegram: Token validado con regex canónica `^\d+:[A-Za-z0-9_-]+$` y codificación URI estricta.
   - Discord: Validación de URL obligatoria mediante `new URL(token)`, requiriendo protocolo HTTPS, host `discord.com` / `discordapp.com` y prefijo `/api/webhooks/`.
   - Mastodon: Validación de FQDN estricto y bloqueo exhaustivo de rangos IP privados (`10.*`, `127.*`, `172.16-31.*`, `192.168.*`, `169.254.*`, `0.*`, `::1`, `fc00:`, `fe80:`, `.local`, `.internal`).

2. **Eliminación Total de ReDoS (`spintax.ts`):**
   - Reemplazo completo de expresiones regulares por un parser lineal $O(N)$ de paso único mediante índices de cursor y búsqueda directa de delimitadores (`indexOf`).

3. **Criptografía FIPS / Web Cryptography API (`sales/page.tsx`):**
   - Sustitución de `Math.random()` por `window.crypto.getRandomValues(new Uint32Array(1))` para la generación de tokens de sesión y leases POS.

4. **Validación de Redirección Local e Inyección DOM (`cuenta/page.tsx`):**
   - Función guardiana `isSafeLocalUrl`: Exige ruta relativa iniciada con un solo `/`, bloquea prefijos dobles (`//`, `/\`), caracteres de escape inversos, y restringe navegación usando el enrutador seguro Next.js `router.push()`.

5. **Sanitización de Esquemas de Imágenes DOM (`media.ts` & componentes):**
   - Nueva función `isSafeImageUrl`: Rechaza esquemas `javascript:` o `vbscript:` y admite únicamente esquemas autorizados (`blob:`, `http://`, `https:`, `data:image/` y rutas relativas seguras `/storage/...`).
   - Propagación segura con fallback a placeholder `null` en `EcosImageUpload` y `ImageUploadField`.

## Consecuencias
- Cierre verificable de las 9 alertas de CodeQL.
- Blindaje contra vector SSRF de movimiento lateral en infraestructura de nube o redes internas LAN.
- Blindaje contra denegación de servicio por agotamiento de CPU (ReDoS).
- Preservación íntegra de pruebas y compilación estricta de TypeScript (`npx tsc --noEmit` y `npm run test:logic` en verde).
