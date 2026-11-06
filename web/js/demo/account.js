import { ApiError } from "../api/error.js";
import { getProfile, getStoredUser, setProfile } from "../core/session.js";
import { clone } from "./util.js";

const DEMO_USER = { id: 42, email: "ivan@mail.ru", full_name: "Иван Петров", is_admin: false };
const TAKEN_EMAILS = new Set(["taken@mail.ru", "taken@example.com"]);
const SESSION_DAYS = 7;

const DEFAULT_PROFILE = {
  target_title: "Backend-разработчик на Go",
  target_grade: "middle",
  cities: ["Москва"],
  work_formats: ["remote", "hybrid"],
  salary_from: 200000,
  tone: "neutral",
  resume_status: "none",
  skills: [
    { id: 1, name: "Go" },
    { id: 2, name: "PostgreSQL" },
    { id: 3, name: "Docker" },
  ],
};

export function currentProfile() {
  return getProfile() ?? clone(DEFAULT_PROFILE);
}

export function login(body) {
  const email = normalizeEmail(body.email);
  if (!email || email.startsWith("wrong@")) {
    throw new ApiError(401, "invalid_credentials", "Неверная почта или пароль");
  }
  const known = getStoredUser();
  const fullName = known?.email === email ? known.full_name : DEMO_USER.full_name;
  return session({ ...DEMO_USER, id: known?.id ?? DEMO_USER.id, email, full_name: fullName });
}

export function register(body) {
  const email = normalizeEmail(body.email);
  if (!email) throw new ApiError(400, "invalid_request", "Укажите почту");
  if (TAKEN_EMAILS.has(email)) throw new ApiError(409, "email_taken", "Почта уже занята");
  const fullName = String(body.full_name ?? "").trim() || DEMO_USER.full_name;
  return session({ ...DEMO_USER, email, full_name: fullName });
}

export function me() {
  return { ...(getStoredUser() ?? DEMO_USER), profile: currentProfile() };
}

export function patchMe(body) {
  const profile = { ...currentProfile(), ...body };
  setProfile(profile);
  return { ...(getStoredUser() ?? DEMO_USER), profile };
}

function session(user) {
  return {
    access_token: `stub.${btoa(encodeURIComponent(user.email))}.demo`,
    token_type: "Bearer",
    expires_at: new Date(Date.now() + SESSION_DAYS * 864e5).toISOString(),
    user,
  };
}

function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}
