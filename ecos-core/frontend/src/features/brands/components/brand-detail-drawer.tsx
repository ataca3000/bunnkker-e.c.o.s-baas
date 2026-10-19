import { useState } from 'react';
import { Briefcase, Building2, Globe, History, Package, Pencil, ShoppingCart, Tag, Truck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
import { getMediaUrl } from '@/lib/media';
import type { Brand } from '@/features/brands/types/brand';
import { BrandShippingTab }         from '@/features/brands/components/brand-shipping-tab';
import { BrandDeliveryWindowsTab } from '@/features/brands/components/brand-delivery-windows-tab';
import { PolicyWorkspace } from '@/features/admin/configuration/components/policy-workspace';
import { useBusinessAccountsQuery } from '@/features/business-accounts/hooks/use-business-accounts';
import { useChannelsQuery } from '@/features/channels/hooks/use-channels';
import { useProductsQuery } from '@/features/products/hooks/use-products';

type BrandDetailDrawerProps = {
  brand: Brand | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (brand: Brand) => void;
};

const TAB_CLS =
  'flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-full text-xs';

// ── OrgLogo ───────────────────────────────────────────────────────────────────

function OrgLogo({ path, name }: { path: string | null | undefined; name: string }) {
  const [imgError, setImgError] = useState(false);
  const url = getMediaUrl(path);

  if (url && !imgError) {
    return (
      <img
        src={url}
        alt={name}
        className="size-10 rounded-lg object-contain border bg-muted/20"
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div className="bg-primary/10 flex size-10 items-center justify-center rounded-lg shrink-0">
      <Building2 className="text-primary size-5" />
    </div>
  );
}

// ── Skeleton + empty ──────────────────────────────────────────────────────────

function RelationshipSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-12 rounded-md border bg-muted/20 animate-pulse" />
      ))}
    </div>
  );
}

