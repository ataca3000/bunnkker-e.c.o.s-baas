import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { LoginForm } from '@/features/auth/components/login-form';
import { env } from '@/lib/env';
import type enAuth from '@/i18n/locales/en/auth.json';

/**
 * A label held as an i18next selector rather than a key string.
 *
 * Selector mode has no type for a key chosen at runtime, so a table of key
 * strings can never type-check. The selector is the same expression the
 * compiler validates at an inline call site, kept in the table.
 */
type AuthLabel = ($: typeof enAuth) => string;

// ── Canvas ─────────────────────────────────────────────────────────────────

function CommerceCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let w = 0;
    let h = 0;

    const resize = () => {
      w = canvas.offsetWidth;
      h = canvas.offsetHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const nodes = Array.from({ length: 42 }, (_, i) => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22,
      r: Math.random() * 1.8 + 0.4,
      accent: i < 5,
      phase: Math.random() * Math.PI * 2,
    }));

    let raf = 0;
    let t = 0;
    const maxD = 145;

    const drawFrame = (animate: boolean) => {
      ctx.clearRect(0, 0, w, h);
      if (animate) t += 0.012;

      for (const n of nodes) {
        if (animate) {
          n.x += n.vx;
          n.y += n.vy;
          if (n.x < 0 || n.x > w) n.vx *= -1;
          if (n.y < 0 || n.y > h) n.vy *= -1;
        }
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const d = Math.hypot(dx, dy);
          if (d < maxD) {
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(99,102,241,${(1 - d / maxD) * 0.16})`;
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }
      }

      for (const n of nodes) {
        const pulse = n.accent && animate ? 1 + Math.sin(t * 1.8 + n.phase) * 0.45 : 1;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * pulse, 0, Math.PI * 2);
        if (n.accent) {
          ctx.fillStyle = 'rgba(34,211,238,0.9)';
          ctx.shadowColor = '#22D3EE';
          ctx.shadowBlur = 12;
        } else {
          ctx.fillStyle = 'rgba(148,163,184,0.3)';
          ctx.shadowBlur = 0;
        }
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      if (animate && !prefersReduced) {
        raf = requestAnimationFrame(() => drawFrame(true));
      }
    };

    drawFrame(!prefersReduced);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    />
  );
}

// ── Data ───────────────────────────────────────────────────────────────────

const STAT_VALUES = ['125K+', '99.8%', '24', '12'] as const;
const STAT_KEYS: AuthLabel[] = [
  ($) => $.branding.statsOrders,
  ($) => $.branding.statsAccuracy,
  ($) => $.branding.statsWarehouses,
  ($) => $.branding.statsChannels,
];
const FEATURE_KEYS: AuthLabel[] = [
  ($) => $.branding.featureAI,
  ($) => $.branding.featureInventory,
  ($) => $.branding.featureManufacturing,
  ($) => $.branding.featureLogistics,
  ($) => $.branding.featureCRM,
];

const ENV_BADGE: Record<string, { label: string; bg: string; color: string } | undefined> = {
  development: { label: 'DEV', bg: 'rgba(34,211,238,0.15)', color: '#22D3EE' },
  staging:     { label: 'STAGING', bg: 'rgba(245,158,11,0.15)', color: '#F59E0B' },
};

// ── Branding panel ────────────────────────────────────────────────────────

function BrandingPanel() {
  const { t } = useTranslation('auth');
  return (
    <div
      className="hidden lg:flex"
      style={{
        width: '55%',
        position: 'relative',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Gradient layers */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at 25% 55%, rgba(99,102,241,0.13) 0%, transparent 55%), ' +
            'radial-gradient(ellipse at 75% 20%, rgba(34,211,238,0.07) 0%, transparent 50%)',
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.025,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), ' +
            'linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          pointerEvents: 'none',
        }}
      />
      <CommerceCanvas />

      {/* Content */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          padding: '40px 48px',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #6366F1 0%, #22D3EE 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              <polyline points="16 7 22 7 22 13" />
            </svg>
          </div>
          <span style={{ color: '#F1F5F9', fontWeight: 700, fontSize: '17px', letterSpacing: '-0.01em' }}>
            ECOS ERP
          </span>
        </div>

        {/* Hero copy */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ marginBottom: '10px' }}>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#22D3EE',
              }}
            >
              {t($ => $.branding.eyebrow)}
            </span>
          </div>

          <h1
            style={{
              margin: 0,
              marginBottom: '12px',
              fontSize: 'clamp(20px, 2.2vw, 33px)',
              fontWeight: 800,
              lineHeight: 1.12,
              letterSpacing: '-0.03em',
              color: '#F1F5F9',
            }}
          >
            {t($ => $.branding.headline)}{' '}
            <span
              style={{
                background: 'linear-gradient(92deg, #818CF8 0%, #22D3EE 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {t($ => $.branding.headlineGradient)}
            </span>
          </h1>

          <p
            style={{
              margin: 0,
              marginBottom: '24px',
              fontSize: '14px',
              lineHeight: 1.65,
              color: '#64748B',
              maxWidth: '400px',
            }}
          >
            {t($ => $.branding.description)}
          </p>

          {/* Stats row — compressed ~20% */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '1px',
              marginBottom: '22px',
              background: 'rgba(255,255,255,0.06)',
              borderRadius: '12px',
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            {STAT_KEYS.map((key, i) => (
              <div
                key={i}
                style={{
                  padding: '8px 6px',
                  textAlign: 'center',
                  background: 'rgba(255,255,255,0.03)',
                }}
              >
                <div
                  style={{
                    fontSize: '17px',
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                    color: '#F1F5F9',
                    lineHeight: 1,
                    marginBottom: '3px',
                  }}
                >
                  {STAT_VALUES[i]}
                </div>
                <div style={{ fontSize: '9px', color: '#475569', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {t(key)}
                </div>
              </div>
            ))}
          </div>

          {/* Feature checklist — Option A */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '6px 16px',
            }}
          >
            {FEATURE_KEYS.map((key, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                }}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 13 13"
                  fill="none"
                  aria-hidden="true"
                  style={{ flexShrink: 0 }}
                >
                  <circle cx="6.5" cy="6.5" r="6.5" fill="rgba(99,102,241,0.18)" />
                  <polyline
                    points="3.5,6.5 5.5,8.5 9.5,4.5"
                    stroke="#818CF8"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 500,
                    color: '#64748B',
                    lineHeight: 1.3,
                  }}
                >
                  {t(key)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div>
          <div style={{ color: '#1E293B', fontSize: '12px', marginBottom: '4px' }}>
            {t($ => $.branding.copyright)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#1E293B', fontSize: '11px' }}>
              v2.3.0 · Build 2026.07
            </span>
            {ENV_BADGE[env.appEnv] && (
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: ENV_BADGE[env.appEnv]!.bg,
                  color: ENV_BADGE[env.appEnv]!.color,
                }}
              >
                {ENV_BADGE[env.appEnv]!.label}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Form panel ─────────────────────────────────────────────────────────────

function FormPanel({ isRTL }: { isRTL: boolean }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        position: 'relative',
        overflow: 'hidden',
        // Divider appears on the side facing the branding panel
        borderInlineEnd: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {/* Ambient glow */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 50% 40%, rgba(99,102,241,0.07) 0%, transparent 65%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '440px' }}>
        {/* Mobile logo */}
        <div
          className="flex lg:hidden"
          style={{ alignItems: 'center', gap: '10px', marginBottom: '40px' }}
        >
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '9px',
              background: 'linear-gradient(135deg, #6366F1 0%, #22D3EE 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              <polyline points="16 7 22 7 22 13" />
            </svg>
          </div>
          <span style={{ color: '#F1F5F9', fontWeight: 700, fontSize: '16px' }}>ECOS ERP</span>
        </div>

        <LoginForm isRTL={isRTL} />

        {/* Mobile footer */}
        <p
          className="lg:hidden"
          style={{ marginTop: '24px', textAlign: 'center', color: '#1E2D3D', fontSize: '11px' }}
        >
          © 2026 ECOS ERP
        </p>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export function LoginPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        background: '#06091A',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
      }}
    >
      {/*
       * DOM order: [FormPanel, BrandingPanel]
       * LTR (dir=ltr): flex goes left→right → Form on LEFT, Branding on RIGHT ✓
       * RTL (dir=rtl): flex goes right→left → Form on RIGHT, Branding on LEFT ✓
       */}
      <FormPanel isRTL={isRTL} />
      <BrandingPanel />
    </div>
  );
}
