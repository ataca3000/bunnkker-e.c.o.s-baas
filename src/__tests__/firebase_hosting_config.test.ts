import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildAppHostingYaml,
  buildDeployOneClickCommand,
  buildFirebaseDeployUrls,
  buildFirebaseHostingConfigObject,
  buildFirebaseRcJson,
  isValidFirebaseProjectId,
  normalizeFirebaseHostingRegion,
  sanitizeFirebaseProjectId,
} from '@/lib/firebaseHosting';

describe('Firebase Hosting & App Hosting deployment configuration', () => {
  it('validates and sanitizes Firebase project IDs safely', () => {
    expect(sanitizeFirebaseProjectId('  Mi-Tienda-ECOS_01 ')).toBe('mi-tienda-ecos-01');
    expect(isValidFirebaseProjectId('mi-tienda-ecos-01')).toBe(true);
    expect(isValidFirebaseProjectId('abc')).toBe(false);
    expect(isValidFirebaseProjectId('123-invalid-start')).toBe(false);
    expect(isValidFirebaseProjectId('bad--double-dash')).toBe(false);
    expect(isValidFirebaseProjectId('../traversal')).toBe(false);
  });

  it('builds valid .firebaserc, firebase.json, apphosting.yaml, URLs, and 1-command CLI instruction', () => {
    const rc = JSON.parse(buildFirebaseRcJson('bunkker-tienda-mx'));
    expect(rc).toEqual({ projects: { default: 'bunkker-tienda-mx' } });

    const region = normalizeFirebaseHostingRegion('southamerica-east1');
    const cfg = buildFirebaseHostingConfigObject(region);
    expect(cfg.hosting.source).toBe('.');
    expect(cfg.hosting.frameworksBackend.region).toBe('southamerica-east1');
    expect(cfg.hosting.headers.some((h) => h.source === '/sw.js')).toBe(true);

    const yaml = buildAppHostingYaml();
    expect(yaml).toContain('NEXT_PUBLIC_APP_ENV');
    expect(yaml).toContain('memoryMiB: 1024');

    const urls = buildFirebaseDeployUrls('bunkker-tienda-mx');
    expect(urls.primaryUrl).toBe('https://bunkker-tienda-mx.web.app');
    expect(urls.altUrl).toBe('https://bunkker-tienda-mx.firebaseapp.com');
    expect(buildDeployOneClickCommand('bunkker-tienda-mx')).toBe(
      'npm run deploy:firebase -- --project bunkker-tienda-mx'
    );
  });

  it('has valid firebase.json, apphosting.yaml, and .firebaserc.example manifests at repo root', () => {
    const root = process.cwd();
    const firebaseJsonRaw = fs.readFileSync(path.join(root, 'firebase.json'), 'utf8');
    const firebaseJson = JSON.parse(firebaseJsonRaw);
    expect(firebaseJson.hosting.source).toBe('.');
    expect(firebaseJson.hosting.frameworksBackend.region).toBe('us-central1');
    expect(firebaseJson.hosting.ignore).toContain('prisma/*.db*');

    const apphostingRaw = fs.readFileSync(path.join(root, 'apphosting.yaml'), 'utf8');
    expect(apphostingRaw).toContain('runConfig:');

    const exampleRcRaw = fs.readFileSync(path.join(root, '.firebaserc.example'), 'utf8');
    const exampleRc = JSON.parse(exampleRcRaw);
    expect(exampleRc.projects.default).toBe('tu-proyecto-firebase');
  });
});
