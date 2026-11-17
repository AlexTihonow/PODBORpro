// Словарь понятий для разбора русских (и смешанных) вакансий.
//
// Каждое понятие — это набор написаний, которые означают одно и то же, и вклад
// этого понятия в ветки дерева тегов. Шаблон в виде строки:
//   - пишется в нормализованном виде (нижний регистр, «е» вместо «ё»);
//   - `*` — любое окончание слова: «тестировщик*» ловит «тестировщика», «тестировщики»;
//   - пробел — любой разделитель или его отсутствие: «full stack» ловит
//     «fullstack», «full-stack», «full stack»;
//   - границы слова проверяются по Юникоду, поэтому работают и для кириллицы.
// Если строки мало, можно дать RegExp (флаги `iu` добавятся автоматически).
//
// `tags` — пути без корня `it/` и вес понятия для ветки. Ключ `~it` — общий признак
// IT-вакансии без направления, ключ `~nonit` — признак не-IT вакансии.
// `tier` — см. поле в интерфейсе.
// `en` — как понятие назвать модели Laya, которая плохо понимает русский.

export interface Concept {
  id: string;
  en: string;
  match: (string | RegExp)[];
  tags?: Record<string, number>;
  // Насколько слово в названии определяет роль: 2 — функция (тестировщик, аналитик,
  // DevOps), 1 — область разработки (backend, mobile, embedded), 0 — инструмент или
  // уточнение (язык, фреймворк, «тимлид»). В названии роль высшего уровня отсекает
  // направления, подсказанные словами уровнем ниже: «Python Developer (ML)» — это ML,
  // «Mobile QA Engineer» — это QA, а Python и Mobile только уточняют.
  tier?: 1 | 2;
  // Тег-признак: добавляется вторым к основному направлению, если понятие встретилось
  // в названии («title») или в названии либо навыках («strong»).
  attribute?: "title" | "strong";
  // Только признак: не влияет на выбор направления. «AI-first» говорит, как работают,
  // а не кем: «AI-first Full-stack Developer» — fullstack + ai/assisted.
  pure?: boolean;
  // Роль уступает направлениям из списка, если они тоже названы в названии (даже в
  // скобках): «Ведущий аналитик экспертной линии (SOC)» и «Application Security
  // Аналитик» — это безопасность, а не аналитика.
  yieldsTo?: string[];
}

export const IT = "~it";
export const NON_IT = "~nonit";

