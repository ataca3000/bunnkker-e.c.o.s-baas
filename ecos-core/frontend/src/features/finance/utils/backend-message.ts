/**
 * Surfaces the backend's own refusal message rather than a generic string.
 *
 * Finance refusals are specific and actionable — "period is locked", "approver
 * may not be the initiator", "VAT period already settled". Replacing them with
 * a house error message would discard the only information the operator needs
 * to know what to do next.
 */
export function backendMessage(error: unknown): string | undefined {
  return (error as { response?: { data?: { message?: string } } }).response?.data?.message;
}
