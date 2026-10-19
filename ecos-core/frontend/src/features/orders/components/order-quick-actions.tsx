import { Check, ClipboardCopy, Eye, History, MapPin, MessageCircle, Pencil, Phone, Printer } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import type { Order } from '../types/order';

type Props = {
  order: Order;
  onView?: (order: Order) => void;
  onEdit?: (order: Order) => void;
  onNotes?: (order: Order) => void;
  onTimeline?: (order: Order) => void;
  onVerifyPayment?: (order: Order) => void;
  onConfirmCustomer?: (order: Order) => void;
  onPrint?: (order: Order) => void;
};

function IconBtn({
  icon: Icon,
  label,
  onClick,
  href,
  disabled,
}: {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
}) {
  const btn = href ? (
    <Button variant="ghost" size="icon" className="size-6" asChild>
      <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label}>
        <Icon className="size-3" />
      </a>
    </Button>
  ) : (
    <Button
      variant="ghost"
      size="icon"
      className="size-6"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
    >
      <Icon className="size-3" />
    </Button>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{btn}</TooltipTrigger>
      <TooltipContent side="top" className="text-xs">{label}</TooltipContent>
    </Tooltip>
  );
}

export function OrderQuickActions({
  order,
  onView,
  onEdit,
  onNotes: _onNotes,
  onTimeline,
  onVerifyPayment,
  onConfirmCustomer,
  onPrint,
}: Props) {
  const { t } = useTranslation('orders');
  const [copied, setCopied] = useState(false);

  const phone     = order.billing_phone ?? order.customer?.phone;
  const digits    = phone?.replace(/\D/g, '') ?? '';
  const hasGps    = Boolean(order.location?.lat && order.location?.lng);
  const hasAddr   = Boolean(order.city || order.governorate || order.shipping_address_1);
  const mapsUrl   = hasGps
    ? `https://www.google.com/maps?q=${order.location!.lat},${order.location!.lng}`
    : hasAddr
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          [order.city ?? order.shipping_city, order.governorate ?? order.shipping_state].filter(Boolean).join(', '),
        )}`
      : null;

  const needsPaymentVerify = !order.date_paid && order.status === 'awaiting_payment';

  function copyLink() {
    void navigator.clipboard.writeText(`${window.location.origin}/orders/${order.id}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-0.5">
        {onView ? (
          <IconBtn icon={Eye} label={t($ => $.actions.view)} onClick={() => onView(order)} />
        ) : null}

        {onEdit ? (
          <IconBtn icon={Pencil} label={t($ => $.actions.edit)} onClick={() => onEdit(order)} />
        ) : null}

        {phone ? (
          <>
            <IconBtn icon={Phone} label={t($ => $.quickActions.call)} href={`tel:${digits}`} />
            <IconBtn icon={MessageCircle} label={t($ => $.quickActions.whatsapp)} href={`https://wa.me/${digits}`} />
          </>
        ) : null}

        {mapsUrl ? (
          <IconBtn icon={MapPin} label={t($ => $.quickActions.maps)} href={mapsUrl} />
        ) : null}

        {onTimeline ? (
          <IconBtn icon={History} label={t($ => $.drawer.tabs.timeline)} onClick={() => onTimeline(order)} />
        ) : null}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="size-6" onClick={copyLink} aria-label={t($ => $.actions.copyLink)}>
              {copied ? <Check className="size-3 text-emerald-500" /> : <ClipboardCopy className="size-3" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">{copied ? t($ => $.actions.linkCopied) : t($ => $.actions.copyLink)}</TooltipContent>
        </Tooltip>

        {needsPaymentVerify && onVerifyPayment ? (
          <IconBtn icon={Phone} label={t($ => $.quickActions.verifyPayment)} onClick={() => onVerifyPayment(order)} />
        ) : null}

        {onConfirmCustomer && !order.confirmation_result ? (
          <IconBtn
            icon={Pencil}
            label={t($ => $.quickActions.confirmCustomer)}
            onClick={() => onConfirmCustomer(order)}
          />
        ) : null}

        {onPrint ? (
          <IconBtn icon={Printer} label={t($ => $.quickActions.printInvoice)} onClick={() => onPrint(order)} />
        ) : null}
      </div>
    </TooltipProvider>
  );
}
