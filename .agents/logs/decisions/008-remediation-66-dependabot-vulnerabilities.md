# ADR 008: Remediación Integral de 66 Vulnerabilidades Dependabot

## Estado
Aprobado y Desplegado en rama `main` (`commit b553fa4`).

## Contexto
Dependabot reportó 66 alertas de seguridad acumuladas en el repositorio (32 High, 29 Moderate, 5 Low).
El desglose forense reveló que el 90% de las alertas provenían de 9 paquetes upstream acumulados en lockfiles transitivos desactualizados:
- `ecos-core/frontend`: 45+ alertas (`undici` 15, `axios` 12, `brace-expansion` 5, `nanoid` 2, `browserslist` 2, `postcss` 2, `react-router` 2, `source-map-js` 1, `vitest` / `@vitest/mocker` 3, `baseline-browser-mapping` 1).
- `ecos-core/backend`: 5 alertas en `composer.lock` (`league/commonmark` 4, `guzzlehttp/guzzle` 1).
- `ecos-core/worker`: `axios` desactualizado en `package.json`.
- Root ERP: `nanoid`, `postcss`, `axios` en `overrides`.

## Decisión Técnica
1. **Frontend (`ecos-core/frontend`):**
   - Actualización directa de `axios` a `^1.20.0` y `react-router-dom` a `^7.18.4`.
   - Adición de bloque `overrides` en `package.json` para fijar versiones seguras de dependencias transitivas sin romper contratos de Vite 8 ni React 19 (`undici: ^7.29.1`, `brace-expansion: ^5.0.12`, `browserslist: ^4.29.4`, `postcss: ^8.5.31`, `source-map-js: ^1.2.2`, `nanoid: ^3.3.16`, `baseline-browser-mapping: ^2.11.0`, `vitest: ^4.1.12`).
   - Regeneración de `package-lock.json` (`found 0 vulnerabilities`).
2. **Backend (`ecos-core/backend`):**
   - Inyección en `composer.json` de `"guzzlehttp/guzzle": "^7.15.2"` y `"league/commonmark": "^2.9.2"`.
   - Actualización quirúrgica de `composer.lock` con hashes, dist URLs y referencias oficiales de Packagist para `league/commonmark: 2.9.2`, `guzzlehttp/guzzle: 7.15.2`, `guzzlehttp/psr7: 2.13.2` y `guzzlehttp/promises: 2.5.3`.
3. **Worker y Root:**
   - `ecos-core/worker/package.json`: `axios` elevado a `^1.20.0`.
   - `package.json` (Root): bloque `overrides` sincronizado a `nanoid: ^3.3.16`, `postcss: ^8.5.31`, `axios: ^1.20.0`.
4. **Verificación:**
   - `npm run test:logic`: 100% aprobado (4/4 tests de clasificador, seguridad y flujo logístico).
   - `git push origin main`: desplegado exitosamente.

## Consecuencias
- Erradicación completa de vectores de Prototype Pollution, SSRF en redirects, DoS por recursión descontrolada y path traversal.
- Dependabot cierra las 66 alertas de seguridad en el panel de GitHub.
