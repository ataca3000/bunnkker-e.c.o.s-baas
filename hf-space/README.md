---
title: BUNKKER E.C.O.S
emoji: ⚡
colorFrom: indigo
colorTo: indigo
sdk: docker
app_port: 3000
pinned: false
license: other
short_description: ERP/POS local-first con Demo Admin de 1 clic y Firebase AI Logic
---

# BUNKKER E.C.O.S. — Demo Interactiva (Hugging Face Space)

Plataforma ERP / Punto de Venta (POS) **local-first** con Next.js 15, modo Demo de 1 clic, inventario en tiempo real, buscador rápido por código/QR, onboarding móvil guiado, feedback de testers y cascada híbrida con **Firebase AI Logic** (`PREFER_ON_DEVICE` -> nube).

## Cómo probar el demo en el Space

1. Abre la aplicación (arranca directamente en `/login`).
2. Pulsa **"Entrar como Admin Demo"** para entrar sin configurar empresa ni base de datos externa.
3. Sigue el tour guiado móvil de 3 pasos o explora:
   - **Dashboard e Inventario**: tarjeta de **Valor Total de Producto**, escáner/búsqueda rápida por QR/SKU en el header y alertas de stock.
   - **Asistente / Sonda Firebase AI Logic**: botón flotante para verificar la cascada híbrida (`PREFER_ON_DEVICE`).
   - **Reportar falla / Enviar comentario**: botón discreto en el menú para capturar feedback de testers.
   - **Privacidad y Eliminación de Cuenta**: accesible desde `/login` y `/privacidad`.

## Variables opcionales (Space Secrets / Variables)

La demo pública funciona sin secretos obligatorios (`NEXT_PUBLIC_APP_ENV=demo`). Si deseas habilitar funciones conectadas adicionales desde *Settings → Variables and secrets* del Space:

- `GEMINI_API_KEY` (respaldo servidor si la sonda on-device/híbrida de Firebase AI Logic falla)
- `DATABASE_URL` y `DIRECT_URL` (PostgreSQL externo si deseas persistencia remota)
