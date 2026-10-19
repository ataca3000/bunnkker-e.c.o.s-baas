import { useEffect, useState } from 'react';
import axios from 'axios';
import { zodResolver } from '@hookform/resolvers/zod';
import { BookOpen, ChefHat } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { EntityDrawer, EntityForm } from '@/components/crud';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ProductFormFields } from '@/features/products/components/product-form';
import {
  productSchema,
  toFormValues,
  toPayload,
  type ProductFormValues,
} from '@/features/products/components/product-form-schema';
import { useCreateProduct, useUpdateProduct } from '@/features/products/hooks/use-products';
import type { Product, ProductType } from '@/features/products/types/product';
import { ROUTES } from '@/router/routes';

const FORM_ID = 'product-form';

type ProductFormDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
  defaultType?: ProductType;
};

function extractMessage(error: unknown): string {
  return axios.isAxiosError(error) && typeof error.response?.data?.message === 'string'
    ? error.response.data.message
    : 'Something went wrong. Please try again.';
}

export function ProductFormDrawer({
  open,
  onOpenChange,
  product,
  defaultType = 'finished_good',
}: ProductFormDrawerProps) {
  const { t } = useTranslation('products');
  const { t: tCommon } = useTranslation('common');
  const navigate = useNavigate();
  const isEdit = Boolean(product);
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const [serverError, setServerError] = useState<string | null>(null);
  const [recipePrompt, setRecipePrompt] = useState<Product | null>(null);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: toFormValues(product, defaultType),
  });

  useEffect(() => {
    if (open) {
      form.reset(toFormValues(product, defaultType));
      setServerError(null);
    }
  }, [open, product, defaultType, form]);

  const isPending = createProduct.isPending || updateProduct.isPending;

  const handleOpenChange = (next: boolean) => {
    if (!next) setServerError(null);
    onOpenChange(next);
  };

  const handleSubmit = (values: ProductFormValues) => {
    setServerError(null);
    const payload = toPayload(values);

    if (isEdit && product) {
      updateProduct.mutate(
        { id: product.id, payload },
        {
          onSuccess: () => handleOpenChange(false),
          onError: (error) => setServerError(extractMessage(error)),
        },
      );
    } else {
      createProduct.mutate(payload, {
        onSuccess: (created) => {
          handleOpenChange(false);
          // Offer recipe creation if finished good has no recipe
          if (created.product_type === 'finished_good' && !created.has_recipe) {
            setRecipePrompt(created);
          }
        },
        onError: (error) => setServerError(extractMessage(error)),
      });
    }
  };

  function handleCreateRecipe() {
    if (!recipePrompt) return;
    setRecipePrompt(null);
    navigate(ROUTES.recipesNew, {
      state: { product_id: recipePrompt.id },
    });
  }

  return (
    <>
      <EntityDrawer
        open={open}
        onOpenChange={handleOpenChange}
        title={isEdit ? t($ => $.drawer.editTitle) : t($ => $.drawer.createTitle)}
        description={isEdit ? t($ => $.drawer.editSubtitle) : t($ => $.drawer.createSubtitle)}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              {tCommon($ => $.common.cancel)}
            </Button>
            <Button type="submit" form={FORM_ID} disabled={isPending}>
              {isPending
                ? t($ => $.drawer.saving)
                : isEdit
                  ? t($ => $.drawer.submitEdit)
                  : t($ => $.drawer.submitCreate)}
            </Button>
          </>
        }
      >
        {serverError ? (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>{t($ => $.drawer.errorTitle)}</AlertTitle>
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        ) : null}

        <EntityForm form={form} id={FORM_ID} onSubmit={handleSubmit}>
          <ProductFormFields isEdit={isEdit} existingProduct={product ?? null} />
        </EntityForm>
      </EntityDrawer>

      {/* Post-save recipe prompt (PART 8) */}
      <Dialog open={Boolean(recipePrompt)} onOpenChange={(open) => { if (!open) setRecipePrompt(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex size-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/40">
                <ChefHat className="size-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
              </div>
              <DialogTitle>{t($ => $.recipePrompt.title)}</DialogTitle>
            </div>
            <DialogDescription>
              <strong className="text-foreground">{recipePrompt?.name}</strong>{' '}
              {t($ => $.recipePrompt.description)}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRecipePrompt(null)}>
              {t($ => $.recipePrompt.later)}
            </Button>
            <Button onClick={handleCreateRecipe} className="gap-2">
              <BookOpen className="size-4" aria-hidden />
              {t($ => $.recipePrompt.createRecipe)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
