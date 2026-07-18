# 🦞 Barnacle

**Docker Freemium Monetization Layer**

Barnacle es una capa de monetización que se adhiere a cualquier contenedor Docker. Sin modificar el código fuente, convierte tu imagen pública en un modelo freemium con prueba gratis, suscripción, y validación de licencia.

## Características

✅ **Freemium nativo** - Prueba gratis + planes pagos
✅ **Código fuente privado** - Imagen pública, lógica protegida
✅ **Stripe integrado** - Pagos automáticos
✅ **Offline-first** - Funciona sin conexión (hasta cierto punto)
✅ **CLI simple** - `barnacle config --price 9.99`
✅ **Multi-instancia** - Controla cuántos contenedores por usuario
✅ **Fully open source** - (Pronto)

## Instalación

```bash
npm install -g barnacle-cli
```

## Uso Rápido

```bash
# 1. Inicializar
barnacle init

# 2. Configurar precios
barnacle config --price 9.99 --trial-days 14 --image terraform98/camalion-erp

# 3. Publicar
barnacle publish

# Tus usuarios:
docker pull terraform98/camalion-erp:latest
docker run -p 3000:3000 terraform98/camalion-erp
# → Se abre panel de Barnacle con opción de pagar
```

## Estructura del Proyecto

```
barnacle/
├── shell/       → CLI (barnacle commands)
├── core/        → Backend (server, DB, Stripe)
├── hook/        → Middleware (interceptor)
├── license/     → Validator (npm package)
├── panel/       → GUI overlay (Electron + React)
├── adapter/     → Docker plugin (Go)
├── docs/        → Documentación
└── freemium.yml → Configuración global
```

## Documentación

- [Arquitectura](./docs/ARCHITECTURE.md)
- [API Reference](./docs/API.md)
- [CLI Commands](./docs/CLI.md)

## Development

```bash
# Instalar workspace
npm install

# Dev mode
npm run dev

# Build all
npm run build

# Tests
npm run test
```

## Precios

- **Free tier**: Desarrollo/hobby
- **Pro**: $9.99/mes - Pequeños negocios
- **Enterprise**: $49.99/mes - Corporativos

Docker toma 30%, tú recibes 70%.

## Roadmap

- [ ] CLI completamente funcional
- [ ] Backend con Stripe
- [ ] Docker plugin en Go
- [ ] GUI panel (Electron)
- [ ] License validator NPM
- [ ] Tests (unit + integration + e2e)
- [ ] Deploy en producción
- [ ] Documentación completa

---

**Creado con ❤️ por developers, para developers.**

🚀 En desarrollo activo
