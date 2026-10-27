import { evaluate } from 'flags/next';
import {
  customerBillingPortalEnabled,
  membershipCheckoutEnabled,
  membershipPlanVisibility,
  freeTierEnabled,
  enterpriseRemoteMonitoringEnabled,
  roleCapabilitySwitchesEnabled,
} from '@/flags';
import PricingPage, { type MembershipFlags } from './SuscripcionClient';

export default async function SubscriptionPage() {
  const flags = await evaluate({
    checkoutEnabled: membershipCheckoutEnabled,
    customerBillingPortalEnabled,
    planVisibility: membershipPlanVisibility,
    freeTierEnabled,
    enterpriseRemoteMonitoringEnabled,
    roleCapabilitySwitchesEnabled,
  });

  return <PricingPage flags={flags as any} />;
}
