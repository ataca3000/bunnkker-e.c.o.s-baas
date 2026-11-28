import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
  InferenceSource,
  type GenerativeModel,
  type HybridParams,
} from 'firebase/ai';
import { app, firebasePublicConfig, hasRealCredentials } from '@/lib/firebase';

export type FirebaseAiEngineSource =
  | 'on_device'
  | 'in_cloud'
  | 'server_gemini'
  | 'local_rule_engine';

export type OnDeviceModelAvailability =
  | 'available'
  | 'downloadable'
  | 'downloading'
  | 'unavailable'
  | 'unsupported';

export type HybridTaskKind =
  | 'chat'
  | 'inventory_summary'
  | 'audit_report'
  | 'product_classification'
  | 'diagnostic_probe';

export interface FirebaseAiCapabilities {
  hasFirebaseCredentials: boolean;
  isBrowser: boolean;
  isOnline: boolean;
  hasOnDevicePromptApi: boolean;
  preferredMode: typeof InferenceMode.PREFER_ON_DEVICE;
}

export interface FirebaseAiDiagnosticReport {
  timestamp: string;
  projectId: string;
  appIdConfigured: boolean;
  hasFirebaseCredentials: boolean;
  isBrowser: boolean;
  isOnline: boolean;
  hasOnDevicePromptApi: boolean;
  onDeviceAvailability: OnDeviceModelAvailability;
  onDeviceDetails: string;
  cloudModel: string;
  sdkPackage: string;
  supportedModes: InferenceMode[];
}

export interface DirectFirebaseProbeResult {
  ok: boolean;
  requestedMode: InferenceMode;
  source: 'on_device' | 'in_cloud' | 'error';
  model: string;
  latencyMs: number;
  text?: string;
  error?: string;
  remediation?: string;
}

export interface HybridTaskExecutionRecord {
  id: string;
  timestamp: string;
  task: HybridTaskKind;
  requestedMode: InferenceMode;
  source: FirebaseAiEngineSource;
  model: string;
  latencyMs: number;
  routingReason: string;
  fallbackReason?: string;
}

export interface HybridInferenceRequest {
  prompt: string;
  history?: Array<{ role: string; content: string }>;
  role?: string;
  contextData?: Record<string, unknown>;
  systemInstruction?: string;
  cloudModel?: string;
  inferenceMode?: InferenceMode;
  taskKind?: HybridTaskKind;
  routingReason?: string;
  serverFallbackFetcher?: (payload: {
    messages: Array<{ role: string; content: string }>;
    contextData: Record<string, unknown>;
    role: string;
  }) => Promise<{ reply?: string; engine?: string } | null>;
}

export interface HybridInferenceResponse {
  text: string;
  source: FirebaseAiEngineSource;
  model: string;
  latencyMs: number;
  requestedMode: InferenceMode;
  routingReason: string;
  fallbackReason?: string;
}

export const DEFAULT_FIREBASE_CLOUD_MODEL = 'gemini-2.5-flash';

const MAX_EXECUTION_HISTORY = 25;
const executionHistory: HybridTaskExecutionRecord[] = [];
const executionListeners = new Set<(records: HybridTaskExecutionRecord[]) => void>();

