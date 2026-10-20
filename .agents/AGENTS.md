.agents/
├── AGENTS.md                     # Master system guidelines (N3 Protocol)
├── VISION_Y_METAS.md             # Vision and system goals
├── manifesto/                    # Core engineering axioms and boundaries
├── learning/                     # Confidence metrics, penalties, and validated patterns
├── legacy/                       # Archived approaches and historical versions
├── diaries/                      # Session journals
├── discoveries/                  # Technical snippets and findings
├── lessons/                      # Post-mortem bug resolutions
├── theories/                     # Architectural hypotheses
├── logs/                         # ADRs, failure autopsies, and simulations
└── memory/                       # Causal, episodic, procedural, and vault data

# N3-Protocol & Persistent Memory Layer for AI Assistants

 **Overview:** A deterministic first-principles engineering workflow and structured local memory layer for AI coding assistants. Designed to eliminate context amnesia, enforce rigorous debugging, and maintain a zero-bloat codebase.

                                     **arquitectura planteada**


## 1. First-Principles Protocol (N3)

Execute strictly in order. Each phase must produce a verifiable deliverable; if it cannot be produced, declare a block and halt execution immediately (no filling or guessing).

### Phase A — Understand (No Code Modification)
* **A15.1 Declare Objective:**
  * **Deliverable:** A chain of $\le 5$ steps structured as: `action → effect → final state`.
* **A13 Recursive Deconstruction:**
  * Ask *HOW* and *WHY* iteratively down to a verifiable fact (code, data, or physical limit).
  * **Deliverable:** Tree of max 3 levels. Each leaf = evidence `file:line`.
* **A01 Infeasibility Discard:**
  * List what CANNOT work due to hard language, syntax, architecture, or platform limits; persist in memory to prevent failure loops.
* **A03 Bounding Box:**
  * **Deliverable:** Active, updatable view (tree/cascade format) of involved files, API routes, data flows, database schemas, and objectives.
* **A02 Execution Map:**
  * **Deliverable:** Mermaid sequence diagram (`sequenceDiagram`) comparing current vs. proposed flow, highlighting architecture bottlenecks or vulnerabilities.

### Phase B — Diagnose
* **A08 Forensic Autopsy:**
  * Identify root cause before proposing fixes (consulting A01, A02, A03).
  * **Deliverable:** `symptom → immediate cause → root cause → why tests missed it`.
* **A07 Flags & Care Zones:**
  * Mark bounding box areas touching: Core Engine, Database, Access Control, Vulnerabilities, or Target Flow.
* **A10 Security Checklist (Fail-Closed):**
  * Audit endpoints/flows against unauthorized access. Examples: Authentication (`validateApiSession`, `apiAuth`), tenant/role authorization, fail-closed validation, and peer-reviewed patterns.
* **A12 Scaling & Technical Debt:**
  * Plan architectural studies using A03 to reduce technical debt at a senior engineering level.

### Phase C — Design
* **A06 Prior Art & Consultation:**
  1. Grep repository for similar implementations.
  2. Check external references (official docs, mature open-source repos).
  * **Deliverable:** `source + what is reused + known failure avoided`.
* **A05 Algorithmic Core:**
  * Identify core algorithms/equations, their $O(\cdot)$ complexity, edge cases, and calculation stability.
* **A14 What-If Mutations:**
  * *Only after A13 + A08.* Propose 1–2 mutations indicating: what changes, why it's better, previous failure avoided, and cost.
* **A15.2 Synchronicity & Dependencies:**
  * Map interactions across scripts, APIs, dependencies, modules, and tests to prevent unintended side effects during scaling.
* **A09 Smoke-Free Plan:**
  * **Deliverable:** Numbered steps focused strictly on real project goals without hallucination.
  * **Rule:** Await explicit user sign-off before proceeding.

### Phase D — Execute & Test
* Create a Git checkpoint/commit prior to modifications.
* **A11 Senior-Grade Testing (Vitest / Playwright):**
  For every critical flow touched, validate:
  1. Happy path.
  2. Flow, architecture, or build failure.
  3. Invalid input handling.
  4. System operational idempotency.

---

## 2. Elite Engineering Paradigms

* **Anthropic Effective Agents:** Prioritize workflows over complex agents. Use Evaluator-Optimizer loops and structured diffs.
* **Aider (Paul Gauthier):** Repository Map with AST + PageRank for dependency compression, and Git-as-Checkpoints with auto-rollback.
* **DAIR.AI (Elvis Saravia):** Tree-of-Thoughts and ReAct with strict alternation: `Thought → Action → Observation`.
* **Andrej Karpathy (nanoGPT & LLM OS):** Treat LLM as a CPU; maintain a Zero-Bloat loop and continuous quantitative evals before touching code.
* **Microsoft / Patrick Guso (Agents from Scratch):** Layered memory harness (volatile RAM vs. SHA-256 immutable vault) and security circuit breakers.

