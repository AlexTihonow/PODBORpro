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
    hint: "server side development, APIs, databases",
    children: {
      go: leaf("Go", "Golang"),
      python: leaf("Python", "Python, Django, FastAPI"),
      java: leaf("Java", "Java, Kotlin, Spring"),
      php: leaf("PHP", "PHP, Laravel, Symfony"),
      node: leaf("Node.js", "Node.js, NestJS"),
      dotnet: leaf("C#/.NET", "C#, .NET"),
      cpp: leaf("C/C++", "C, C++"),
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
  devops: leaf("DevOps", "infrastructure, CI/CD, Kubernetes, SRE"),
  data: {
    label: "Data",
    hint: "data engineering, machine learning, data science",
    children: {
      engineering: leaf("Data Engineering", "ETL, data pipelines, DWH"),
      science: leaf("ML / Data Science", "machine learning, models, data science"),
    },
  },
  analytics: {
    label: "Аналитика",
    hint: "business, system or product analysis",
    children: {
      business: leaf("Бизнес-аналитика", "business analyst, requirements"),
      system: leaf("Системная аналитика", "system analyst, integrations, specifications"),
      product: leaf("Продуктовая аналитика", "product metrics, data analyst"),
    },
  },
  management: leaf("Менеджмент", "project, product or team management"),
  design: leaf("Дизайн", "UI/UX design"),
  support: leaf("Поддержка", "technical support, administration"),
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
