import { z } from 'zod';

/**
 * Validation for the CRM customer form.
 *
 * Field lengths mirror CustomerController exactly, so the form rejects what the
 * API would reject rather than discovering it on submit.
 *
 * CREATE and UPDATE accept different fields. `update` takes only the profile
 * fields — no type, status, phone or email — because identity is fixed at
 * creation and contact details are managed through their own endpoints
 * (/phones, /emails). The two schemas are separate for that reason; a single
 * schema would let the edit form offer fields the API silently drops.
 */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal('').transform(() => undefined));

const shared = {
  first_name: optionalText(120),
  last_name: optionalText(120),
  business_name: optionalText(200),
  tax_registration_number: optionalText(60),
  contact_person: optionalText(200),
  customer_group_id: optionalText(64),
  preferred_language: optionalText(10),
  preferred_contact_method: optionalText(20),
  country: optionalText(100),
  city: optionalText(100),
  notes: optionalText(5000),
};

export const crmCustomerCreateSchema = z
  .object({
    type: z.enum(['individual', 'business']),
    status: z.enum(['prospect', 'active', 'inactive', 'blocked', 'archived']).optional(),
    phone: optionalText(40),
    email: z
      .string()
      .trim()
      .email()
      .max(200)
      .optional()
      .or(z.literal('').transform(() => undefined)),
    ...shared,
  })
  // A customer needs something to be called. Which field supplies it depends on
  // the type, so this cannot be expressed per-field.
  .refine(
    (v) => (v.type === 'business' ? Boolean(v.business_name) : Boolean(v.first_name)),
    { path: ['identity'], message: 'nameRequired' },
  );

export const crmCustomerUpdateSchema = z.object(shared);

export type CrmCustomerCreateValues = z.infer<typeof crmCustomerCreateSchema>;
export type CrmCustomerUpdateValues = z.infer<typeof crmCustomerUpdateSchema>;
