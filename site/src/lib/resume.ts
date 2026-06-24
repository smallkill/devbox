export interface SkillGroup {
  group: string;
  items: string[];
}

/** Hero 硬事實列:招募方 30 秒抓重點用。href 可選(目前僅專利顆連 Google Patents)。 */
export interface HeroStat {
  label: string;
  href?: string;
}

export const RESUME = {
  name: "Derek Chen",
  avatar: "/derek.jpg",
  email: "chinte.cheng@gmail.com",
  links: [
    { label: "GitHub", href: "https://github.com/smallkill" },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/dereklovetw/" },
  ] as { label: string; href: string }[],
  intro: {
    zh: "我在 edge 與 cloud 之間搭橋,而且橫跨三個產業。從車用電腦視覺(3D AVM、ADAS)、自駕車隊的雲端平台,到現在的韌體 CI/CD 與 DevSecOps,主軸始終如一:把雜亂的 edge 系統(車、路由器、感測器)變得可觀測、安全、能規模化交付。",
    en: "I build the bridge between edge systems and the cloud across three industries. From automotive computer vision (3D AVM, ADAS) to autonomous-fleet cloud platforms to firmware CI/CD and DevSecOps, the through-line stays the same: take messy edge systems (cars, routers, sensors) and make them observable, secure, and shippable at scale.",
  },
  // Hero 硬事實列:取代資訊量低的形容詞特質,讓招募方 30 秒抓到數字。
  // 數字皆已核可,勿自行增改;「發明專利」顆連 Google Patents(TWI844132B,單一發明人)。
  stats: {
    zh: [
      { label: "10+ 年經驗" },
      { label: "Edge→Cloud · 跨 3 產業" },
      { label: "雙北 · 可遠端" },
      { label: "發明專利 · 單一發明人", href: "https://patents.google.com/patent/TWI844132B/zh" },
      { label: "13 台自駕車量產交付" },
    ],
    en: [
      { label: "10+ yrs" },
      { label: "Edge→Cloud · 3 industries" },
      { label: "Greater Taipei · Remote" },
      { label: "Issued patent (sole inventor)", href: "https://patents.google.com/patent/TWI844132B/zh" },
      { label: "13 autonomous vehicles shipped" },
    ],
  } as Record<"zh" | "en", HeroStat[]>,
  skills: [
    {
      group: "AI / ML",
      items: [
        "RAG · retrieval-augmented generation",
        "LLM apps · Workers AI / Llama 3.3",
        "Embeddings · bge-m3 (multilingual)",
        "Vector DB · Vectorize",
        "Prompt engineering · anti-hallucination",
      ],
    },
    {
      group: "Cloud / Infra",
      items: [
        "AWS · EC2 / S3 / Lambda / IoT Core / API Gateway / KVS",
        "GCP · Cloud Run / VPC / VM",
        "Cloudflare Workers",
        "Terraform / IaC",
        "MQTT",
      ],
    },
    {
      group: "DevOps / CI-CD",
      items: [
        "GitLab CI/CD",
        "GitHub Actions",
        "Jenkins",
        "DevSecOps · Coverity / Nessus",
        "TDD",
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
