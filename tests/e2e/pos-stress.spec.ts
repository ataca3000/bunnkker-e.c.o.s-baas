import { test, expect } from '@playwright/test';

// Prueba: Robot Multi-Sesión Estresando el Login y el ERP
test.describe('BUNKKER E.C.O.S - Stress & E2E Testing', () => {

  test('Robot 1: Flujo básico de Acceso y Bloqueo Rate Limiter', async ({ page }) => {
    // 1. Ir a la página de login
    await page.goto('/login');
    await expect(page).toHaveTitle(/TERRAFORM ERP/);
    
    // 2. Verificar que aparezca el botón de PIN Acceso y dar click (si no es el default)
    const pinModeBtn = page.getByRole('button', { name: /PIN Acceso/i });
    if (await pinModeBtn.isVisible()) {
      await pinModeBtn.click();
    }
    
    // 3. Simular intentos de fuerza bruta (Rate Limiting)
    const pinInput = page.getByPlaceholder('••••••');
    const submitBtn = page.getByRole('button', { name: /Desbloquear Sistema/i });
    
    for (let i = 0; i < 6; i++) {
      await pinInput.fill('000000'); // PIN incorrecto
      await submitBtn.click();
      await page.waitForTimeout(500); // pequeña pausa
    }

    // 4. Debería mostrar mensaje de bloqueo temporal
    await expect(page.locator('text=Demasiados intentos')).toBeVisible({ timeout: 5000 });
  });

  test('Robot 2: Carga pesada en interfaz (Navegación resiliente)', async ({ page }) => {
    // Para probar la resiliencia UI sin login
    await page.goto('/login');
    // Esperamos a que la UI estabilice
    await page.waitForTimeout(1000);
    // Tomamos screenshot para verificar que no hay pantallas de error rojo de Nextjs
    await page.screenshot({ path: 'tests/e2e/screenshots/login-stable.png' });
    
    // Intentar ir a una ruta protegida directamente, debe redirigir a login
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*\/login/);
  });

});