export function recordHybridExecution(
  entry: Omit<HybridTaskExecutionRecord, 'id' | 'timestamp'>
): HybridTaskExecutionRecord {
  const full: HybridTaskExecutionRecord = {
    ...entry,
    id: `hyb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
  };
  executionHistory.unshift(full);
  if (executionHistory.length > MAX_EXECUTION_HISTORY) {
    executionHistory.length = MAX_EXECUTION_HISTORY;
  }
  executionListeners.forEach((cb) => {
    try {
      cb([...executionHistory]);
    } catch {}
  });
  return full;
}

export function getHybridExecutionHistory(): HybridTaskExecutionRecord[] {
  return [...executionHistory];
}

export function subscribeHybridExecutionHistory(
  listener: (records: HybridTaskExecutionRecord[]) => void
): () => void {
  executionListeners.add(listener);
  return () => {
    executionListeners.delete(listener);
  };
}

const ROLE_INSTRUCTIONS: Record<string, string> = {
  customer:
    'Ayuda a clientes a encontrar productos, consultar precios y preparar pedidos. Nunca inventes stock ni confirmes pagos.',
  support:
    'Atiende soporte a clientes con respuestas claras, consulta el contexto disponible y escala incidencias que requieran permisos.',
  sales:
    'Asiste a caja con precios, existencias y cobro. Nunca autorices descuentos, devoluciones o cambios sin confirmación humana.',
  cashier:
    'Asiste a caja con precios, existencias y cobro. Nunca autorices descuentos, devoluciones o cambios sin confirmación humana.',
  inventory:
    'Asiste al almacén con existencias, ubicaciones, recepción y mermas. No modifiques inventario ni precios sin autorización.',
  warehouse:
    'Asiste al almacén con existencias, ubicaciones, recepción y mermas. No modifiques inventario ni precios sin autorización.',
  driver:
    'Asiste al repartidor con rutas, pedidos y evidencias PoD. No marques una entrega como completada sin confirmación.',
  delivery:
    'Asiste al repartidor con rutas, pedidos y evidencias PoD. No marques una entrega como completada sin confirmación.',
  billing:
    'Asiste en facturación CFDI 4.0 y conciliación fiscal sin alterar montos cobrados.',
  owner:
    'Asiste al dueño con resúmenes, alertas y decisiones operativas. Separa hechos del contexto de cualquier recomendación.',
  admin:
    'Asiste al gerente con auditoría, inventario, ventas y finanzas. No ejecutes acciones irreversibles.',
  superadmin:
    'Asiste al dueño/superadmin con auditoría, métricas ejecutivas y supervisión operativa. No expongas secretos ni llaves internas.',
};

export function detectFirebaseAiCapabilities(): FirebaseAiCapabilities {
  const isBrowser = typeof window !== 'undefined';
  const isOnline =
    typeof navigator === 'undefined' ? true : navigator.onLine !== false;

  let hasOnDevicePromptApi = false;
  if (isBrowser) {
    const win = window as unknown as Record<string, any>;
    hasOnDevicePromptApi = Boolean(
      win.LanguageModel ||
        win.ai?.languageModel ||
        (typeof navigator !== 'undefined' && (navigator as any).ml)
    );
  }

  return {
    hasFirebaseCredentials: hasRealCredentials,
    isBrowser,
    isOnline,
    hasOnDevicePromptApi,
    preferredMode: InferenceMode.PREFER_ON_DEVICE,
  };
}

export async function probeFirebaseAiDiagnostics(): Promise<FirebaseAiDiagnosticReport> {
  const caps = detectFirebaseAiCapabilities();
  let onDeviceAvailability: OnDeviceModelAvailability = 'unsupported';
  let onDeviceDetails = 'Navegador sin Prompt API local (Chrome Built-in AI / Gemini Nano).';

  if (caps.isBrowser) {
    const win = window as unknown as Record<string, any>;
    try {
      if (win.LanguageModel && typeof win.LanguageModel.availability === 'function') {
        const status = await win.LanguageModel.availability();
        if (
          status === 'available' ||
          status === 'readily' ||
          status === 'downloadable' ||
          status === 'after-download' ||
          status === 'downloading' ||
          status === 'unavailable'
        ) {
          onDeviceAvailability =
            status === 'readily'
              ? 'available'
              : status === 'after-download'
                ? 'downloadable'
                : status;
          onDeviceDetails =
            onDeviceAvailability === 'available'
              ? 'Gemini Nano local listo en Chrome (LanguageModel.availability = available).'
              : onDeviceAvailability === 'downloadable' || onDeviceAvailability === 'downloading'
                ? `Modelo Gemini Nano en estado "${status}". Chrome lo descarga al primer uso.`
                : 'Prompt API detectada pero Gemini Nano no está disponible en este dispositivo/perfil.';
        }
      } else if (win.ai?.languageModel && typeof win.ai.languageModel.capabilities === 'function') {
        const lmCaps = await win.ai.languageModel.capabilities();
        const avail = String(lmCaps?.available || 'no');
        if (avail === 'readily') {
          onDeviceAvailability = 'available';
          onDeviceDetails = 'Chrome ai.languageModel listo (available: readily).';
        } else if (avail === 'after-download') {
          onDeviceAvailability = 'downloadable';
          onDeviceDetails = 'Chrome ai.languageModel requiere descarga inicial (after-download).';
        } else {
          onDeviceAvailability = 'unavailable';
          onDeviceDetails = `Chrome ai.languageModel reportó estado "${avail}".`;
        }
      } else if (caps.hasOnDevicePromptApi) {
        onDeviceAvailability = 'available';
        onDeviceDetails = 'API ML/Prompt detectada en el navegador.';
      }
    } catch (err: unknown) {
      onDeviceAvailability = 'unavailable';
      onDeviceDetails =
        err instanceof Error
          ? `Error consultando modelo local: ${err.message}`
          : 'No se pudo consultar LanguageModel local.';
    }
  }

  return {
    timestamp: new Date().toISOString(),
    projectId: firebasePublicConfig.projectId || 'no-configurado',
    appIdConfigured: Boolean(firebasePublicConfig.appId && !firebasePublicConfig.appId.includes('848317819375')),
    hasFirebaseCredentials: caps.hasFirebaseCredentials,
    isBrowser: caps.isBrowser,
    isOnline: caps.isOnline,
    hasOnDevicePromptApi: caps.hasOnDevicePromptApi,
    onDeviceAvailability,
    onDeviceDetails,
    cloudModel: DEFAULT_FIREBASE_CLOUD_MODEL,
    sdkPackage: 'firebase/ai (Firebase AI Logic Web SDK)',
    supportedModes: [
      InferenceMode.PREFER_ON_DEVICE,
      InferenceMode.PREFER_IN_CLOUD,
      InferenceMode.ONLY_ON_DEVICE,
      InferenceMode.ONLY_IN_CLOUD,
    ],
  };
}

export function buildBunkkerRoleSystemInstruction(
  role = 'customer',
  contextData: Record<string, unknown> = {}
): string {
  const normalizedRole = String(role || 'customer').toLowerCase();
  const roleRule = ROLE_INSTRUCTIONS[normalizedRole] || ROLE_INSTRUCTIONS.customer;

  const businessName =
    typeof contextData.businessName === 'string' && contextData.businessName.trim()
      ? contextData.businessName.trim()
      : 'BUNKKER E.C.O.S.';

  const rawProducts = Array.isArray(contextData.products) ? contextData.products : [];
  const compactProducts = rawProducts.slice(0, 12).map((p: any) => ({
    name: String(p?.name || 'Producto').slice(0, 60),
    stock: typeof p?.stock === 'number' ? p.stock : undefined,
    price: typeof p?.price === 'number' ? p.price : undefined,
    location: typeof p?.location === 'string' ? p.location : undefined,
  }));

  const ordersCount =
    typeof contextData.ordersCount === 'number' ? contextData.ordersCount : undefined;

  const safeSummary = {
    businessName,
    totalProductsInContext: rawProducts.length,
    ...(ordersCount !== undefined ? { ordersCount } : {}),
    sampleProducts: compactProducts,
  };

  return [
    `Eres LION, agente operativo (${normalizedRole}) de ${businessName} dentro de BUNKKER E.C.O.S.`,
    roleRule,
    'Responde en español, de forma concisa, precisa y accionable (máximo 150 palabras).',
    `Contexto operativo verificado: ${JSON.stringify(safeSummary)}`,
  ].join(' ');
}

export function buildHybridModelParams(options?: {
  systemInstruction?: string;
  cloudModel?: string;
  mode?: InferenceMode;
}): HybridParams {
  const instruction = options?.systemInstruction?.trim();
  const cloudModel = options?.cloudModel?.trim() || DEFAULT_FIREBASE_CLOUD_MODEL;
  const mode = options?.mode || InferenceMode.PREFER_ON_DEVICE;

  return {
    mode,
    onDeviceParams: {
      createOptions: instruction
        ? {
            initialPrompts: [
              {
                role: 'system',
                content: [{ type: 'text', value: instruction }],
              },
            ],
          }
        : undefined,
    },
    inCloudParams: {
      model: cloudModel,
      ...(instruction ? { systemInstruction: instruction } : {}),
    },
  };
}

let cachedFirebaseAiModels = new Map<string, GenerativeModel>();

export function getHybridFirebaseModel(options?: {
  systemInstruction?: string;
  cloudModel?: string;
  mode?: InferenceMode;
}): GenerativeModel | null {
  if (!hasRealCredentials) return null;

  const instruction = options?.systemInstruction?.trim() || '';
  const cloudModel = options?.cloudModel?.trim() || DEFAULT_FIREBASE_CLOUD_MODEL;
  const mode = options?.mode || InferenceMode.PREFER_ON_DEVICE;
  const cacheKey = `${mode}::${cloudModel}::${instruction}`;

  const cached = cachedFirebaseAiModels.get(cacheKey);
  if (cached) {
    return cached;
  }

  const ai = getAI(app, { backend: new GoogleAIBackend() });
  const params = buildHybridModelParams({
    systemInstruction: instruction || undefined,
    cloudModel,
    mode,
  });

  const model = getGenerativeModel(ai, params);
  cachedFirebaseAiModels.set(cacheKey, model);
  if (cachedFirebaseAiModels.size > 16) {
    const firstKey = cachedFirebaseAiModels.keys().next().value;
    if (firstKey) cachedFirebaseAiModels.delete(firstKey);
  }
  return model;
}

export async function runDirectFirebaseAiProbe(options?: {
  mode?: InferenceMode;
  prompt?: string;
  cloudModel?: string;
}): Promise<DirectFirebaseProbeResult> {
  const startedAt = Date.now();
  const mode = options?.mode || InferenceMode.PREFER_ON_DEVICE;
  const cloudModel = options?.cloudModel || DEFAULT_FIREBASE_CLOUD_MODEL;
  const prompt =
    options?.prompt?.trim() ||
    'Responde en una oración corta en español confirmando que el SDK híbrido de BUNKKER E.C.O.S. responde correctamente.';

  if (!hasRealCredentials) {
    return {
      ok: false,
      requestedMode: mode,
      source: 'error',
      model: cloudModel,
      latencyMs: Date.now() - startedAt,
      error: 'Credenciales reales de Firebase no detectadas en firebase-applet-config.json.',
      remediation: 'Configura firebase-applet-config.json o NEXT_PUBLIC_FIREBASE_* con un proyecto válido.',
    };
  }

  try {
    const model = getHybridFirebaseModel({
      mode,
      cloudModel,
      systemInstruction:
        'Eres el verificador de diagnóstico de Firebase AI Logic para BUNKKER E.C.O.S. Responde en español, máximo 25 palabras.',
    });

    if (!model) {
      throw new Error('No fue posible inicializar getGenerativeModel(ai, hybridParams).');
    }

    const result = await model.generateContent(prompt);
    const text = result?.response?.text?.()?.trim() || '';
    const isOnDevice = result?.response?.inferenceSource === InferenceSource.ON_DEVICE;
    const latencyMs = Date.now() - startedAt;

    recordHybridExecution({
      task: 'diagnostic_probe',
      requestedMode: mode,
      source: isOnDevice ? 'on_device' : 'in_cloud',
      model: isOnDevice ? 'gemini-nano-on-device' : cloudModel,
      latencyMs,
      routingReason: `Prueba directa SDK (${mode})`,
    });

    return {
      ok: true,
      requestedMode: mode,
      source: isOnDevice ? 'on_device' : 'in_cloud',
      model: isOnDevice ? 'gemini-nano-on-device' : cloudModel,
      latencyMs,
      text: text || '(Respuesta vacía del modelo)',
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const latencyMs = Date.now() - startedAt;

    let remediation =
      'Verifica conectividad y estado del servicio Firebase AI Logic en Firebase Console.';
    if (mode === InferenceMode.ONLY_ON_DEVICE) {
      remediation =
        'Gemini Nano local no está activo en este navegador. En Chrome habilita chrome://flags/#prompt-api-for-gemini-nano y #optimization-guide-on-device-model, luego reinicia Chrome.';
    } else if (
      message.includes('App Check') ||
      message.includes('app-check') ||
      message.includes('401')
    ) {
      remediation = `Firebase AI Logic ya está activa, pero App Check rechazó la petición web (401). Para pruebas/web, desactiva la exigencia (Unenforce) de App Check en Firebase AI Logic desde https://console.firebase.google.com/project/${firebasePublicConfig.projectId}/appcheck/apis o configura tu clave reCAPTCHA v3 en firebase-applet-config.json.`;
    } else if (
      message.includes('API has not been used') ||
      message.includes('api-not-enabled') ||
      message.includes('403') ||
      message.includes('PERMISSION_DENIED') ||
      message.includes('firebasevertexai') ||
      message.includes('firebaseml')
    ) {
      remediation = `Habilita Firebase AI Logic (Gemini Developer API) en https://console.firebase.google.com/project/${firebasePublicConfig.projectId}/ailogic y verifica que el API Key del proyecto no bloquee firebasevertexai.googleapis.com.`;
    }

    return {
      ok: false,
      requestedMode: mode,
      source: 'error',
      model: cloudModel,
      latencyMs,
      error: message,
      remediation,
    };
  }
}

