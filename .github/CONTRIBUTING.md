# 📜 Guía de Estándares de Desarrollo & Contribución — BUNKKER E.C.O.S ERP

Este documento establece las reglas y estándares de desarrollo profesional para mantener la integridad, seguridad y calidad del proyecto.

---

## 🌲 1. Estrategia de Ramas (Git Branching Strategy)

- **Prohibido realizar commits directos a `main`**.
- Cada nuevo cambio debe desarrollarse en su propia rama descriptiva:
  - `feature/nombre-de-la-funcionalidad`
  - `fix/descripcion-del-bug`
  - `docs/actualizacion-de-documentos`
  - `perf/optimizacion-de-rendimiento`

---

## ✍️ 2. Convención de Commits (Conventional Commits)

Los mensajes de commit deben ser claros, concisos y profesionales:

✅ **Ejemplos Correctos:**
- `git commit -m "feat: implementa algoritmo mutex para inventario en cajas"`
- `git commit -m "fix: resuelve error de async cookies en Next.js 15"`
- `git commit -m "docs: actualiza especificaciones tecnicas en lfeds"`

❌ **Ejemplos Incorrectos (No permitidos):**
- `git commit -m "cambios"`
- `git commit -m "arreglo bug"`
- `git commit -m "update"`

---

## 🔐 3. Reglas Estrictas de Seguridad y Bóveda de Secretos

1. **Cero Tokens en Código Plano:**
   - **NUNCA** escribir API Keys, Passwords, o Personal Access Tokens (PAT) directamente en archivos `.js`, `.ts`, `.json` o `.yml`.
2. **Uso de Variables de Entorno y Secrets:**
   - En desarrollo local: usar `.env.local` (incluido en `.gitignore`).
   - En CI/CD y GitHub Actions: usar **GitHub Secrets** (`Settings > Secrets and variables > Actions`).
3. **Impresión Segura:**
   - Usar `echo $TOKEN | docker login --password-stdin` para evitar exponer contraseñas en logs de consola.

---

## 🚀 4. Proceso de Pull Request (PR)

1. Crear la rama `feature/mi-aporte`.
2. Verificar que `npx tsc --noEmit` y `npm run build` completen con 0 errores.
3. Hacer push a GitHub: `git push origin feature/mi-aporte`.
4. Abrir el Pull Request en GitHub seleccionando el template automático `PULL_REQUEST_TEMPLATE.md`.
5. Marcar los elementos del **Checklist Pro** antes de solicitar el merge.
