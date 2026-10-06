/**
 * Проверка полей до отправки (клиентская часть).
 * Тексты должны совпадать по смыслу с серверными из openapi.yaml.
 * Эти проверки срабатывают после ухода из поля, а не на каждую букву.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | null {
  const value = email.trim();
  if (!value) return "Укажите почту";
  if (!EMAIL_PATTERN.test(value)) return "Похоже, в почте опечатка";
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return "Укажите пароль";
  if (password.length < 8) return "Пароль должен быть не короче 8 символов";
  return null;
}

export function validateName(name: string): string | null {
  if (!name.trim()) return "Укажите имя";
  return null;
}