export const CONCEPTS: Concept[] = [
  // ——— Общие слова должности: дают перевод и признак IT, но не направление ———
  { id: "developer", en: "developer", match: ["разработчик*", "developer", "dev", "программист*", "programmer", "разработк*", "development", "кодер*", "coder"], tags: { [IT]: 1 } },
  { id: "engineer", en: "engineer", match: ["инженер*", "engineer"], tags: { [IT]: 0.5 } },
  { id: "architect", en: "architect", match: ["архитектор*", "architect"], tags: { [IT]: 1 } },
  { id: "specialist", en: "specialist", match: ["специалист*", "specialist", "эксперт*", "expert"] },
  { id: "senior", en: "senior", match: ["senior", "старш*", "ведущ*", "сеньор*", "синьор*"] },
  { id: "middle", en: "middle", match: ["middle", "мидл*"] },
  { id: "junior", en: "junior", match: ["junior", "младш*", "джун*", "начинающ*"] },
  { id: "intern", en: "intern", match: ["стажер*", "intern", "trainee", "практикант*"] },
  { id: "head", en: "head", match: ["руководител*", "head", "директор*", "director"] },
  { id: "team", en: "team", match: ["команд*", "групп*", "team", "отдел*"] },

  // ——— Направления (первый уровень дерева) ———
  { id: "backend", tier: 1, en: "backend", match: ["backend", "back end", "бэкенд*", "бэкэнд*", "бекенд*", "бекэнд*", "серверн* разработ*", "server side"], tags: { backend: 1 } },
  { id: "frontend", tier: 1, en: "frontend", match: ["frontend", "front end", "фронтенд*", "фронтэнд*", "фронт энд*", "верстальщик*", "верстк*", "ui developer"], tags: { frontend: 1 } },
  { id: "web", tier: 1, en: "web developer", match: ["web разработ*", "веб разработ*", "web developer", "web программист*", "веб программист*"], tags: { frontend: 0.5, fullstack: 0.4, backend: 0.2 } },
  { id: "fullstack", tier: 1, en: "fullstack", match: ["full stack", "фулл стек*", "фул стек*", "фулстэк*", "фуллстэк*"], tags: { fullstack: 1 } },
  { id: "mobile", tier: 1, en: "mobile", match: ["mobile", "мобильн*"], tags: { mobile: 1 } },
  { id: "qa", tier: 2, en: "QA engineer", match: ["qa", "тестировщик*", "тестирован*", "quality assurance", "quality engineer", "инженер* по тестировани*", "test engineer", "tester"], tags: { qa: 1 } },
  { id: "devops", tier: 2, en: "DevOps", match: ["devops", "dev ops", "инженер* linux", "linux engineer", "platform engineer", "платформенн* инженер*"], tags: { devops: 1 } },
  { id: "sre", tier: 2, en: "SRE, site reliability", match: ["sre", "site reliability", "reliability engineer"], tags: { devops: 1 } },
  { id: "sysadmin", tier: 2, en: "system administrator", match: ["системн* администратор*", "sysadmin", "system administrator", "администратор* linux", "linux администратор*", "администратор* windows", "администрировани* сервер*", "сетев* инженер*", "network engineer"], tags: { devops: 1 } },
  { id: "devsecops", tier: 2, en: "DevSecOps", match: ["devsecops", "dev sec ops"], tags: { devops: 0.7, security: 0.7 } },
  { id: "ops", tier: 2, en: "operations, infrastructure", match: ["ops", "operations", "инфраструктур*", "infrastructure", "эксплуатаци*"], tags: { devops: 0.7 } },
  { id: "devops_tools", en: "Kubernetes, Terraform, CI/CD", match: ["kubernetes", "k8s", "terraform", "ansible", "helm", "openshift", "prometheus", "gitops", "ci cd"], tags: { devops: 0.4 } },
  { id: "analyst", tier: 2, yieldsTo: ["security"], en: "analyst", match: ["аналитик*", "analyst"], tags: { analytics: 1 } },
  { id: "support", tier: 2, en: "technical support", match: ["техническ* поддержк*", "поддержк* пользовател*", "служб* поддержк*", "специалист* поддержк*", "инженер* поддержк*", "helpdesk", "help desk", "service desk", "servicedesk", "support engineer", "technical support", "инженер* сопровождени*", "сопровождени* систем*", "дежурн* инженер*", "1 линии", "2 линии", "первой линии", "второй линии"], tags: { support: 1 } },
  { id: "monitoring", en: "monitoring", match: ["мониторинг*", "monitoring"], tags: { support: 0.3, devops: 0.3 } },
  { id: "project_manager", tier: 2, en: "project manager", match: ["руководител* проект*", "менеджер* проект*", "руководител* it проект*", "руководител* ит проект*", "менеджер* it проект*", "it project manager", "project manager", "delivery manager", "delivery lead", "scrum master", "agile coach", "руководител* проектн* офис*", "pmo"], tags: { management: 1 } },
  { id: "product_manager", tier: 2, en: "product manager", match: ["product manager", "продакт менеджер*", "продакт*", "product owner", "менеджер* продукт*", "владел* продукт*", "cpo"], tags: { management: 1 } },
  { id: "engineering_manager", tier: 2, en: "engineering manager, head of development", match: ["руководител* разработк*", "руководител* групп* разработк*", "руководител* отдел* разработк*", "руководител* команд* разработк*", "директор* по разработк*", "head of engineering", "head of development", "engineering manager", "technical manager", "технически* менеджер*", "delivery director", "технически* директор*", "cto", "it лидер*", "ит лидер*", "лидер* стрим*"], tags: { management: 1 } },
  { id: "management", tier: 2, en: "management", match: ["руководител* направлени*", "директор* направлени*"], tags: { management: 1 } },
  { id: "teamlead", en: "team lead", match: ["team lead", "teamlead", "тимлид*", "тим лид*", "лидер* команд*", "tech lead", "техлид*", "техническ* лидер*", "head of", "team leader"], tags: { management: 0.8 } },
  { id: "manager", en: "manager", match: ["менеджер*", "manager"], tags: { management: 0.5 } },
  { id: "design", tier: 2, en: "UI/UX designer", match: ["дизайнер*", "designer", "ui ux", "ux ui", "ux", "figma", "веб дизайн*", "web design"], tags: { design: 1 } },
  { id: "security", tier: 2, en: "information security", match: ["информационн* безопасност*", "кибербезопасност*", "техническ* безопасност*", "защит* информаци*", "information security", "cyber security", "cybersecurity", "security engineer", "security lead", "security analyst", "infosec", "ciso", "иб", "сетев* безопасност*", "network security", "архитектор* безопасност*", "архитектор* иб", "security architect", "аналитик* иб", "аналитик* soc", "soc аналитик*", "security аналитик*"], tags: { security: 1 } },
  { id: "appsec", tier: 2, en: "application security", match: ["application security", "appsec", "безопасност* приложени*", "безопасн* разработк*", "sast", "dast", "secure code*", "secure development"], tags: { security: 1 } },
  { id: "soc", tier: 2, en: "SOC, security monitoring, incident response", match: ["soc", "security operations", "siem", "экспертн* лини* soc", "мониторинг* иб", "мониторинг* информационн* безопасност*", "реагировани* на инцидент*", "инцидент* иб", "incident response"], tags: { security: 1 } },
  { id: "pentest", tier: 2, en: "penetration testing", match: ["пентест*", "pentest*", "тестирован* на проникновени*", "penetration test*", "red team", "offensive security", "bug bounty"], tags: { security: 1.5 } },
  { id: "gamedev", tier: 1, en: "game development", match: ["gamedev", "game dev", "геймдев*", "game developer", "разработчик* игр", "игров*", "unity", "unreal", "unity3d", "godot"], tags: { gamedev: 1 } },
  { id: "game", en: "game", match: ["game", "games", "игр"], tags: { gamedev: 0.5 } },
  { id: "embedded", tier: 1, en: "embedded", match: ["embedded", "встраиваем*", "встроенн* по", "микроконтроллер*", "stm32", "openwrt", "firmware", "прошивк*", "fpga", "плис", "rtos", "робототехник*", "ros2", "ros", "linux kernel", "kernel developer", "ядр* linux", "драйвер*"], tags: { embedded: 1 } },
  { id: "techwriter", tier: 2, en: "technical writer", match: ["технически* писател*", "техписател*", "technical writer", "tech writer", "документировани*"], tags: { docs: 1 } },
  { id: "database", tier: 2, en: "database administrator, SQL/PL-SQL developer", match: ["администратор* баз* данных", "администратор* бд", "администратор* субд", "dba", "database administrator", "database engineer", "разработчик* баз* данных", "разработчик* бд", "database developer", "pl sql", "pl pgsql", "plpgsql", "pgsql", "t sql", "transact sql", "sql разработчик*", "разработчик* sql", "oracle developer", "oracle разработчик*", "разработчик* oracle"], tags: { database: 1 } },
  { id: "lowcode", en: "low-code or BPM platform", match: ["low code", "лоукод*", "no code", "elma", "elma365", "elma 365", "pega", "pegasystems", "greendata", "creatio", "terrasoft", "bpmsoft", "mendix", "outsystems", "power apps", "comindware", "directum", "bpm платформ*", "абс", "rstyle", "rs bank", "цфт", "диасофт*"], tags: { lowcode: 1 } },

  // ——— Стек и специализации (второй уровень дерева) ———
  { id: "go", en: "Go (Golang)", match: ["go", "golang", "гошник*"], tags: { "backend/go": 1 } },
  { id: "python", en: "Python", match: ["python", "питон*", "django", "fastapi", "flask", "aiohttp"], tags: { "backend/python": 1 } },
  { id: "java", en: "Java", match: ["java", "spring", "spring boot", "джава"], tags: { "backend/java": 1 } },
  { id: "kotlin", en: "Kotlin", match: ["kotlin", "котлин"], tags: { "backend/java": 0.6, "mobile/android": 0.6 } },
  { id: "php", en: "PHP", match: ["php", "php5", "php7", "php8", "laravel", "symfony", "yii", "yii2", "битрикс*", "bitrix*", "1с битрикс*", "1c битрикс*", "wordpress"], tags: { "backend/php": 1 } },
  { id: "node", en: "Node.js", match: ["node js", "nodejs", "node", "nestjs", "nest js", "express js"], tags: { "backend/node": 1 } },
  { id: "dotnet", en: "C# / .NET", match: [".net", "c#", "с#", "asp.net", "dotnet", "net core", "asp.net core"], tags: { "backend/dotnet": 1 } },
  { id: "cpp", en: "C/C++", match: ["c++", "с++", "c c++", "cpp", "qt"], tags: { "backend/cpp": 1 } },
  { id: "rust", en: "Rust", match: ["rust"], tags: { "backend/rust": 1 } },
  { id: "ruby", en: "Ruby", match: ["ruby", "rails", "ruby on rails", "ror"], tags: { "backend/ruby": 1 } },
  { id: "scala", en: "Scala", match: ["scala", "akka"], tags: { "backend/scala": 1 } },
  { id: "onec", en: "1C platform", match: [/(?<![\p{L}\p{N}])1[сc](?![\p{L}\p{N}])(?![\s-]*(?:битрикс|bitrix))/u, "1с erp", "1с предприятие"], tags: { "backend/onec": 1 } },
  { id: "javascript", en: "JavaScript / TypeScript", match: ["javascript", "js", "typescript", "ts", "html", "css"], tags: { frontend: 0.4 } },
  { id: "react", en: "React", match: [/(?<![\p{L}\p{N}])react(?:js|\.js)?(?![\p{L}\p{N}])(?![\s-]*native)/u, "next js", "nextjs", "redux"], tags: { "frontend/react": 1 } },
  { id: "vue", en: "Vue", match: ["vue", "vuejs", "vue js", "nuxt", "nuxtjs", "nuxt js", "pinia", "vuex"], tags: { "frontend/vue": 1 } },
  { id: "angular", en: "Angular", match: ["angular", "angularjs", "rxjs"], tags: { "frontend/angular": 1 } },
  { id: "ios", en: "iOS, Swift", match: ["ios", "swift", "swiftui", "objective c"], tags: { "mobile/ios": 1 } },
  { id: "android", en: "Android", match: ["android", "андроид*", "jetpack compose"], tags: { "mobile/android": 1 } },
  { id: "crossplatform", en: "Flutter / React Native", match: ["flutter", "dart", "react native", "кроссплатформ*", "cross platform"], tags: { "mobile/crossplatform": 1 } },
  { id: "qa_manual", tier: 2, en: "manual testing, test cases", match: ["ручн* тестировани*", "ручн* тестировщик*", "ручн* qa", "ручное", "ручной", "manual", "manual qa", "manual testing", "тест кейс*", "test case*", "чек лист*", "функциональн* тестировани*", "регрессионн* тестировани*"], tags: { "qa/manual": 1 } },
  { id: "qa_auto", tier: 2, en: "test automation, autotests", match: ["автотест*", "qa auto", "auto qa", "qa automation", /(?<![\p{L}\p{N}])auto(?=[\s\/-]*manual)/u, /(?<=manual[\s\/-]*)auto(?![\p{L}\p{N}])/u, "автоматизац* тестировани*", "автоматизирован* тестировани*", "автоматизатор*", "automation", "aqa", "sdet", "selenium", "playwright", "cypress", "pytest", "appium", "selenide", "allure", "нагрузочн* тестировани*", "load testing", "jmeter", "k6"], tags: { "qa/automation": 1 } },
  { id: "system_analyst", tier: 2, en: "system analyst, integrations, specifications", match: ["системн* аналитик*", "system analyst", "системн* анализ*", "bpmn", "uml"], tags: { analytics: 1 } },
  { id: "business_analyst", tier: 2, en: "business analyst, requirements", match: ["бизнес аналитик*", "коммерческ* аналитик*", "business analyst", "бизнес анализ*", "финансов* аналитик*"], tags: { analytics: 1 } },
  { id: "product_analyst", tier: 2, en: "data analyst, product metrics, BI", match: ["аналитик* данных", "data analyst", "продуктов* аналитик*", "product analyst", "bi", "bi аналитик*", "веб аналитик*", "power bi", "tableau", "superset", "qlik*", "qlikview", "qlik sense", "a b тест*"], tags: { analytics: 1 } },
  { id: "data_engineering", tier: 2, en: "data engineering, ETL, DWH", match: ["data engineer", "инженер* данных", "dwh", "etl", "elt", "airflow", "spark", "hadoop", "greenplum", "dbt", "хранилищ* данных", "кхд", "корпоративн* хранилищ*"], tags: { data: 1 } },
  { id: "data_science", tier: 2, en: "machine learning, data science", match: ["ml", "machine learning", "машинн* обучени*", "data scien*", "data scientist", "исследовани* данных", "nlp", "computer vision", "компьютерн* зрени*", "cv engineer", "cv", "нейросет*", "neural", "pytorch", "tensorflow", "deep learning", "mlops", "ml engineer", "ml инженер*", "ai/ml", "ml/ai", "рекомендательн* систем*", "scikit learn", "catboost"], tags: { "ai/ml": 1.2 } },

  // ——— AI: LLM-разработка, AI-интеграция и разработка с AI-инструментами ———
  // `attribute` — тег, который добавляется вторым к основному направлению, если
  // понятие есть в названии («title») или в названии и навыках («strong»):
  // «Fullstack-разработчик (внедрение ИИ)» → fullstack + ai/integration.
  { id: "ai_role", tier: 2, en: "AI engineer", match: ["ai engineer", "ai инженер*", "ии инженер*", "ai developer", "ai разработчик*", "ии разработчик*", "разработчик* ии", "разработчик* ии решени*", "разработчик* ai решени*", "ai специалист*", "специалист* по ии", "ai architect", "ai архитектор*", "ai solution* architect*", "ai solution* engineer*", "ai tech lead", "ai lead", "prompt engineer*", "промпт инженер*"], tags: { ai: 1 } },
  { id: "llm", en: "LLM, RAG, AI agents", attribute: "strong", pure: true, match: ["llm*", "rag", "langchain", "langgraph", "llamaindex", "llama index", "ai agent*", "ai агент*", "ии агент*", "llm агент*", "agentic", "генеративн* ии", "generative ai", "genai", "gen ai", "gpt*", "fine tun*", "файнтюн*", "векторн* баз*", "vector db*", "vector database*", "mcp server*", "mcp сервер*", "model context protocol", "prompt engineering", "промптинг*", "transformers", "hugging face", "huggingface"], tags: { "ai/llm": 1 } },
  { id: "ai_integration", en: "AI integration, AI automation of business processes", attribute: "strong", pure: true, match: ["внедрени* ии", "внедрени* ai", "внедрени* искусственн* интеллект*", "интеграци* ии", "интеграци* ai", "интеграци* llm", "ai integration", "ai автоматизац*", "ии автоматизац*", "автоматизац* с ии", "автоматизац* с помощью ии", "автоматизац* на базе ии", "ai automation", "чат бот*", "чатбот*", "chatbot*", "chat bot*", "ии помощник*", "ai помощник*", "ai ассистент*", "ии ассистент*", "ai assistant*", "openai api", "chatgpt api", "yandexgpt", "yandex gpt", "gigachat", "гигачат*"], tags: { "ai/integration": 1 } },
  { id: "ai_assisted", en: "AI-assisted development, vibe coding", attribute: "strong", pure: true, match: ["ai first", "ai driven", "ai native", "ai assisted", "ai powered development", "вайбкод*", "вайб код*", "vibe cod*", "vibecod*", "cursor", "copilot", "github copilot", "claude code", "codex", "windsurf", "разработк* с ии", "разработк* с помощью ии"], tags: { "ai/assisted": 1 } },
  { id: "ai", en: "AI", match: ["ai", "ии", "ии решени*", "искусственн* интеллект*", "artificial intelligence"], tags: { ai: 0.6 } },

  // ——— Признаки не-IT вакансии ———
  { id: "sales", en: "sales", match: ["продаж*", "sales", "b2b продаж*", "активн* продаж*", "назначени* встреч", "организаци* встреч", "клиентск* баз*", "business development", "развити* бизнес*", "account manager", "аккаунт менеджер*", "market manager", "маркет менеджер*", "sales manager", "менеджер* по продаж*", "sales representative"], tags: { [NON_IT]: 1 } },
  { id: "hr", en: "HR, recruiting", match: ["подбор* персонал*", "рекрутер*", "рекрутмент*", "recruiter", "hr", "hrbp", "hrg", "адаптаци* персонал*"], tags: { [NON_IT]: 1 } },
  { id: "marketing", en: "marketing", match: ["маркетинг*", "marketing", "маркетолог*", "smm", "pr менеджер*"], tags: { [NON_IT]: 1 } },
  { id: "logistics", en: "logistics, warehouse", match: ["маркировк*", "честн* знак*", "склад*", "логист*", "закуп*", "запас*", "снабжени*"], tags: { [NON_IT]: 1 } },
  { id: "finance", en: "accounting", match: ["бухгалтер*", "accountant", "экономист*"], tags: { [NON_IT]: 1 } },
  { id: "production", en: "production technologist", match: ["технолог", "технологи пищев*", "technologist", "производств*"], tags: { [NON_IT]: 1 } },
];

const LETTER = "[\\p{L}\\p{N}]";

function compile(pattern: string): RegExp {
  const body = pattern
    .split(" ")
    .map((word) =>
      word
        .split("*")
        .map((part) => part.replace(/[.+?^${}()|[\]\\/]/g, (ch) => `\\${ch}`))
        .join("\\p{L}*"),
    )
    .join("[\\s\\-/]*");
  return new RegExp(`(?<!${LETTER})${body}(?!${LETTER})`, "giu");
}

export interface CompiledConcept extends Concept {
  patterns: RegExp[];
}

export const COMPILED: CompiledConcept[] = CONCEPTS.map((concept) => ({
  ...concept,
  patterns: concept.match.map((m) => (typeof m === "string" ? compile(m) : new RegExp(m.source, "giu"))),
}));
