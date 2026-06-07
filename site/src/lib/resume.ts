export interface SkillGroup {
  group: string;
  items: string[];
}

export const RESUME = {
  name: "Derek Chen",
  links: [
    { label: "GitHub", href: "https://github.com/smallkill" },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/dereklovetw/" },
    { label: "Live Demo", href: "https://derek-chen.pages.dev/status" },
  ] as { label: string; href: string }[],
  intro: {
    zh: "我在 edge 與 cloud 之間搭橋,而且橫跨三個產業。從車用電腦視覺(3D AVM、ADAS)、自駕車隊的雲端平台,到現在的韌體 CI/CD 與 DevSecOps——主軸始終如一:把雜亂的 edge 系統(車、路由器、感測器)變得可觀測、安全、能規模化交付。",
    en: "I build the bridge between edge systems and the cloud — across three industries. From automotive computer vision (3D AVM, ADAS) to autonomous-fleet cloud platforms to firmware CI/CD and DevSecOps, the through-line stays the same: take messy edge systems — cars, routers, sensors — and make them observable, secure, and shippable at scale.",
  },
  skills: [
    {
      group: "Cloud / Infra",
      items: ["AWS", "GCP", "Cloudflare Workers", "Terraform / IaC", "MQTT"],
    },
    {
      group: "DevOps / CI-CD",
      items: [
        "GitLab CI/CD",
        "GitHub Actions",
        "Jenkins",
        "DevSecOps · Coverity / Nessus",
        "TDD",
        "Observability",
      ],
    },
    {
      group: "Languages",
      items: ["C/C++", "Python", "JavaScript / Node.js", "TypeScript", "Shell"],
    },
    {
      group: "CV / Embedded / Robotics",
      items: [
        "OpenCV",
        "OpenGL ES",
        "ROS / Autoware",
        "YOLO",
        "3D Reconstruction",
        "Nvidia NX / Arm64",
      ],
    },
  ] as SkillGroup[],
};
