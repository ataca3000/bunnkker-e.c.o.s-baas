# Arquitectura del Sistema Multiservicios Veracruz

## 1\. Visión General

Multiservicios Veracruz es una plataforma integral de gestión de recursos empresariales (ERP) diseñada para la infraestructura de alumbrado público y logística. El sistema utiliza una arquitectura **Serverless** basada en eventos para garantizar escalabilidad y bajo mantenimiento.

## 2\. Stack Tecnológico

### Frontend

* **Framework:** [Next.js 14](https://nextjs.org/) (App Router)
* **Lenguaje:** TypeScript (Tipado estático estricto)
* **UI/UX:** React, Framer Motion (Animaciones), Lucide Icons
* **Estado Global:** React Context API (`CartContext`, `AuthContext`)

### Backend (BaaS)

* **Base de Datos:** Google Cloud Firestore (NoSQL, tiempo real)
* **Autenticación:** Firebase Admin Auth
* **Infraestructura:** Vercel / Firebase Hosting

## 3\. Estructura del Código Fuente

```bash
src/
├── app/                  # Rutas y Vistas (Next.js App Router)
│   ├── dashboard/        # Panel administrativo protegido
│   ├── login/            # Autenticación unificada
│   └── api/              # Endpoints API (Edge Functions)
├── components/           # Componentes UI Reutilizables
│   ├── admin/            # Layouts y tablas de administración
│   └── SanJoseAI.tsx     # Módulo de Asistencia Técnica (Chatbot)
├── context/              # Gestión de Estado (Patrón Provider)
├── lib/                  # Lógica de Negocio Pura y Configuraciones
│   ├── firebase.ts       # Singleton de conexión a DB
│   └── audit.ts          # Sistema de Logs de Auditoría
```

## 4\. Patrones de Diseño Implementados

### A. Gestión de Estado Singleton

El uso de `CartContext` actúa como un **Singleton** para el estado de la aplicación, manejando la persistencia del carrito, la configuración del sitio y los créditos del usuario en una sola fuente de verdad.

### B. Optimistic Updates (Actualizaciones Optimistas)

La interfaz de usuario refleja los cambios (como agregar al carrito o cambiar configuraciones) instantáneamente mediante `React State`, mientras la sincronización con Firestore ocurre en segundo plano de manera asíncrona.

### C. Estrategia de Seguridad (Defense in Depth)

1. **Nivel Aplicación:** `LicenseGuard.tsx` (Validación de licencia en cliente).
2. **Nivel Datos:** Validación de tipos en TypeScript y saneamiento de entradas.
3. **Nivel Acceso:** Roles RBAC (`superadmin`, `admin`, `driver`) gestionados en `AuthContext`.

## 5\. Modelo de Datos (Firestore)

* **users:** Perfiles de usuario y roles.
* **products:** Inventario en tiempo real con control de concurrencia.
* **orders:** Transacciones inmutables de ventas y servicios.
* **audit\_logs:** Trazabilidad completa de acciones del sistema (Compliance).

## 6\. Flujo de Datos Crítico

1. **Usuario** interactúa con la UI.
2. **Context API** captura la intención y dispara la acción lógica.
3. **Optimistic UI** actualiza la vista.
4. **Firebase Web SDK** transmite el cambio a la nube.
5. **Audit System** registra la transacción paralelamente.

\---

*Documentación generada automáticamente para Multiservicios Veracruz V2.0*

