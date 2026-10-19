import { Badge } from '@/components/ui/badge';
import type { ChannelPlatform } from '@/features/channels/types/channel';

type Config = { label: string; dot: string };

const PLATFORM_CONFIG: Record<ChannelPlatform, Config> = {
  woocommerce: { label: 'WooCommerce', dot: 'bg-violet-500' },
  shopify: { label: 'Shopify', dot: 'bg-emerald-500' },
  amazon: { label: 'Amazon', dot: 'bg-amber-500' },
  noon: { label: 'Noon', dot: 'bg-yellow-400' },
  salla: { label: 'Salla', dot: 'bg-teal-500' },
  zid: { label: 'Zid', dot: 'bg-blue-500' },
};

type Props = { platform: ChannelPlatform };

export function PlatformBadge({ platform }: Props) {
  const config = PLATFORM_CONFIG[platform] ?? { label: platform, dot: 'bg-gray-400' };

  return (
    <Badge variant="secondary" className="gap-1.5">
      <span className={`size-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </Badge>
  );
}
