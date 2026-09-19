# BUNKKER E.C.O.S — PWA ERP & BaaS Architecture (Local-First)

> **Autor & Propietario Intelectual:** LUISHALO69 <luishalo69@gmail.com> (ataca3000)  
> **Ingeniería & Desarrollo:** Brecha Soluciones DS & Gemini (Google DeepMind)

---

## ⚡ Características Principales

1. **Local-First Zero-Cloud DB:** El 100% de la lógica opera en la memoria IndexedDB del dispositivo maestro.
2. **Edge Store Guard (`?s=[storeId]`):** Validación Edge que responde `404 Not Found` ante accesos no autorizados.
3. **Modos de Acceso Dual:**
   - `mode=catalog`: Menú y pedidos rápidos para clientes (sin instalador de tienda).
   - `mode=staff`: ERP para personal con seguridad ciega RBAC (`404 Rewrite`).
4. **Monetización con Gancho Invisible:** Contador silencioso de 200 operaciones antes de activar el modal de suscripción ilimitada ($300 MXN/mes).
5. **Anti-Trampas & Marcas Stealth:** Marcas digitales criptográficas (`1998 BSF` / `MTk5OCBCU0Y=`) para rastrear derivados en GitHub.

---

## 🚀 Despliegue en Producción

El proyecto está optimizado para desplegarse a costo $0 en Vercel / GitHub Pages.
