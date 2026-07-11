# ADMIN.COM — Manual de Arquitectura Técnica (Desarrolladores)

Este documento detalla la ingeniería del sistema, el flujo de datos, los protocolos de seguridad y la infraestructura de red local del ERP.

---

## 1. Topología del Sistema (Local-First Híbrido)

El ERP opera bajo un modelo **Maestro-Esclavo** distribuido en red local con replicación asíncrona hacia la nube (**Google Cloud Firestore**).

```
[ Nube: Google Cloud Firestore ] (BaaS Sync en tiempo real)
             ▲
             │ (Canal HTTPS Seguro / WebSockets)
             ▼
[ Nodo Maestro (Servidor Principal en Sucursal) ] <--- Levanta Puerto Aleatorio (3000-3020)
             ▲
             ├─────── LAN (HTTP / WebSocket local) ────────┐
             ▼                                             ▼
[ Nodo Esclavo 1 (POS Caja 2) ]              [ Nodo Esclavo 2 (Inventario Móvil) ]
```

### A. Buscador y Aleatorizador de Puertos (Local Networking)
Para prevenir conflictos de puertos si múltiples procesos se inician en el servidor local:
- El software principal (**Nodo Maestro**) busca de forma dinámica un puerto disponible entre el `3000` y `3020`.
- Al encontrarlo, inicia el servidor de Next.js y escribe el IP/Puerto actual en un archivo de red local compartido o en el almacén de red.
- Los **Nodos Esclavos** (tablets de ventas, laptops del patio de carga) escanean la subred local al arrancar y localizan de manera automática la dirección activa del Maestro.

---

## 2. Gestión de Estados Globales y Flujo de Datos

El motor lógico central reside en la combinación de **Zustand** (estados de persistencia inmediata) y **React Context** (estados de sesión y facturación).

### A. El Motor del Canvas Magnético (`useERPStore.ts`)
- Guarda el layout completo en un único JSON que representa la estructura, colores, textos y categorías activas del Marketplace público.
- **Optimistic Updates:** Las modificaciones de diseño o marcas en `/dashboard/design` impactan la vista de manera instantánea, actualizando la memoria local y empujando asíncronamente el cambio hacia Firestore.

### B. Ciclo del Tour Onboarding del Dueño (`GuidedTourWidget.tsx`)
- Suscrito dinámicamente al hook `usePathname` de Next.js.
- Cuando el usuario navega a las rutas predefinidas, el Tour detecta el cambio de URL y avanza de forma automatizada los pasos (ej: `/dashboard` [Paso 1] $\rightarrow$ `/dashboard/design` [Paso 2] $\rightarrow$ `/dashboard/simulator` [Paso 4] $\rightarrow$ `/dashboard/audit` [Paso 6]).
- Permite simular interacciones reales para validar que el sistema responde correctamente.

---

## 3. Seguridad de Acceso y Redirección Camuflada

### A. Login Detrás del Telón
El portal `/login` unifica todas las entradas del sistema para mantener un perfil bajo.
- Si un cliente inicia sesión, es retenido en el e-commerce público (`/catalogo`) o su panel de compras (`/cuenta`).
- Si un empleado o el Super Admin inician sesión, el middleware intercepta la sesión y redirige inmediatamente a la consola administrativa `/dashboard/*`.
- En caso de olvido de contraseña, se dispara un correo o un código SMS al celular para recuperar el control.

### B. Perro Guardián de Super Admin y Wizard Efímero
- El sistema cuenta con un control estricto que impide registrar más de un Super Administrador por licencia activa.
- La primera vez que corre el ERP, la pantalla de setup guía al usuario en la toma de control. Una vez que se registra el perfil de Super Admin en local o Firestore, la ruta `/dashboard/setup` queda desactivada de manera incondicional.

### C. Bypass de Rescate Offline (Modo Soberano)
Si la conexión a la nube o el internet fallan, el Super Admin puede ingresar con sus credenciales de bypass local. El sistema inyecta cookies encriptadas de sesión maestro (`local_owner`) y asume el control del negocio guardando las transacciones de forma temporal en SQLite local.

---

## 4. Licenciamiento Estándar vs PRO (Machine ID & Cloud Functions)

La seguridad y activación de licencias se controlan en `src/lib/license.ts` mediante:
1. **Huella de Máquina (Machine ID):** Generada mediante datos físicos únicos del equipo de instalación. La licencia se asocia a esta huella.
2. **Reinstalación Resiliente:** Si el sistema es desinstalado, los datos persistentes locales reconocen el hardware al reinstalar en el mismo equipo, permitiendo levantar la licencia sin re-activaciones.
3. **Validación por Cloud Functions:** Las llaves seriales de los clientes se validan a nivel de servidor remoto a través de una **Google Cloud Function** conectada a Firestore, sirviendo como pasarela de validación segura.
4. **Selector de Umbral SAT Facturapi (PRO):** El timbrado de facturas SAT se ejecuta exclusivamente si la licencia es PRO. En la consola del dueño se expone un **selector dinámico de monto mínimo** (por ejemplo, timbrar sólo compras mayores a $50 o $100 MXN) para evitar el timbrado automático de pequeñas compras irrelevantes y prevenir quejas o reclamos. El cliente final sólo ingresa su RFC y nombre, y la API Key de Facturapi queda resguardada en el backend.
5. **Aislamiento Multi-Tenant (Seguridad de Servidor):** La base de datos Firebase restringe los accesos de los clientes mediante reglas de seguridad estructuradas por el `tenantId` de la licencia activa, previniendo visualizaciones de bases de datos ajenas o duplicidades.

---

## 5. Medidas Avanzadas de Integridad y Ofuscación

### A. Auditoría Inmutable (Commits Forenses)
- Cada acción ejecutada genera un "commit" (`audit.ts`) inalterable guardado en texto plano.
- Contiene: Marca de tiempo, ID del usuario, rol, acción detallada y estado de conexión.
- El panel `/dashboard/audit` los renderiza de forma virtualizada para evitar caídas de rendimiento en el navegador. Se pueden exportar a PDF y Word, pero no editar.

### B. Re-ofuscación Cíclica
- Para evitar ingeniería inversa por descompiladores de JavaScript o inspección de memoria en el navegador, el núcleo del cliente ejecuta un ciclo en segundo plano cada 5 segundos que regenera y re-ofusca los tokens de seguridad y referencias activas en memoria virtual.

### C. Importador de Inventarios con IA
- Habilita la lectura de archivos de inventario anteriores en Excel/CSV, interpretando campos desestructurados mediante lenguaje natural para poblar el catálogo local en un solo paso.
