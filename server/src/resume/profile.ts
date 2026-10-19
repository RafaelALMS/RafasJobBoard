import type { ResumeProfile, Seniority } from '@shared'

// ── Skill dictionary ────────────────────────────────────────────────

const SKILLS = [
  // Languages
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C#', 'C++', 'Go', 'Rust', 'PHP', 'Ruby',
  'Swift', 'Kotlin', 'Scala', 'Dart', 'SQL', 'PL/SQL', 'R', 'MATLAB', 'Perl', 'Lua', 'Bash',
  'PowerShell', 'Haskell', 'Elixir', 'Clojure', 'Objective-C', 'Groovy', 'Solidity', 'VBA',
  'HTML', 'CSS', 'Sass', 'Less', 'GraphQL',
  // Frontend / mobile
  'React', 'Angular', 'Vue', 'Svelte', 'Next.js', 'Nuxt', 'Remix', 'Astro', 'jQuery',
  'React Native', 'Flutter', 'Ionic', 'Xamarin', 'Electron', 'Tauri', 'Tailwind CSS',
  'Redux', 'Zustand', 'Webpack', 'Vite', 'Babel', 'Rollup', 'ESLint', 'Prettier', 'Storybook',
  'Figma', 'Sketch', 'Adobe XD',
  // Backend
  'Node.js', 'Express', 'NestJS', 'Fastify', 'Django', 'Flask', 'FastAPI', 'Laravel',
  'Rails', 'Spring', 'Spring Boot', '.NET', 'ASP.NET', 'WordPress', 'Shopify', 'Qt',
  'gRPC', 'REST', 'REST APIs', 'WebSocket', 'Microservices', 'Serverless',
  // Data / ML / AI
  'Pandas', 'NumPy', 'SciPy', 'scikit-learn', 'PyTorch', 'TensorFlow', 'Keras',
  'Hugging Face', 'LangChain', 'LlamaIndex', 'OpenAI', 'Machine Learning', 'Deep Learning',
  'Natural Language Processing', 'Computer Vision', 'Data Analysis', 'Data Visualization',
  'Data Engineering', 'Spark', 'PySpark', 'Hadoop', 'Kafka', 'Airflow', 'dbt', 'Databricks',
  'Snowflake', 'Tableau', 'Power BI', 'Looker', 'Excel', 'Statistics', 'A/B Testing',
  'Recommendation Systems', 'Vector Databases', 'MLOps', 'Time Series', 'ETL',
  // Cloud / DevOps / infra
  'AWS', 'Azure', 'Google Cloud', 'Docker', 'Kubernetes', 'Terraform', 'Ansible', 'Puppet',
  'Jenkins', 'GitHub Actions', 'GitLab CI', 'CircleCI', 'ArgoCD', 'Helm', 'OpenShift',
  'Linux', 'Unix', 'Windows Server', 'Nginx', 'Apache', 'CI/CD', 'DevOps', 'SRE',
  'Prometheus', 'Grafana', 'Datadog', 'Splunk', 'New Relic', 'Sentry', 'ELK Stack',
  'Redis', 'RabbitMQ', 'Elasticsearch',
  // Databases
  'PostgreSQL', 'MySQL', 'MongoDB', 'SQLite', 'Oracle', 'SQL Server', 'Cassandra',
  'DynamoDB', 'Neo4j', 'Supabase', 'Firebase', 'Couchbase',
  // Practices / testing / tools
  'Agile', 'Scrum', 'Kanban', 'TDD', 'BDD', 'Pair Programming', 'Code Review',
  'Test Automation', 'Selenium', 'Cypress', 'Playwright', 'Jest', 'Mocha', 'Vitest',
  'JUnit', 'Mockito', 'xUnit', 'PHPUnit', 'RSpec', 'Postman', 'Swagger', 'OpenAPI',
  'Git', 'GitHub', 'Bitbucket', 'Jira', 'Confluence', 'Notion', 'OAuth', 'JWT', 'SAML',
  'SEO', 'Accessibility', 'Performance Optimization',
]

const ALIASES: Record<string, string> = {
  js: 'JavaScript', ts: 'TypeScript', tsx: 'TypeScript',
  node: 'Node.js', nodejs: 'Node.js', 'node js': 'Node.js',
  reactjs: 'React', 'react.js': 'React', vuejs: 'Vue', 'vue.js': 'Vue',
  nextjs: 'Next.js', sveltejs: 'Svelte', angularjs: 'Angular',
  postgres: 'PostgreSQL', mongo: 'MongoDB', mariadb: 'MySQL', mssql: 'SQL Server',
  k8s: 'Kubernetes', gcp: 'Google Cloud', 'google cloud platform': 'Google Cloud',
  'amazon web services': 'AWS', 'amazon s3': 'AWS',
  sklearn: 'scikit-learn', tf: 'TensorFlow', pytorch: 'PyTorch',
  nlp: 'Natural Language Processing', cv: 'Computer Vision', dl: 'Deep Learning',
  'ci cd': 'CI/CD', cicd: 'CI/CD', 'continuous integration': 'CI/CD',
  tailwind: 'Tailwind CSS', tailwindcss: 'Tailwind CSS',
  'rest api': 'REST APIs', restful: 'REST', oop: 'OOP',
  'unit testing': 'Test Automation', e2e: 'Cypress',
  githubactions: 'GitHub Actions', apigee: 'REST APIs',
  powerbi: 'Power BI', scikitlearn: 'scikit-learn', huggingface: 'Hugging Face',
}

