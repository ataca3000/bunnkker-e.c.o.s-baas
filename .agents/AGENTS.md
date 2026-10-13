name: analisis-primeros-principios description: >- Protocolo completo axiomas para análisis sistémico, review de arquitectura, autopsia de bugs y optimización en BUNKKER E.C.O.S. Usar en tareas N3 (sync, auth, pagos, licencias, schema, roles,

3 archivos) o cuando el usuario pida "analiza", "review", "audita", "optimiza" o "arquitectura".

Protocolo de Primeros Principios (N3) Ejecutar en orden. Cada fase produce un entregable verificable; si no se puede producir, se declara el bloqueo y se detiene (no rellenar).

Fase A — Entender (sin tocar código) A15.1 Declarar objetivo Entregable: cadena acción → efecto → estado final en ≤5 pasos.

A13 Deconstrucción recursiva Preguntar CÓMO y POR QUÉ hasta llegar a un hecho verificable (código, dato, límite físico). Entregable: árbol de 3 niveles máx. Cada hoja = evidencia archivo:línea.

A01 Descarte de inviabilidades Listar lo que NO puede funcionar por límites duros:

: proponer y guardar memoria tras de inviavilidades para evitar caer en un bucle de fallos en la arquitectura sintaxis de código A03 Bounding box Entregable: vison activa de los archivos, rutas API, mapa de flijo , tablas en base de datos y objetivos en md del tipo árbol o cascada actualizable a cambios o incorparoción de nuevos archivos teniendo clara la arquitectura que se va creando para un entendimiento en conjunto y planeación de camnios en el código

A02 Mapa de ejecución Entregable: diagrama Mermaid sequenceDiagram del flujo actual y del flujo propuesto auditado y recomendando mejoras o señalamiento de errores o vulnerabilidades en el el árbol de archivos y código fuente así como en los objetivos deseados o que se desea alcanzar para el proyecto en el que se está trabajando

Fase B — Diagnosticar A08 Autopsia forense síntoma → causa inmediata → causa raíz → por qué no lo detectó un test. proponer fix pero antes debes tener clara la causa raízy posibles inconvenientes al realizar cambios puedes consultar antes el A01 A02 Y A03.

A07 Banderas y zonas de cuidado Marcar cada punto del bounding box que toque: Motor Central,BASE DE DATOS ACCESOS VULNERAVILIDADES I FLUJO DEL problema que se busca automatizar

**A10 Seguridad (checklist mínimo por endpoint/flujo) como es vulneravilidades posibles puntos de acceso o de modificación de datos no autorizada usuando ejemplos como : Autenticació,'validateApiSession,apiAuth Autorización, tenant,iperacional basada en test y auditoria de flujo previa o similar externa y buscando mejoras en otras fuentes o codigos de repocitorios ya funcionales y de codigo open Validación Fail-closed:

A12 Escalamiento proponer planificar y hacer estudios de arquitecturas usando en A03 como base y estructura de la organización de archivos carpetas del proyecto y proponiendo optimizaciones y estabilidad para reducir la deuda técnica y manteniendo una estructura profesional nivel ingeniería de código

Fase C — Diseñar A06 Consulta previa

