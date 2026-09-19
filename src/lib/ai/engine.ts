/**
 * src/lib/ai/engine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Motor de IA Local — Clasificación semántica + Aprendizaje en la marcha
 *
 * Pipeline:
 *  1. Coincidencia directa en vocabulario ERP (alta confianza)
 *  2. Búsqueda en índice de tópicos LDA (es + en)
 *  3. Aprendizaje: cada clasificación confirmada se guarda en learned.json
 *  4. En la próxima consulta, learned.json tiene prioridad máxima
 *
 * El sistema aprende sin necesitar reentrenamiento — crece con el uso.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs   from 'fs';
import path from 'path';

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface ClassificationResult {
  category:    string;
  subcategory: string;
  confidence:  number;
  source:      'learned' | 'direct' | 'model_es' | 'model_en' | 'fallback';
  lang?:       'es' | 'en';
}

export interface IntentMapping {
  intent:   string;
  label:    string;
  terms:    string[];
  redirect: string;
}

export interface IntentResult {
  intent:     string;
  label:      string;
  redirect:   string;
  confidence: number;
}


interface TopicEntry {
  code:  string;
  words: string[];
}

interface LearnedEntry {
  input:      string;   // palabra/producto normalizado
  category:   string;
  subcategory: string;
  hits:       number;   // veces confirmado — más hits = más confianza
  updatedAt:  string;
}

// ─── Rutas ──────────────────────────────────────────────────────────────────

/** Resuelve la raíz del proyecto de forma robusta (dev, Electron, standalone) */
function getProjectRoot(): string {
  // En Electron empaquetado, process.resourcesPath apunta a resources/
  if (process.env.ELECTRON_RUN_AS_NODE || process.versions?.electron) {
    return path.join((process as any).resourcesPath ?? process.cwd(), 'server');
  }
  return process.cwd();
}

function getTopicsPath(lang: 'es' | 'en'): string {
  // Usamos es/11/100/100 (11 tópicos, 100 palabras, iteración 100) — mejor balance
  const configs: Record<string, string[]> = {
    es: ['11', '100', '100'],
    en: ['11', '100', '100'],
  };
  const [topics, words, iter] = configs[lang];
  return path.join(
    getProjectRoot(),
    'unsupervised_topic_modeling-master',
    'unsupervised_topic_modeling-master',
    'topics', lang, topics, words, iter, 'topics'
  );
}

function getLearnedPath(): string {
  return path.join(getProjectRoot(), 'src', 'lib', 'ai', 'learned.json');
}

// ─── Cache en memoria ────────────────────────────────────────────────────────

const _cache: { es: TopicEntry[] | null; en: TopicEntry[] | null } = { es: null, en: null };
let _learned: Map<string, LearnedEntry> | null = null;

// ─── Palabras sensibles ──────────────────────────────────────────────────────

const SENSITIVE = new Set([
  'sex','porn','drug','terror','gay','lesbian','trans','sperm','semen',
  'weed','cocaine','marijuana','hitler','nazi','violence','rape','murder',
  'suicide','abuse','vulgar','ass','bitch','droga','terrorista','porno',
  'violencia','suicidio','abuso','sexo',
]);

// ─── Vocabulario ERP directo (español + inglés) ──────────────────────────────

