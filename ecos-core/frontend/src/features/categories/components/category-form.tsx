import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { FormField } from '@/components/crud';
import { Input } from '@/components/ui/input';
import { ParentCategorySelect } from '@/features/categories/components/parent-category-select';
import type { CategoryFormValues } from '@/features/categories/components/category-form-schema';

type CategoryFormFieldsProps = {
  currentId?: string;
};

export function CategoryFormFields({ currentId }: CategoryFormFieldsProps) {
  const { t } = useTranslation('categories');
  const { register, control, watch } = useFormContext<CategoryFormValues>();
  const currentScope = watch('category_scope');

  return (
    <div className="flex flex-col gap-4">
      {/* Category Type (scope) */}
      <FormField name="category_scope" label={t($ => $.form.categoryType)}>
        <Controller
          control={control}
          name="category_scope"
          render={({ field }) => (
            <div className="flex flex-col gap-2 pt-1">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="radio"
                  className="size-4 accent-primary"
                  value="product"
                  checked={field.value === 'product'}
                  onChange={() => field.onChange('product')}
                />
                <span className="text-sm">{t($ => $.form.scopeProduct)}</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="radio"
                  className="size-4 accent-primary"
                  value="material"
                  checked={field.value === 'material'}
                  onChange={() => field.onChange('material')}
                />
                <span className="text-sm">{t($ => $.form.scopeMaterial)}</span>
              </label>
            </div>
          )}
        />
      </FormField>

      <FormField name="parent_id" label={t($ => $.form.parentCategory)}>
        <Controller
          control={control}
          name="parent_id"
          render={({ field }) => (
            <ParentCategorySelect
              value={field.value ?? ''}
              onChange={field.onChange}
              excludeId={currentId}
              scope={currentScope}
            />
          )}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField name="code" label={t($ => $.form.code.label)} required>
          <Input placeholder={t($ => $.form.code.placeholder)} {...register('code')} />
        </FormField>
        <FormField name="name" label={t($ => $.form.name.label)} required>
          <Input placeholder={t($ => $.form.name.placeholder)} {...register('name')} />
        </FormField>
        <FormField name="sort_order" label={t($ => $.form.sortOrder)}>
          <Input type="number" min={0} {...register('sort_order')} />
        </FormField>
      </div>

      <FormField name="description" label={t($ => $.form.description.label)}>
        <Input placeholder={t($ => $.form.description.placeholder)} {...register('description')} />
      </FormField>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="border-input size-4 rounded" {...register('is_active')} />
        {t($ => $.form.active)}
      </label>
    </div>
  );
}
