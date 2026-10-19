export type QuickFilterChip = {
  key: string;
  label: string;
  count?: number;
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
};

export type PageLoadingVariant = 'spinner' | 'table' | 'cards' | 'list';

export type PageDrawerSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