function buildLocalDeterministicReply(
  role: string,
  prompt: string,
  contextData: Record<string, unknown> = {}
): string {
  const q = prompt.toLowerCase().trim();
  const businessName =
    typeof contextData.businessName === 'string' && contextData.businessName.trim()
      ? contextData.businessName.trim()
      : 'BUNKKER E.C.O.S.';
  const products = Array.isArray(contextData.products) ? contextData.products : [];

  const matched = products.filter((p: any) => {
    if (!p?.name) return false;
    const words = String(p.name).toLowerCase().split(/\s+/);
    return words.some((w) => w.length > 2 && q.includes(w));
  });

  if (matched.length > 0) {
    if (q.includes('precio') || q.includes('cuanto') || q.includes('cuesta')) {
      return `Precios en ${businessName}:\n${matched
        .slice(0, 5)
        .map(
          (p: any) =>
            `• **${p.name}**: $${Number(p.price || 0).toLocaleString('es-MX', {
              minimumFractionDigits: 2,
            })} MXN (Stock: ${p.stock ?? 'N/A'})`
        )
        .join('\n')}`;
    }

    return `Existencias actuales en ${businessName}:\n${matched
      .slice(0, 5)
      .map(
        (p: any) =>
          `• **${p.name}**: ${p.stock ?? 0} pzas${p.location ? ` (${p.location})` : ''}`
      )
      .join('\n')}`;
  }

  if (q.includes('alerta') || q.includes('bajo') || q.includes('agotad') || q.includes('stock')) {
    const low = products.filter((p: any) => typeof p?.stock === 'number' && p.stock < 5);
    if (low.length === 0) {
      return `Inventario saludable en ${businessName}: sin productos críticos por debajo de 5 unidades.`;
    }
    return `Alertas de inventario bajo en ${businessName}:\n${low
      .slice(0, 6)
      .map((p: any) => `• **${p.name}**: ${p.stock} pzas`)
      .join('\n')}`;
  }

  if (role === 'superadmin' || role === 'admin' || role === 'owner') {
    return `Modo local activo en ${businessName}. Catálogo cargado con ${products.length} productos. Puedo revisar existencias, precios o alertas operativas sin conexión a internet.`;
  }

  return `Asistente local de ${businessName} listo. Pregunta por precios, disponibilidad o artículos del catálogo.`;
}

