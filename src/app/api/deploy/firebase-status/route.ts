import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { requireRole } from '@/lib/apiAuth';
import {
  buildAppHostingYaml,
  buildDeployOneClickCommand,
  buildFirebaseDeployUrls,
  buildFirebaseHostingConfigJson,
  buildFirebaseRcJson,
  isValidFirebaseProjectId,
  normalizeFirebaseHostingRegion,
  sanitizeFirebaseProjectId,
} from '@/lib/firebaseHosting';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const execFileAsync = promisify(execFile);

function readExistingProjectId(projectRoot: string): string {
  const rcPath = path.join(projectRoot, '.firebaserc');
  if (fs.existsSync(rcPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(rcPath, 'utf8'));
      const def = parsed?.projects?.default;
      if (isValidFirebaseProjectId(def)) return def;
    } catch {
      // Ignorar archivo malformado
    }
  }
  const envId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || '';
  if (isValidFirebaseProjectId(envId) && envId !== 'bunkker-local-app') {
    return envId;
  }
  return '';
}

function readExistingRegion(projectRoot: string) {
  const fbJsonPath = path.join(projectRoot, 'firebase.json');
  if (fs.existsSync(fbJsonPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(fbJsonPath, 'utf8'));
      return normalizeFirebaseHostingRegion(parsed?.hosting?.frameworksBackend?.region);
    } catch {
      // Fallback a región por defecto
    }
  }
  return normalizeFirebaseHostingRegion(undefined);
}

async function detectFirebaseCliVersion(): Promise<{ installed: boolean; version: string | null }> {
  try {
    const { stdout } = await execFileAsync('firebase', ['--version'], { timeout: 3000 });
    return { installed: true, version: stdout.trim() || null };
  } catch {
    return { installed: false, version: null };
  }
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, ['superadmin', 'admin']);
  if (!auth.ok) return auth.response;

  const projectRoot = process.cwd();
  const hasFirebaseJson = fs.existsSync(path.join(projectRoot, 'firebase.json'));
  const hasAppHostingYaml = fs.existsSync(path.join(projectRoot, 'apphosting.yaml'));
  const hasFirebaseRc = fs.existsSync(path.join(projectRoot, '.firebaserc'));
  const projectId = readExistingProjectId(projectRoot);
  const region = readExistingRegion(projectRoot);
  const cli = await detectFirebaseCliVersion();

  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0);
  const hasFirebaseToken = Boolean(process.env.FIREBASE_TOKEN || process.env.GOOGLE_APPLICATION_CREDENTIALS);

  return NextResponse.json({
    success: true,
    data: {
      hasFirebaseJson,
      hasAppHostingYaml,
      hasFirebaseRc,
      projectId,
      region,
      cliInstalled: cli.installed,
      cliVersion: cli.version,
      hasDatabaseUrl,
      hasFirebaseToken,
      urls: projectId ? buildFirebaseDeployUrls(projectId) : null,
      deployCommand: projectId ? buildDeployOneClickCommand(projectId) : 'npm run deploy:firebase -- --project tu-proyecto-firebase',
    },
  });
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, ['superadmin', 'admin']);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const projectId = sanitizeFirebaseProjectId(body?.projectId);
    const region = normalizeFirebaseHostingRegion(body?.region);

    if (!isValidFirebaseProjectId(projectId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'El Project ID debe tener entre 6 y 30 caracteres (solo minúsculas, números y guiones, iniciando con letra).',
        },
        { status: 400 }
      );
    }

    const projectRoot = process.cwd();
    const rcContent = buildFirebaseRcJson(projectId);
    const hostingContent = buildFirebaseHostingConfigJson(region);
    const appHostingContent = buildAppHostingYaml();

    let savedToDisk = false;
    try {
      fs.writeFileSync(path.join(projectRoot, '.firebaserc'), rcContent, 'utf8');
      fs.writeFileSync(path.join(projectRoot, 'firebase.json'), hostingContent, 'utf8');
      if (!fs.existsSync(path.join(projectRoot, 'apphosting.yaml'))) {
        fs.writeFileSync(path.join(projectRoot, 'apphosting.yaml'), appHostingContent, 'utf8');
      }
      savedToDisk = true;
    } catch {
      // En entornos serverless read-only devolvemos igualmente los manifiestos listos para descargar
      savedToDisk = false;
    }

    return NextResponse.json({
      success: true,
      data: {
        projectId,
        region,
        savedToDisk,
        urls: buildFirebaseDeployUrls(projectId),
        deployCommand: buildDeployOneClickCommand(projectId),
        files: {
          firebaserc: rcContent,
          firebaseJson: hostingContent,
          appHostingYaml: appHostingContent,
        },
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error generando configuración de Firebase Hosting.',
      },
      { status: 500 }
    );
  }
}
