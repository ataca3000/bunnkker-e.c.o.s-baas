#!/usr/bin/env bash
# NAME: Translation Validator
# Checks i18n consistency across all namespaces:
#   - Missing namespace files (EN or AR)
#   - Missing translation keys within a namespace
#   - Empty translation values
#   - Namespace registered but no locale files exist
set -euo pipefail

PROJECT_ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
LOCALES="$PROJECT_ROOT/frontend/src/i18n/locales"
NS_FILE="$PROJECT_ROOT/frontend/src/i18n/namespaces.ts"

source "$(dirname "${BASH_SOURCE[0]}")/../lib/emit.sh"

if ! command -v node &>/dev/null; then
  echo "node not in PATH" >&2
  exit 2
fi

if [[ ! -f "$NS_FILE" ]]; then
  echo "namespaces.ts not found at $NS_FILE" >&2
  exit 2
fi

node -e "
const fs   = require('fs');
const path = require('path');

const LOCALES = process.argv[1];
const NS_FILE = process.argv[2];

// ── Extract namespace list from namespaces.ts ─────────────────────────────────
const nsSource = fs.readFileSync(NS_FILE, 'utf8');
const namespaces = [];
const re = /'([a-z][a-z0-9-]*)'/g;
let m;
while ((m = re.exec(nsSource)) !== null) namespaces.push(m[1]);

// ── Flatten nested JSON to dot-path keys ──────────────────────────────────────
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? prefix + '.' + k : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      flatten(v, key, out);
    } else {
      out[key] = v;
    }
  }
  return out;
}

function emit(sev, cat, file, line, expl, fix) {
  const clean = s => String(s).replace(/\t/g, ' ');
  process.stdout.write(
    'FINDING\t' + sev + '\t' + cat + '\t' + file + '\t' + line + '\t' +
    clean(expl) + '\t' + clean(fix) + '\n'
  );
}

// ── Check each namespace ───────────────────────────────────────────────────────
for (const ns of namespaces) {
  const enPath = path.join(LOCALES, 'en', ns + '.json');
  const arPath = path.join(LOCALES, 'ar', ns + '.json');

  const enExists = fs.existsSync(enPath);
  const arExists = fs.existsSync(arPath);

  if (!enExists && !arExists) {
    emit('HIGH', 'missing-translation',
      'frontend/src/i18n/locales/{en,ar}/' + ns + '.json', 0,
      'Namespace \"' + ns + '\" is registered in namespaces.ts but has no locale files',
      'Create frontend/src/i18n/locales/en/' + ns + '.json and ar/' + ns + '.json'
    );
    continue;
  }

  if (!enExists) {
    emit('CRITICAL', 'missing-translation',
      'frontend/src/i18n/locales/en/' + ns + '.json', 0,
      'Missing English (source) locale file for namespace \"' + ns + '\"',
      'Create frontend/src/i18n/locales/en/' + ns + '.json — it is the translation source'
    );
    continue;
  }

  if (!arExists) {
    emit('HIGH', 'missing-translation',
      'frontend/src/i18n/locales/ar/' + ns + '.json', 0,
      'Missing Arabic locale file for namespace \"' + ns + '\"',
      'Create frontend/src/i18n/locales/ar/' + ns + '.json with all keys from the EN file'
    );
    continue;
  }

  let enJson, arJson;
  try { enJson = JSON.parse(fs.readFileSync(enPath, 'utf8')); } catch(e) {
    emit('CRITICAL', 'invalid-json', 'frontend/src/i18n/locales/en/' + ns + '.json', 0,
      'Invalid JSON: ' + e.message, 'Fix the JSON syntax error');
    continue;
  }
  try { arJson = JSON.parse(fs.readFileSync(arPath, 'utf8')); } catch(e) {
    emit('CRITICAL', 'invalid-json', 'frontend/src/i18n/locales/ar/' + ns + '.json', 0,
      'Invalid JSON: ' + e.message, 'Fix the JSON syntax error');
    continue;
  }

  const enKeys = flatten(enJson);
  const arKeys = flatten(arJson);

  // Keys in EN missing from AR
  const missingInAr = Object.keys(enKeys).filter(k => !(k in arKeys));
  if (missingInAr.length > 0) {
    const sample = missingInAr.slice(0, 5).join(', ');
    const more   = missingInAr.length > 5 ? ' (+' + (missingInAr.length - 5) + ' more)' : '';
    emit('HIGH', 'missing-translation',
      'frontend/src/i18n/locales/ar/' + ns + '.json', 0,
      missingInAr.length + ' key(s) missing in AR for namespace \"' + ns + '\": ' + sample + more,
      'Add missing keys to ar/' + ns + '.json — translate from the EN values'
    );
  }

  // Keys in AR missing from EN (orphaned)
  const orphanedInAr = Object.keys(arKeys).filter(k => !(k in enKeys));
  if (orphanedInAr.length > 0) {
    const sample = orphanedInAr.slice(0, 3).join(', ');
    emit('LOW', 'orphaned-translation',
      'frontend/src/i18n/locales/ar/' + ns + '.json', 0,
      orphanedInAr.length + ' key(s) exist in AR but not EN for \"' + ns + '\": ' + sample,
      'Remove orphaned AR keys or add the corresponding EN keys if they were missed'
    );
  }

  // Empty string values in EN (untranslated placeholders)
  const emptyEn = Object.entries(enKeys).filter(([,v]) => v === '');
  if (emptyEn.length > 0) {
    const sample = emptyEn.slice(0, 3).map(([k]) => k).join(', ');
    emit('MEDIUM', 'empty-translation',
      'frontend/src/i18n/locales/en/' + ns + '.json', 0,
      emptyEn.length + ' empty string value(s) in EN for \"' + ns + '\": ' + sample,
      'Fill in the empty translation values in en/' + ns + '.json'
    );
  }

  // Empty string values in AR
  const emptyAr = Object.entries(arKeys).filter(([,v]) => v === '');
  if (emptyAr.length > 0) {
    const sample = emptyAr.slice(0, 3).map(([k]) => k).join(', ');
    emit('MEDIUM', 'empty-translation',
      'frontend/src/i18n/locales/ar/' + ns + '.json', 0,
      emptyAr.length + ' empty string value(s) in AR for \"' + ns + '\": ' + sample,
      'Provide Arabic translations for the empty keys in ar/' + ns + '.json'
    );
  }
}

// ── Check for locale files not in NAMESPACES ──────────────────────────────────
const nsSet = new Set(namespaces);
for (const lang of ['en', 'ar']) {
  const langDir = path.join(LOCALES, lang);
  if (!fs.existsSync(langDir)) continue;
  for (const file of fs.readdirSync(langDir)) {
    if (!file.endsWith('.json')) continue;
    const ns = file.replace('.json', '');
    if (!nsSet.has(ns)) {
      emit('LOW', 'unregistered-namespace',
        'frontend/src/i18n/locales/' + lang + '/' + file, 0,
        'Locale file \"' + ns + '\" exists but is not registered in namespaces.ts',
        'Add \"' + ns + '\" to the NAMESPACES array in frontend/src/i18n/namespaces.ts, or remove the file'
      );
    }
  }
}
" "$LOCALES" "$NS_FILE"
