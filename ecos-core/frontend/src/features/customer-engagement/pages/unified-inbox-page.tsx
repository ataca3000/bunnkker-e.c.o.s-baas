import { useState } from 'react';
import { useConversations, useMessageThread, useSendMessage, useConversation, useResolveConversation, usePrivateNotes, useAddNote } from '../hooks/use-cep';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  CONVERSATION_STATUS_LABELS, PROVIDER_LABELS, PROVIDER_COLORS, STATUS_COLORS,
  type ConversationStatus, type CommunicationProvider,
} from '../types/cep';
import { Loader2, Send, Lock, RefreshCw } from 'lucide-react';

const STATUSES: ConversationStatus[] = ['open', 'pending', 'waiting_customer', 'waiting_agent', 'resolved', 'closed'];
const PROVIDERS: CommunicationProvider[] = ['whatsapp', 'messenger', 'instagram', 'email', 'live_chat', 'telegram', 'sms'];

// ─── Conversation List Item ───────────────────────────────────────────────────

function ConvItem({ conv, isActive, onClick }: {
  conv: import('../types/cep').Conversation;
  isActive: boolean;
  onClick: () => void;
}) {
  const timeAgo = conv.last_message_at
    ? new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <button
      onClick={onClick}
      className={`w-full text-start px-3 py-3 border-b transition-colors hover:bg-muted/50 ${isActive ? 'bg-primary/10 border-s-2 border-s-primary' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium truncate">
              {conv.customer_name ?? conv.customer_phone ?? 'Unknown'}
            </span>
            {conv.unread_count > 0 && (
              <span className="shrink-0 text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 font-medium">
                {conv.unread_count}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Badge variant="secondary" className={`text-[10px] px-1 py-0 ${PROVIDER_COLORS[conv.provider]}`}>
              {PROVIDER_LABELS[conv.provider]}
            </Badge>
            <Badge variant="secondary" className={`text-[10px] px-1 py-0 ${STATUS_COLORS[conv.status]}`}>
              {CONVERSATION_STATUS_LABELS[conv.status]}
            </Badge>
          </div>
        </div>
        <time className="text-xs text-muted-foreground shrink-0 tabular-nums">{timeAgo}</time>
      </div>
    </button>
  );
}

// ─── Message Thread ───────────────────────────────────────────────────────────

function MessageThread({ conversationId }: { conversationId: string }) {
  const [compose, setCompose] = useState('');
  const { data, isLoading } = useMessageThread(conversationId, 50);
  const sendMutation = useSendMessage(conversationId);
  const resolveMutation = useResolveConversation();
  const { data: conv } = useConversation(conversationId);

  const messages = data?.data ?? [];

  async function handleSend() {
    const text = compose.trim();
    if (!text) return;
    setCompose('');
    await sendMutation.mutateAsync({ content: text });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card shrink-0">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{conv?.customer_name ?? conv?.customer_phone ?? '—'}</p>
          <p className="text-xs text-muted-foreground">{conv?.provider_label} · {conv?.status_label}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => resolveMutation.mutate(conversationId)}
            disabled={conv?.status === 'resolved' || conv?.status === 'closed'}>
            Resolve
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
        ) : messages.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-12">No messages yet.</div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] rounded-2xl px-3.5 py-2 text-sm ${
                msg.direction === 'outbound'
                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                  : 'bg-muted rounded-bl-sm'
              }`}>
                {msg.message_type === 'image' && msg.media_url ? (
                  <img src={msg.media_url} alt="media" className="rounded max-w-[200px]" />
                ) : (
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                )}
                <time className={`text-[10px] mt-1 block ${msg.direction === 'outbound' ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                  {new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </time>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Compose */}
      <div className="border-t px-3 py-2 bg-card shrink-0">
        <div className="flex items-center gap-2">
          <Input
            value={compose}
            onChange={(e) => setCompose(e.target.value)}
            placeholder="Type a message…"
            className="flex-1 text-sm"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          />
          <Button size="icon" onClick={handleSend} disabled={!compose.trim() || sendMutation.isPending}>
            {sendMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1 px-1">Press Enter to send</p>
      </div>
    </div>
  );
}

// ─── Customer Sidebar ─────────────────────────────────────────────────────────

function CustomerSidebar({ conversationId }: { conversationId: string }) {
  const { data: conv } = useConversation(conversationId);
  const { data: notes } = usePrivateNotes(conversationId);
  const [noteText, setNoteText] = useState('');
  const addNote = useAddNote(conversationId);
  const [tab, setTab] = useState<'info' | 'notes' | 'sla'>('info');

  async function handleAddNote() {
    if (!noteText.trim()) return;
    await addNote.mutateAsync({ content: noteText.trim(), author_id: 'system' });
    setNoteText('');
  }

  if (!conv) return <div className="flex justify-center pt-8"><Loader2 className="size-4 animate-spin" /></div>;

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b shrink-0">
        {(['info', 'notes', 'sla'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-medium capitalize transition-colors ${
              tab === t ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}>
            {t === 'notes' ? `Notes (${notes?.length ?? 0})` : t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {tab === 'info' && (
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Customer</p>
              <p className="font-medium">{conv.customer_name ?? '—'}</p>
              {conv.customer_phone && <p className="text-muted-foreground">{conv.customer_phone}</p>}
              {conv.customer_email && <p className="text-muted-foreground">{conv.customer_email}</p>}
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Conversation</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Provider</span><span>{conv.provider_label}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span>{conv.status_label}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Priority</span><span>{conv.priority_label}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Started</span><span>{new Date(conv.started_at).toLocaleDateString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Messages</span><span>{conv.messages_count}</span></div>
              </div>
            </div>
            {conv.tags.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {conv.tags.map((t) => (
                    <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                  ))}
                </div>
              </div>
            )}
            {conv.business_dna_id && (
              <div className="rounded-md bg-muted/30 p-2 text-xs">
                <p className="font-medium">Business DNA</p>
                <p className="font-mono text-muted-foreground">{conv.business_dna_id.slice(0, 16)}…</p>
              </div>
            )}
          </div>
        )}

        {tab === 'notes' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-start gap-1.5">
                <Lock className="size-3 text-muted-foreground mt-0.5 shrink-0" />
                <span className="text-xs text-muted-foreground">Private — customer cannot see these</span>
              </div>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add internal note…"
                className="w-full text-sm border rounded-md p-2 resize-none h-20 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <Button size="sm" className="w-full" onClick={handleAddNote} disabled={!noteText.trim() || addNote.isPending}>
                {addNote.isPending ? <Loader2 className="size-3 animate-spin mr-1" /> : null}
                Add Note
              </Button>
            </div>
            <div className="space-y-2">
              {(notes ?? []).map((note) => (
                <div key={note.id} className="rounded-md bg-yellow-50 border border-yellow-200 p-2 text-xs">
                  <p className="text-gray-800 whitespace-pre-wrap">{note.content}</p>
                  <time className="text-muted-foreground mt-1 block">
                    {new Date(note.created_at).toLocaleString()}
                  </time>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'sla' && (
          <div className="space-y-2 text-sm">
            {conv.first_response_at ? (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">First Response</span>
                <span className="text-green-700 font-medium">Responded</span>
              </div>
            ) : (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">First Response</span>
                <span className="text-orange-600 font-medium">Pending</span>
              </div>
            )}
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Started</span>
              <span>{new Date(conv.started_at).toLocaleString()}</span>
            </div>
            {conv.closed_at && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Closed</span>
                <span>{new Date(conv.closed_at).toLocaleString()}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Inbox Page ──────────────────────────────────────────────────────────

export function UnifiedInboxPage() {
  const [activeId, setActiveId]   = useState<string | null>(null);
  const [status,   setStatus]     = useState('open');
  const [provider, setProvider]   = useState('');
  const [search,   setSearch]     = useState('');
  const [page,     setPage]       = useState(1);

  const { data, isLoading, refetch } = useConversations({
    status:   status || undefined,
    provider: provider || undefined,
    search:   search || undefined,
    per_page: 30,
    page,
  });

  const conversations = data?.data ?? [];
  const meta          = data?.meta;

  return (
    <div className="flex h-[calc(100vh-56px)]">
      {/* LEFT: Conversation List */}
      <div className="w-72 shrink-0 border-r flex flex-col bg-card">
        {/* Filters */}
        <div className="p-2 space-y-1.5 border-b">
          <div className="flex gap-1">
            <Input
              placeholder="Search…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="h-7 text-xs flex-1"
            />
            <Button variant="ghost" size="icon" className="size-7" onClick={() => refetch()}>
              <RefreshCw className="size-3" />
            </Button>
          </div>
          <div className="flex gap-1">
            <Select value={status || 'all'} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="h-6 text-xs flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{CONVERSATION_STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={provider || 'all'} onValueChange={(v) => { setProvider(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="h-6 text-xs w-28"><SelectValue placeholder="Provider" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p} value={p}>{PROVIDER_LABELS[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Count */}
        <div className="px-3 py-1 text-xs text-muted-foreground border-b">
          {meta?.total ?? 0} conversations
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-3 py-3 border-b animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-1" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            ))
          ) : conversations.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              No conversations found.
            </div>
          ) : (
            conversations.map((conv) => (
              <ConvItem key={conv.id} conv={conv} isActive={activeId === conv.id} onClick={() => setActiveId(conv.id)} />
            ))
          )}
        </div>

        {/* Pagination */}
        {meta && meta.last_page > 1 && (
          <div className="flex gap-1 p-2 border-t justify-center">
            <Button variant="outline" size="sm" className="h-6 text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
            <span className="text-xs text-muted-foreground self-center">{page}/{meta.last_page}</span>
            <Button variant="outline" size="sm" className="h-6 text-xs" disabled={page >= meta.last_page} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        )}
      </div>

      {/* MIDDLE: Thread */}
      <div className="flex-1 min-w-0">
        {activeId ? (
          <MessageThread conversationId={activeId} />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm flex-col gap-2">
            <div className="text-4xl">💬</div>
            <p className="font-medium">Select a conversation</p>
            <p className="text-xs">Messages from all providers appear here</p>
          </div>
        )}
      </div>

      {/* RIGHT: Customer Info */}
      {activeId && (
        <div className="w-64 shrink-0 border-l bg-card">
          <CustomerSidebar conversationId={activeId} />
        </div>
      )}
    </div>
  );
}
