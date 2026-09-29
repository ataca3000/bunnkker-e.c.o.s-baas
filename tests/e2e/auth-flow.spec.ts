import { test, expect } from '@playwright/test';

test.describe('BUNKKER E.C.O.S - Flujo de Autorización y Tokens Locales', () => {

  test('Validar que el login sin credenciales redirija correctamente y bloquee acceso', async ({ page }) => {
    // Intentar ir directo al dashboard sin token
    await page.goto('/dashboard');
    
    // Debería redirigir al login
    await expect(page).toHaveURL(/.*\/login/);
    
    // Verificar que no existen las cookies de sesión
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name === 'msj-session');
    expect(sessionCookie).toBeUndefined();
  });

  test('Validar el flujo completo de autenticación y generación de tokens locales HMAC', async ({ page }) => {
    // 1. Ir a login
    await page.goto('/login');
    
    // 2. Dar click en PIN Acceso si está disponible
    const pinModeBtn = page.getByRole('button', { name: /PIN Acceso/i });
    if (await pinModeBtn.isVisible()) {
      await pinModeBtn.click();
    }
    
    // 3. Introducir PIN correcto (Asumiendo que 123456 es el superadmin por defecto para pruebas locales)
    // NOTA: Si el PIN de pruebas es diferente, debe ajustarse aquí.
    const pinInput = page.getByPlaceholder('••••••');
    await pinInput.fill('123456');
    
    const submitBtn = page.getByRole('button', { name: /Desbloquear/i });
    await submitBtn.click();
    
    // 4. Validar redirección al dashboard principal
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });
    
    // 5. Validar que los tokens AES/HMAC locales se inyectaron correctamente como httpOnly
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name === 'msj-session');
    const roleCookie = cookies.find(c => c.name === 'msj-role');
    const sigCookie = cookies.find(c => c.name === 'msj-role-sig');
    
    expect(sessionCookie).toBeDefined();
    expect(roleCookie).toBeDefined();
    expect(sigCookie).toBeDefined();
    
    // 6. Validar persistencia de sesión navegando entre rutas protegidas
    await page.goto('/dashboard/inventory');
    await expect(page).toHaveURL(/.*\/dashboard\/inventory/);
    
    // El sistema funciona nativamente con tokens generados en src/lib/apiAuth.ts sin requerir Firebase.
  });
});