function formatHistoryPrompt(
  prompt: string,
  history?: Array<{ role: string; content: string }>
): string {
  const trimmedHistory = Array.isArray(history) ? history.slice(-6) : [];
  if (trimmedHistory.length === 0) return prompt;

  const lines = trimmedHistory
    .filter((m) => typeof m.content === 'string' && m.content.trim().length > 0)
    .map((m) => `${m.role === 'user' ? 'Usuario' : 'LION'}: ${m.content.trim()}`);

  lines.push(`Usuario: ${prompt}`);
  return lines.join('\n');
}

export async function runHybridFirebaseInference(
  request: HybridInferenceRequest
): Promise<HybridInferenceResponse> {
  const startedAt = Date.now();
  const role = String(request.role || 'customer').toLowerCase();
  const contextData = request.contextData || {};
  const capabilities = detectFirebaseAiCapabilities();
  const systemInstruction =
    request.systemInstruction?.trim() ||
    buildBunkkerRoleSystemInstruction(role, contextData);
  const cloudModel = request.cloudModel?.trim() || DEFAULT_FIREBASE_CLOUD_MODEL;
  const requestedMode = request.inferenceMode || InferenceMode.PREFER_ON_DEVICE;
  const taskKind: HybridTaskKind = request.taskKind || 'chat';
  const routingReason =
    request.routingReason ||
    (requestedMode === InferenceMode.PREFER_IN_CLOUD
      ? 'Documento extenso o análisis profundo en nube'
      : 'Inferencia rápida On-Device primero con respaldo en nube');

  let firebaseFallbackReason: string | undefined;

  // 1. Firebase AI Logic (PREFER_ON_DEVICE / PREFER_IN_CLOUD -> Gemini Nano local o Firebase AI Cloud)
  if (
    capabilities.hasFirebaseCredentials &&
    (capabilities.hasOnDevicePromptApi || capabilities.isOnline)
  ) {
    try {
      const model = getHybridFirebaseModel({
        systemInstruction,
        cloudModel,
        mode: requestedMode,
      });
      if (model) {
        const promptInput = formatHistoryPrompt(request.prompt, request.history);
        const result = await model.generateContent(promptInput);
        const text = result?.response?.text?.()?.trim();
        if (text) {
          const isOnDevice =
            result.response.inferenceSource === InferenceSource.ON_DEVICE;
          const source: FirebaseAiEngineSource = isOnDevice ? 'on_device' : 'in_cloud';
          const modelName = isOnDevice ? 'gemini-nano-on-device' : cloudModel;
          const latencyMs = Date.now() - startedAt;
          recordHybridExecution({
            task: taskKind,
            requestedMode,
            source,
            model: modelName,
            latencyMs,
            routingReason,
          });
          return {
            text,
            source,
            model: modelName,
            latencyMs,
            requestedMode,
            routingReason,
          };
        }
      }
    } catch (err: unknown) {
      firebaseFallbackReason =
        err instanceof Error ? err.message : 'Firebase AI Logic no disponible';
    }
  } else {
    firebaseFallbackReason = !capabilities.hasFirebaseCredentials
      ? 'Credenciales Firebase no configuradas'
      : 'Sin conexión ni modelo On-Device';
  }

  // 2. Fallback a ruta de servidor (/api/ai/chat con gemini-4-hydrogen / motor local)
  if (request.serverFallbackFetcher && capabilities.isOnline) {
    try {
      const messages = [
        ...(Array.isArray(request.history) ? request.history : []),
        { role: 'user', content: request.prompt },
      ];
      const serverData = await request.serverFallbackFetcher({
        messages,
        contextData,
        role,
      });
      if (serverData?.reply && serverData.reply.trim()) {
        const isServerGemini =
          serverData.engine && serverData.engine !== 'bunkker-local-engine';
        const source: FirebaseAiEngineSource = isServerGemini
          ? 'server_gemini'
          : 'local_rule_engine';
        const modelName = serverData.engine || 'bunkker-local-engine';
        const latencyMs = Date.now() - startedAt;
        recordHybridExecution({
          task: taskKind,
          requestedMode,
          source,
          model: modelName,
          latencyMs,
          routingReason,
          fallbackReason: firebaseFallbackReason,
        });
        return {
          text: serverData.reply.trim(),
          source,
          model: modelName,
          latencyMs,
          requestedMode,
          routingReason,
          fallbackReason: firebaseFallbackReason,
        };
      }
    } catch (serverErr: unknown) {
      firebaseFallbackReason =
        serverErr instanceof Error ? serverErr.message : firebaseFallbackReason;
    }
  }

  // 3. Motor determinístico local sin red (0 ms)
  const latencyMs = Date.now() - startedAt;
  recordHybridExecution({
    task: taskKind,
    requestedMode,
    source: 'local_rule_engine',
    model: 'bunkker-local-engine',
    latencyMs,
    routingReason,
    fallbackReason: firebaseFallbackReason,
  });
  return {
    text: buildLocalDeterministicReply(role, request.prompt, contextData),
    source: 'local_rule_engine',
    model: 'bunkker-local-engine',
    latencyMs,
    requestedMode,
    routingReason,
    fallbackReason: firebaseFallbackReason,
  };
}

