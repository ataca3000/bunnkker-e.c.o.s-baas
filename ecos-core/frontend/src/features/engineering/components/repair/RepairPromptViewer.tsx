import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Copy, Send, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/components/ds/use-toast';
import type { RepairPrompt } from '../../types/engineering';

interface Props {
  prompt: RepairPrompt;
  onMarkSent?: () => void;
}

function buildFormattedPrompt(prompt: RepairPrompt): string {
  const sections: string[] = [prompt.system_context, prompt.repair_instructions];
  if (prompt.constraints && prompt.constraints.length > 0) {
    sections.push('CONSTRAINTS:\n' + prompt.constraints.map(c => `- ${c}`).join('\n'));
  }
  if (prompt.success_criteria && prompt.success_criteria.length > 0) {
    sections.push('SUCCESS CRITERIA:\n' + prompt.success_criteria.map(s => `- ${s}`).join('\n'));
  }
  return sections.filter(Boolean).join('\n\n');
}

export default function RepairPromptViewer({ prompt, onMarkSent }: Props) {
  const { toast } = useToast();

  const formattedPrompt =
    (prompt as RepairPrompt & { formatted_prompt?: string }).formatted_prompt ?? buildFormattedPrompt(prompt);

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(formattedPrompt);
      toast({ title: 'Prompt copied to clipboard', description: `Prompt v${prompt.prompt_version} ready to paste into Claude Code.` });
    } catch {
      toast({ title: 'Failed to copy prompt', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary">Prompt v{prompt.prompt_version}</Badge>
          <Badge variant="outline" className="capitalize">{prompt.prompt_type.replace(/_/g, ' ')}</Badge>
          {prompt.token_estimate != null && (
            <Badge variant="outline" className="tabular-nums">~{prompt.token_estimate.toLocaleString()} tokens</Badge>
          )}
        </div>
        {prompt.sent_at ? (
          <Badge className="bg-green-600 text-white">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Sent {new Date(prompt.sent_at).toLocaleString()}
          </Badge>
        ) : (
          <Badge className="bg-orange-500 text-white">Not Sent</Badge>
        )}
      </div>

      {/* System context */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1">System Context</p>
        <pre className="text-xs bg-muted rounded-md p-3 max-h-40 overflow-auto whitespace-pre-wrap font-mono">
          {prompt.system_context}
        </pre>
      </div>

      {/* Repair instructions */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1">Repair Instructions</p>
        <pre className="text-xs bg-muted rounded-md p-3 max-h-64 overflow-auto whitespace-pre-wrap font-mono">
          {prompt.repair_instructions}
        </pre>
      </div>

      {/* Constraints */}
      {prompt.constraints && prompt.constraints.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Constraints</p>
          <ul className="text-xs space-y-1 list-disc list-inside">
            {prompt.constraints.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Success criteria */}
      {prompt.success_criteria && prompt.success_criteria.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Success Criteria</p>
          <ul className="text-xs space-y-1 list-disc list-inside">
            {prompt.success_criteria.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      <Separator />

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={copyPrompt}>
          <Copy className="h-3.5 w-3.5 mr-1.5" />
          Copy Full Prompt
        </Button>
        {!prompt.sent_at && onMarkSent && (
          <Button size="sm" variant="outline" onClick={onMarkSent}>
            <Send className="h-3.5 w-3.5 mr-1.5" />
            Mark as Sent
          </Button>
        )}
      </div>
    </div>
  );
}
