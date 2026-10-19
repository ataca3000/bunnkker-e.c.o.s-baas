import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/crud';

export function BridgeSettingsPage() {
  const { t } = useTranslation('settings');

  const [defaultRepo, setDefaultRepo]     = useState(
    () => localStorage.getItem('cb_last_repo_path') ?? '',
  );
  const [defaultBranch, setDefaultBranch] = useState('main');

  function saveDefaults() {
    localStorage.setItem('cb_last_repo_path', defaultRepo);
  }

  return (
    <div className="space-y-6 p-6 max-w-2xl mx-auto">
      <PageHeader title={t($ => $.bridgeSettings.pageTitle)} />

      {/* Worker status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t($ => $.bridgeSettings.worker.title)}</CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <p className="text-muted-foreground text-sm mb-3">
              {t($ => $.bridgeSettings.worker.noWorker)}
            </p>
            <Button size="sm" disabled>
              {t($ => $.bridgeSettings.register)}
            </Button>
            <p className="text-muted-foreground text-xs mt-2">
              {t($ => $.bridgeSettings.worker.regAvailable)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Default settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t($ => $.bridgeSettings.defaults.title)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="default-repo">{t($ => $.bridgeSettings.defaults.repoPath)}</Label>
            <Input
              id="default-repo"
              placeholder="C:\Projects\ecos-erp"
              value={defaultRepo}
              onChange={(e) => setDefaultRepo(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="default-branch">{t($ => $.bridgeSettings.defaults.branch)}</Label>
            <Input
              id="default-branch"
              value={defaultBranch}
              onChange={(e) => setDefaultBranch(e.target.value)}
            />
          </div>
          <Button size="sm" onClick={saveDefaults}>
            {t($ => $.bridgeSettings.saveDefaults)}
          </Button>
          <p className="text-muted-foreground text-xs">
            {t($ => $.bridgeSettings.defaults.savedNote)}
          </p>
        </CardContent>
      </Card>

      {/* Worker setup instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t($ => $.bridgeSettings.worker.subtitle)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ol className="text-sm space-y-1 list-decimal pl-4">
            <li>{t($ => $.bridgeSettings.worker.steps["1"])}</li>
            <li>{t($ => $.bridgeSettings.worker.steps["2"])}</li>
            <li>{t($ => $.bridgeSettings.worker.steps["3"])}</li>
            <li>{t($ => $.bridgeSettings.worker.steps["4"])}</li>
            <li>{t($ => $.bridgeSettings.worker.steps["5"])}</li>
            <li>{t($ => $.bridgeSettings.worker.steps["6"])}</li>
            <li>{t($ => $.bridgeSettings.worker.steps["7"])}</li>
          </ol>
          <Button size="sm" variant="outline" disabled>
            {t($ => $.bridgeSettings.download)}
          </Button>
          <p className="text-muted-foreground text-xs">
            {t($ => $.bridgeSettings.worker.availableSoon)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
