# 🌎 TERRAFORM ERP — Ecosistema Comercial Local-First

**Terraform ERP** es una plataforma de software de código abierto diseñada para negocios pequeños y medianos que necesitan un ERP/POS profesional, asequible y que funcione sin internet.

## ⭐ ¿Por qué Terraform ERP?

| Problema | Solución Terraform ERP |
|----------|------------------------|
| Sistemas SAP cuestan $500 USD/mes | Terraform: $500-800 MXN/mes |
| No funcionan sin internet | Funciona 100% offline (local-first) |
| Complicados de usar | Interfaz simple y en español |
| Para grandes empresas | Diseñado para pymes mexicanas |
| Caro implementar | Instalación en 1 hora |

## 🚀 Características Principales

✅ **POS Completo** - Lectura de códigos de barras, carrito, tickets
✅ **Inventario Sincronizado** - Local + Cloud (Firebase)
✅ **Editor Visual (Canvas)** - Personaliza tu marketplace sin código
✅ **Logística & Delivery** - Asignación de rutas y rastreo en tiempo real
✅ **Multi-sucursal** - Controla múltiples tiendas desde una app
✅ **Facturación SAT** - Integración con Facturapi (CFDI 4.0)
✅ **Roles & Permisos** - Control de acceso por empleado
✅ **Offline-First** - Funciona sin internet, sincroniza cuando conecta
✅ **Auditoría Inmutable** - Historial completo de cada transacción
✅ **IA Integrada** - Clasificación automática de productos
✅ **UI Optimizada (Nueva UX)** - Notificaciones Toast no bloqueantes y diseño SaaS Premium con soporte Mobile.

## 📱 Plataformas Soportadas

- 🖥️ **Windows** - Aplicación de escritorio (Electron)
- 💻 **Web** - Acceso desde navegador (Next.js)
- 📱 **Mobile** - Próximamente (React Native / Capacitor)
- 🍎 **macOS** - Compatible (Electron)

## 💰 Planes y Precios

### **Estándar** - GRATIS (Open Source)
- POS básico
- Inventario local
- Sistema 100% aislado (Sin dependencias externas como Vercel o Firebase obligatorias)
- Ideal para: Ferreterías, tienditas, negocios locales

### **PRO** - $500-800 MXN/mes
- Todo de Estándar +
- Cloud Sync (Firebase)
- Facturación SAT integrada
- Multi-sucursal
- Logística y delivery
- Soporte técnico
- Ideal para: Restaurantes, supermercados, distribuidoras

### **ENTERPRISE** - Consultar
- Customización completa
- Integraciones personalizadas
- Soporte 24/7
- SLA garantizado
- Ideal para: Cadenas, corporativos

## 🎯 Comienza Ahora

