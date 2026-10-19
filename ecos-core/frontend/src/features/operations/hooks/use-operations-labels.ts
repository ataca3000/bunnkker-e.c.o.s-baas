import { useTranslation } from 'react-i18next';

import type { WaveStatus } from '../types/preparation';

// ── Static style map (not i18n-dependent) ─────────────────────────────────────
// Canonical source — both WavePicker and WaveSettingsPage must import from here.

export const WAVE_STATUS_COLORS: Record<WaveStatus, string> = {
  draft:            'bg-gray-100 text-gray-700',
  collecting:       'bg-cyan-100 text-cyan-700',
  planning:         'bg-blue-100 text-blue-700',
  shortage_blocked: 'bg-amber-100 text-amber-700',
  preparing:        'bg-purple-100 text-purple-700',
  completed:        'bg-green-100 text-green-700',
  closed:           'bg-slate-100 text-slate-600',
  cancelled:        'bg-red-100 text-red-700',
};

// ── Wave status labels ─────────────────────────────────────────────────────────
// Single source of truth — all wave status badges, pickers, and settings pages
// must consume this hook. Do NOT define STATUS_LABELS locally in components.

export function useWaveStatusLabels() {
  const { t } = useTranslation('operations');

  const waveStatusLabel: Record<WaveStatus, string> = {
    draft:            t($ => $.wave.status.draft),
    collecting:       t($ => $.wave.status.collecting),
    planning:         t($ => $.wave.status.planning),
    shortage_blocked: t($ => $.wave.status.shortage_blocked),
    preparing:        t($ => $.wave.status.preparing),
    completed:        t($ => $.wave.status.completed),
    closed:           t($ => $.wave.status.closed),
    cancelled:        t($ => $.wave.status.cancelled),
  };

  return { waveStatusLabel };
}
