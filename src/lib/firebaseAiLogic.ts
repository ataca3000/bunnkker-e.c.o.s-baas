import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
  InferenceSource,
  type GenerativeModel,
  type HybridParams,
} from 'firebase/ai';
import { app, hasRealCredentials } from '@/lib/firebase';

export type FirebaseAiEngineSource =
  | 'on_device'
  | 'in_cloud'
  | 'server_gemini'
  | 'local_rule_engine';

export interface FirebaseAiCapabilities {
  hasFirebaseCredentials: boolean;
  isBrowser: boolean;
  isOnline: boolean;
  hasOnDevicePromptApi: boolean;
  preferredMode: typeof InferenceMode.PREFER_ON_DEVICE;
}

export interface HybridInferenceRequest {
  prompt: string;
  history?: Array<{ role: string; content: string }>;
  role?: string;
  contextData?: Record<string, unknown>;
  systemInstruction?: string;
  cloudModel?: string;
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
  fallbackReason?: string;
}

export const DEFAULT_FIREBASE_CLOUD_MODEL = 'gemini-2.5-flash';

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
}): HybridParams {
  const instruction = options?.systemInstruction?.trim();
  const cloudModel = options?.cloudModel?.trim() || DEFAULT_FIREBASE_CLOUD_MODEL;

  return {
    mode: InferenceMode.PREFER_ON_DEVICE,
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

let cachedFirebaseAiModelKey = '';
let cachedFirebaseAiModel: GenerativeModel | null = null;

export function getHybridFirebaseModel(options?: {
  systemInstruction?: string;
  cloudModel?: string;
}): GenerativeModel | null {
  if (!hasRealCredentials) return null;

  const instruction = options?.systemInstruction?.trim() || '';
  const cloudModel = options?.cloudModel?.trim() || DEFAULT_FIREBASE_CLOUD_MODEL;
  const cacheKey = `${cloudModel}::${instruction}`;

  if (cachedFirebaseAiModel && cachedFirebaseAiModelKey === cacheKey) {
    return cachedFirebaseAiModel;
  }

  const ai = getAI(app, { backend: new GoogleAIBackend() });
  const params = buildHybridModelParams({
    systemInstruction: instruction || undefined,
    cloudModel,
  });

  cachedFirebaseAiModel = getGenerativeModel(ai, params);
  cachedFirebaseAiModelKey = cacheKey;
  return cachedFirebaseAiModel;
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

  let firebaseFallbackReason: string | undefined;

  // 1. Firebase AI Logic (PREFER_ON_DEVICE -> Gemini Nano local o Firebase AI Cloud)
  if (
    capabilities.hasFirebaseCredentials &&
    (capabilities.hasOnDevicePromptApi || capabilities.isOnline)
  ) {
    try {
      const model = getHybridFirebaseModel({
        systemInstruction,
        cloudModel,
      });
      if (model) {
        const promptInput = formatHistoryPrompt(request.prompt, request.history);
        const result = await model.generateContent(promptInput);
        const text = result?.response?.text?.()?.trim();
        if (text) {
          const isOnDevice =
            result.response.inferenceSource === InferenceSource.ON_DEVICE;
          return {
            text,
            source: isOnDevice ? 'on_device' : 'in_cloud',
            model: isOnDevice ? 'gemini-nano-on-device' : cloudModel,
            latencyMs: Date.now() - startedAt,
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
        return {
          text: serverData.reply.trim(),
          source: isServerGemini ? 'server_gemini' : 'local_rule_engine',
          model: serverData.engine || 'bunkker-local-engine',
          latencyMs: Date.now() - startedAt,
          fallbackReason: firebaseFallbackReason,
        };
      }
    } catch (serverErr: unknown) {
      firebaseFallbackReason =
        serverErr instanceof Error ? serverErr.message : firebaseFallbackReason;
    }
  }

  // 3. Motor determinístico local sin red (0 ms)
  return {
    text: buildLocalDeterministicReply(role, request.prompt, contextData),
    source: 'local_rule_engine',
    model: 'bunkker-local-engine',
    latencyMs: Date.now() - startedAt,
    fallbackReason: firebaseFallbackReason,
  };
}
