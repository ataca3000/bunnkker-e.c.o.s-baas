<img width="512" height="512" alt="46 sin título_20261114143850" src="https://github.com/user-attachments/assets/4a27f18e-6b1a-4c44-90fd-8ecc6d164f0a" />
<img width="720" height="1600" alt="Screenshot_20261114_234155_com microsoft emmx" src="https://github.com/user-attachments/assets/5bd408a8-6d76-46f8-91aa-2834f78410d1" />


<div align="center">

# BUNKKER E.C.O.S.

### Ecosistema Comercial de Operación Sincronizada

ERP y punto de venta para operaciones de mayoreo y menudeo. El proyecto busca combinar operación local-first, sincronización entre dispositivos y herramientas para ventas, inventario, logística y administración.

[![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs)](https://nextjs.org/)
[![Electron](https://img.shields.io/badge/Electron-Desktop-47848F?logo=electron)](https://www.electronjs.org/)
[![Licencia BSL 1.1](https://img.shields.io/badge/Licencia-BSL%201.1-blue)](./LICENSE)

[Ver el proyecto](https://github.com/ataca3000/bunnkker-e.c.o.s-baas) · [Proponer una idea](https://github.com/ataca3000/bunnkker-e.c.o.s-baas/issues/new) · [Colaborar](./CONTRIBUTING.md) · [Patrocinar](https://github.com/sponsors/ataca3000)

</div>

---

## ¿Qué es BUNKKER E.C.O.S.?

Una plataforma en desarrollo para tiendas, ferreterías, bodegas y distribuidoras. El repositorio incluye una aplicación basada en Next.js/TypeScript y herramientas de escritorio con Electron.

Áreas del producto:

- Punto de venta, catálogo virtual y gestión de pedidos.
- Inventario, almacén, logística y entregas.
- Roles operativos, caja, auditoría y reportes.
- Experiencias web y escritorio; se exploran también escenarios móviles y de operación local.
- Sincronización en red local y servicios conectados, según la configuración del despliegue.

> El alcance y la disponibilidad de cada función pueden variar. El proyecto sigue en desarrollo; revisa la documentación y valida el software en un entorno de prueba antes de usarlo en operaciones reales.

## Primeros pasos

### Requisitos

- Node.js y npm compatibles con las dependencias del proyecto.
- Git.
- Variables de entorno según el servicio o modo que quieras ejecutar. Usa `.env.example` como referencia y nunca publiques secretos.

### Instalación

```bash
git clone https://github.com/ataca3000/bunnkker-e.c.o.s-baas.git
cd bunnkker-e.c.o.s-baas
npm install --legacy-peer-deps
cp .env.example .env.local
npx prisma generate
npm run dev
```

La aplicación de desarrollo queda normalmente disponible en `http://localhost:3000`. Algunas funciones requieren configurar servicios externos y variables de entorno; consulta `.env.example` y el [manual de usuario](./MANUAL_DE_USUARIO.md). No compartas archivos `.env` ni credenciales.

### Comandos útiles

| Comando | Uso |
|---|---|
| `npm run dev` | Inicia el servidor de desarrollo. |
| `npm run lint` | Ejecuta ESLint. |
| `npm test` | Ejecuta las pruebas con Vitest. |
| `npm run build` | Prepara la base de datos y compila la aplicación. |
| `npm run build:standalone` | Prepara una compilación de escritorio local. |
| `npm run dist:win` | Genera el instalador de Windows. |

Consulta `package.json` para la lista completa de comandos. Los pasos de despliegue pueden requerir servicios, credenciales y configuración adicionales.

## Cómo colaborar

¡Las contribuciones son bienvenidas! Puedes reportar errores, proponer funcionalidades, mejorar documentación, agregar pruebas o ayudar con accesibilidad y experiencia de usuario.

1. Revisa [CONTRIBUTING.md](./CONTRIBUTING.md) y las [ideas y misiones](./docs/IDEAS_Y_MISIONES.md).
2. Busca un Issue existente o abre uno para conversar sobre el cambio antes de empezar.
3. Para una propuesta, explica el problema, el resultado esperado y cómo se podría validar.
4. Envía un Pull Request pequeño y enfocado, con pruebas o pasos de verificación cuando corresponda.

- [Abrir un Issue](https://github.com/ataca3000/bunnkker-e.c.o.s-baas/issues/new)
- [Ver Issues abiertos](https://github.com/ataca3000/bunnkker-e.c.o.s-baas/issues)
- [Participar en Discussions](https://github.com/ataca3000/bunnkker-e.c.o.s-baas/discussions)

## Patrocina el proyecto

Si BUNKKER E.C.O.S. te resulta útil, puedes apoyar su desarrollo:

[![Patrocinar en GitHub](https://img.shields.io/badge/Patrocinar-GitHub%20Sponsors-ea4aaa?logo=githubsponsors&logoColor=white)](https://github.com/sponsors/ataca3000)

También puedes usar el botón **Sponsor** de GitHub cuando GitHub Sponsors esté habilitado para la cuenta. Para agregar PayPal hace falta el enlace público de donación o PayPal.Me del responsable; no se ha inventado ni añadido uno para evitar dirigir aportaciones a una cuenta equivocada. Cuando tengas ese enlace, se puede agregar aquí y a `.github/FUNDING.yml`.

## Documentación

- [Manual de usuario](./MANUAL_DE_USUARIO.md)
- [Contexto del sistema](./SYSTEM_CONTEXT.md)
- [Contribuir](./CONTRIBUTING.md)
- [Ideas y misiones para colaboradores](./docs/IDEAS_Y_MISIONES.md)
- [Licencia](./LICENSE) — Business Source License 1.1. Lee sus términos antes de usar o distribuir el software.

## Seguridad

No publiques contraseñas, PIN, tokens, claves privadas, datos de clientes ni archivos de configuración con secretos. Para reportar una posible vulnerabilidad, evita abrir un Issue público con detalles explotables; contacta al mantenedor por un canal privado.
<img width="720" height="1600" alt="Screenshot_20261114_234155_com microsoft emmx" src="https://github.com/user-attachments/assets/e50c9273-857d-46ee-8d1a-66cb6c5b24d6" />
<img width="1600" height="720" alt="Screenshot_20261114_234259_com microsoft emmx" src="https://github.com/user-attachments/assets/716f12db-5881-4789-8594-5b49c04da988" />
<img width="720" height="1600" alt="Screenshot_20261114_234331_com microsoft emmx" src="https://github.com/user-attachments/assets/bd6d74ff-b589-4e18-9dce-b246be251615" />
<img width="720" height="1600" alt="Screenshot_20261114_234336_com microsoft emmx" src="https://github.com/user-attachments/assets/e571496d-999b-49df-8913-27aed0f71261" />

---

© 2026 BUNKKER E.C.O.S. La licencia aplicable es la indicada en [`LICENSE`](./LICENSE).
