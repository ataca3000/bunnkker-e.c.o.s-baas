import { useTranslation } from 'react-i18next';

import { PhoneCell } from '@/components/ecos/phone-cell';

type OrderPhoneCellProps = {
  phone: string | null;
};

/**
 * DD-013 — Clicking a phone number opens Call / WhatsApp / Copy actions.
 * Wraps the generic PhoneCell with translated labels from the 'orders' namespace.
 */
export function OrderPhoneCell({ phone }: OrderPhoneCellProps) {
  const { t } = useTranslation('orders');

  return (
    <PhoneCell
      phone={phone}
      labels={{
        call:     t($ => $.phone.call),
        whatsapp: t($ => $.phone.whatsapp),
        copy:     t($ => $.phone.copy),
        copied:   t($ => $.phone.copied),
      }}
    />
  );
}
