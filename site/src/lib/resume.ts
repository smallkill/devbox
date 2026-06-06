export interface SkillGroup {
  group: string;
  items: string[];
}

export const RESUME = {
  name: "Derek Chen",
  links: [
    { label: "GitHub", href: "https://github.com/smallkill" },
    { label: "Live", href: "https://derek-chen.pages.dev" },
    // LinkedIn 待補:Derek 提供 handle 後加入
  ] as { label: string; href: string }[],
  intro: {
    zh: "以 Cloudflare 為核心的 Software / DevOps 工程師。自架生產級 SaaS:CI/CD 自動部署、Infrastructure-as-Code、可觀測性優先。重視測試紀律與最小權限安全設計。",
    en: "Software / DevOps engineer building production SaaS on Cloudflare — automated CI/CD, infrastructure-as-code, and observability-first. Disciplined about testing and least-privilege security.",
  },
  skills: [
    { group: "Cloud / Infra", items: ["Cloudflare Workers", "Pages", "D1", "GCP", "Terraform"] },
    { group: "Engineering", items: ["TypeScript", "CI/CD · GitHub Actions", "TDD", "Observability"] },
  ] as SkillGroup[],
};
