/**
 * Пометки для тестов (data-testid). Правило согласовано с тестировщиком:
 * имя складывается из префикса экрана и назначения элемента через дефис.
 * Список форм входа/регистрации — из 04-klientskaya.md, раздел 3.3.
 */
export const TEST_IDS = {
  loginEmail: "login-email",
  loginPassword: "login-password",
  loginSubmit: "login-submit",
  loginError: "login-error",

  registerEmail: "register-email",
  registerName: "register-name",
  registerPassword: "register-password",
  registerSubmit: "register-submit",
  registerError: "register-error",
} as const;