export const INTENT_MAPPINGS: Record<string, { label: string; terms: string[]; redirect: string }> = {
  sales:     { label: 'Punto de Venta / Caja',        terms: ['vender','cobrar','caja','pagar','venta','pos','dinero','cajero','ticket','efectivo','cambio','corte','terminal','sale','sell','pay','cashier','checkout'], redirect: '/dashboard/admin/sales' },
  inventory: { label: 'Control de Inventario',         terms: ['inventario','almacen','stock','producto','mercancia','bodega','lote','catalogo','existencias','estanteria','merma','inventory','warehouse','stock','product','goods'], redirect: '/dashboard/inventory' },
  delivery:  { label: 'Logística de Repartos',         terms: ['reparto','entrega','domicilio','chofer','ruta','camion','enviar','envio','repartidor','direccion','gps','delivery','driver','route','shipping','dispatch'], redirect: '/dashboard/delivery' },
  billing:   { label: 'Facturación CFDI / SAT',        terms: ['factura','sat','rfc','cfdi','timbrado','fiscal','impuesto','facturacion','facturar','invoice','billing','tax','receipt'], redirect: '/dashboard/billing' },
  import:    { label: 'Carga de Inventario',           terms: ['importar','importacion','trasladar','subir','cargar','excel','csv','archivo','traspaso','migrar','import','upload','load','transfer'], redirect: '/dashboard/inventory' },
  export:    { label: 'Descarga / Exportación',        terms: ['exportar','descargar','bajar','guardar','reporte','respaldo','backup','descarga','cierre','pdf','export','download','report','backup'], redirect: '/dashboard/reports' },
  design:    { label: 'Diseño y Branding',             terms: ['diseño','marca','branding','logo','colores','apariencia','personalizar','tienda','canvas','estilo','design','brand','theme','style'], redirect: '/dashboard/design' },
  marketing: { label: 'Marketing y Campañas',          terms: ['marketing','qr','campaña','publicidad','volante','flyer','compartir','codigo','escaner','campaign','advertising','flyer','scan'], redirect: '/dashboard/marketing' },
  audit:     { label: 'Registro de Auditoría',         terms: ['auditoria','bitacora','log','historial','seguridad','acceso','registro','operaciones','audit','log','history','security','access'], redirect: '/dashboard/audit' },
  users:     { label: 'Usuarios y Roles',              terms: ['usuario','empleado','pin','acceso','rol','permiso','contraseña','user','employee','role','permission','pin','password','access'], redirect: '/dashboard/users' },
  reports:   { label: 'Reportes y Estadísticas',       terms: ['reporte','estadistica','grafica','resumen','ventas','dia','semana','mes','report','stats','chart','summary','analytics'], redirect: '/dashboard/reports' },
};

// ─── Cargador de modelo ──────────────────────────────────────────────────────

