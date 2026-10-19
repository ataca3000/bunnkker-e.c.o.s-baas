import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { Skeleton } from '@/components/ui/skeleton';
import { CustomerDrawer } from '@/features/customers/components/customer-drawer';
import { CustomerFormDrawer } from '@/features/customers/components/customer-form-drawer';
import { useCustomerQuery } from '@/features/customers/hooks/use-customers';
import type { Customer } from '@/features/customers/types/customer';
import { ROUTES } from '@/router/routes';

export function CustomerProfilePage() {
  const { t } = useTranslation('customers');
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();

  const { data: customer, isLoading, isError } = useCustomerQuery(customerId ?? '');

  const [editOpen, setEditOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);

  function openEdit(c: Customer) {
    setEditCustomer(c);
    setEditOpen(true);
  }

  function handleClose() {
    navigate(ROUTES.customers);
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full max-w-md" />
      </div>
    );
  }

  if (isError || !customer) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-16 text-center">
        <p className="text-sm font-medium text-destructive">{t($ => $.profile.notFound)}</p>
        <button
          type="button"
          className="text-xs text-muted-foreground underline"
          onClick={() => navigate(ROUTES.customers)}
        >
          {t($ => $.profile.backToCustomers)}
        </button>
      </div>
    );
  }

  return (
    <>
      <CustomerDrawer
        customer={customer}
        open
        onOpenChange={(open) => { if (!open) handleClose(); }}
        onEdit={openEdit}
        defaultTab="summary"
      />

      <CustomerFormDrawer
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditCustomer(null);
        }}
        customer={editCustomer}
        initialPhone=""
        onFoundExisting={() => undefined}
      />
    </>
  );
}
