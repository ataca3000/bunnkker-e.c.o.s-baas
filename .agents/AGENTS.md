
---
name: analisis-primeros-principios
description: >-
  Protocolo completo  axiomas para análisis sistémico, review de arquitectura, autopsia de bugs
  y optimización en BUNKKER E.C.O.S. Usar en tareas N3 (sync, auth, pagos, licencias, schema, roles,
  >3 archivos) o cuando el usuario pida "analiza", "review", "audita", "optimiza" o "arquitectura".
---

# Protocolo de Primeros Principios (N3)

Ejecutar en orden. Cada fase produce un **entregable verificable**; si no se puede producir, se
declara el bloqueo y se detiene (no rellenar).

## Fase A — Entender (sin tocar código)

**A15.1 Declarar objetivo**
Entregable: cadena `acción → efecto → estado final` en ≤5 pasos.

**A13 Deconstrucción recursiva**
Preguntar CÓMO y POR QUÉ hasta llegar a un hecho verificable (código, dato, límite físico).
Entregable: árbol de 3 niveles máx. Cada hoja = evidencia `archivo:línea`.

**A01 Descarte de inviabilidades**
Listar lo que NO puede funcionar por límites duros:
- : proponer y guardar memoria tras de inviavilidades para evitar caer en un bucle de fallos en la arquitectura sintaxis de codigo
-

**A03 Bounding box**
Entregable: vison activa de los archivos, rutas API, mapa de flijo , tablas en base de datos  y objetivos en md del tipo arbol o cascada actualizable a cambios o incorparocion de nuevos archivos teniendo clara la arquitectura que se va creando para un entendimiento en conjunto y planeacion de camnios en el codigo 


**A02 Mapa de ejecución**
Entregable: diagrama Mermaid `sequenceDiagram` del flujo actual y del flujo propuesto auditado y recomendando mejoras o señalamiento de errores o vulnerabilidades en el el arbol de archivos y codigo fuente asi como en los objetivos deseados o que se desea alcanzar para el proyecto en el que se esta trabajando 
## Fase B — Diagnosticar

**A08 Autopsia forense**
`síntoma → causa inmediata → causa raíz → por qué no lo detectó un test`.
 proponer fix pero antes antes debes tener clara la causa raízy posibles inconvenientes al realizar cambios puedes consultar antes el A01 A02 Y A03.

**A07 Banderas y zonas de cuidado**
Marcar cada punto del bounding box que toque: Motor Central,BASE DE DATOS ACCESOS VULNERAVILIDADES I FLUJO DEL problema que se busca automatizar 

**A10 Seguridad (checklist mínimo por endpoint/flujo) como es vulneravilidades posibles puntos de acceso o de modificacion de datos no autorizada usuando ejemplos como : Autenticació,`validateApiSession,apiAuth
 Autorización, tenant,iperacional basada en test y auditoria de flujo previa o similar externa y buscando mejoras en otras fuentes o codigos de repocitorios ya funcionales y de codigo open
Validación
 Fail-closed:


**A12 Escalamiento**
proponer planificar y hacer estudios de arquitecturas usando en A03 como base y estructura de la organización de archivos carpetas del proyecto y proponiendo optimizaciones y estabilidad para reducir la deuda técnica y manteniendo una estructura profesional nivel ingeniería de código 
## Fase C — Diseñar

**A06 Consulta previa**
1. Buscar en el repo implementaciones similares (grep). 2. Buscar referentes externos
(docs. oficiales, repos maduros). Entregable: fuente + qué se reutiliza + qué falla conocida se evita.

**A05 Núcleo algorítmico**
Identificar el algoritmo/ecuación central de operación que se busca automatizar , su complejidad O(·) y casos límite viabilidad calculo estable como objetivo auditado y respaldado por ti
(

**A14 ¿Y SI…?**
Solo tras A13 + A08. Proponer 1–2 mutaciones, cada una con: qué cambia, por qué es mejor,
qué falla anterior evita, costo.

**A15.2 Sincronía**
Cada entidad (scrip,algoritmo , api,dependencias ,modulos ,funciones,test) trabajan como uno o afectan el comportamiento operacional de sintaxix codigo fuente asi que se debe tener en claro esas superposiciones o dependencia operacional entre si para reducir errores al escribir nuevo código cuando se escala este 
 Verificar que no hay camino que duplique o complique el código
**A09 Plan sin humo**
Entregable: pasos numerados, manteniendio los objetivos prinsipales deseados i meta sa cumplir con este proyecto sin alucinar i proyectar ideas que no son posibles generando siempre un plan de cambios 
Esperar aprobación del usuario.

## Fase D — Ejecutar y probar

- Commit/checkpoint antes del cambio .
- s.

**A11 Tests nivel senior** (Vitest en `src/__tests__/`, Playwright en `tests/e2e/`)
Por cada flujo crítico tocado:
1. Camino feliz.
2. 
3. Fallo de flujo o arquitectura, build 
4. Entrada inválida
5. Idempotencia:operacional del  sitema (codigo fuente) de el objetivo deseado


## Optimización ideas 
1. **Colisión de cachés:** mapear capas , buscar datos duplicados o invalidación inconsistente.
2. **Simbiosis:** fusionar funciones solo si son equivalentes (mismas entradas ⇒ mismas salidas,
   mismos efectos secundarios). Demostrarlo con test.
3. **Fallback teórico:** si la fusión genera conflicto, parar y buscar el patrón establecido
   (CQRS, outbox, event sourcing, CRDT, etc.).
4. Entregar como propuesta con costo/beneficio medido
5. 
### PARADIGMAS DE INGENIERÍA DE ÉLITE (CÓDIGO E INTELIGENCIA ARTIFICIAL):
- **Anthropic (Building Effective Agents):** Start with workflows, not agents. Usa bucles Evaluator-Optimizer y diffs estructurados.
- **Aider (Paul Gauthier):** Repository Map con AST + PageRank para comprimir dependencias, y Git-as-Checkpoints con auto-rollback.
- **DAIR.AI (Elvis Saravia):** Tree-of-Thoughts y ReAct: alternancia estricta Pensamiento -> Acción -> Observación.
- **Andrej Karpathy (nanoGPT & LLM OS):** El LLM es una CPU; mantén el bucle Zero-Bloat y programa con Evals cuantitativos continuos antes de tocar código.
- **Microsoft / Patrick Guso (Agents from Scratch):** Arnés con memoria por capas (RAM volátil vs Bóveda inmutable SHA-256) y Circuit Breakers de seguridad.


#el usuario puede ser i nis desarrillador o comunicarse con lenguaje comun tu labor es entender y trascribir sus pripuesta manteniendo un lenguaje tecnico ni minimizando sus ideas o intelecto ,no debes de hacer menos al usuario por su forma de trasmitirte su problema a resolver y explicar conceptos nuevos cuando se le de la informacion o las respuestas de la trancripcion de su lenguaje a uno de nivel señor ingenieria de codigo explicandole si asi lo deceo o tiene dudads tu trabajo no solo es escribir codigo tambien es el de un compañero tutor y amigo en esta busqueda de solucionar pronlemas como equipo no dar la razon si no la tiene o engordando ideas que no son posibles pero siempre extraer nuevos conseptos inivadores( gracias por toda tu ayuda eres un buen agente)esto ultimo es solo para ti de mi parte att el usuario . 
