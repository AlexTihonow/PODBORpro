export interface TagNode {
  label: string;
  hint: string;
  children?: Record<string, TagNode>;
}

const leaf = (label: string, hint: string): TagNode => ({ label, hint });

export const TAG_ROOT = "it";

export const TAG_TREE: Record<string, TagNode> = {
  backend: {
    label: "Backend",
    hint: "server side development, APIs",
    children: {
      go: leaf("Go", "Golang"),
      python: leaf("Python", "Python, Django, FastAPI"),
      java: leaf("Java", "Java, Kotlin, Spring"),
      php: leaf("PHP", "PHP, Laravel, Symfony"),
      node: leaf("Node.js", "Node.js, NestJS"),
      dotnet: leaf("C#/.NET", "C#, .NET"),
      cpp: leaf("C/C++", "C, C++"),
      rust: leaf("Rust", "Rust"),
      ruby: leaf("Ruby", "Ruby, Ruby on Rails"),
      scala: leaf("Scala", "Scala, Akka"),
      onec: leaf("1С", "1C platform"),
    },
  },
  frontend: {
    label: "Frontend",
    hint: "web interfaces, JavaScript, TypeScript, HTML, CSS",
    children: {
      react: leaf("React", "React, Next.js"),
      vue: leaf("Vue", "Vue, Nuxt"),
      angular: leaf("Angular", "Angular"),
    },
  },
  fullstack: leaf("Fullstack", "both backend and frontend"),
  mobile: {
    label: "Mobile",
    hint: "iOS and Android applications",
    children: {
      ios: leaf("iOS", "Swift, iOS"),
      android: leaf("Android", "Kotlin, Android"),
      crossplatform: leaf("Кроссплатформа", "Flutter, React Native"),
    },
  },
  qa: {
    label: "QA",
    hint: "testing and quality assurance",
    children: {
      manual: leaf("Ручное тестирование", "manual testing, test cases"),
      automation: leaf("Автотесты", "test automation, autotests"),
    },
  },
  devops: leaf("DevOps", "infrastructure, CI/CD, Kubernetes, SRE, system and network administration"),
  data: leaf("Data Engineering", "ETL, data pipelines, DWH, data platforms"),
  database: leaf("Базы данных", "database administration (DBA), SQL and PL/SQL development"),
  analytics: leaf("Аналитика", "system, business, product or data analysis, BI"),
  ai: {
    label: "AI / ML",
    hint: "machine learning, LLM, generative AI, AI agents, AI integration",
    children: {
      ml: leaf("ML / Data Science", "classic machine learning, computer vision, data science, model training"),
      llm: leaf("LLM-разработка", "LLM applications, RAG, AI agents, prompt engineering"),
      integration: leaf("AI-интеграция", "integrating AI into business processes, AI automation, chatbots, LLM APIs"),
      assisted: leaf("AI-assisted разработка", "AI-first development with Cursor, Copilot, Claude Code, vibe coding"),
    },
  },
  management: leaf("Менеджмент", "project, product or engineering management, team lead, CTO"),
  lowcode: leaf("Low-code и платформы", "low-code and BPM platforms (ELMA365, Pega, GreenData), banking platforms (ЦФТ, RS-Bank)"),
  design: leaf("Дизайн", "UI/UX design"),
  support: leaf("Поддержка", "technical support, administration"),
  security: leaf("Безопасность", "information security, AppSec, pentest, SOC, network security"),
  gamedev: leaf("Геймдев", "game development, Unity, Unreal"),
  embedded: leaf("Embedded", "embedded and system programming, firmware, microcontrollers, Linux kernel, robotics"),
  docs: leaf("Техписатели", "technical writing, documentation"),
};

export function childrenAt(path: string[]): Record<string, TagNode> | undefined {
  let level: Record<string, TagNode> | undefined = TAG_TREE;
  for (const key of path) level = level?.[key]?.children;
  return level;
}

export function labelFor(path: string[]): string {
  const names: string[] = [];
  let level: Record<string, TagNode> | undefined = TAG_TREE;
  for (const key of path) {
    const node: TagNode | undefined = level?.[key];
    if (!node) break;
    names.push(node.label);
    level = node.children;
  }
  return names.join(" / ");
}
