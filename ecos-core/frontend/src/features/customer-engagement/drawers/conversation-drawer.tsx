import { useState } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { useConversation, useMessageThread, useSlaViolations, usePrivateNotes } from '../hooks/use-cep';
import {
  PROVIDER_COLORS, STATUS_COLORS, CONVERSATION_STATUS_LABELS, PROVIDER_LABELS,
  type ConversationStatus, type CommunicationProvider,
} from '../types/cep';

const TABS = ['Overview', 'Messages', 'SLA', 'Notes', 'Business DNA'] as const;
type Tab = (typeof TABS)[number];

interface ConversationDrawerProps {
  conversationId: string | null;
  open: boolean;
  onClose: () => void;
}

export function ConversationDrawer({ conversationId, open, onClose }: ConversationDrawerProps) {
  const [tab, setTab] = useState<Tab>('Overview');

  const { data: conv, isLoading } = useConversation(conversationId);
  const { data: threadData }       = useMessageThread(conversationId, 30);
  const { data: slaViolations }    = useSlaViolations(conversationId);
  const { data: notes }            = usePrivateNotes(conversationId);

  const messages = threadData?.data ?? [];

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent className="w-[520px] sm:max-w-[520px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            Conversation
            {conv && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {conv.customer_name ?? conv.customer_phone ?? conv.conversation_uuid.slice(0, 8)}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {isLoading || !conv ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="flex gap-2 mt-3 flex-wrap">
              <Badge variant="secondary" className={`text-xs ${PROVIDER_COLORS[conv.provider as CommunicationProvider] ?? ''}`}>
                {PROVIDER_LABELS[conv.provider as CommunicationProvider] ?? conv.provider}
              </Badge>
              <Badge variant="secondary" className={`text-xs ${STATUS_COLORS[conv.status as ConversationStatus] ?? ''}`}>
                {CONVERSATION_STATUS_LABELS[conv.status as ConversationStatus] ?? conv.status}
              </Badge>
              {conv.unread_count > 0 && (
                <Badge variant="secondary" className="text-xs bg-primary text-primary-foreground">
                  {conv.unread_count} unread
                </Badge>
              )}
            </div>

            {/* Tabs */}
            <div className="flex gap-0.5 border-b mt-4 mb-1 overflow-x-auto">
              {TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                    tab === t
                      ? 'border-b-2 border-primary text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="pb-8 pt-2">
              {tab === 'Overview' && (
                <div className="space-y-4">
                  <div className="rounded-md border divide-y text-sm">
                    <div className="flex justify-between px-3 py-2">
                      <span className="text-muted-foreground">Customer</span>
                      <span className="font-medium">{conv.customer_name ?? '—'}</span>
                    </div>
                    <div className="flex justify-between px-3 py-2">
                      <span className="text-muted-foreground">Phone</span>
                      <span>{conv.customer_phone ?? '—'}</span>
                    </div>
                    <div className="flex justify-between px-3 py-2">
                      <span className="text-muted-foreground">Email</span>
                      <span>{conv.customer_email ?? '—'}</span>
                    </div>
                    <div className="flex justify-between px-3 py-2">
                      <span className="text-muted-foreground">Source</span>
                      <span>{conv.source ?? '—'}</span>
                    </div>
                    <div className="flex justify-between px-3 py-2">
                      <span className="text-muted-foreground">Language</span>
                      <span>{conv.language ?? '—'}</span>
                    </div>
                    <div className="flex justify-between px-3 py-2">
                      <span className="text-muted-foreground">Started</span>
                      <span>{new Date(conv.started_at).toLocaleString()}</span>
                    </div>
                    {conv.closed_at && (
                      <div className="flex justify-between px-3 py-2">
                        <span className="text-muted-foreground">Closed</span>
                        <span>{new Date(conv.closed_at).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between px-3 py-2">
                      <span className="text-muted-foreground">Messages</span>
                      <span>{conv.messages_count}</span>
                    </div>
                    <div className="flex justify-between px-3 py-2">
                      <span className="text-muted-foreground">Priority</span>
                      <span className="capitalize">{conv.priority}</span>
                    </div>
                  </div>
                  {conv.tags.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Tags</p>
                      <div className="flex flex-wrap gap-1">
                        {conv.tags.map((t) => (
                          <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {tab === 'Messages' && (
                <div className="space-y-2">
                  {messages.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No messages.</p>
                  ) : (
                    messages.map((msg) => (
                      <div key={msg.id} className={`rounded-lg px-3 py-2 text-sm max-w-[85%] ${
                        msg.direction === 'outbound' ? 'ml-auto bg-primary text-primary-foreground' : 'bg-muted'
                      }`}>
                        {msg.content && <p className="whitespace-pre-wrap">{msg.content}</p>}
                        {msg.media_url && (
                          <p className="text-xs opacity-70">📎 Media: {msg.media_type ?? 'file'}</p>
                        )}
                        <time className="text-[10px] opacity-60 mt-0.5 block">
                          {new Date(msg.sent_at).toLocaleString()}
                        </time>
                      </div>
                    ))
                  )}
                </div>
              )}

              {tab === 'SLA' && (
                <div className="space-y-2">
                  {!slaViolations || slaViolations.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No SLA tracking configured.</p>
                  ) : (
                    slaViolations.map((v) => (
                      <div key={v.id} className={`rounded-md border p-3 text-sm ${v.is_breached ? 'border-red-300 bg-red-50' : ''}`}>
                        <div className="flex justify-between">
                          <span className="font-medium capitalize">{v.violation_type.replace('_', ' ')}</span>
                          <Badge variant="secondary" className={`text-xs ${
                            v.status === 'breached' ? 'bg-red-100 text-red-800' :
                            v.status === 'resolved' ? 'bg-green-100 text-green-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>{v.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Due: {new Date(v.due_at).toLocaleString()}</p>
                        {v.breached_at && <p className="text-xs text-red-600">Breached: {new Date(v.breached_at).toLocaleString()}</p>}
                      </div>
                    ))
                  )}
                </div>
              )}

              {tab === 'Notes' && (
                <div className="space-y-2">
                  {!notes || notes.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No internal notes.</p>
                  ) : (
                    notes.map((note) => (
                      <div key={note.id} className="rounded-md bg-yellow-50 border border-yellow-200 p-2.5 text-xs">
                        <p className="text-gray-800 whitespace-pre-wrap">{note.content}</p>
                        <time className="text-muted-foreground mt-1 block">{new Date(note.created_at).toLocaleString()}</time>
                      </div>
                    ))
                  )}
                </div>
              )}

              {tab === 'Business DNA' && (
                <div className="pt-2 text-sm space-y-3">
                  {conv.business_dna_id ? (
                    <>
                      <div className="rounded-md border bg-muted/20 px-3 py-2">
                        <p className="text-xs text-muted-foreground">Business DNA ID</p>
                        <p className="font-mono text-xs mt-0.5">{conv.business_dna_id}</p>
                      </div>
                      {conv.campaign_id && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Campaign</span>
                          <span className="font-mono">{conv.campaign_id.slice(0, 12)}…</span>
                        </div>
                      )}
                      {conv.initiative_id && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Initiative</span>
                          <span className="font-mono">{conv.initiative_id.slice(0, 12)}…</span>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        This conversation is linked to the Business Attribution Engine. Full journey and attribution data
                        is available in Core Platform → Journey Explorer.
                      </p>
                    </>
                  ) : (
                    <div className="text-center py-6 space-y-2">
                      <p className="text-muted-foreground">No Business DNA linked yet.</p>
                      <p className="text-xs text-muted-foreground">
                        DNA is auto-linked when the conversation is attributed to a marketing campaign or initiative.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