/** Short/ambiguous terms that need a resume-list context (commas, "with", …). */
const CONTEXT_SKILLS: Array<[RegExp, string]> = [
  [
    /(?:^|[,;•()\/]|\b(?:and|with|using|plus|via|languages?|stack)\b)\s*go\b(?!\s*(?:to|the|a|an|ing|es|al|al\b))/im,
    'Go',
  ],
  [
    /(?:^|[,;•()\/]|\b(?:and|with|using|plus|via|languages?)\b)\s*r\b(?!\s*(?:eport|each|ight|eading|eview|equire|esult))/im,
    'R',
  ],
]

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const hasTerm = (lowerText: string, term: string): boolean => {
  const escaped = escapeRe(term.toLowerCase())
  return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`).test(lowerText)
}

/** Finds known skills/technologies in free text. */
export function findSkills(text: string): string[] {
  const lower = text.toLowerCase()
  const found = new Map<string, number>()

  const add = (skill: string) => {
    const count = (lower.match(new RegExp(`(?<![a-z0-9])${escapeRe(skill.toLowerCase())}(?![a-z0-9])`, 'g')) ?? [])
      .length
    found.set(skill, Math.max(found.get(skill) ?? 0, count + 1))
  }

  for (const skill of SKILLS) if (hasTerm(lower, skill)) add(skill)
  for (const [alias, canonical] of Object.entries(ALIASES)) {
    if (hasTerm(lower, alias) && !found.has(canonical)) add(canonical)
  }
  for (const [re, skill] of CONTEXT_SKILLS) {
    if (re.test(text) && !found.has(skill)) found.set(skill, 1)
  }

  return [...found.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([skill]) => skill)
}

// ── Experience / seniority / languages ──────────────────────────────

function yearsOfExperience(text: string): number | null {
  let best: number | null = null

  for (const m of text.matchAll(/(\d{1,2})\s*\+?\s*(?:years?|yrs?)(?:\s+(?:of|in|professional|hands-on|commercial))?(?:\s+(?:experience|exp))?/gi)) {
    const n = Number(m[1])
    if (n >= 1 && n <= 45) best = Math.max(best ?? 0, n)
  }

  const nowYear = new Date().getFullYear()
  const ranges = [...text.matchAll(/((?:19|20)\d{2})\s*[–—\-]\s*((?:19|20)\d{2}|present|current|now|today)/gi)]
  if (ranges.length >= 1) {
    let earliest = nowYear
    let latest = 0
    for (const m of ranges) {
      const start = Number(m[1])
      const end = /^\d{4}$/.test(m[2]) ? Number(m[2]) : nowYear
      if (start >= 1970 && start <= nowYear && end >= start && end <= nowYear + 1) {
        earliest = Math.min(earliest, start)
        latest = Math.max(latest, end)
      }
    }
    const span = latest - earliest
    if (ranges.length >= 2 && span >= 1 && span <= 45) best = Math.max(best ?? 0, span)
  }
  return best
}

const SENIORITY_PATTERNS: Array<[RegExp, Seniority]> = [
  [/\b(principal|distinguished|staff)\s+(engineer|developer|architect|scientist|designer)\b/i, 'principal'],
  [/\b(head of|director( of)?|vice president|vp of|\bvp\b|chief|cto|cio)\b/i, 'director'],
  [/\b(engineering|technical|team|product)\s+manager\b|\b(eng\.?|engineering)\s+manager\b/i, 'manager'],
  [/\b(team|tech|lead)\s+lead\b|\blead\s+(engineer|developer|architect|designer|scientist)\b|\b(engineer|developer|designer)\s+lead\b/i, 'lead'],
  [/\bsenior\b|\bsr\.?\s+(engineer|developer|analyst|designer)/i, 'senior'],
  [/\bmid[ -]?level\b/i, 'mid'],
  [/\bjunior\b|\bjr\.?\s|\bintern(ship)?\b|\btrainee\b|\bgraduate\s+(role|programme|program)\b/i, 'junior'],
]

function detectSeniority(text: string): Seniority | null {
  let bestIndex = Number.POSITIVE_INFINITY
  let bestPriority = Number.POSITIVE_INFINITY
  let bestValue: Seniority | null = null
  for (let i = 0; i < SENIORITY_PATTERNS.length; i++) {
    const [re, value] = SENIORITY_PATTERNS[i]
    const m = re.exec(text)
    if (!m) continue
    if (m.index < bestIndex || (m.index === bestIndex && i < bestPriority)) {
      bestIndex = m.index
      bestPriority = i
      bestValue = value
    }
  }
  return bestValue
}

const LANGUAGES = [
  'English', 'Spanish', 'Portuguese', 'French', 'German', 'Italian', 'Dutch', 'Polish',
  'Russian', 'Chinese', 'Japanese', 'Korean', 'Arabic', 'Hindi', 'Catalan', 'Swedish',
  'Danish', 'Norwegian', 'Finnish', 'Turkish', 'Greek', 'Czech', 'Romanian', 'Ukrainian',
]

function detectLanguages(text: string): string[] {
  return LANGUAGES.filter((l) => hasTerm(text.toLowerCase(), l.toLowerCase()))
}

// ── Contact / location ──────────────────────────────────────────────

const COUNTRIES = [
  'united states', 'usa', 'united kingdom', 'uk', 'spain', 'germany', 'france', 'portugal',
  'italy', 'netherlands', 'ireland', 'poland', 'canada', 'mexico', 'brazil', 'argentina',
  'chile', 'colombia', 'india', 'australia', 'switzerland', 'austria', 'belgium', 'sweden',
  'denmark', 'norway', 'finland', 'czech republic', 'romania', 'greece', 'turkey', 'japan',
  'singapore', 'estonia', 'latvia', 'lithuania', 'hungary', 'bulgaria', 'croatia',
]

const CITIES = [
  'london', 'madrid', 'barcelona', 'lisbon', 'porto', 'berlin', 'munich', 'hamburg',
  'paris', 'amsterdam', 'rotterdam', 'dublin', 'new york', 'san francisco', 'austin',
  'seattle', 'boston', 'chicago', 'los angeles', 'toronto', 'vancouver', 'são paulo',
  'sao paulo', 'mexico city', 'bangalore', 'bengaluru', 'delhi', 'mumbai', 'hyderabad',
  'tokyo', 'stockholm', 'zurich', 'geneva', 'warsaw', 'krakow', 'bucharest', 'athens',
  'milan', 'rome', 'vienna', 'prague', 'brussels', 'helsinki', 'oslo', 'copenhagen',
]

function detectEmail(text: string): string | null {
  return text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] ?? null
}

function detectName(text: string, email: string | null): string | null {
  if (email) {
    const local = email.split('@')[0]
    const parts = local.split(/[._0-9-]+/).filter((p) => p.length > 1)
    if (parts.length >= 1 && parts.length <= 3 && parts.every((p) => /^[a-zA-Zà-ÿ']+$/.test(p))) {
      return parts.map((p) => p[0].toUpperCase() + p.slice(1).toLowerCase()).join(' ')
    }
  }
  const skip = /resume|curriculum|vitae|\bcv\b|experience|summary|profile|contact|portfolio|linkedin|github|references|education|skills|@|http|\d/
  for (const line of text.split('\n').slice(0, 25)) {
    const candidate = line.trim()
    if (candidate.length < 4 || candidate.length > 40) continue
    if (skip.test(candidate)) continue
    const words = candidate.split(/\s+/)
    if (words.length < 2 || words.length > 4) continue
    if (words.every((w) => /^[A-ZÀ-Þ][\p{L}'-]*$/u.test(w))) return candidate
  }
  return null
}

function detectLocation(text: string): { location: string | null; remote: boolean } {
  const remote = /\b(remote|teletrabajo|work from home|wfh|fully distributed)\b/i.test(text)

  for (const m of text.matchAll(/\b([A-ZÀ-Ý][\p{L}'-]+(?: [A-ZÀ-Ý][\p{L}'-]+)?), +([A-ZÀ-Ý][\p{L}. ]{2,30})\b/gu)) {
    const country = m[2].trim().toLowerCase()
    if (COUNTRIES.includes(country)) {
      return { location: `${m[1].replace(/\s+/g, ' ').trim()}, ${m[2].trim()}`, remote }
    }
  }

  const lower = text.toLowerCase()
  for (const city of CITIES) {
    const idx = lower.indexOf(city)
    if (idx >= 0) {
      const cityDisplay = text.slice(idx, idx + city.length)
      const after = text.slice(idx + city.length, idx + city.length + 30)
      const country = COUNTRIES.find((c) => after.toLowerCase().includes(c))
      return { location: country ? `${cityDisplay}, ${titleCase(country)}` : titleCase(cityDisplay), remote }
    }
  }
  for (const country of COUNTRIES) {
    if (new RegExp(`(?<![a-z])${escapeRe(country)}(?![a-z])`).test(lower)) {
      return { location: titleCase(country), remote }
    }
  }
  return { location: remote ? 'Remote' : null, remote }
}

const titleCase = (s: string) =>
  s.replace(/\b[a-zà-ÿ]/g, (c) => c.toUpperCase()).replace(/^Us$/, 'US').replace(/^Uk$/, 'UK')

// ── Main entry ──────────────────────────────────────────────────────

export function parseProfile(text: string): ResumeProfile {
  const email = detectEmail(text)
  const { location, remote } = detectLocation(text)
  return {
    name: detectName(text, email),
    email,
    skills: findSkills(text).slice(0, 40),
    years: yearsOfExperience(text),
    seniority: detectSeniority(text),
    languages: detectLanguages(text),
    location,
    remote,
    rawText: text,
    updatedAt: Date.now(),
  }
}
