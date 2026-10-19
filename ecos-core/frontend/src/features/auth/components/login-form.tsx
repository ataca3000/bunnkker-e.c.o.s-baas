import { useState } from 'react';
import axios from 'axios';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { useAuthStore } from '@/features/auth/store/auth-store';
import { ROUTES } from '@/router/routes';

// ── Types ─────────────────────────────────────────────────────────────────

type LoginFormValues = {
  email: string;
  password: string;
  remember: boolean;
};

// ── Icons ─────────────────────────────────────────────────────────────────

function MailIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
      style={{ animation: 'ecos-spin 0.75s linear infinite' }}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────

export function LoginForm({ isRTL = false }: { isRTL?: boolean }) {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const loginSchema = z.object({
    email: z.email(t($ => $.login.email.validation)),
    password: z.string().min(1, t($ => $.login.password.validation)),
    remember: z.boolean(),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', remember: false },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setFormError(null);
    try {
      await login(values);
      navigate(ROUTES.dashboard, { replace: true });
    } catch (error) {
      if (!axios.isAxiosError(error)) {
        setFormError(t($ => $.login.error.message));
        return;
      }

      const status = error.response?.status;
      const data = error.response?.data as
        | { message?: string; errors?: Record<string, string[]> }
        | null
        | undefined;

      if (!error.response) {
        // Network failure — could not reach the server at all
        setFormError(t($ => $.login.error.serverUnavailable));
      } else if (status === 429) {
        setFormError(t($ => $.login.error.tooManyAttempts));
      } else if (status === 403 || status === 423) {
        setFormError(typeof data?.message === 'string' ? data.message : t($ => $.login.error.accountDisabled));
      } else if (status === 422) {
        const firstFieldError = data?.errors
          ? Object.values(data.errors)[0]?.[0]
          : undefined;
        setFormError(firstFieldError ?? (typeof data?.message === 'string' ? data.message : t($ => $.login.error.validation)));
      } else if (status !== undefined && status >= 500) {
        setFormError(t($ => $.login.error.serverUnavailable));
      } else if (typeof data?.message === 'string' && data.message) {
        // 401 invalid credentials, or any other backend message
        setFormError(data.message);
      } else {
        setFormError(t($ => $.login.error.message));
      }
    }
  };

  // icon & eye-toggle positions adapt to LTR/RTL automatically via logical CSS
  const iconStyle: React.CSSProperties = {
    position: 'absolute',
    insetBlockStart: '50%',
    insetInlineStart: '13px',
    transform: 'translateY(-50%)',
    color: '#4B5563',
    pointerEvents: 'none',
    display: 'flex',
    alignItems: 'center',
  };

  const eyeStyle: React.CSSProperties = {
    position: 'absolute',
    insetBlockStart: '50%',
    insetInlineEnd: '12px',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '3px',
    color: '#4B5563',
    display: 'flex',
    alignItems: 'center',
    transition: 'color 0.12s ease',
    borderRadius: '4px',
  };

  const inputBase: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.055)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '10px',
    paddingTop: '12px',
    paddingBottom: '12px',
    paddingInlineStart: '40px',
    paddingInlineEnd: '14px',
    color: '#F1F5F9',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
    WebkitAppearance: 'none',
    textAlign: isRTL ? 'right' : 'left',
  };

  const inputErrorStyle: React.CSSProperties = {
    ...inputBase,
    borderColor: 'rgba(239,68,68,0.5)',
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'rgba(99,102,241,0.65)';
    e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.13)';
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>, hasError: boolean) => {
    e.target.style.borderColor = hasError ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.10)';
    e.target.style.boxShadow = 'none';
  };

  const { onBlur: emailOnBlur, ...emailReg } = register('email');
  const { onBlur: pwOnBlur, ...pwReg }       = register('password');

  return (
    <>
      <style>{`
        @keyframes ecos-spin { to { transform: rotate(360deg); } }

        .ecos-input::placeholder { color: rgba(148,163,184,0.38) !important; }

        .ecos-submit:hover:not(:disabled) {
          opacity: 0.9;
          transform: translateY(-1px);
          box-shadow: 0 8px 28px rgba(99,102,241,0.42) !important;
        }
        .ecos-submit:active:not(:disabled) { transform: translateY(0); }
        .ecos-submit:focus-visible {
          outline: 2px solid rgba(99,102,241,0.8);
          outline-offset: 2px;
        }

        .ecos-forgot:hover  { color: #A5B4FC !important; }
        .ecos-forgot:focus-visible {
          outline: 2px solid rgba(99,102,241,0.7);
          outline-offset: 2px;
          border-radius: 4px;
        }

        .ecos-eye:hover { color: #94A3B8 !important; }
        .ecos-eye:focus-visible {
          outline: 2px solid rgba(99,102,241,0.7);
          outline-offset: 2px;
        }

        .ecos-input:focus-visible {
          border-color: rgba(99,102,241,0.65) !important;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.13) !important;
          outline: none;
        }

        .ecos-card input:-webkit-autofill,
        .ecos-card input:-webkit-autofill:hover,
        .ecos-card input:-webkit-autofill:focus {
          -webkit-text-fill-color: #F1F5F9;
          -webkit-box-shadow: 0 0 0 1000px rgba(10,15,35,0.98) inset;
          transition: background-color 5000s ease-in-out 0s;
        }

        @media (prefers-reduced-motion: reduce) {
          .ecos-submit, .ecos-forgot, .ecos-eye, .ecos-input {
            transition: none !important;
          }
          .ecos-submit:hover:not(:disabled) {
            transform: none !important;
          }
        }
      `}</style>

      <div
        className="ecos-card"
        role="main"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: '22px',
          backdropFilter: 'blur(48px)',
          WebkitBackdropFilter: 'blur(48px)',
          padding: '48px 44px',
          boxShadow: '0 8px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <div style={{ marginBottom: '36px' }}>
          <h2
            style={{
              margin: 0,
              marginBottom: '8px',
              color: '#F1F5F9',
              fontSize: '26px',
              fontWeight: 800,
              letterSpacing: '-0.025em',
              lineHeight: 1.15,
            }}
          >
            {t($ => $.login.welcomeBack) || 'Welcome Back'}
          </h2>
          <p style={{ margin: 0, color: '#475569', fontSize: '14px', lineHeight: 1.6 }}>
            {t($ => $.login.subtitle)}
          </p>
        </div>

        {/* ── Error alert ─────────────────────────────────────────── */}
        {formError ? (
          <div
            role="alert"
            aria-live="assertive"
            style={{
              background: 'rgba(239,68,68,0.09)',
              border: '1px solid rgba(239,68,68,0.22)',
              borderRadius: '10px',
              padding: '12px 14px',
              marginBottom: '24px',
              color: '#FCA5A5',
              fontSize: '13px',
              lineHeight: 1.5,
            }}
          >
            {formError}
          </div>
        ) : null}

        {/* ── Form ────────────────────────────────────────────────── */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}
          noValidate
        >
          {/* Email field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <label
              htmlFor="email"
              style={{ color: '#94A3B8', fontSize: '13px', fontWeight: 500 }}
            >
              {t($ => $.login.email.label)}
            </label>
            <div style={{ position: 'relative' }}>
              <span style={iconStyle}>
                <MailIcon />
              </span>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder={t($ => $.login.email.placeholder)}
                className="ecos-input"
                style={errors.email ? inputErrorStyle : inputBase}
                onFocus={handleFocus}
                onBlur={(e) => { void emailOnBlur(e); handleBlur(e, !!errors.email); }}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'email-error' : undefined}
                {...emailReg}
              />
            </div>
            {errors.email ? (
              <p id="email-error" role="alert" style={{ margin: 0, color: '#F87171', fontSize: '12px' }}>
                {errors.email.message}
              </p>
            ) : null}
          </div>

          {/* Password field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <label
              htmlFor="password"
              style={{ color: '#94A3B8', fontSize: '13px', fontWeight: 500 }}
            >
              {t($ => $.login.password.label)}
            </label>
            <div style={{ position: 'relative' }}>
              <span style={iconStyle}>
                <LockIcon />
              </span>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder={t($ => $.login.password.placeholder)}
                className="ecos-input"
                style={{
                  ...(errors.password ? inputErrorStyle : inputBase),
                  paddingInlineEnd: '42px',
                }}
                onFocus={handleFocus}
                onBlur={(e) => { void pwOnBlur(e); handleBlur(e, !!errors.password); }}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'password-error' : undefined}
                {...pwReg}
              />
              <button
                type="button"
                className="ecos-eye"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t($ => $.login.hidePassword) || 'Hide password' : t($ => $.login.showPassword) || 'Show password'}
                style={eyeStyle}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
            {errors.password ? (
              <p id="password-error" role="alert" style={{ margin: 0, color: '#F87171', fontSize: '12px' }}>
                {errors.password.message}
              </p>
            ) : null}
          </div>

          {/* Remember me + Forgot password */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <label
              style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
            >
              <input
                type="checkbox"
                style={{ width: '15px', height: '15px', accentColor: '#6366F1', cursor: 'pointer', flexShrink: 0 }}
                {...register('remember')}
              />
              <span style={{ color: '#64748B', fontSize: '13px', userSelect: 'none' }}>
                {t($ => $.login.rememberMe)}
              </span>
            </label>
            <button
              type="button"
              className="ecos-forgot"
              style={{
                background: 'none',
                border: 'none',
                color: '#818CF8',
                fontSize: '13px',
                cursor: 'pointer',
                padding: '2px 0',
                transition: 'color 0.12s ease',
                flexShrink: 0,
              }}
            >
              {t($ => $.login.forgotPassword)}
            </button>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="ecos-submit"
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '12px',
              border: 'none',
              background: isSubmitting
                ? 'rgba(99,102,241,0.4)'
                : 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
              color: 'white',
              fontSize: '15px',
              fontWeight: 600,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              minHeight: '50px',
              transition: 'opacity 0.18s ease, transform 0.12s ease, box-shadow 0.18s ease',
              boxShadow: '0 4px 20px rgba(99,102,241,0.3)',
              letterSpacing: '0.01em',
            }}
          >
            {isSubmitting ? (
              <>
                <SpinnerIcon />
                <span>{t($ => $.login.submitting)}</span>
              </>
            ) : (
              t($ => $.login.submit)
            )}
          </button>
        </form>
      </div>
    </>
  );
}
