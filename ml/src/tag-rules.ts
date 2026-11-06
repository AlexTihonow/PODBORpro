type Rule = [path: string[], pattern: RegExp];

const DOMAINS: Rule[] = [
  [["qa"], /(тестиров|\bqa\b|quality assurance|автотест)/i],
  [["analytics", "system"], /(системн\S* аналитик|system analyst)/i],
  [["analytics", "business"], /((бизнес|коммерческ)\S*[- ]аналитик|business analyst)/i],
  [["analytics", "product"], /(аналитик\S* данных|data analyst|продуктов\S* аналитик|product analyst|аналитик-разработчик bi|bi[- ]аналитик)/i],
  [["analytics"], /(аналитик|analyst)/i],
  [["support"], /(техническ\S* поддержк|специалист\S* поддержк|servicedesk|service desk|helpdesk|support engineer)/i],
  [["devops"], /(devops|\bsre\b|системн\S* администратор|sysadmin)/i],
  [["data", "engineering"], /(\bdwh\b|\betl\b|data engineer|инженер данных)/i],
  [["fullstack"], /(full[\s\-‑]?stack|фулстек|фуллстек)/i],
  [["data", "science"], /(\bml\b|machine learning|data scien|\bllm|\bai[\s-]*(engineer|инженер|разработчик|tech lead)|ai-first разработчик)/i],
  [["mobile", "ios"], /\bios\b/i],
  [["mobile", "android"], /\bandroid\b/i],
  [["mobile"], /(mobile|мобильн|flutter|react native)/i],
  [["management"], /(менеджер|manager|delivery|руководитель проект)/i],
];

const FRONTEND = /(frontend|front-end|фронтенд|фронт-энд|верстальщик|верстк)/i;
const BACKEND = /(backend|back-end|бэкенд|бэкэнд|бекенд)/i;

const FRONTEND_STACK: Rule[] = [
  [["react"], /\breact\b|next\.js/i],
  [["vue"], /\bvue|nuxt/i],
  [["angular"], /\bangular/i],
];

const BACKEND_STACK: Rule[] = [
  [["go"], /(\bgo\b|golang|\bgo-|-go\b)/i],
  [["python"], /(python|django|fastapi|питон)/i],
  [["java"], /(\bjava\b|kotlin|spring)/i],
  [["php"], /(\bphp|laravel|symfony)/i],
  [["node"], /(node\.?js|\bnode\b|nestjs)/i],
  [["dotnet"], /(\.net|c#|с#)/i],
  [["cpp"], /(c\+\+|\bc\/c\+\+)/i],
  [["onec"], /(\b1с\b|\b1c\b)/i],
];

function first(rules: Rule[], ...texts: string[]): string[] | null {
  for (const text of texts) {
    const hit = rules.find(([, pattern]) => pattern.test(text));
    if (hit) return hit[0];
  }
  return null;
}

export function tagFromRules(title: string, skills: string[]): string[] | null {
  const stack = skills.join(", ");
  const domain = first(DOMAINS, title);
  if (domain) {
    if (domain[0] === "qa") return ["qa", ...qaKind(title, stack)];
    return domain;
  }
  if (FRONTEND.test(title)) return ["frontend", ...(first(FRONTEND_STACK, title, stack) ?? [])];
  const language = first(BACKEND_STACK, title);
  if (language || BACKEND.test(title)) return ["backend", ...(language ?? first(BACKEND_STACK, stack) ?? [])];
  return null;
}

function qaKind(title: string, stack: string): string[] {
  if (/(автоматиз|automation|автотест|aqa)/i.test(title)) return ["automation"];
  if (/(ручн|manual)/i.test(title)) return ["manual"];
  if (/(playwright|selenium|pytest|cypress|автотест)/i.test(stack)) return ["automation"];
  return [];
}
