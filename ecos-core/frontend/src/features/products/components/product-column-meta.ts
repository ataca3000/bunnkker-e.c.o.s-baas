import type { ColumnMeta } from '@/components/data-grid/types';

/**
 * Canonical column metadata for the Products workspace.
 * Drives both useColumnVisibility (persistence) and ColumnVisibilityMenu (toggle UI).
 * Final approved layout: 17 columns per PKG-PRODUCT-004.
 */
export const PRODUCT_COLUMN_META: ColumnMeta[] = [
  { key: 'image',          label: 'Image',          alwaysVisible: false, defaultVisible: true  },
  { key: 'name',           label: 'Name',           alwaysVisible: true                         },
  { key: 'category',       label: 'Category',       defaultVisible: true                        },
  { key: 'channels',       label: 'Channels',       defaultVisible: true                        },
  { key: 'product_cost',   label: 'Product Cost',   defaultVisible: true                        },
  { key: 'regular_price',  label: 'Regular Price',  defaultVisible: true                        },
  { key: 'sale_price',     label: 'Sale Price',     defaultVisible: true                        },
  { key: 'gross_profit',   label: 'Gross Profit %', defaultVisible: true                        },
  { key: 'final_margin',   label: 'Final Margin %', defaultVisible: true                        },
  { key: 'stock_status',   label: 'Stock Status',   defaultVisible: true                        },
  { key: 'recipe',         label: 'Recipe',         defaultVisible: true                        },
  { key: 'sku',            label: 'SKU',            defaultVisible: false                       },
  { key: 'is_published',   label: 'Published',      defaultVisible: false                       },
  { key: 'sync_status',    label: 'Sync',           defaultVisible: false                       },
  { key: 'updated_at',     label: 'Updated',        defaultVisible: false                       },
  { key: 'pricing_review', label: 'Price Review',   defaultVisible: true                        },
  { key: 'actions',        label: '',               alwaysVisible: true                         },
];
