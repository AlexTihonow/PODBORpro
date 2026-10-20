import { clearAccessToken, getAccessToken, getProfile, getStoredUser, setProfile } from "./session.js";

const CONFIG = {
  apiBase: "/api/v1",
  useStubs: null,
  stubDelay: 420,
  ...(window.PODBOR_CONFIG ?? {}),
};

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function shouldUseStubs() {
  if (CONFIG.useStubs !== null && CONFIG.useStubs !== undefined) return Boolean(CONFIG.useStubs);

  const forced = new URLSearchParams(location.search).get("stubs");
  if (forced !== null) return !["0", "false", "no"].includes(forced.toLowerCase());

  try {
    const saved = localStorage.getItem("podbor.use_stubs");
    if (saved !== null) return saved !== "false";
  } catch {
    // Хранилище недоступно — используем автоопределение.
  }

  if (location.protocol === "file:") return true;
  if (location.hostname.endsWith("github.io")) return true;
  if (location.port === "8080") return false;
  return true;
}

export async function request(method, path, body, options = {}) {
  if (shouldUseStubs()) return requestStub(method, path, body);
  return requestHttp(method, path, body, options);
}

async function requestHttp(method, path, body, options) {
  const headers = {};
  let payload;

  if (body !== undefined) {
    if (body instanceof FormData) {
      payload = body;
    } else {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
  }

  const token = getAccessToken();
  if (token && options.auth !== false) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${CONFIG.apiBase}${path}`, {
      method,
      headers,
      body: payload,
      signal: options.signal,
    });
  } catch {
    throw new ApiError(0, "network", "Нет связи с сервером. Проверьте подключение и попробуйте ещё раз.");
  }

  if (response.status === 204) return undefined;

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Тело ответа может быть пустым.
  }

  if (!response.ok) {
    const error = data?.error ?? {};
    if (response.status === 401) clearAccessToken();
    throw new ApiError(response.status, error.code ?? "unknown", error.message ?? `Ошибка ${response.status}`);
  }

  return data;
}

/* ------------------------------------------------------------------ */
/* Демо-данные и заглушки                                             */
/* ------------------------------------------------------------------ */

const V = {
  goJunior: {
    id: 4821,
    title: "Разработчик на Go",
    company: "Ромашка",
    city: "Москва",
    grade: "junior",
    work_format: "hybrid",
    salary_from: 180000,
    salary_to: null,
    currency: "RUB",
    skills: [
      { id: 12, name: "Go" },
      { id: 31, name: "PostgreSQL" },
      { id: 40, name: "Docker" },
    ],
    source: "headhunter",
    url: "https://hh.ru/vacancy/4821",
    published_at: "2026-10-03T09:15:00Z",
  },
  goMiddle: {
    id: 5102,
    title: "Go-разработчик в платёжный сервис",
    company: "Финтех Лаб",
    city: "Санкт-Петербург",
    grade: "middle",
    work_format: "remote",
    salary_from: 250000,
    salary_to: 320000,
    currency: "RUB",
    skills: [
      { id: 12, name: "Go" },
      { id: 31, name: "PostgreSQL" },
      { id: 52, name: "gRPC" },
      { id: 40, name: "Docker" },
    ],
    source: "headhunter",
    url: "https://hh.ru/vacancy/5102",
    published_at: "2026-10-06T11:40:00Z",
  },
  python: {
    id: 4987,
    title: "Backend-разработчик Python",
    company: "DataWave",
    city: "Москва",
    grade: "junior",
    work_format: "office",
    salary_from: 130000,
    salary_to: 160000,
    currency: "RUB",
    skills: [
      { id: 60, name: "Python" },
      { id: 61, name: "FastAPI" },
      { id: 31, name: "PostgreSQL" },
    ],
    source: "superjob",
    url: "https://superjob.ru/vakansii/4987.html",
    published_at: "2026-10-04T08:20:00Z",
  },
  goSenior: {
    id: 5230,
    title: "Senior Go Engineer",
    company: "CloudForge",
    city: "Удалённо",
    grade: "senior",
    work_format: "remote",
    salary_from: 400000,
    salary_to: null,
    currency: "RUB",
    skills: [
      { id: 12, name: "Go" },
      { id: 70, name: "Kubernetes" },
      { id: 52, name: "gRPC" },
      { id: 31, name: "PostgreSQL" },
    ],
    source: "headhunter",
    url: "https://hh.ru/vacancy/5230",
    published_at: "2026-10-08T07:05:00Z",
  },
  node: {
    id: 5155,
    title: "Backend-разработчик Node.js",
    company: "Marketplace",
    city: "Казань",
    grade: "middle",
    work_format: "hybrid",
    salary_from: 220000,
    salary_to: 260000,
    currency: "RUB",
    skills: [
      { id: 80, name: "Node.js" },
      { id: 81, name: "TypeScript" },
      { id: 31, name: "PostgreSQL" },
      { id: 82, name: "Redis" },
    ],
    source: "headhunter",
    url: "https://hh.ru/vacancy/5155",
    published_at: "2026-10-01T15:30:00Z",
  },
  goStartup: {
    id: 4790,
    title: "Golang-разработчик",
    company: "Северный старт",
    city: "Новосибирск",
    grade: "junior",
    work_format: "remote",
    salary_from: 150000,
    salary_to: 190000,
    currency: "RUB",
    skills: [
      { id: 12, name: "Go" },
      { id: 40, name: "Docker" },
      { id: 83, name: "Git" },
    ],
    source: "superjob",
    url: "https://superjob.ru/vakansii/4790.html",
    published_at: "2026-10-09T12:10:00Z",
  },
};

const DEMO_FEED = [
  {
    vacancy: V.goJunior,
    score: 0.83,
    explanation: {
      matched_skills: ["Go", "PostgreSQL", "Docker"],
      missing_skills: ["Kubernetes"],
      grade_fit: "match",
      parts: { similarity: 0.79, skills: 0.75, grade: 1, freshness: 0.95 },
    },
  },
  {
    vacancy: V.goMiddle,
    score: 0.76,
    explanation: {
      matched_skills: ["Go", "PostgreSQL", "gRPC"],
      missing_skills: ["Docker"],
      grade_fit: "higher",
      parts: { similarity: 0.82, skills: 0.68, grade: 0.7, freshness: 0.91 },
    },
  },
  {
    vacancy: V.goStartup,
    score: 0.71,
    explanation: {
      matched_skills: ["Go", "Docker"],
      missing_skills: ["Git"],
      grade_fit: "match",
      parts: { similarity: 0.74, skills: 0.72, grade: 1, freshness: 0.97 },
    },
  },
  {
    vacancy: V.python,
    score: 0.64,
    explanation: {
      matched_skills: ["Python", "PostgreSQL"],
      missing_skills: ["FastAPI"],
      grade_fit: "match",
      parts: { similarity: 0.66, skills: 0.6, grade: 1, freshness: 0.89 },
    },
  },
  {
    vacancy: V.goSenior,
    score: 0.52,
    explanation: {
      matched_skills: ["Go", "PostgreSQL"],
      missing_skills: ["Kubernetes", "gRPC"],
      grade_fit: "higher",
      parts: { similarity: 0.78, skills: 0.45, grade: 0.4, freshness: 0.94 },
    },
  },
  {
    vacancy: V.node,
    score: 0.38,
    explanation: {
      matched_skills: ["PostgreSQL"],
      missing_skills: ["Node.js", "TypeScript", "Redis"],
      grade_fit: "higher",
      parts: { similarity: 0.48, skills: 0.28, grade: 0.6, freshness: 0.85 },
    },
  },
];

const VACANCY_DETAILS = {
  4821: {
    description:
      "Ищем разработчика в команду платёжного шлюза. Вам предстоит развивать сервисы на Go, проектировать API и следить за стабильностью обработки платежей.\n\nМы работаем небольшими продуктовыми командами, проводим код-ревью и даём время на техническое развитие.",
    also_on: [{ source: "superjob", url: "https://superjob.ru/vakansii/4821.html" }],
  },
  5102: {
    description:
      "Платёжный сервис ищет Go-разработчика для развития ядра транзакций. Задачи: высоконагруженные API, интеграции с банками, очереди и наблюдаемость.\n\nОжидаем уверенный Go, опыт с PostgreSQL и понимание распределённых систем.",
    also_on: [],
  },
  4987: {
    description:
      "Команда аналитики данных собирает сервисы обработки событий. Нужен Python-разработчик для API на FastAPI и внутренних инструментов.\n\nПоможем погрузиться в домен, дадим наставника и понятный план роста.",
    also_on: [{ source: "headhunter", url: "https://hh.ru/vacancy/4987" }],
  },
  5230: {
    description:
      "CloudForge развивает платформу для облачных нагрузок. Ищем senior-инженера на Go: Kubernetes-операторы, gRPC-сервисы, отказоустойчивость и производительность.\n\nВажна самостоятельность и опыт проектирования систем с нуля.",
    also_on: [{ source: "superjob", url: "https://superjob.ru/vakansii/5230.html" }],
  },
  5155: {
    description:
      "Маркетплейс ищет backend-разработчика на Node.js. В зоне ответственности — каталог, корзина и интеграции с партнёрами.\n\nСтек: TypeScript, PostgreSQL, Redis, очереди. Есть гибридный формат и гибкое начало дня.",
    also_on: [],
  },
  4790: {
    description:
      "Небольшая продуктовая команда ищет Golang-разработчика. Нужно поддерживать и развивать сервисы доставки, писать понятный код и тесты.\n\nПредлагаем удалённый формат, современный стек и быстрый цикл принятия решений.",
    also_on: [{ source: "headhunter", url: "https://hh.ru/vacancy/4790" }],
  },
};

const DEFAULT_PROFILE = {
  target_title: "Разработчик на Go",
  target_grade: "junior",
  cities: ["Москва"],
  work_formats: ["remote", "hybrid"],
  salary_from: 120000,
  tone: "neutral",
  resume_status: "none",
  skills: [
    { id: 12, name: "Go" },
    { id: 31, name: "PostgreSQL" },
  ],
};

const DEMO_APPLICATIONS = [
  application(9, V.goJunior, "draft", 15, "2026-10-05T10:00:00Z"),
  application(10, V.goMiddle, "sent", null, "2026-10-07T09:20:00Z"),
  application(11, V.python, "interview", null, "2026-10-09T14:45:00Z"),
  application(12, V.goSenior, "offer", null, "2026-10-11T16:05:00Z"),
  application(13, V.node, "rejected", null, "2026-10-02T11:30:00Z"),
  application(14, V.goStartup, "draft", null, "2026-10-10T08:15:00Z"),
];

function application(id, vacancy, status, letterId, updatedAt) {
  return {
    id,
    vacancy: { ...vacancy, skills: [...vacancy.skills] },
    status,
    letter_id: letterId,
    created_at: updatedAt,
    updated_at: updatedAt,
  };
}

const LETTER_CLAIMS = ["Kubernetes", "запускал кластеры в продакшене"];

let letter = {
  id: 15,
  application_id: 9,
  vacancy_id: 4821,
  content:
    "Здравствуйте! Меня заинтересовала вакансия разработчика на Go. Я работал с Kubernetes и запускал кластеры в продакшене. Готов обсудить задачи команды.",
  version: 1,
  unverified: [],
  updated_at: "2026-10-05T10:00:00Z",
};
letter.unverified = findClaims(letter.content);

let letterVersions = [
  {
    version: 1,
    content: letter.content,
    author: "model",
    created_at: "2026-10-05T10:00:00Z",
  },
];

let applications = DEMO_APPLICATIONS.map(clone);
let cachedFeed = DEMO_FEED.map(clone);

export function getCachedFeedItem(id) {
  return cachedFeed.find((item) => item.vacancy.id === Number(id)) ?? null;
}

async function requestStub(method, path, body) {
  await new Promise((resolve) => setTimeout(resolve, CONFIG.stubDelay));

  const [pathname, queryString = ""] = path.split("?");
  const cleanPath = pathname.replace(/\/+$/, "") || "/";
  const query = new URLSearchParams(queryString);
  const payload = body ?? {};

  if (method === "POST" && cleanPath === "/auth/login") return stubLogin(payload);
  if (method === "POST" && cleanPath === "/auth/register") return stubRegister(payload);
  if (method === "GET" && cleanPath === "/me") return stubMe();
  if (method === "PATCH" && cleanPath === "/me") return stubPatchMe(payload);
  if (method === "GET" && cleanPath === "/feed") return stubFeed(query);
  if (method === "GET" && cleanPath === "/health") {
    return { status: "ok", services: { db: "ok", ml: "ok" } };
  }

  let match = cleanPath.match(/^\/vacancies\/(\d+)$/);
  if (method === "GET" && match) return stubVacancy(Number(match[1]));

  match = cleanPath.match(/^\/vacancies\/(\d+)\/letters$/);
  if (method === "POST" && match) return stubCreateLetter(Number(match[1]));

  match = cleanPath.match(/^\/letters\/(\d+)\/versions$/);
  if (method === "GET" && match) {
    ensureLetter(Number(match[1]));
    return { items: clone(letterVersions) };
  }

  match = cleanPath.match(/^\/letters\/(\d+)$/);
  if (match) {
    ensureLetter(Number(match[1]));
    if (method === "GET") return clone(letter);
    if (method === "PATCH") return stubPatchLetter(payload);
  }

  if (method === "GET" && cleanPath === "/applications") return stubApplications(query);

  match = cleanPath.match(/^\/applications\/(\d+)$/);
  if (method === "PATCH" && match) return stubPatchApplication(Number(match[1]), payload);

  throw new ApiError(404, "not_found", "Не найдено");
}

function stubLogin(body) {
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email || email.startsWith("wrong@")) {
    throw new ApiError(401, "invalid_credentials", "Неверная почта или пароль");
  }

  const known = getStoredUser();
  const user = {
    id: known?.id ?? 42,
    email,
    full_name: known?.email === email ? known.full_name : "Иван Петров",
    is_admin: false,
  };

  return {
    access_token: `stub.${btoa(unescape(encodeURIComponent(email)))}.demo`,
    token_type: "Bearer",
    expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
    user,
  };
}

function stubRegister(body) {
  const email = String(body.email ?? "").trim().toLowerCase();
  const fullName = String(body.full_name ?? "").trim() || "Иван Петров";
  if (!email) throw new ApiError(400, "invalid_request", "Укажите почту");
  if (email === "taken@mail.ru" || email === "taken@example.com") {
    throw new ApiError(409, "email_taken", "Почта уже занята");
  }

  return {
    access_token: `stub.${btoa(unescape(encodeURIComponent(email)))}.demo`,
    token_type: "Bearer",
    expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
    user: { id: 42, email, full_name: fullName, is_admin: false },
  };
}

function stubMe() {
  const user = getStoredUser() ?? {
    id: 42,
    email: "ivan@mail.ru",
    full_name: "Иван Петров",
    is_admin: false,
  };
  const profile = getProfile() ?? clone(DEFAULT_PROFILE);
  return { ...user, profile };
}

function stubPatchMe(body) {
  const current = getProfile() ?? clone(DEFAULT_PROFILE);
  const next = { ...current, ...body };
  setProfile(next);
  const user = getStoredUser() ?? { id: 42, email: "ivan@mail.ru", full_name: "Иван Петров", is_admin: false };
  return { ...user, profile: next };
}

function stubFeed(query) {
  let items = DEMO_FEED.map(clone);
  const city = query.get("city");
  if (city) items = items.filter((item) => item.vacancy.city === city);
  cachedFeed = items;
  return { items, total: items.length, simplified: false };
}

function stubVacancy(id) {
  const item = DEMO_FEED.find((entry) => entry.vacancy.id === id);
  if (!item) throw new ApiError(404, "not_found", "Вакансия не найдена");
  const details = VACANCY_DETAILS[id] ?? { description: "Описание вакансии скоро появится.", also_on: [] };
  return { ...clone(item.vacancy), ...clone(details) };
}

function stubCreateLetter(vacancyId) {
  const item = DEMO_FEED.find((entry) => entry.vacancy.id === vacancyId);
  if (!item) throw new ApiError(404, "not_found", "Вакансия не найдена");
  letter = {
    ...clone(letter),
    id: 15,
    vacancy_id: vacancyId,
    content: `Здравствуйте! Меня заинтересовала вакансия «${item.vacancy.title}». Буду рад обсудить, как мой опыт поможет команде.`,
    version: 1,
    updated_at: new Date().toISOString(),
  };
  letter.unverified = findClaims(letter.content);
  return clone(letter);
}

function ensureLetter(id) {
  if (id !== letter.id) throw new ApiError(404, "not_found", "Письмо не найдено");
}

function stubPatchLetter(body) {
  const content = String(body.content ?? "");
  letter = {
    ...letter,
    content,
    version: Math.max(letter.version, Number(body.version) || letter.version) + 1,
    unverified: findClaims(content),
    updated_at: new Date().toISOString(),
  };
  letterVersions = [
    {
      version: letter.version,
      content,
      author: "user",
      created_at: new Date().toISOString(),
    },
    ...letterVersions,
  ];
  return clone(letter);
}

function stubApplications(query) {
  const status = query.get("status");
  const items = applications.filter((item) => !status || item.status === status);
  return { items: clone(items), total: items.length };
}

function stubPatchApplication(id, body) {
  const item = applications.find((application) => application.id === id);
  if (!item) throw new ApiError(404, "not_found", "Отклик не найден");
  item.status = body.status ?? item.status;
  item.updated_at = new Date().toISOString();
  return clone(item);
}

function findClaims(content) {
  const ranges = [];
  for (const claim of LETTER_CLAIMS) {
    const start = content.indexOf(claim);
    if (start >= 0) ranges.push({ start, end: start + claim.length, text: claim });
  }
  return ranges.sort((a, b) => a.start - b.start);
}

function clone(value) {
  return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

/* ------------------------------------------------------------------ */
/* Публичные методы API                                               */
/* ------------------------------------------------------------------ */

export const login = (email, password) => request("POST", "/auth/login", { email, password });
export const register = (body) => request("POST", "/auth/register", body);
export const getMe = () => request("GET", "/me");
export const patchMe = (body) => request("PATCH", "/me", body);
export const getFeed = (params = {}) => {
  const query = new URLSearchParams();
  if (params.city) query.set("city", params.city);
  if (params.page) query.set("page", String(params.page));
  if (params.per_page) query.set("per_page", String(params.per_page));
  const suffix = query.toString();
  return request("GET", suffix ? `/feed?${suffix}` : "/feed");
};
export const getVacancy = (id) => request("GET", `/vacancies/${id}`);
export const listApplications = (params = {}) => {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.page) query.set("page", String(params.page));
  if (params.per_page) query.set("per_page", String(params.per_page));
  const suffix = query.toString();
  return request("GET", suffix ? `/applications?${suffix}` : "/applications");
};
export const createLetter = (vacancyId, tone) =>
  request("POST", `/vacancies/${vacancyId}/letters`, tone ? { tone } : undefined);
export const getLetter = (id) => request("GET", `/letters/${id}`);
export const patchLetter = (id, content, version) =>
  request("PATCH", `/letters/${id}`, { content, version });
export const listLetterVersions = (id) => request("GET", `/letters/${id}/versions`);
