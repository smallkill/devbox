import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

// 內容依 locale 分目錄:zh/<slug>.md、en/<slug>.md。entry id 形如 "zh/devbox"。
const projects = defineCollection({
  loader: glob({ pattern: "{zh,en}/*.md", base: "./src/content/projects" }),
  schema: z.object({
    title: z.string(),
    role: z.string().optional(),
    org: z.string().optional(),
    period: z.string().optional(),
    tech: z.array(z.string()).default([]),
    cover: z.string().optional(),
    gallery: z
      .array(z.object({ src: z.string(), caption: z.string().optional() }))
      .default([]),
    // 自動輪播圖組(可多組,例如同一專案的不同版本/系統)。
    slideshows: z
      .array(
        z.object({
          caption: z.string().optional(),
          images: z.array(z.string()).default([]),
          // 圖片填滿方式:cover(裁切填滿,預設)或 contain(完整不裁切)。
          fit: z.enum(["cover", "contain"]).optional(),
        }),
      )
      .default([]),
    // 選用:示範影片(渲染在 slideshows 之後、頁面下方)。
    video: z
      .object({ src: z.string(), caption: z.string().optional() })
      .optional(),
    links: z
      .array(z.object({ label: z.string(), href: z.string() }))
      .default([]),
    featured: z.boolean().default(false),
    order: z.number().default(99),
    // 個人專案 / 工作專案,履歷分兩區呈現。
    category: z.enum(["personal", "work"]).default("work"),
  }),
});

const experience = defineCollection({
  loader: glob({ pattern: "{zh,en}/*.md", base: "./src/content/experience" }),
  schema: z.object({
    org: z.string(),
    role: z.string(),
    period: z.string(),
    location: z.string().optional(),
    logo: z.string().optional(),
    tech: z.array(z.string()).default([]),
    highlights: z.array(z.string()).default([]),
    order: z.number().default(99),
  }),
});

export const collections = { projects, experience };
