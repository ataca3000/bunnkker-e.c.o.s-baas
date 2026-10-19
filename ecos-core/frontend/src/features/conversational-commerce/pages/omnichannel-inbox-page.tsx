import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, MessageSquare, Phone, Send, Search, CheckCheck, RefreshCw } from 'lucide-react';
import { useConversations } from '../hooks/use-conversations';
import { useConversationMessages, useSendMessage } from '../hooks/use-conversation-messages';
import type { Conversation, ConversationStatus, CommunicationProvider } from '../types/conversation';

const STATUS_COLORS: Record<ConversationStatus, string> = {
  open: 'bg-green-500',
  pending: 'bg-yellow-500',
  resolved: 'bg-blue-500',
  closed: 'bg-gray-400',
  snoozed: 'bg-purple-500',
};

const PROVIDER_LABELS: Record<CommunicationProvider, string> = {
  whatsapp: 'WhatsApp',
  messenger: 'Messenger',
  instagram_direct: 'Instagram',
  email: 'Email',
  sms: 'SMS',
};

function ConvListItem({
  conv,
  isActive,
  onClick,
}: {
  conv: Conversation;
  isActive: boolean;
  onClick: () => void;
}) {
  const time = conv.last_message_at
    ? new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <button
      onClick={onClick}
      className={`w-full text-start px-3 py-3 border-b transition-colors hover:bg-muted/50 ${
        isActive ? 'bg-primary/10 border-s-2 border-s-primary' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium truncate">
              {conv.customer_name || conv.customer_phone || 'Unknown'}
            </span>
            {conv.unread_count > 0 && (
              <span className="flex-shrink-0 bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full">
                {conv.unread_count}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_COLORS[conv.status]}`}
            />
            <span className="text-xs text-muted-foreground">
              {PROVIDER_LABELS[conv.provider] ?? conv.provider}
            </span>
            {conv.is_vip && (
              <Badge variant="outline" className="text-xs px-1 py-0 h-4">
                VIP
              </Badge>
            )}
          </div>
        </div>
        <span className="text-xs text-muted-foreground flex-shrink-0">{time}</span>
      </div>
    </button>
  );
}

function MessageBubble({ msg }: { msg: import('../types/conversation').ConversationMessage }) {
  const isOut = msg.direction === 'outbound';
  return (
    <div className={`flex ${isOut ? 'justify-end' : 'justify-start'} mb-2`}>
      <div
        className={`max-w-[75%] px-3 py-2 rounded-xl text-sm ${
          isOut ? 'bg-primary text-primary-foreground' : 'bg-muted'
        }`}
      >
        {msg.content ?? <span className="italic text-muted-foreground">[media]</span>}
        <div className={`text-[10px] mt-1 ${isOut ? 'text-primary-foreground/70 text-right' : 'text-muted-foreground'}`}>
          {msg.sent_at ? new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
          {isOut && msg.delivery_status === 'read' && (
            <CheckCheck className="inline-block w-3 h-3 ml-1" />
          )}
        </div>
      </div>
    </div>
  );
}

function ConversationPanel({ conversationId }: { conversationId: string }) {
  const [text, setText] = useState('');
  const { data: messages = [], isLoading } = useConversationMessages(conversationId);
  const send = useSendMessage(conversationId);

  function handleSend() {
    if (!text.trim()) return;
    send.mutate({ message_type: 'text', content: text.trim() }, { onSuccess: () => setText('') });
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
            <MessageSquare className="w-8 h-8" />
            <span className="text-sm">No messages yet</span>
          </div>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} msg={m} />)
        )}
      </div>
      <div className="border-t p-3 flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          className="flex-1"
        />
        <Button size="sm" onClick={handleSend} disabled={!text.trim() || send.isPending}>
          {send.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}

export function OmnichannelInboxPage() {
  const [status, setStatus] = useState<string>('open');
  const [provider, setProvider] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const params: Record<string, string | number> = { status };
  if (provider !== 'all') params.provider = provider;
  if (search) params.search = search;

  const { data, isLoading, refetch } = useConversations(params);
  const conversations = data?.data ?? [];

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel — conversation list */}
      <div className="w-72 flex-shrink-0 border-r flex flex-col">
        {/* Filters */}
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="pl-7 h-8 text-sm"
              />
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => refetch()}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-7 text-xs flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['open', 'pending', 'resolved', 'closed', 'snoozed'] as ConversationStatus[]).map((s) => (
                  <SelectItem key={s} value={s} className="text-xs capitalize">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger className="h-7 text-xs flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All channels</SelectItem>
                {Object.entries(PROVIDER_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k} className="text-xs">
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <MessageSquare className="w-8 h-8 mb-2" />
              <span className="text-sm">No conversations</span>
            </div>
          ) : (
            conversations.map((c) => (
              <ConvListItem
                key={c.id}
                conv={c}
                isActive={c.id === selectedId}
                onClick={() => setSelectedId(c.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Right panel — message thread */}
      <div className="flex-1 min-w-0">
        {selectedId ? (
          <ConversationPanel conversationId={selectedId} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
            <Phone className="w-12 h-12" />
            <div className="text-center">
              <p className="font-medium">Select a conversation</p>
              <p className="text-sm mt-1">Choose from the list to start responding</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
