# AI Product Classification - Plan de Integración para ADMIN.COM ERP

## 1. ¿Qué es este repo?

Este proyecto es un ERP híbrido que combina:

- `Next.js 15` + React 19 para la interfaz y rutas del app router.
- `Electron` para empaquetar la aplicación como escritorio.
- `Firebase` / Firestore como backend principal.
- `Stripe`, `Facturapi`, `nodemailer` y varios servicios comerciales.

Estructura relevante:

- `src/app/` → rutas, páginas y APIs de Next.js.
- `src/components/` → componentes UI reutilizables.
- `src/context/` → estado global con `CartContext` y `AuthContext`.
- `src/lib/` → lógica de negocio, Firebase, licencias, mail, auditoría.
- `src/lib/firebase.ts` → configuración de Firebase cliente.
- `src/lib/firebase-admin.ts` → inicialización segura de Firebase Admin.
- `electron-main.js` → arranque de Electron + servidor Next.

## 2. ¿Para qué sirve este repo hoy?

Es una base de ERP con módulos de:

- catálogo de productos
- carrito / checkout
- facturación
- licencias y control de accesos
- notificaciones y mail
- administración de usuarios

Pero no tiene aún un módulo IA integrado.

## 3. ¿Qué vamos a agregar?

### Módulo: Clasificación Inteligente de Productos

Objetivo: cuando se agrega o edita un producto, el sistema sugiere automáticamente:

- categoría principal
- subcategoría
- material / tipo
- medida
- otros metadatos útiles

Ejemplo:

- `tubo 3/4 galvanizado` → `Fontanería / Tubería / Galvanizado / 3/4`
- `pija hex 1/4` → `Tornillería / Tornillo / Acero / 1/4`

Esto reduce trabajo manual y mejora la calidad del catálogo.

## 4. ¿Dónde se integra en este repo?

### Backend - API de clasificación

Crear una ruta server-side en:

- `src/app/api/ai/classify-product/route.ts`

Ese endpoint usará:

- `src/lib/firebase-admin.ts` para validación segura si la ruta requiere auth.
- un servicio de IA en `src/lib/ai/` o `src/services/ai/`.

### Frontend - llamada desde el formulario

Agregar un helper en:

- `src/lib/ai/classifyProduct.ts`

Y usarlo desde el formulario de productos donde se ingresan nombres/descripciones.

### Base de datos - historial y correcciones

Crear colección opcional en Firestore:

- `ai_classifications/{productId}`

Campos sugeridos:

- `name`
- `category`
- `subcategory`
- `material`
- `measure`
- `confidence`
- `timestamp`
- `source` (ej. `auto-classified`)

## 5. Flujo recomendado

### A. Captura de producto

1. Usuario escribe nombre/descripción.
2. Frontend envía `POST /api/ai/classify-product`.
3. Backend devuelve la clasificación IA.
4. Formulario se completa con la sugerencia.
5. Usuario confirma o ajusta.
6. Guardar clasificación en Firestore junto con el producto.

### B. Datos de entrenamiento

Para mejorar en el futuro, usa:

- `products` existentes
- descripciones de productos
- categorías ya asignadas
- notas y metadatos internos

Esto permitirá pasar de un modelo de similitud a un clasificador supervisado.

## 6. Tecnologías IA recomendadas

### 6.1 Primera fase: rápido y económico

- embeddings + similitud coseno
- clustering simple
- reglas de extracción de texto

### 6.2 Segunda fase: mejor precisión

- modelo supervisado entrenado con tu catálogo
- fine-tuning o embeddings + KNN
- uso de OpenAI / Azure / modelos locales

### 6.3 Continuidad futura

- agregar un panel de revisión de IA
- colección `ai_classifications` para validación humana
- feedback loop para mejorar el modelo

## 7. Cambios prácticos a hacer en el repo

1. Añadir un endpoint IA: `src/app/api/ai/classify-product/route.ts`
2. Añadir helper cliente: `src/lib/ai/classifyProduct.ts`
3. Extender formulario de producto en `src/app/...` donde se crea o edita productos.
4. Añadir env vars necesarias a `.env.example`: `OPENAI_API_KEY`, `AI_SERVICE_URL`, etc.
5. Crear colección `ai_classifications` y/o guardar metadatos en `products`.
6. Crear pagina administrativa futura de revisión de predicciones.

## 8. ¿Cómo te sirve esto a ti?

- Hace que ADMIN.COM deje de ser solo CRUD y pase a ser inteligente.
- Reduce el trabajo del cliente en catálogos grandes.
- Mejora la calidad de datos y la búsqueda.
- Te abre la puerta a venderlo como un módulo premium.

## 9. Siguiente paso inmediato

### Opción 1: generar el backend + endpoint IA básico.

### Opción 2: generar el frontend para autocompletar el formulario de producto.

### Opción 3: generar la estructura de entrenamiento de datos y la colección de Firestore.

---

## Notas específicas sobre este repo

- `src/lib/firebase.ts` ya está listo para el cliente.
- `src/lib/firebase-admin.ts` ya maneja la inicialización segura de Firebase Admin.
- La arquitectura actual usa `src/app/api/*`, así que el endpoint IA encaja bien allí.
- El proyecto ya usa Stripe, mail y Firebase en server-side, por lo que agregar una ruta serverless es natural.
- `electron-main.js` no necesita cambios para esta función; toda la IA se resuelve en el backend de Next/Firebase.

## Recomendación final

Comenzar por la clasificación de productos es el mejor primer módulo IA.

- Se ve útil rápido.
- Es fácil de integrar.
- Es escalable para futuras funciones como tickets y reclamos.

Cuando quieras, te escribo el código de inicio completo para este módulo y lo integramos en tu repo.