---

## 3. Persistent Memory & Document Cache Structure

The repository maintains an external Markdown-based document cache inside `.agents/` so the assistant retains context across sessions without bloating source code:

* `.agents/manifesto/`: Core principles, axioms, and master rules.
* `.agents/learning/`: Technical growth blocks (confidence metrics, logic penalties, validated rewards, uncertainty zones).
* `.agents/legacy/`: Historical versions or discarded approaches.
* `.agents/diaries/`: Session logs.
* `.agents/discoveries/`: Innovative snippets and technical findings.
* `.agents/lessons/`: Bug resolution learnings.
* `.agents/theories/`: Architecture hypotheses to test.
* `.agents/logs/`: Structured logs (decisions/ADRs, discoveries, failures/autopsies, simulations).
* `.agents/memory/`: Structured agent memory (causal, episodic, identity, long-term, procedural, short-term, procedures, trash, vault).

### Autonomous Management Rules for the Assistant
1. **Asynchronous Logging:** Upon resolving complex tasks, record execution summaries in `.agents/logs/decisions/` or `.agents/diaries/` (`Problem → Root Cause → Solution`).
2. **Skill Updates:** When discovering reusable patterns, update or create Markdown files under `.agents/learning/rewards/` or `.agents/memory/procedural/`.
3. **Failure Tracking:** If an approach fails, log the evidence in `.agents/learning/penalties/` and `.agents/logs/failures/` to prevent recurrence.
4. **Zero Code Pollution:** Markdown files act exclusively as external disk memory inside `.agents/` and never interfere with software compilation or runtime execution.

---

## 4. Protocolo de Fontanería Sistémica & Reglas de Trabajo End-to-End

### 4.1 Principio del Fontanero de Tuberías
No analizar archivos ni funciones de forma aislada. Entrar en las tuberías del sistema para rastrear el flujo circulatorio completo:
`Evento Iniciador → Entrada de Datos → Validaciones/Compuertas Lógicas → Mutación de Estado → Propagación (DB/Sockets/Store) → Consumo por otros Actores → Resultado Observable`.

### 4.2 Cuestionario Obligatorio por Cada Compuerta
En cada bifurcación o paso de un flujo, responder explícitamente:
1. ¿Qué acción ocurre y qué condición permite que ocurra?
2. ¿De qué dato, estado, usuario, rol o acción previa depende?
3. ¿Qué camino sigue si la condición se cumple y cuál si es rechazada?
4. ¿Qué dato crea, modifica, elimina o transmite (DB, memoria, sockets)?
5. ¿Qué otras partes del sistema o terminales de rol afecta?
6. ¿Qué ocurre después y quién recibe ese resultado?
7. ¿Qué podría fallar, quedar pendiente o duplicarse por fallas de red Wi-Fi?
8. ¿Cómo se recupera el sistema ante el error (idempotencia y fail-closed)?

### 4.3 Mapa Vivo del Sistema Circulatorio
Mantener y contrastar visualmente el sistema bajo esta taxonomía:
- **Raíces:** Entradas (cliente catálogo, terminal caja, tablet patio, escáner almacén, app repartidor).
- **Tronco/Corazón:** Servidor central / Base de datos autoridad única (SQLite WAL / Next.js API / Socket Radio).
- **Ramas/Arterias:** Llamadas API, eventos de orden (`OrderEvent`), sincronizadores (`BroadcastChannel`, `Socket.IO`, `IndexedDB`).
- **Compuertas:** Estados de validación (`pending_payment` → `paid` → `isLoaded` → `DELIVERED`).
- **Órganos:** Pizarras públicas por rol (Caja, Almacén, Patio, Reparto, Auditoría).
- **Salidas:** Ticket digital, comprobante PoD (firma/foto), cierre contable, inventario físico deducido.

### 4.4 Estados del Mapa de Tuberías
Todo nodo o conexión auditada debe clasificarse con rigor:
- **`[IMPLEMENTADO]`**: Existe, comprobado con evidencia de código y conectado E2E.
- **`[PARCIAL]`**: Existe una parte, pero el recorrido se corta o no actualiza al siguiente actor.
- **`[PENDIENTE]`**: Diseñado o requerido, pero aún no existe en el código.
- **`[ROTO/DUDOSO]`**: Conexión fallida, estado desfasado o riesgo de desincronización detectado.

### 4.5 Regla de Implementación No-Aislada
Antes de modificar código:
1. Declarar el flujo completo a intervenir, sus compuertas lógicas y los actores afectados.
2. Describir caminos de éxito, rechazo y recuperación.
3. Prohibido escribir parches cosméticos o funciones aisladas que dejen desconectada la circulación entre pantallas y base de datos.


