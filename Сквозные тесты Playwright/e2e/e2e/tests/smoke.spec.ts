import { test, expect } from '@playwright/test';

test('Главная без входа перенаправляет на /login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/.*\/login/);
});

test('Закрытая страница без входа перенаправляет на /login', async ({ page }) => {
  await page.goto('/feed');
  await expect(page).toHaveURL(/.*\/login/);
});

test('Несуществующая страница показывает "Не найдено"', async ({ page }) => {
  await page.goto('/nichego');
  // Ищем по data-testid, как договорились с фронтендом
  await expect(page.getByTestId('not-found-title')).toContainText('Не найдено');
  await expect(page.getByTestId('not-found-title')).toBeVisible();
});

test('Вход на заглушке успешен', async ({ page }) => {
  await page.goto('/login');
  await page.getByTestId('login-email').fill('test@example.com');
  await page.getByTestId('login-password').fill('password123');
  await page.getByTestId('login-submit').click();
  // Ожидаем редирект на feed или onboarding
  await expect(page).toHaveURL(/.*\/(feed|onboarding)/);
});

test('Ошибка входа очищает поле пароля и показывает сообщение', async ({ page }) => {
  await page.goto('/login');
  await page.getByTestId('login-email').fill('wrong@example.com');
  await page.getByTestId('login-password').fill('wrongpassword');
  await page.getByTestId('login-submit').click();

  await expect(page.getByTestId('login-error')).toContainText('Неверная почта или пароль');
  await expect(page.getByTestId('login-password')).toHaveValue('');
});

test('Сервер жив (Health check)', async ({ request }) => {
  const response = await request.get('/api/v1/health');
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.status).toBe('ok'); // или как указано в вашем API
});