import { expect, test } from "@playwright/test";

const realServer = Boolean(process.env.BASE_URL);

async function signIn(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
}

test("Главная без входа перенаправляет на /login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/.*\/login/);
});

test("Закрытая страница без входа перенаправляет на /login", async ({ page }) => {
  await page.goto("/feed");
  await expect(page).toHaveURL(/.*\/login/);
});

test("Несуществующая страница показывает «Не найдено»", async ({ page }) => {
  await page.goto("/nichego");
  await expect(page.getByTestId("not-found-title")).toContainText("Не найдено");
});

test("Вход на заглушке ведёт в ленту или настройку", async ({ page }) => {
  await signIn(page, "test@example.com", "password123");
  await expect(page).toHaveURL(/.*\/(feed|onboarding)/);
});

test("Ошибка входа очищает поле пароля и показывает сообщение", async ({ page }) => {
  await signIn(page, "wrong@example.com", "wrongpassword");
  await expect(page.getByTestId("login-error")).toContainText("Неверная почта или пароль");
  await expect(page.getByTestId("login-password")).toHaveValue("");
});

test("Лента демо показывает собранные вакансии", async ({ page }) => {
  test.skip(realServer, "только для статического демо");
  await signIn(page, "test@example.com", "password123");
  await expect(page).toHaveURL(/.*\/(feed|onboarding)/);
  await page.goto("/feed");
  await expect(page.locator(".vacancy-card").first()).toBeVisible();
});

test("Сервер жив", async ({ request }) => {
  test.skip(!realServer, "нужен настоящий сервер: BASE_URL");
  const response = await request.get("/api/v1/health");
  expect(response.status()).toBe(200);
  expect((await response.json()).status).toBe("ok");
});