function loadModel(lang: 'es' | 'en'): TopicEntry[] {
  if (_cache[lang]) return _cache[lang]!;

  const filePath = getTopicsPath(lang);
  if (!fs.existsSync(filePath)) {
    console.warn(`[AI Engine] Modelo ${lang.toUpperCase()} no encontrado: ${filePath}`);
    _cache[lang] = [];
    return [];
  }

  try {
    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    _cache[lang] = lines
      .map(line => {
        const parts = line.trim().split('\t');
        if (parts.length < 2) return null;
        const words = parts.slice(1)
          .map(w => w.toLowerCase().replace(/[#?,.:;@]/g, '').trim())
          .filter(w => w.length >= 2 && !SENSITIVE.has(w) && !w.startsWith('http'));
        return { code: parts[0], words };
      })
      .filter((t): t is TopicEntry => t !== null && t.words.length > 0);

    console.log(`[AI Engine] Modelo ${lang.toUpperCase()} cargado: ${_cache[lang]!.length} tópicos`);
    return _cache[lang]!;
  } catch (e) {
    console.error(`[AI Engine] Error cargando modelo ${lang}:`, e);
    _cache[lang] = [];
    return [];
  }
}

// ─── Aprendizaje ─────────────────────────────────────────────────────────────

function loadLearned(): Map<string, LearnedEntry> {
  if (_learned) return _learned;
  _learned = new Map();
  const p = getLearnedPath();
  try {
    if (fs.existsSync(p)) {
      const data: LearnedEntry[] = JSON.parse(fs.readFileSync(p, 'utf8'));
      data.forEach(e => _learned!.set(e.input, e));
      console.log(`[AI Engine] Aprendizaje cargado: ${_learned.size} entradas`);
    }
  } catch { /* primera vez — archivo no existe aún */ }
  return _learned;
}

function backupLearnedAndDb(): void {
  try {
    const backupDir = path.join(getProjectRoot(), 'prisma', 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const learnedPath = getLearnedPath();
    if (fs.existsSync(learnedPath)) {
      fs.copyFileSync(learnedPath, path.join(backupDir, 'learned.json.bak'));
    }
    const dbPath = path.join(getProjectRoot(), 'prisma', 'dev.db');
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, path.join(backupDir, 'dev.db.bak'));
    }
  } catch { }
}

function saveLearned(): void {
  if (!_learned) return;
  try {
    const p = getLearnedPath();
    const data = Array.from(_learned.values())
      .sort((a, b) => b.hits - a.hits); // más usadas primero
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
    backupLearnedAndDb();
  } catch (e) {
    console.warn('[AI Engine] No se pudo guardar aprendizaje:', e);
  }
}

/**
 * Registra una clasificación confirmada para que el sistema aprenda.
 * Llamar cuando el usuario acepta/corrige una sugerencia.
 */
export function teachEngine(input: string, category: string, subcategory: string): void {
  const learned = loadLearned();
  const key = normalize(input);
  const existing = learned.get(key);
  learned.set(key, {
    input: key,
    category,
    subcategory,
    hits: (existing?.hits ?? 0) + 1,
    updatedAt: new Date().toISOString(),
  });
  saveLearned();
  // Invalida caché para que la próxima consulta use el aprendizaje actualizado
  console.log(`[AI Engine] ✅ Aprendido: "${key}" → ${category} / ${subcategory}`);
}

// ─── Utilidades ──────────────────────────────────────────────────────────────

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar tildes
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text: string): string[] {
  return normalize(text).split(' ').filter(w => w.length > 2);
}

function scoreTopics(queryWords: string[], topics: TopicEntry[]): { topic: TopicEntry; score: number } | null {
  let best: { topic: TopicEntry; score: number } | null = null;
  for (const topic of topics) {
    let score = 0;
    for (const qw of queryWords) {
      for (const tw of topic.words) {
        if (tw === qw) { score += 2; break; }
        if (tw.length > 3 && qw.length > 3 && (tw.startsWith(qw) || qw.startsWith(tw))) { score += 1; break; }
      }
    }
    if (!best || score > best.score) best = { topic, score };
  }
  return best && best.score > 0 ? best : null;
}

// ─── API PÚBLICA — Clasificar producto ──────────────────────────────────────

export function classifyProduct(name: string): ClassificationResult {
  const words = tokenize(name);
  if (words.length === 0) {
    return { category: 'General', subcategory: 'Sin Clasificar', confidence: 0.1, source: 'fallback' };
  }

  // 1️⃣ Aprendizaje previo — máxima prioridad
  const learned = loadLearned();
  const key = normalize(name);

  // Búsqueda exacta
  const exact = learned.get(key);
  if (exact) {
    const conf = Math.min(0.99, 0.70 + (exact.hits * 0.02));
    return { category: exact.category, subcategory: exact.subcategory, confidence: conf, source: 'learned' };
  }

  // Búsqueda parcial en aprendizaje (si comparten palabras)
  let bestLearnedScore = 0;
  let bestLearned: LearnedEntry | null = null;
  for (const [k, entry] of learned) {
    const learnedWords = k.split(' ');
    const overlap = words.filter(w => learnedWords.includes(w)).length;
    const score = overlap * (entry.hits + 1);
    if (score > bestLearnedScore) { bestLearnedScore = score; bestLearned = entry; }
  }
  if (bestLearned && bestLearnedScore >= 2) {
    return {
      category: bestLearned.category,
      subcategory: bestLearned.subcategory,
      confidence: Math.min(0.85, 0.50 + bestLearnedScore * 0.05),
      source: 'learned',
    };
  }

  // 2️⃣ Modelo español (prioridad por ser el idioma principal)
  const esTopics = loadModel('es');
  const esBest = scoreTopics(words, esTopics);
  if (esBest && esBest.score >= 2) {
    const cleanWords = esBest.topic.words.filter(w => !w.startsWith('#') && !w.includes('_'));
    return {
      category:    capitalize(cleanWords[0] ?? 'General'),
      subcategory: capitalize(cleanWords[1] ?? 'Otros'),
      confidence:  Math.min(0.85, 0.40 + (esBest.score / Math.max(1, words.length)) * 0.45),
      source:      'model_es',
      lang:        'es',
    };
  }

  // 3️⃣ Modelo inglés (fallback semántico)
  const enTopics = loadModel('en');
  const enBest = scoreTopics(words, enTopics);
  if (enBest && enBest.score >= 1) {
    const cleanWords = enBest.topic.words.filter(w => !w.startsWith('#') && !w.includes('_'));
    return {
      category:    capitalize(cleanWords[0] ?? 'General'),
      subcategory: capitalize(cleanWords[1] ?? 'Others'),
      confidence:  Math.min(0.70, 0.30 + (enBest.score / Math.max(1, words.length)) * 0.40),
      source:      'model_en',
      lang:        'en',
    };
  }

  return { category: 'General', subcategory: 'Sin Clasificar', confidence: 0.2, source: 'fallback' };
}

// ─── API PÚBLICA — Resolver intención del usuario ────────────────────────────

export function resolveIntent(query: string): IntentResult {
  const words = tokenize(query);
  if (words.length === 0) {
    return { intent: 'unknown', label: 'Consulta vacía', redirect: '/dashboard', confidence: 0.0 };
  }

  let bestIntent: string | null = null;
  let maxScore = 0;

  // 1️⃣ Coincidencia directa en vocabulario ERP
  for (const [intent, meta] of Object.entries(INTENT_MAPPINGS)) {
    const score = words.reduce((acc, w) => acc + (meta.terms.includes(w) ? 3 : 0), 0);
    if (score > maxScore) { maxScore = score; bestIntent = intent; }
  }

  // 2️⃣ Si no hay match directo, usar el modelo semántico
  if (!bestIntent || maxScore < 3) {
    for (const lang of ['es', 'en'] as const) {
      const topics = loadModel(lang);
      const best = scoreTopics(words, topics);
      if (!best) continue;

      for (const [intent, meta] of Object.entries(INTENT_MAPPINGS)) {
        const overlap = best.topic.words.filter(w => meta.terms.includes(w)).length;
        if (overlap === 0) continue;
        const score = best.score + overlap * 0.75;
        if (score > maxScore) { maxScore = score; bestIntent = intent; }
      }
      if (bestIntent) break; // español primero — si hay match, no seguir con inglés
    }
  }

  if (bestIntent) {
    const meta = INTENT_MAPPINGS[bestIntent];
    const confidence = Math.min(1.0, 0.35 + (maxScore / Math.max(1, words.length)) * 0.65);
    return { intent: bestIntent, label: meta.label, redirect: meta.redirect, confidence: parseFloat(confidence.toFixed(2)) };
  }

  return { intent: 'unknown', label: 'No identificado', redirect: '/dashboard', confidence: 0.2 };
}

// ─── Rol-Aware Assistance (Seguridad & Privacidad por Rol) ──────────────────────

export type AIRole = 'cliente' | 'cajera' | 'almacenista' | 'repartidor' | 'superadmin';

export interface AIRoleContext {
  role: AIRole;
  userId?: string;
}

export function formatRoleAwareResponse(intentResult: IntentResult, roleCtx?: AIRoleContext): IntentResult & { roleMessage: string } {
  const role = roleCtx?.role || 'cliente';
  let roleMessage = '';

  switch (role) {
    case 'cliente':
      roleMessage = `🛒 Asistente Catálogo: Te sugerimos explorar ${intentResult.label}.`;
      break;
    case 'cajera':
      roleMessage = `💳 Asistente POS: Acceso directo a ${intentResult.label} (Reserva atómica 0/1 activa).`;
      break;
    case 'almacenista':
      roleMessage = `📦 Asistente Almacén: Control de slots y existencias para ${intentResult.label}.`;
      break;
    case 'repartidor':
      roleMessage = `🚗 Asistente Repartos: Notita y ruta óptima asignada a ${intentResult.label}.`;
      break;
    case 'superadmin':
      roleMessage = `👑 Supervisión Total: Métrica completa, márgenes y bitácora de ${intentResult.label}.`;
      break;
  }

  return {
    ...intentResult,
    roleMessage
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Compatibilidad con código existente */
export const classifyLocalProduct       = classifyProduct;
export const classifyProductText        = async (p: { name: string }) => classifyProduct(p.name);
export const resolveSemanticIntent      = resolveIntent;
export const logAIClassificationAudit   = async (name: string, result: unknown, userId?: string) =>
  console.log(`[AI AUDIT] ${userId ?? 'anon'} | ${name} | ${JSON.stringify(result)}`);

