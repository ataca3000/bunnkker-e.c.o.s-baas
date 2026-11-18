export const FIREBASE_HOSTING_REGIONS = [
  { id: 'us-central1', label: 'Iowa (us-central1 · Recomendada)' },
  { id: 'us-east1', label: 'Carolina del Sur (us-east1)' },
  { id: 'us-west1', label: 'Oregón (us-west1)' },
  { id: 'southamerica-east1', label: 'São Paulo (southamerica-east1)' },
  { id: 'europe-west1', label: 'Bélgica (europe-west1)' },
] as const;

export type FirebaseHostingRegion = (typeof FIREBASE_HOSTING_REGIONS)[number]['id'];

const PROJECT_ID_REGEX = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;
const ALLOWED_REGIONS = new Set<string>(FIREBASE_HOSTING_REGIONS.map((r) => r.id));

export function sanitizeFirebaseProjectId(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
}

export function isValidFirebaseProjectId(projectId: unknown): projectId is string {
  return typeof projectId === 'string' && PROJECT_ID_REGEX.test(projectId) && !projectId.includes('--');
}

export function normalizeFirebaseHostingRegion(region: unknown): FirebaseHostingRegion {
  if (typeof region === 'string' && ALLOWED_REGIONS.has(region)) {
    return region as FirebaseHostingRegion;
  }
  return 'us-central1';
}

export function buildFirebaseRcJson(projectId: string): string {
  if (!isValidFirebaseProjectId(projectId)) {
    throw new Error('Project ID de Firebase inválido (6 a 30 caracteres: minúsculas, números y guiones).');
  }
  return JSON.stringify(
    {
      projects: {
        default: projectId,
      },
    },
    null,
    2
  ) + '\n';
}

export function buildFirebaseHostingConfigObject(region: FirebaseHostingRegion = 'us-central1') {
  return {
    hosting: {
      source: '.',
      ignore: [
        'firebase.json',
        '**/.*',
        '**/node_modules/**',
        'build/**',
        'dist-build-win/**',
        'prisma/*.db*',
        'bunkker.backup.json',
        '*.log',
      ],
      frameworksBackend: {
        region,
        minInstances: 0,
        maxInstances: 3,
        memory: '1GiB',
      },
      headers: [
        {
          source: '/sw.js',
          headers: [
            { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
            { key: 'Service-Worker-Allowed', value: '/' },
          ],
        },
        {
          source: '/firebase-messaging-sw.js',
          headers: [
            { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
            { key: 'Service-Worker-Allowed', value: '/' },
          ],
        },
        {
          source: '/manifest.json',
          headers: [
            { key: 'Cache-Control', value: 'public, max-age=3600' },
          ],
        },
      ],
    },
  };
}

export function buildFirebaseHostingConfigJson(region: FirebaseHostingRegion = 'us-central1'): string {
  return JSON.stringify(buildFirebaseHostingConfigObject(region), null, 2) + '\n';
}

export function buildAppHostingYaml(): string {
  return [
    '# Configuracion oficial para Firebase App Hosting (Next.js App Router + APIs)',
    'runConfig:',
    '  cpu: 1',
    '  memoryMiB: 1024',
    '  concurrency: 80',
    '  minInstances: 0',
    '  maxInstances: 3',
    '',
    'env:',
    '  - variable: NEXT_PUBLIC_APP_ENV',
    '    value: nube',
    '    availability:',
    '      - BUILD',
    '      - RUNTIME',
    '  - variable: NODE_ENV',
    '    value: production',
    '    availability:',
    '      - RUNTIME',
    '',
  ].join('\n');
}

export function buildFirebaseDeployUrls(projectId: string) {
  const safeId = isValidFirebaseProjectId(projectId) ? projectId : 'tu-proyecto-firebase';
  return {
    primaryUrl: `https://${safeId}.web.app`,
    altUrl: `https://${safeId}.firebaseapp.com`,
    consoleHostingUrl: `https://console.firebase.google.com/project/${safeId}/hosting`,
    consoleAppHostingUrl: `https://console.firebase.google.com/project/${safeId}/apphosting`,
  };
}

export function buildDeployOneClickCommand(projectId: string): string {
  const safeId = isValidFirebaseProjectId(projectId) ? projectId : 'tu-proyecto-firebase';
  return `npm run deploy:firebase -- --project ${safeId}`;
}