### **Opción 1: Descargar Instalador (Windows)**
[📥 Descargar Terraform ERP v1.0.0](https://github.com/ataca3000/camaliontopics.com.erp/releases)

### **Opción 2: Instalación Local (Desarrolladores)**

```bash
# Clonar repositorio
git clone https://github.com/ataca3000/camaliontopics.com.erp.git
cd camaliontopics.com.erp

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local
# Edita .env.local con tus credenciales de Firebase

# Ejecutar en desarrollo
npm run dev
# Abre http://localhost:3000
```

## 📚 Documentación

- [🏗️ Arquitectura del Sistema](./ARCHITECTURE.md)
- [📦 Guía de Distribución Windows](./WINDOWS_DISTRIBUTION.md)
- [✅ Checklist de Build & Release](./BUILD_CHECKLIST.md)
- [💰 Cómo Monetizar (Gana Dinero)](./MONETIZACION.md)
- [🔧 Desarrollo Local](./CONTRIBUTING.md)

## 🔧 Stack Tecnológico

```
Frontend:
├── React 19
├── Next.js 15 (App Router)
├── TypeScript
├── Tailwind CSS
└── Zustand (State Management)

Backend:
├── Next.js API Routes
├── Prisma ORM
├── SQLite (Local DB)
└── Firebase (Cloud DB)

Desktop:
├── Electron 42
├── electron-updater (Auto-updates)
└── IPC (Node <-> Renderer)

Pagos:
├── Stripe Connect
└── Facturapi (SAT México)
```

## 💻 Requisitos de Sistema

### **Para Usar la App**
- Windows 10+ (64-bit) o macOS 10.15+
- 500 MB de espacio en disco
- 4 GB RAM (recomendado 8 GB)
- Conexión a internet (opcional, funciona offline)

### **Para Desarrollar**
- Node.js 18+
- npm o yarn
- Git
- Visual Studio Code (recomendado)
- MySQL/Firebase (para cloud)

## 🚀 Roadmap

### ✅ v1.0 (Actual)
- [x] POS funcional
- [x] Inventario local
- [x] Canvas editor
- [x] Multi-sucursal
- [x] Auditoría

### 🔄 v1.1 (Próximas 2 semanas)
- [ ] App móvil iOS/Android
- [ ] Integraciones con proveedores
- [ ] Reportes avanzados
- [ ] BI Dashboard

### 📅 v2.0 (Q3 2026)
- [ ] Marketplace integrado
- [ ] IA predictiva de inventario
- [ ] Finanzas y contabilidad
- [ ] Integración Contpaqi

## 🤝 Contribuir

¿Quieres contribuir? ¡Excelente!

```bash
# 1. Fork el repositorio
# 2. Crea una rama
git checkout -b feature/mi-feature

# 3. Haz tus cambios
# 4. Commit
git commit -m "feat: descripción"

# 5. Push
git push origin feature/mi-feature

# 6. Abre Pull Request
```

Ver [CONTRIBUTING.md](./CONTRIBUTING.md) para más detalles.

## 📝 Licencia

Terraform ERP está bajo licencia **Permisiva Comercial** (ver [LICENSE.md](./LICENSE.md)).

En resumen:
no se permite el uso sin permiso 
## 🛡️ Seguridad

Ver [SECURITY.md](./SECURITY.md) para:
- Reportar vulnerabilidades
- Políticas de seguridad
- Mejores prácticas

## 📞 Soporte

### Gratuito
- 📖 [Documentación oficial](./docs)
- 🐛 [Issues en GitHub](https://github.com/ataca3000/camaliontopics.com.erp/issues)
- 💬 [Discussiones](https://github.com/ataca3000/camaliontopics.com.erp/discussions)

### Premium ($500-800 MXN/mes)
- 📧 Email support
- 📞 Chat en vivo
- 🔧 Soporte técnico
- 📈 Asesoría de implementación

## 💬 Contacto

- **Email**: soporte@terraformerp.com
- **WhatsApp**: +52 XXXXX XXXXX
- **Twitter/X**: @TerraformERP
- **GitHub Issues**: [Crear issue](https://github.com/ataca3000/camaliontopics.com.erp/issues/new)

## 👨‍💼 Sobre el Autor

**[Tu Nombre]**
- Desarrollador Full Stack
- Especialista en sistemas de punto de venta
- Pasión por soluciones para pymes
- Mexicano 🇲🇽

## 🙏 Agradecimientos

- Inspiración en Shopify, Square, SAP
- Comunidad open source
- Todos los usuarios tempranos
- Contribuidores

---

## 📊 Estadísticas del Proyecto

![GitHub Stars](https://img.shields.io/github/stars/ataca3000/camaliontopics.com.erp?style=social)
![GitHub Forks](https://img.shields.io/github/forks/ataca3000/camaliontopics.com.erp?style=social)
![GitHub Watchers](https://img.shields.io/github/watchers/ataca3000/camaliontopics.com.erp?style=social)

---

**Made with ❤️ for Mexican SMBs** 🇲🇽

*Última actualización: 2026-07-01*
