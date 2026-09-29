# 🗂️ Estructura del Proyecto — BUNKKER E.C.O.S. ERP

> Arquitectura física y lógica del código fuente de BUNKKER E.C.O.S.

---

## 📁 Distribución del Árbol de Directorios

```text
bunnkker-e.c.o.s-baas/
│
├── 📂 .agents/                  # Directivas de optimización, axiomas y memoria de agentes
├── 📂 .certificate/             # Certificados de validación lógica y roadmap
├── 📂 .devcontainer/            # Configuración para desarrollo en contenedores
├── 📂 .vscode/                  # Tareas y configuraciones de editor
│
├── 📂 docs/                     # Documentación técnica, comercial y legal unificada
│   ├── ARCHITECTURE.md          # Arquitectura del sistema y flujo de datos
│   ├── BRIDGE_WINDOWS_LAN.md    # Red local, WebSockets y radio Walkie-Talkie
│   ├── BUNKKER_ECOS_ESPECIFICACION_TECNICA.md # Especificación técnica profunda
│   ├── BUNKKER_ECOS_MEMORIA_TECNICA_INDAUTOR.md # Memoria descriptiva para INDAUTOR
│   ├── CONTRIBUTING.md           # Guía de contribución y buenas prácticas
│   ├── HISTORIA_Y_RESUMEN_PROYECTO.md # Génesis, visión e historia del sistema
│   ├── MONETIZACION.md          # Esquema de monetización, SaaS y licencias
│   ├── PATENTE_NODOS_BANDERA.md # Reivindicaciones de patente nodal terrestre
│   ├── PITCH_COMERCIAL_Y_VENTAS.md # Pitch comercial y manejo de objeciones
│   ├── POLICIES.md              # Políticas y gobernanza del proyecto
│   ├── PROJECT_STRUCTURE.md     # Este archivo
│   ├── ROLES_MAP.md             # Matriz de permisos y accesos por rol
│   ├── SECURITY.md              # Seguridad perimetral, RBAC y firmas HMAC
│   ├── VERCEL_MARKETPLACE.md    # Integración y distribución Vercel
│   └── WORKFLOW_PRODUCCION.md   # Pipeline de despliegue y QA
│
├── 📂 prisma/                   # Modelos de base de datos ORM
│   ├── schema.prisma            # Esquema PostgreSQL (Vercel / Nube multi-tenant)
│   ├── schema.sqlite.prisma     # Esquema SQLite (Desktop / Local-First offline)
│   └── seed.js                  # Sembrado inicial de roles y catálogos
│
├── 📂 public/                   # Recursos estáticos servidos por Next.js
│   ├── icons/                   # Iconografía de roles y utilidades
│   ├── manifest.json            # Manifiesto PWA para instalación web móvil
│   └── sounds/                  # Audio de notificaciones y tonos de radio
│
├── 📂 scripts/                  # Scripts de mantenimiento, build y pruebas
│   ├── 📂 deploy/               # Automatización de instalación y despliegue (.bat, .sh)
│   │   ├── backup-data.bat      # Respaldo automático de base de datos local
│   │   ├── configurar-red.bat   # Switch de modo local / nube
│   │   ├── deploy-all.bat       # Script de despliegue integral
│   │   ├── gcp_startup.sh       # Script de arranque en Google Cloud
│   │   ├── Instalar_Bunkker_1.0.bat # Instalador seguro
│   │   ├── push-to-docker-hub.ps1 # Publicador a Docker Hub
│   │   └── start-server.bat     # Diagnóstico de IP y servicios LAN
│   ├── build-guard.js           # Verificación de integridad previa a compilación
│   ├── copy-standalone.js       # Ensamblador del bundle standalone para Electron
│   ├── optimize-sqlite.ts       # Pragmas de rendimiento WAL para SQLite
│   ├── run-next-build.js        # Switch dinámico de Prisma schemas para build
│   └── test-logic.js            # Pruebas rápidas de consistencia
│
├── 📂 src/                      # Código fuente principal de la aplicación
│   ├── app/                     # Rutas y páginas de Next.js (App Router)
│   │   ├── (public)/            # Catálogo libre, checkout y registro
│   │   ├── api/                 # Endpoints REST (auth, ordenes, inventario, etc.)
│   │   └── dashboard/           # Paneles por rol (admin, ventas, patio, etc.)
│   ├── components/              # Componentes visuales interactivos y radio
│   ├── lib/                     # Utilidades, autenticación, RBAC y clientes DB
│   └── store/                   # Estado global unificado (Zustand)
│
├── 📂 tests/                    # Pruebas End-to-End (Playwright)
│
├── 📄 .dockerignore             # Exclusiones de Docker
├── 📄 .env.example              # Plantilla de variables de entorno requeridas
├── 📄 .gitignore                # Exclusiones estrictas de Git
├── 📄 bunkker.config.json       # Configuración global del nodo BUNKKER
├── 📄 docker-compose.yml        # Orquestación de contenedores
├── 📄 Dockerfile                # Imagen Docker de producción
├── 📄 electron-main.js          # Proceso principal de Electron (Desktop)
├── 📄 eslint.config.mjs         # Reglas de linting
├── 📄 LICENSE                   # Licencia oficial Business Source License 1.1
├── 📄 next.config.ts            # Configuración de Next.js (modo standalone)
├── 📄 package.json              # Dependencias y scripts de ejecución
├── 📄 preload.js                # Puente seguro IPC entre Electron y Next.js
├── 📄 radio-server.js           # Servidor WebSocket para walkie-talkie LAN
├── 📄 README.md                 # Documento principal del repositorio
├── 📄 tsconfig.json             # Configuración TypeScript
├── 📄 vercel.json               # Configuración de despliegue Vercel
└── 📄 vitest.config.ts          # Configuración del motor de pruebas unitarias
```
