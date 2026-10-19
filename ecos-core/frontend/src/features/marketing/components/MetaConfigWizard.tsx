import { useState } from 'react';
import { Check, ChevronRight, Eye, EyeOff, ExternalLink, Loader2, AlertCircle, CheckCircle2, RotateCcw, Lock, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ds/use-toast';
import { useSaveProviderConfig, useValidateProviderConfig } from '../hooks/use-provider-config';
import type { ProviderConfig, SaveConfigPayload, ValidateConfigPayload } from '../types/provider-config';

interface Props {
  config: ProviderConfig;
  onComplete: () => void;
  onCancel?: () => void;
}

type Step = 1 | 2 | 3 | 4;

const STEPS = [
  { id: 1, label: 'App ID' },
  { id: 2, label: 'App Secret' },
  { id: 3, label: 'Redirect URI' },
  { id: 4, label: 'Validate & Save' },
] as const;

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? '1 month ago' : `${months} months ago`;
}

function extractErrors(err: unknown): string[] {
  const resp = (err as { response?: { data?: unknown } })?.response?.data;
  if (!resp || typeof resp !== 'object') return [];
  const r = resp as Record<string, unknown>;

  // Laravel validation: { errors: { field: ['message', ...] } }
  if (r.errors && typeof r.errors === 'object' && !Array.isArray(r.errors)) {
    const msgs = Object.values(r.errors as Record<string, string[]>).flat();
    if (msgs.length) return msgs;
  }

  // API data layer: { data: { errors: string[] } }
  if (r.data && typeof r.data === 'object') {
    const d = r.data as Record<string, unknown>;
    if (Array.isArray(d.errors) && d.errors.length) return d.errors as string[];
  }

  // Generic message (exclude the opaque "Server Error")
  if (typeof r.message === 'string' && r.message !== 'Server Error') {
    return [r.message];
  }

  return [];
}

