# Guía de Configuración de GitHub Actions

## Workflows Creados

### 1. `ci-cd.yml` (Pipeline Principal)
Se ejecuta en cada push a `main` o `develop`, y en todos los pull requests.

**Trabajos (Jobs):**
- **lint**: ESLint + validación de tipos TypeScript
- **test**: Pruebas con Vitest
- **build**: Construcción de Docker e impulso a GitHub Container Registry (GHCR) solo en main
- **docker-test**: Prueba de imagen construida en PRs
- **security**: Auditoría de npm para vulnerabilidades

### 2. `deploy-docker-hub.yml` (Despliegue a Docker Hub)
Impulsa a Docker Hub en pushes a `main` y tags de versión.

---

## Instrucciones de Configuración

### GitHub Container Registry (Automático)
GHCR usa `GITHUB_TOKEN` que está disponible automáticamente. No requiere configuración — el workflow principal impulsará imágenes a `ghcr.io/tu-org/tu-repo` en fusiones a `main`.

### Docker Hub (Opcional)
Para impulsar a Docker Hub, agrega estos secretos a tu repositorio:

1. Ve a **Settings → Secrets and variables → Actions**
2. Haz clic en **New repository secret**
3. Agrega:
   - Nombre: `DOCKER_HUB_USERNAME` → Valor: Tu nombre de usuario de Docker Hub
   - Nombre: `DOCKER_HUB_TOKEN` → Valor: Tu Token de Acceso Personal de Docker Hub

**Para crear un token en Docker Hub:**
- Inicia sesión en Docker Hub
- Account Settings → Security → Personal Access Tokens
- Crear token con permisos **Read, Write, Delete**

### Variables de Entorno
Si tu aplicación necesita secretos o variables de entorno en tiempo de construcción:

1. Agrega secretos vía **Settings → Secrets and variables → Actions**
2. Referencia en el workflow con `secrets.NOMBRE_SECRETO`

Ejemplo (si necesitas configuración de Firebase):
```yaml
- name: Construir imagen Docker
  env:
    FIREBASE_PROJECT_ID: ${{ secrets.FIREBASE_PROJECT_ID }}
  run: docker build -t app .
```

---

## Cómo Funcionan los Workflows

### En Pull Request
- ✅ Validación de código y tipos
- ✅ Ejecutar pruebas
- ✅ Construir imagen Docker (sin impulsar)
- ✅ Probar imagen Docker localmente
- ✅ Escaneo de seguridad

### En Push a `main`
- ✅ Todas las verificaciones de PR anteriores
- ✅ Impulsar a GHCR: `ghcr.io/tu-org/tu-repo:main`
- ✅ Impulsar a Docker Hub (si los secretos están configurados)

### En Tag de Versión (v1.0.0)
- ✅ Impulsar a GHCR con tag de versión
- ✅ Impulsar a Docker Hub con tag de versión y `latest`

---

## Personalización

### Agregar Pruebas de Playwright
Si deseas ejecutar pruebas E2E:

```yaml
- name: Ejecutar pruebas de Playwright
  run: npm run test:e2e
```

### Agregar Migraciones de Base de Datos
Para migraciones de Prisma en CI:

```yaml
- name: Ejecutar migraciones de Prisma
  run: npx prisma migrate deploy
```

### Omitir Construcción de Docker
Comenta el job `build` si no necesitas impulsos a registros de contenedores.

### Cambiar Ramas que Activan el Workflow
Edita el array `on.push.branches` en cada workflow para que coincida con tu estrategia de ramas.

---

## Monitoreo

Verifica el estado de los workflows:
1. Ve a la pestaña **Actions** en tu repositorio
2. Haz clic en la ejecución del workflow para ver los logs
3. Los jobs fallidos muestran salida de error detallada

---

## Referencias de Imágenes

Después de la configuración, tus imágenes estarán disponibles en:

**GitHub Container Registry:**
```
ghcr.io/tu-org/tu-repo:main
ghcr.io/tu-org/tu-repo:sha-abc123def
```

**Docker Hub** (si está configurado):
```
tu-usuario/bunkker-erp:main
tu-usuario/bunkker-erp:v1.0.0
tu-usuario/bunkker-erp:latest
```

Descarga con:
```bash
docker pull ghcr.io/tu-org/tu-repo:main
```

---

## Pasos Recomendados para Docker

### 1. **Cache de Capas Docker**
Ya está habilitado con `cache-from: type=gha`. Esto acelera significativamente los builds subsecuentes.

### 2. **Build Multi-Etapa**
Tu Dockerfile ya usa multi-etapa (dependencies → builder → runner), lo que es una práctica recomendada.

### 3. **Healthcheck**
Tu Dockerfile incluye un HEALTHCHECK que se valida automáticamente en el workflow.

### 4. **Seguridad**
- Las imágenes se construyen como usuario no-root (`nextjs:nodejs`)
- El escaneo npm audit detecta vulnerabilidades
- Considera agregar escaneo de imágenes Docker con Trivy

### 5. **Optimizaciones Aplicadas**
- ✅ Build solo se impulsa a main (no en PR)
- ✅ Las imágenes se prueban antes de desplegar
- ✅ Versionado semántico automático en tags
- ✅ Caché de GitHub Actions para capas Docker

---

## Próximos Pasos

1. **Configura secretos de Docker Hub** (si lo necesitas)
2. **Realiza un push** a una rama para ver el workflow en acción
3. **Ve a Actions** tab para monitorear el progreso
4. **Revisa los logs** si algo falla
5. **Conecta despliegues** (Kubernetes, Docker Swarm, etc.) cuando sea necesario
