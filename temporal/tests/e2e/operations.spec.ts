import { test, expect } from '@playwright/test';

// Mapeo de roles y PINs según la configuración de la base de datos real
const ROLES = [
  { pin: '0000', name: 'SUPERADMIN', expectedUrl: /\/dashboard/ },
  { pin: '1111', name: 'CAJERO', expectedUrl: /\/dashboard\/market/ },
  { pin: '2222', name: 'INVENTARIO', expectedUrl: /\/dashboard\/inventory/ },
  { pin: '3333', name: 'CARGA', expectedUrl: /\/dashboard\/cargas/ },
];

test.describe('BUNKKER E.C.O.S - Escuadrón de Robots por Rol', () => {

  // Generamos un test automático por cada rol
  for (const rol of ROLES) {
    test(`Robot Operativo: ${rol.name} (PIN: ${rol.pin})`, async ({ page }) => {
      // 1. Ir al login
      await page.goto('/login');
      
      const pinModeBtn = page.getByRole('button', { name: /PIN Acceso/i });
      if (await pinModeBtn.isVisible()) {
        await pinModeBtn.click();
      }
      
      // 2. Ingresar el PIN de 4 dígitos correspondiente a este rol
      await page.getByPlaceholder('••••••').fill(rol.pin);
      await page.getByRole('button', { name: /Desbloquear Sistema/i }).click();

      // 3. Verificar que logra entrar al dashboard
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

      // 4. Navegación específica según el rol
      if (rol.name === 'CAJERO' || rol.name === 'SUPERADMIN') {
        const posLink = page.getByRole('link', { name: /Market/i }).first();
        if (await posLink.isVisible()) {
          await posLink.click();
          await expect(page).toHaveURL(/\/dashboard\/market/);
          
          // 1. Agregar al carrito
          const addBtn = page.locator('button:has-text("Agregar")').first();
          if (await addBtn.isVisible()) {
            await addBtn.click();
            await page.waitForTimeout(500); // Dar tiempo a que el cajón reaccione
          }

          // 2. Abrir carrito (si está oculto, suele tener ícono lucide-shopping-cart)
          const cartBtn = page.locator('button:has(.lucide-shopping-cart), button:has-text("Carrito")').first();
          if (await cartBtn.isVisible()) {
            await cartBtn.click();
            await page.waitForTimeout(500);
          }

          // 3. Procesar cobro (checkout)
          const cobrarBtn = page.locator('button:has-text("Procesar"), button:has-text("Siguiente"), button:has-text("Completar")').first();
          if (await cobrarBtn.isVisible()) {
            await cobrarBtn.click();
          }
        }
      }

      // Tomar screenshot de la operación de este rol
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `tests/e2e/screenshots/operacion-${rol.name}.png` });
    });
  }

});
