import { BarChart3, MessageSquare, ShoppingCart, Clock, CheckCircle2, TrendingUp } from 'lucide-react';
import { useCepDashboard } from '../hooks/use-conversations-dashboard';
import { useConversationKpis } from '../hooks/use-conversations-dashboard';

function KpiCard({
  label,
  value,
  icon: Icon,
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  sub?: string;
}) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export function ConversationsDashboardPage() {
  const { data: kpis } = useConversationKpis();
  const { data: cepData } = useCepDashboard();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Omnichannel Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Real-time overview of all channel conversations
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard
          label="Open"
          value={kpis?.total_open ?? cepData?.open ?? '—'}
          icon={MessageSquare}
          sub="Active conversations"
        />
        <KpiCard
          label="Unread"
          value={kpis?.unread ?? cepData?.unread ?? '—'}
          icon={BarChart3}
          sub="Awaiting response"
        />
        <KpiCard
          label="Resolved Today"
          value={kpis?.resolved_today ?? cepData?.resolved_today ?? '—'}
          icon={CheckCircle2}
          sub="Closed this shift"
        />
        <KpiCard
          label="Avg Response"
          value={kpis ? `${kpis.avg_response_time_min}m` : '—'}
          icon={Clock}
          sub="Minutes to first reply"
        />
        <KpiCard
          label="Orders Created"
          value={kpis?.orders_created ?? '—'}
          icon={ShoppingCart}
          sub="Via conversations"
        />
        <KpiCard
          label="Revenue Attributed"
          value={kpis ? `${(kpis.revenue_attributed / 1000).toFixed(1)}K` : '—'}
          icon={TrendingUp}
          sub="From chat-to-order"
        />
      </div>

      <div className="border rounded-lg p-6 flex items-center justify-center text-muted-foreground min-h-48">
        <div className="text-center">
          <BarChart3 className="w-10 h-10 mx-auto mb-3" />
          <p className="font-medium">Conversation Trends</p>
          <p className="text-sm mt-1">Charts coming in next sprint</p>
        </div>
      </div>
    </div>
  );
}