export interface HybridOperationalSummaryInput {
  scope: 'inventory_brief' | 'sales_cut' | 'audit_deep';
  businessName: string;
  products?: Array<{ name: string; stock?: number; price?: number; category?: string }>;
  orders?: Array<{ id?: string; total?: number; status?: string; date?: string }>;
  auditCount?: number;
}

export async function runHybridOperationalSummary(
  input: HybridOperationalSummaryInput
): Promise<HybridInferenceResponse> {
  const products = input.products || [];
  const orders = input.orders || [];
  const lowStock = products.filter((p) => Number(p.stock ?? 0) < 5);
  const totalInventoryValue = products.reduce(
    (sum, p) => sum + Number(p.price || 0) * Math.max(0, Number(p.stock || 0)),
    0
  );
  const totalSales = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);

  // Regla híbrida explícita: cortes rápidos y alertas offline -> PREFER_ON_DEVICE;
  // análisis extensos de auditoría o catálogos grandes (>25 registros auditables) -> PREFER_IN_CLOUD.
  const isHeavyAudit =
    input.scope === 'audit_deep' || (input.auditCount ?? 0) > 25 || orders.length > 40;
  const inferenceMode = isHeavyAudit
    ? InferenceMode.PREFER_IN_CLOUD
    : InferenceMode.PREFER_ON_DEVICE;
  const routingReason = isHeavyAudit
    ? 'Análisis extenso multi-registro dirigido primero a Cloud (fallback local si no hay red)'
    : 'Resumen operativo rápido ejecutado On-Device primero (privado y sin costo)';

  const prompt =
    input.scope === 'inventory_brief'
      ? `Genera un resumen ejecutivo breve de almacén para ${input.businessName}. Productos totales: ${products.length}. Stock bajo (<5 pzas): ${lowStock.length} (${lowStock.slice(0, 6).map((p) => `${p.name}:${p.stock ?? 0}`).join(', ') || 'ninguno'}). Valor estimado de inventario: $${totalInventoryValue.toFixed(2)} MXN. Da 3 acciones concretas.`
      : input.scope === 'sales_cut'
        ? `Resume el corte operativo de ${input.businessName}. Órdenes registradas: ${orders.length}. Monto acumulado: $${totalSales.toFixed(2)} MXN. Productos en catálogo: ${products.length}. Da 3 puntos de control para cierre de caja.`
        : `Analiza la postura de control y auditoría para ${input.businessName}. Registros de auditoría: ${input.auditCount ?? orders.length}. Pedidos: ${orders.length} por $${totalSales.toFixed(2)} MXN. Productos con stock crítico: ${lowStock.length}. Emite recomendaciones de control interno.`;

  const res = await runHybridFirebaseInference({
    prompt,
    role: 'superadmin',
    inferenceMode,
    taskKind: input.scope === 'audit_deep' ? 'audit_report' : 'inventory_summary',
    routingReason,
    contextData: {
      businessName: input.businessName,
      ordersCount: orders.length,
      products: products.slice(0, 12),
    },
    serverFallbackFetcher:
      typeof fetch === 'function'
        ? async (payload) => {
            const r = await fetch('/api/ai/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify(payload),
            });
            if (!r.ok) return null;
            return r.json();
          }
        : undefined,
  });

  if (res.source === 'local_rule_engine') {
    const deterministicSummary =
      input.scope === 'inventory_brief'
        ? `Resumen Local de Almacén (${input.businessName}):\n• Catálogo activo: ${products.length} productos (valor aprox. $${totalInventoryValue.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN).\n• Alertas críticas (<5 pzas): ${lowStock.length}${lowStock.length > 0 ? ` → ${lowStock.slice(0, 4).map((p) => `${p.name} (${p.stock ?? 0})`).join(', ')}` : ' — Sin críticos'}.\n• Acción sugerida: Reabastecer artículos críticos y validar conteo físico.`
        : `Resumen Local Operativo (${input.businessName}):\n• Órdenes analizadas: ${orders.length} por $${totalSales.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN.\n• Productos críticos: ${lowStock.length}.\n• Acción sugerida: Verificar firmas de entrega PoD y conciliación SHA-256 antes del cierre.`;
    return {
      ...res,
      text: deterministicSummary,
    };
  }

  return res;
}

