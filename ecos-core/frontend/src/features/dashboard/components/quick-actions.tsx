import { Link } from 'react-router-dom';
import {
  ArrowLeftRight,
  Factory,
  Package,
  ShoppingBag,
  ShoppingCart,
  UserPlus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ROUTES } from '@/router/routes';

type Action = {
  label: string;
  icon: LucideIcon;
  href: string;
  iconCls: string;
  bgCls: string;
};

const ACTIONS: Action[] = [
  {
    label: 'Create Order',
    icon: ShoppingCart,
    href: ROUTES.ordersNew,
    iconCls: 'text-indigo-500',
    bgCls: 'bg-indigo-500/10',
  },
  {
    label: 'Receive Inventory',
    icon: Package,
    href: ROUTES.goodsReceiptsNew,
    iconCls: 'text-emerald-500',
    bgCls: 'bg-emerald-500/10',
  },
  {
    label: 'Start Wave',
    icon: Factory,
    href: ROUTES.waveWorkspace,
    iconCls: 'text-violet-500',
    bgCls: 'bg-violet-500/10',
  },
  {
    label: 'Transfer Stock',
    icon: ArrowLeftRight,
    href: ROUTES.stockTransfers,
    iconCls: 'text-cyan-500',
    bgCls: 'bg-cyan-500/10',
  },
  {
    label: 'New Purchase',
    icon: ShoppingBag,
    href: ROUTES.purchaseOrdersNew,
    iconCls: 'text-amber-500',
    bgCls: 'bg-amber-500/10',
  },
  {
    label: 'Add Customer',
    icon: UserPlus,
    href: ROUTES.customers,
    iconCls: 'text-pink-500',
    bgCls: 'bg-pink-500/10',
  },
];

export function QuickActions() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <Button
                key={a.label}
                variant="outline"
                asChild
                className="h-auto flex-col gap-2 py-4"
              >
                <Link to={a.href}>
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${a.bgCls}`}>
                    <Icon className={`h-4 w-4 ${a.iconCls}`} />
                  </div>
                  <span className="text-center text-xs font-medium leading-tight">{a.label}</span>
                </Link>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