function EmptyRelationship({ icon: Icon, message }: { icon: typeof Globe; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted/50">
        <Icon className="text-muted-foreground/50 size-7" />
      </div>
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────────────

type OverviewTabProps = {
  brand: Brand;
  accountsCount: number;
  channelsCount: number;
  productsCount: number;
};

function OverviewTab({ brand, accountsCount, channelsCount, productsCount }: OverviewTabProps) {
  return (
    <div className="flex flex-col gap-5">
      {/* KPI metrics strip */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Integration Accounts', value: accountsCount },
          { label: 'Sales Channels',       value: channelsCount },
          { label: 'Products',             value: productsCount },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-md border bg-muted/30 p-2.5 text-center">
            <p className="text-lg font-bold">{value}</p>
            <p className="text-[10px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Detail rows */}
      <dl className="grid gap-3 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Code</dt>
          <dd className="font-mono font-medium">{brand.code}</dd>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Name</dt>
          <dd className="font-medium">{brand.name}</dd>
        </div>
        {brand.slug && (
          <>
            <Separator />
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Slug</dt>
              <dd className="font-mono text-xs text-muted-foreground">{brand.slug}</dd>
            </div>
          </>
        )}
        <Separator />
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Company</dt>
          <dd>{brand.company?.name ?? 'Unassigned'}</dd>
        </div>
        {brand.description && (
          <>
            <Separator />
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground">Description</dt>
              <dd className="text-sm text-muted-foreground/80">{brand.description}</dd>
            </div>
          </>
        )}
        <Separator />
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Created At</dt>
          <dd className="text-muted-foreground text-xs">
            {brand.created_at ? new Date(brand.created_at).toLocaleDateString() : '—'}
          </dd>
        </div>
        {brand.updated_at && (
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Updated At</dt>
            <dd className="text-muted-foreground text-xs">
              {new Date(brand.updated_at).toLocaleDateString()}
            </dd>
          </div>
        )}
      </dl>

      {/* Pricing Policy */}
      {(brand.default_target_margin !== null || brand.default_markup !== null || brand.default_discount_pct !== null) && (
        <div className="rounded-md border bg-muted/20 p-3 flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <Tag className="size-3" />
            Pricing Policy
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {brand.default_target_margin !== null && (
              <div>
                <p className="text-sm font-semibold">{brand.default_target_margin}%</p>
                <p className="text-[10px] text-muted-foreground">Min Margin</p>
              </div>
            )}
            {brand.default_markup !== null && (
              <div>
                <p className="text-sm font-semibold">{brand.default_markup}%</p>
                <p className="text-[10px] text-muted-foreground">Markup</p>
              </div>
            )}
            {brand.default_discount_pct !== null && (
              <div>
                <p className="text-sm font-semibold">{brand.default_discount_pct}%</p>
                <p className="text-[10px] text-muted-foreground">Discount</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Drawer ────────────────────────────────────────────────────────────────────

export function BrandDetailDrawer({ brand, open, onOpenChange, onEdit }: BrandDetailDrawerProps) {
  if (!brand) return null;

  const accountsResult = useBusinessAccountsQuery({ brand_id: brand.id, per_page: 50 }, { enabled: open });
  const channelsResult = useChannelsQuery({ brand_id: brand.id, per_page: 50 }, { enabled: open });
  const productsResult = useProductsQuery({ brand_id: brand.id, per_page: 50 }, { enabled: open });

  const accounts = accountsResult.data?.items ?? [];
  const channels = channelsResult.data?.items ?? [];
  const products = productsResult.data?.items ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col overflow-hidden p-0">
        <SheetTitle className="sr-only">{brand.name} — Brand Details</SheetTitle>

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-3 border-b px-6 py-5 flex-none pr-14">
          <div className="flex items-center gap-3 min-w-0">
            <OrgLogo path={brand.logo} name={brand.name} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-semibold leading-none truncate">{brand.name}</span>
                <Badge
                  variant={brand.is_active ? 'default' : 'secondary'}
                  className="text-[10px] px-1.5 py-0 shrink-0"
                >
                  {brand.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <SheetDescription className="font-mono text-xs mt-0.5">{brand.code}</SheetDescription>
            </div>
          </div>
          {onEdit && (
            <Button variant="outline" size="sm" className="shrink-0" onClick={() => onEdit(brand)}>
              <Pencil className="size-3.5 mr-1" />
              Edit
            </Button>
          )}
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto">
          <Tabs defaultValue="overview">
            <div className="sticky top-0 z-10 bg-background border-b">
              <TabsList className="w-full rounded-none border-0 bg-transparent h-10 gap-0 p-0">
                <TabsTrigger value="overview"          className={TAB_CLS}>Overview</TabsTrigger>
                <TabsTrigger value="pricing"           className={TAB_CLS}>Pricing</TabsTrigger>
                <TabsTrigger value="orders"            className={TAB_CLS}>
                  <ShoppingCart className="size-3 mr-1" />Orders
                </TabsTrigger>
                <TabsTrigger value="channels"          className={TAB_CLS}>Channels</TabsTrigger>
                <TabsTrigger value="products"          className={TAB_CLS}>Products</TabsTrigger>
                <TabsTrigger value="shipping"          className={TAB_CLS}>
                  <Truck className="size-3 mr-1" />Shipping &amp; Delivery
                </TabsTrigger>
                <TabsTrigger value="activity"          className={TAB_CLS}>Activity</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview" className="m-0 px-6 py-5">
              <OverviewTab
                brand={brand}
                accountsCount={accountsResult.data?.meta.total ?? 0}
                channelsCount={channelsResult.data?.meta.total ?? 0}
                productsCount={productsResult.data?.meta.total ?? 0}
              />
            </TabsContent>

            <TabsContent value="pricing" className="m-0 p-0">
              <PolicyWorkspace brandId={brand.id} group="pricing" />
            </TabsContent>

            <TabsContent value="orders" className="m-0 p-0">
              <PolicyWorkspace brandId={brand.id} group="order" />
            </TabsContent>

            <TabsContent value="business-accounts" className="m-0 px-6 py-5">
              {accountsResult.isLoading ? (
                <RelationshipSkeleton />
              ) : accounts.length === 0 ? (
                <EmptyRelationship icon={Briefcase} message="No integration accounts linked to this brand." />
              ) : (
                <div className="flex flex-col gap-2">
                  {accounts.map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center gap-3 rounded-md border px-3 py-2.5"
                    >
                      <div className="bg-primary/10 flex size-7 items-center justify-center rounded shrink-0">
                        <Briefcase className="text-primary size-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{account.name}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">{account.code}</p>
                      </div>
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        {account.provider}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="channels" className="m-0 px-6 py-5">
              {channelsResult.isLoading ? (
                <RelationshipSkeleton />
              ) : channels.length === 0 ? (
                <EmptyRelationship icon={Globe} message="No sales channels linked to this brand." />
              ) : (
                <div className="flex flex-col gap-2">
                  {channels.map((channel) => (
                    <div
                      key={channel.id}
                      className="flex items-center gap-3 rounded-md border px-3 py-2.5"
                    >
                      <div className="bg-primary/10 flex size-7 items-center justify-center rounded shrink-0">
                        <Globe className="text-primary size-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{channel.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{channel.store_url}</p>
                      </div>
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        {channel.platform_label}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="products" className="m-0 px-6 py-5">
              {productsResult.isLoading ? (
                <RelationshipSkeleton />
              ) : products.length === 0 ? (
                <EmptyRelationship icon={Package} message="No products linked to this brand." />
              ) : (
                <div className="flex flex-col gap-2">
                  {products.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center gap-3 rounded-md border px-3 py-2.5"
                    >
                      <div className="bg-primary/10 flex size-7 items-center justify-center rounded shrink-0">
                        <Package className="text-primary size-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{product.name}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">{product.sku}</p>
                      </div>
                      <Badge variant={product.is_active ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                        {product.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  ))}
                  {(productsResult.data?.meta.total ?? 0) > products.length && (
                    <p className="text-center text-xs text-muted-foreground pt-1">
                      Showing {products.length} of {productsResult.data?.meta.total} products
                    </p>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="shipping" className="m-0 p-0">
              <Tabs defaultValue="general">
                <div className="border-b px-6">
                  <TabsList className="rounded-none border-0 bg-transparent h-9 gap-0 p-0 -mb-px">
                    <TabsTrigger value="general"    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-full text-xs px-3">General</TabsTrigger>
                    <TabsTrigger value="time-slots" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-full text-xs px-3">Delivery Windows</TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="general" className="m-0 px-6 py-5">
                  <BrandShippingTab brandId={brand.id} />
                </TabsContent>
                <TabsContent value="time-slots" className="m-0 px-6 py-5">
                  <BrandDeliveryWindowsTab brandId={brand.id} />
                </TabsContent>
              </Tabs>
            </TabsContent>

            <TabsContent value="activity" className="m-0 px-6 py-5">
              <EmptyRelationship icon={History} message="Activity log will be available in a future update." />
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
