/**
 * Automation monitoring types — mirror AutomationController.
 *
 * All three endpoints are read-only. There is no endpoint to create, edit or
 * toggle a policy: the catalogue is declared in code and published here for
 * inspection. The UI reflects that and offers no controls it cannot honour.
 */

export type AutomationPolicy = {
  name: string;
  event: string;
  action: string;
  channel: string | null;
  target: string | null;
  min_severity: string | null;
  status_equals: string | null;
  active: boolean;
};

export type AutomationConsumer = {
  event: string;
  consumer: string;
};

export type AutomationMonitoring = {
  generated_at: string;
  consumers: AutomationConsumer[];
  consumer_count: number;
  events_consumed: number;
  policy_count: number;
  active_policy_count: number;
  event_logging: boolean;
  queue: { connection: string | null; retry: unknown } | null;
};

export type AutomationMetrics = {
  generated_at: string;
  exceptions: {
    outstanding: number;
    critical: number;
    needs_attention: number;
    overdue_for_escalation: number;
  };
  conflicts: { open: number; blocking: number };
  alerts: { total: number; critical: number; unacknowledged: number };
};
