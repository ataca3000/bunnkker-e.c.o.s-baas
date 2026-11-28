'use client';

import { useState, useRef, useEffect } from 'react';
import { HelpCircle, X, Info, AlertTriangle } from 'lucide-react';
import { getConfigHelpEntry, type ConfigHelpEntry } from '@/lib/configHelpCatalog';

interface ConfigHelpButtonProps {
  settingKey: string;
  customEntry?: Partial<ConfigHelpEntry>;
  align?: 'left' | 'right';
}

const RISK_LABELS: Record<'bajo' | 'medio' | 'alto', { label: string; toneClass: string }> = {
  bajo: { label: 'Riesgo bajo · Reversible al instante', toneClass: 'text-emerald-300' },
  medio: { label: 'Riesgo medio · Revisa antes de guardar', toneClass: 'text-amber-300' },
  alto: { label: 'Riesgo alto · Cambia arquitectura multi-sucursal', toneClass: 'text-rose-300' },
};

export default function ConfigHelpButton({
  settingKey,
  customEntry,
  align = 'right',
}: ConfigHelpButtonProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const base = getConfigHelpEntry(settingKey);
  const entry: ConfigHelpEntry | null = base
    ? { ...base, ...customEntry }
    : customEntry?.title
      ? {
          key: settingKey,
          title: customEntry.title,
          whatItDoes: customEntry.whatItDoes || '',
          whoItAffects: customEntry.whoItAffects || 'Sistema general.',
          riskLevel: customEntry.riskLevel || 'bajo',
          tip: customEntry.tip || '',
        }
      : null;

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  if (!entry) return null;

  const riskMeta = RISK_LABELS[entry.riskLevel];

  return (
    <div ref={containerRef} className="relative inline-flex items-center shrink-0">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        aria-expanded={open}
        aria-label={`Ayuda sobre ${entry.title}`}
        title={`¿Qué hace "${entry.title}"?`}
        className="min-w-[32px] min-h-[32px] w-8 h-8 rounded-lg border border-slate-700/80 bg-slate-900/90 text-slate-300 hover:border-cyan-400/60 hover:text-cyan-300 flex items-center justify-center transition-colors cursor-pointer"
      >
        <HelpCircle size={15} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={`Explicación: ${entry.title}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className={`absolute top-full mt-2 z-[900] w-72 sm:w-80 rounded-xl border border-slate-700 bg-slate-950 p-3.5 text-left shadow-2xl ${
            align === 'left' ? 'left-0' : 'right-0'
          }`}
        >
          <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2 min-w-0">
              <Info size={14} className="text-cyan-400 shrink-0" aria-hidden="true" />
              <span className="text-xs font-bold text-slate-100 leading-snug">{entry.title}</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar ayuda"
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer shrink-0"
            >
              <X size={13} aria-hidden="true" />
            </button>
          </div>

          <div className="mt-2.5 space-y-2 text-[11px] leading-relaxed">
            <div>
              <span className="font-semibold text-slate-400 block">¿Qué hace?</span>
              <p className="text-slate-200 mt-0.5">{entry.whatItDoes}</p>
            </div>
            <div>
              <span className="font-semibold text-slate-400 block">¿A quién afecta?</span>
              <p className="text-slate-300 mt-0.5">{entry.whoItAffects}</p>
            </div>
            <div className="pt-1.5 border-t border-slate-800/80 flex items-center gap-1.5">
              {entry.riskLevel !== 'bajo' && (
                <AlertTriangle size={12} className="text-amber-300 shrink-0" aria-hidden="true" />
              )}
              <span className={`font-semibold ${riskMeta.toneClass}`}>{riskMeta.label}</span>
            </div>
            {entry.tip && (
              <p className="text-cyan-300/90 bg-cyan-950/30 border border-cyan-500/20 rounded-lg px-2.5 py-1.5">
                {entry.tip}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
