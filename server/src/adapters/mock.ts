import type { Adapter, RawJob } from './types'

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

/** Offline fixtures for development — enabled with ENABLE_MOCK=1. */
export const mock: Adapter = {
  id: 'mock',
  name: 'Mock fixtures',
  kind: 'mock',
  available: () => process.env.ENABLE_MOCK === '1' || process.env.ENABLE_MOCK === 'true',
  reason: () => 'Set ENABLE_MOCK=1 to serve offline fixture jobs',

  async search({ q, location, limit }): Promise<RawJob[]> {
    const all: RawJob[] = [
      {
        title: 'Senior Frontend Engineer (React/TypeScript)',
        company: 'Northwind Labs',
        location: 'Remote — Europe',
        url: 'https://example.com/jobs/northwind-senior-frontend',
        description:
          '<p>We are looking for a Senior Frontend Engineer with 5+ years of experience building modern web applications with <strong>React</strong>, <strong>TypeScript</strong> and <strong>Next.js</strong>.</p><p>You will own our design system, improve performance with Vite and Webpack, write unit tests with <strong>Jest</strong> and end-to-end tests with <strong>Playwright</strong>, and collaborate with product designers in an <strong>Agile</strong>/<strong>Scrum</strong> team.</p><p>Requirements: strong knowledge of HTML, CSS, Tailwind CSS, state management (Redux or Zustand), REST and <strong>GraphQL</strong> APIs, Git, CI/CD pipelines and accessibility best practices. Experience with <strong>Node.js</strong> is a plus.</p>',
        contract: 'Full-time',
        remote: true,
        postedAt: daysAgo(1),
        category: 'Software Development',
        salary: '€65k – €85k',
      },
      {
        title: 'Full Stack Developer (Node.js + React)',
        company: 'Bright Harbor',
        location: 'Madrid, Spain',
        url: 'https://example.com/jobs/bright-harbor-fullstack',
        description:
          '<p>Bright Harbor is hiring a Full Stack Developer to build SaaS products end-to-end.</p><p>Stack: <strong>Node.js</strong>, <strong>Express</strong>, <strong>React</strong>, <strong>TypeScript</strong>, <strong>PostgreSQL</strong>, <strong>Docker</strong> and <strong>AWS</strong>.</p><p>You will design REST APIs, model data in PostgreSQL, ship features weekly, and take part in code reviews. We value testing (<strong>Jest</strong>), clean architecture and <strong>microservices</strong> thinking. Knowledge of <strong>Kubernetes</strong> and <strong>Terraform</strong> is welcome. Hybrid schedule, 3 days per week from our Madrid office.</p>',
        contract: 'Full-time',
        remote: false,
        postedAt: daysAgo(2),
        category: 'Software Development',
        salary: '€55k – €70k',
      },
      {
        title: 'Machine Learning Engineer',
        company: 'Cobalt AI',
        location: 'Remote — Worldwide',
        url: 'https://example.com/jobs/cobalt-ml',
        description:
          '<p>Cobalt AI is looking for a Machine Learning Engineer passionate about LLMs.</p><p>You will train and evaluate models with <strong>PyTorch</strong> and <strong>TensorFlow</strong>, build data pipelines with <strong>Pandas</strong>, <strong>NumPy</strong> and <strong>Spark</strong>, and deploy services with <strong>FastAPI</strong> and <strong>Docker</strong> on <strong>GCP</strong>.</p><p>Requirements: 3+ years of experience in <strong>machine learning</strong>, solid <strong>Python</strong>, familiarity with <strong>NLP</strong>, vector databases and <strong>LangChain</strong>, experiment tracking with MLflow, and strong <strong>SQL</strong>. Experience with <strong>Kubernetes</strong> and MLOps is a plus.</p>',
        contract: 'Full-time',
        remote: true,
        postedAt: daysAgo(3),
        category: 'Data Science',
        salary: '$110k – $140k',
      },
      {
        title: 'DevOps / Platform Engineer',
        company: 'Ridgeline Systems',
        location: 'Austin, TX (Remote-friendly)',
        url: 'https://example.com/jobs/ridgeline-devops',
        description:
          '<p>Ridgeline Systems needs a Platform Engineer to evolve our infrastructure.</p><p>Day to day: <strong>Kubernetes</strong>, <strong>Terraform</strong>, <strong>AWS</strong>, <strong>Docker</strong>, <strong>GitHub Actions</strong>, observability with <strong>Prometheus</strong> and <strong>Grafana</strong>, and Linux systems administration.</p><p>You will improve CI/CD pipelines, reduce deploy times, harden security, and support developers with self-service tooling. 4+ years in DevOps or SRE roles, scripting with Bash or <strong>Python</strong>, and experience with <strong>Ansible</strong> or Helm are expected.</p>',
        contract: 'Full-time',
        remote: true,
        postedAt: daysAgo(5),
        category: 'Engineering',
        salary: '$120k – $150k',
      },
      {
        title: 'Junior Backend Developer (Java/Spring)',
        company: 'Helio Bank',
        location: 'Barcelona, Spain',
        url: 'https://example.com/jobs/helio-junior-backend',
        description:
          '<p>Join Helio Bank as a Junior Backend Developer. You will learn from seniors while shipping real features.</p><p>Stack: <strong>Java</strong>, <strong>Spring Boot</strong>, <strong>REST</strong> APIs, <strong>MySQL</strong>, <strong>Docker</strong> and microservices on <strong>Azure</strong>.</p><p>We are looking for a junior profile (0–2 years) with basic knowledge of OOP, unit testing and <strong>Agile</strong> methodologies. A university degree in computer science or a coding bootcamp background is welcome.</p>',
        contract: 'Full-time',
        remote: false,
        postedAt: daysAgo(6),
        category: 'Software Development',
        salary: '€32k – €40k',
      },
      {
        title: 'Lead Product Designer (UX/UI)',
        company: 'Fern & Co',
        location: 'Remote — US/EU',
        url: 'https://example.com/jobs/fern-lead-designer',
        description:
          '<p>Fern &amp; Co is hiring a Lead Product Designer to own our end-to-end product experience.</p><p>You will lead discovery, run user research, prototype in <strong>Figma</strong>, and partner with engineering to ship accessible interfaces. Experience with design systems, usability testing and mentoring designers is required.</p>',
        contract: 'Full-time',
        remote: true,
        postedAt: daysAgo(8),
        category: 'Design',
        salary: '$100k – $130k',
      },
    ]

    const tokens = q.toLowerCase().split(/\s+/).filter(Boolean)
    const filtered = all.filter((j) => {
      const hay = `${j.title} ${j.description} ${j.location}`.toLowerCase()
      const okQ = tokens.length === 0 || tokens.every((t) => hay.includes(t))
      const okLoc = !location || hay.includes(location.toLowerCase())
      return okQ && okLoc
    })
    return filtered.slice(0, limit)
  },
}