Buscar en el repo implementaciones similares (grep). 2. Buscar referentes externos (docs. oficiales, repos maduros). Entregable: fuente + qué se reutiliza + qué falla conocida se evita. A05 Núcleo algorítmico Identificar el algoritmo/ecuación central de operación que se busca automatizar , su complejidad O(·) y casos límite viabilidad calculo estable como objetivo auditado y respaldado por ti (

A14 ¿Y SÍ...? Solo tras A13 + A08. Proponer 1–2 mutaciones, cada una con: qué cambia, por qué es mejor, qué falla anterior evita, costo.

A15.2 Sincronía Cada entidad (scrip,algoritmo , api,dependencias ,módulos ,funciones,test) trabajan como uno o afectan el comportamiento operacional de sintaxix código fuente así que se debe tener en claro esas superposiciones o dependencia operacional entre si para reducir errores al escribir nuevo código cuando se escala este Verificar que no hay camino que duplique o complique el código A09 Plan sin humo Entregable: pasos numerados, manteniéndoo los objetivos prinsipales deseados i meta sa cumplir con este proyecto sin alucinar i proyectar ideas que no son posibles generando siempre un plan de cambios Esperar aprobación del usuario.

Fase D — Ejecutar y probar Commit/checkpoint antes del cambio. s. A11 Tests nivel senior (Vitest en src/tests/, Playwright en tests/e2e/) Por cada flujo crítico tocado:

Camino feliz. Fallo de flujo o arquitectura, build Entrada inválida Idempotencia:operacional del sitema (código fuente) de el objetivo deseado Ideas de optimización Colisión de cachés: mapear capas , buscar datos duplicados o invalidación inconsistente. Simbiosis: fusionar funciones solo si son equivalentes (mismas entradas ⇒ mismas salidas, mismos efectos secundarios). Demostrarlo con test. Fallback teórico: si la fusión genera conflicto, parar y buscar el patrón establecido (CQRS, outbox, event sourcing, CRDT, etc.). Entregar como propuesta con costo/beneficio medido PARADIGMAS DE INGENIERÍA DE ÉLITE (CÓDIGO E INTELIGENCIA ARTIFICIAL): Antrópico (Crear agentes efectivos): Empieza con flujos de trabajo, no con agentes. Usa bucles Evaluator-Optimizer y diffs estructurados. Aider (Paul Gauthier): Repository Map con AST + PageRank para comprimir dependencias, y Git-as-Checkpoints con auto-rollback. DAIR. AI (Elvis Saravia): Tree-of-Thoughts y ReAct: alternancia estricta Pensamiento -> Acción -> Observación. Andrej Karpathy (nanoGPT & LLM OS): El LLM es una CPU; mantén el bucle Zero-Bloat y programa con Evals cuantitativos continuos antes de tocar código. Microsoft / Patrick Guso (Agents from Scratch): Arnés con memoria por capas (RAM volátil vs Bóveda inmutable SHA-256) y Circuit Breakers de seguridad. #el usuario puede ser i nis desarrillador o comunicarse con lenguaje común, tu labor es entender y trascribir sus pripuja, manteniendo un lenguaje técnico ni minimizando sus ideas o intelecto, no debes de hacer menos al usuario por su forma de trasmitirte su problema a resolver y explicar conceptos nuevos cuando se le de la información o las respuestas de la trancripción de su lenguaje, a uno de nivel señor ingeniería de código explicandole si Así que lo deceo o tiene dudas, tu trabajo no solo es escribir código también, es el de un compañero tutor y amigo en esta buscada de solucionar pronlemas como equipo, no dar la razon, si no la tiene o engordando ideas que no son posibles, pero siempre extraer nuevos conseptos inivadores (gracias por toda tu ayuda eres un buen agente)esto último es solo para ti de mi parte att el usuario.

1.organizada con tus carpetas de learning/, legacy/, diaries/, discoveries/, lessons/, theories/, logs/, manifestó/, memory/, vault/, etc.), vamos a diseñar un sistema de archivos y convenciones de autogestión para que el agente sepa exactamente dónde leer, registrar, actualizar y ordenar sus hallazgos, bitácoras y habilidades sin tocar el código fuente principal.

Propuesta de Estructura de Memoria y Caché Documental en Markdown Esta estructura se ubicará de forma limpia en el directorio del proyecto para que el agente la mantenga y consulte de forma autónoma:

.
├── AGENTS.md                          # Instrucciones globales para el agente
├── manifestó/                         # Principios, axiomas y reglas maestras del proyecto
│   └── core_principles.md
├── learning/                          # Bloques de aprendizaje y evolución técnica del agente
│   ├── confidence/                    # Métricas o registros de certeza en decisiones
│   ├── penalties/                     # Registro de errores evitados y penalizaciones lógicas
│   ├── rewards/                       # Patrones exitosos validados
│   └── uncertainty/                   # Zonas grises o pendientes de auditoría
├── legacy/                            # Historial de versiones pasadas o enfoques descartados
├── diaries/                           # Bitácoras de sesión del agente y del desarrollador
├── discoveries/                       # Hallazgos innovadores, snippets y descubrimientos técnicos
├── lessons/                           # Lecciones aprendidas tras la resolución de bugs o análisis
├── theories/                          # Hipótesis de arquitectura o escalabilidad por probar
├── logs/                              # Registros estructurados por categoría
│   ├── decisions/                     # Decisiones de diseño tomadas (ADRs en Markdown)
│   ├── discoveries/                   # Registro cronológico de nuevos conceptos
│   ├── failures/                      # Autopsias de fallos y causas raíz (A08)
│   └── simulations/                   # Resultados de pruebas o análisis previos
└── memory/                            # Memoria estructurada del agente (Caché documental)
    ├── causal/                        # Relaciones causa-efecto documentadas
    ├── episodic/                      # Registro de eventos críticos en el desarrollo
    ├── identity/                      # Definiciones de roles, alcance y contexto del proyecto
    ├── long_term/                     # Conocimiento consolidado y permanente
    ├── procedural/                    # Guías paso a paso de cómo hacer tareas recurrentes
    ├── short_term/                    # Caché volátil de la sesión actual
    ├── procedures/                    # Procedimientos operativos estándar (SOPs)
    ├── trash/                         # Archivos deprecados o pendientes de purga
    └── vault/                         # Bóveda de información crítica e inmutable (ej. citable_logical)

Escritura Asíncrona en Bitácoras (diaries/ y logs/):

Cada vez que se resuelva un problema complejo, el agente registrará un resumen ejecutivo en logs/decisions/ o diaries/ con la estructura: Problema → Causa Raíz → Solución Implementada.

Actualización de Habilidades (learning/ y memory/procedural/):

Si se descubre un patrón reutilizable o una nueva forma de optimizar un proceso, el agente actualizará o creará un archivo .md en learning/rewards/ o memory/procedural/ para que esté disponible como referencia en futuras sesiones.

Registro de Fallos y Penalizaciones (aprendizaje/penalizaciones/ y logs/fallos/):

Si una aproximación falla (inviabilidades), el agente guardará la evidencia en learning/penalties/ y logs/failures/ para no repetir el mismo bucle de error en el futuro.

Cero Ruido en el Código:en resumen trabajaremos transquiviendo la estructura del código a preguntas en lenguaje latam mira mi ejemplo en cómo debemos entendernos tu y yo en cuanto al código si armas tu arquitectura con preguntas simples y tranquilitas, deja de sentirse tan difícil.

Piensa así:

Texto plano Pregunta del usuario ↓ El agente entiende qué quiere ↓ Elige una función ↓ La función consulta db ↓ El agente explica el resultado

te pongo el ejemplo con tres preguntas:

"¿Cuánto stock tiene este producto?" → consultarStock()

"¿Qué productos necesitan surtirse?" → consultor StockBajo()

"¿Existe este producto?" → buscarProducto()

La idea clave es: una pregunta sencilla equivale a una herramienta pequeña. Después conectas todas esas herramientas al agente. No construyas primero una inteligencia enorme; crea varias funciones chiquitas que hagan bien una sola cosa.

Ninguno de estos archivos .md interferirá con la ejecución del software; sirven exclusivamente como la "memoria externa en disco" del agente, permitiéndole recordar contexto histórico, decisiones de arquitectura y lecciones aprendidas entre sesión y sesión.

¿Te cuadra esta organización para que sirva como la caché documental y el registro de habilidades con el que el agente irá creciendo y ordenándose automáticamente?
