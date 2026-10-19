import type { ComponentType } from 'react';

export type FormDrawerSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export type DrawerFooterAction = {
  label: string;
  onClick?: () => void;
  form?: string;
  type?: 'button' | 'submit';
  loading?: boolean;
  disabled?: boolean;
  icon?: ComponentType<{ className?: string }>;
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary';
};