export function MetaConfigWizard({ config, onComplete, onCancel }: Props) {
  const { toast } = useToast();

  const [step, setStep]       = useState<Step>(1);
  const [appId, setAppId]     = useState(config.app_id ?? '');
  const [appSecret, setAppSecret] = useState('');
  // showChangeSecret: true when user explicitly wants to replace the stored secret
  // Starts as true when no secret exists (first-time), false when one is already saved
  const [showChangeSecret, setShowChangeSecret] = useState(!config.has_app_secret);
  const [redirectUri, setRedirectUri] = useState(config.redirect_uri ?? config.default_redirect_uri);
  const [showSecret, setShowSecret]   = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; errors: string[] } | null>(null);

  const validateMutation = useValidateProviderConfig('meta');
  const saveMutation     = useSaveProviderConfig('meta');

  const isValidating = validateMutation.isPending;
  const isSaving     = saveMutation.isPending;

  // ── Step navigation ────────────────────────────────────────────────────────

  function canAdvance(): boolean {
    if (step === 1) return appId.trim().length > 0;
    if (step === 2) {
      // Can advance without a new secret if one is already saved and user isn't replacing it
      if (!showChangeSecret && config.has_app_secret) return true;
      return appSecret.trim().length > 0;
    }
    if (step === 3) return redirectUri.trim().length > 0;
    return false;
  }

  function advance() {
    if (step < 4) setStep((s) => (s + 1) as Step);
  }

  function back() {
    if (step > 1) {
      setValidationResult(null);
      setStep((s) => (s - 1) as Step);
    }
  }

  // ── Validate & Save ───────────────────────────────────────────────────────

  async function handleValidate() {
    setValidationResult(null);

    // Keeping existing secret: skip client-side validation — the server will
    // decrypt the stored secret and validate it against Meta during save.
    if (!showChangeSecret && config.has_app_secret) {
      await handleSave();
      return;
    }

    try {
      const payload: ValidateConfigPayload = {
        app_id:       appId,
        app_secret:   appSecret,
        redirect_uri: redirectUri,
      };
      const result = await validateMutation.mutateAsync(payload);
      setValidationResult(result);
      if (result.valid) {
        await handleSave();
      }
    } catch (err: unknown) {
      const errs = extractErrors(err);
      setValidationResult({
        valid:  false,
        errors: errs.length ? errs : ['Cannot reach validation service. Please try again.'],
      });
    }
  }

  async function handleSave() {
    try {
      const payload: SaveConfigPayload = {
        app_id:       appId,
        redirect_uri: redirectUri,
      };
      // Only send app_secret when the user explicitly entered a new one
      if (showChangeSecret || !config.has_app_secret) {
        payload.app_secret = appSecret;
      }

      await saveMutation.mutateAsync(payload);
      toast({ title: 'Meta configuration saved.', description: 'OAuth is now enabled.' });
      onComplete();
    } catch (err: unknown) {
      const errs = extractErrors(err);
      setValidationResult({
        valid:  false,
        errors: errs.length ? errs : ['Save failed. Please check your configuration and try again.'],
      });
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Step progress */}
      <nav aria-label="Wizard steps" className="flex items-center gap-1">
        {STEPS.map((s, i) => {
          const done   = step > s.id;
          const active = step === s.id;
          return (
            <div key={s.id} className="flex items-center gap-1 flex-1 min-w-0">
              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
                done   ? 'bg-emerald-500 text-white' :
                active ? 'bg-primary text-primary-foreground' :
                         'bg-muted text-muted-foreground'
              }`}>
                {done ? <Check className="h-3 w-3" /> : s.id}
              </div>
              <span className={`hidden sm:block text-xs truncate ${active ? 'font-medium' : 'text-muted-foreground'}`}>
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0 ml-1" />
              )}
            </div>
          );
        })}
      </nav>

      {/* Step 1 — App ID */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold">Step 1 — Meta App ID</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Found in{' '}
              <a
                href="https://developers.facebook.com/apps"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 inline-flex items-center gap-0.5"
              >
                Meta Developer Console
                <ExternalLink className="h-3 w-3" />
              </a>
              {' '}→ your app → App Settings → Basic.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="app-id">App ID <span className="text-destructive">*</span></Label>
            <Input
              id="app-id"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              placeholder="e.g. 123456789012345"
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Step 2 — App Secret */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold">Step 2 — App Secret</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Found in Meta Developer Console → App Settings → Basic.
              Stored encrypted — never exposed after save.
            </p>
          </div>

          {!showChangeSecret && config.has_app_secret ? (
            <div className="space-y-2">
              <Label>App Secret</Label>
              <div className="flex items-center justify-between rounded-md border px-3 py-2.5 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center gap-2 text-sm">
                  <Lock className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="font-medium text-emerald-800 dark:text-emerald-300">Saved — stored encrypted</span>
                  {config.last_updated_at && (
                    <span className="text-xs text-emerald-600/70 dark:text-emerald-400/60">
                      · {formatRelativeTime(config.last_updated_at)}
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 shrink-0"
                  onClick={() => setShowChangeSecret(true)}
                >
                  <KeyRound className="h-3.5 w-3.5 mr-1" />
                  Change Secret
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                The stored secret will be used for validation. No action needed.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="app-secret">
                  {showChangeSecret ? 'New App Secret' : <>App Secret <span className="text-destructive">*</span></>}
                </Label>
                {showChangeSecret && config.has_app_secret && (
                  <button
                    type="button"
                    className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
                    onClick={() => { setShowChangeSecret(false); setAppSecret(''); }}
                  >
                    Cancel — keep existing
                  </button>
                )}
              </div>
              <div className="relative">
                <Input
                  id="app-secret"
                  type={showSecret ? 'text' : 'password'}
                  value={appSecret}
                  onChange={(e) => setAppSecret(e.target.value)}
                  placeholder="Enter your App Secret"
                  className="pr-9"
                  autoFocus
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowSecret((v) => !v)}
                  tabIndex={-1}
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {showChangeSecret && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  Saving a new secret will permanently replace the currently stored one.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 3 — Redirect URI */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold">Step 3 — Redirect URI</h3>
            <p className="text-xs text-muted-foreground mt-1">
              This URI must be added to your Meta App's{' '}
              <strong>Valid OAuth Redirect URIs</strong> in Facebook Login Settings.
            </p>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="redirect-uri">Redirect URI <span className="text-destructive">*</span></Label>
              <button
                type="button"
                className="text-[11px] text-primary hover:underline flex items-center gap-0.5"
                onClick={() => setRedirectUri(config.default_redirect_uri)}
              >
                <RotateCcw className="h-3 w-3" />
                Reset to default
              </button>
            </div>
            <Input
              id="redirect-uri"
              value={redirectUri}
              onChange={(e) => setRedirectUri(e.target.value)}
              placeholder={config.default_redirect_uri}
            />
          </div>
          <div className="rounded-md bg-muted/50 border px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Required in Meta Console:</span>{' '}
            Facebook Login → Settings → Valid OAuth Redirect URIs → add the URI above.
          </div>
        </div>
      )}

      {/* Step 4 — Validate & Save */}
      {step === 4 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold">Step 4 — Validate &amp; Save</h3>
            <p className="text-xs text-muted-foreground mt-1">
              ECOS will verify your credentials against the Meta Graph API before saving.
            </p>
          </div>

          {/* Summary */}
          <dl className="rounded-md border divide-y text-xs">
            {[
              { label: 'App ID', value: appId },
              {
                label: 'App Secret',
                value: showChangeSecret
                  ? '•••••••• (new — will replace saved)'
                  : config.has_app_secret
                  ? '•••••••• (saved — no change)'
                  : (appSecret ? '••••••••' : '—'),
              },
              { label: 'Redirect URI', value: redirectUri },
            ].map(({ label, value }) => (
              <div key={label} className="flex gap-3 px-3 py-2">
                <dt className="w-28 shrink-0 text-muted-foreground">{label}</dt>
                <dd className="font-medium truncate">{value}</dd>
              </div>
            ))}
          </dl>

          {/* Status */}
          {(isValidating || isSaving) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {isValidating ? 'Verifying credentials with Meta…' : 'Saving configuration…'}
            </div>
          )}

          {validationResult && !validationResult.valid && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Validation failed
              </div>
              <ul className="text-xs text-destructive/80 space-y-0.5 list-disc list-inside">
                {validationResult.errors.map((e) => <li key={e}>{e}</li>)}
              </ul>
            </div>
          )}

          {validationResult?.valid && (
            <div className="flex items-center gap-1.5 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Connection successful — credentials verified.
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t">
        <div className="flex gap-2">
          {step > 1 && (
            <Button variant="ghost" size="sm" onClick={back} disabled={isSaving || isValidating}>
              Back
            </Button>
          )}
          {onCancel && step === 1 && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>

        {step < 4 ? (
          <Button size="sm" onClick={advance} disabled={!canAdvance()}>
            Next
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleValidate}
            disabled={isValidating || isSaving}
          >
            {(isValidating || isSaving) && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Validate &amp; Save
          </Button>
        )}
      </div>
    </div>
  );
}
