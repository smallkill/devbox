export const UI = {
  zh: {
    role: "Software / DevOps Engineer",
    nav_projects: "專案",
    nav_status: "系統狀態",
    experience: "經歷",
    skills: "技能",
    projects: "精選專案",
    experience_soon: "經歷內容陸續補上。",
    fallback: "中文",
    back: "← 回首頁",
    view: "查看",
  },
  en: {
    role: "Software / DevOps Engineer",
    nav_projects: "Projects",
    nav_status: "Status",
    experience: "Experience",
    skills: "Skills",
    projects: "Selected Projects",
    experience_soon: "Experience entries coming soon.",
    fallback: "ZH",
    back: "← Home",
    view: "View",
  },
} as const;

export type Locale = keyof typeof UI;