export interface HybridProductClassificationResult {
  category: string;
  subcategory: string;
  material: string;
  measure: string;
  confidence: number;
  source: FirebaseAiEngineSource;
  model: string;
  latencyMs: number;
}

export async function runHybridProductClassification(
  productName: string
): Promise<HybridProductClassificationResult> {
  const startedAt = Date.now();
  const cleanName = productName.trim();
  const caps = detectFirebaseAiCapabilities();

  // 1. Firebase AI Logic PREFER_ON_DEVICE (On-Device Gemini Nano o Cloud)
  if (
    cleanName &&
    caps.hasFirebaseCredentials &&
    (caps.hasOnDevicePromptApi || caps.isOnline)
  ) {
    try {
      const model = getHybridFirebaseModel({
        mode: InferenceMode.PREFER_ON_DEVICE,
        systemInstruction:
          'Clasifica productos ferreteros o comerciales en español. Devuelve SOLO JSON válido con las llaves: category, subcategory, material, measure, confidence (0 a 1).',
      });
      if (model) {
        const result = await model.generateContent(
          `Clasifica el producto: "${cleanName}". Responde únicamente JSON.`
        );
        const raw = result?.response?.text?.()?.trim() || '';
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]) as Partial<HybridProductClassificationResult>;
          if (parsed.category) {
            const isOnDevice =
              result.response.inferenceSource === InferenceSource.ON_DEVICE;
            const source: FirebaseAiEngineSource = isOnDevice ? 'on_device' : 'in_cloud';
            const modelName = isOnDevice
              ? 'gemini-nano-on-device'
              : DEFAULT_FIREBASE_CLOUD_MODEL;
            const latencyMs = Date.now() - startedAt;
            recordHybridExecution({
              task: 'product_classification',
              requestedMode: InferenceMode.PREFER_ON_DEVICE,
              source,
              model: modelName,
              latencyMs,
              routingReason: 'Autoclasificación rápida de producto en almacén',
            });
            return {
              category: String(parsed.category || 'General'),
              subcategory: String(parsed.subcategory || 'General'),
              material: String(parsed.material || 'Estándar'),
              measure: String(parsed.measure || 'Estándar'),
              confidence: Number(parsed.confidence || 0.85),
              source,
              model: modelName,
              latencyMs,
            };
          }
        }
      }
    } catch {
      // Fall through to server / local classifier
    }
  }

  // 2. Fallback servidor (/api/ai/classify-product)
  if (typeof fetch === 'function' && caps.isOnline) {
    try {
      const res = await fetch('/api/ai/classify-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: cleanName }),
      });
      if (res.ok) {
        const json = await res.json();
        const isServerGemini = json.source === 'gemini_server';
        const source: FirebaseAiEngineSource = isServerGemini
          ? 'server_gemini'
          : 'local_rule_engine';
        const modelName = isServerGemini ? 'gemini-4-hydrogen' : 'bunkker-classifier-local';
        const latencyMs = Date.now() - startedAt;
        recordHybridExecution({
          task: 'product_classification',
          requestedMode: InferenceMode.PREFER_ON_DEVICE,
          source,
          model: modelName,
          latencyMs,
          routingReason: 'Respaldo servidor de clasificación',
        });
        return {
          category: String(json.category || 'General'),
          subcategory: String(json.subcategory || 'General'),
          material: String(json.material || 'Estándar'),
          measure: String(json.measure || 'Estándar'),
          confidence: Number(json.confidence || 0.75),
          source,
          model: modelName,
          latencyMs,
        };
      }
    } catch {}
  }

  // 3. Clasificador heurístico local sin red
  const lower = cleanName.toLowerCase();
  let category = 'General';
  if (/cemento|varilla|arena|grava|tabique|block|mortero|yeso/.test(lower)) {
    category = 'Materiales de Construcción';
  } else if (/taladro|martillo|pinza|desarmador|llave|sierra|pulidora/.test(lower)) {
    category = 'Herramientas';
  } else if (/tubo|pvc|codo|valvula|llave de paso|tinaco|grifo/.test(lower)) {
    category = 'Plomería';
  } else if (/cable|apagador|contacto|foco|breaker|pastilla|lampara/.test(lower)) {
    category = 'Electricidad';
  } else if (/pintura|brocha|rodillo|impermeabilizante|sellador|esmalte/.test(lower)) {
    category = 'Pinturas y Acabados';
  }

  const latencyMs = Date.now() - startedAt;
  recordHybridExecution({
    task: 'product_classification',
    requestedMode: InferenceMode.PREFER_ON_DEVICE,
    source: 'local_rule_engine',
    model: 'bunkker-local-engine',
    latencyMs,
    routingReason: 'Clasificación determinística offline',
  });

  return {
    category,
    subcategory: 'Estándar',
    material: 'No especificado',
    measure: 'Estándar',
    confidence: category === 'General' ? 0.55 : 0.82,
    source: 'local_rule_engine',
    model: 'bunkker-local-engine',
    latencyMs,
  };
}

