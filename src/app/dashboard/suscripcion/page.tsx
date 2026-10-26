import { evaluate } from 'flags/next';
import {
  customerBillingPortalEnabled,
  membershipCheckoutEnabled,
  membershipPlanVisibility,
} from '@/flags';
import PricingPage, { type MembershipFlags } from './SuscripcionClient';

export default async function SubscriptionPage() {
  const flags = await evaluate({
    checkoutEnabled: membershipCheckoutEnabled,
    customerBillingPortalEnabled,
    planVisibility: membershipPlanVisibility,
  });

  return <PricingPage flags={flags satisfies MembershipFlags} />;
}
