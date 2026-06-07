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
    links: z
      .array(z.object({ label: z.string(), href: z.string() }))
      .default([]),
    featured: z.boolean().default(false),
    order: z.number().default(99),
  }),
});

const experience = defineCollection({
  loader: glob({ pattern: "{zh,en}/*.md", base: "./src/content/experience" }),
  schema: z.object({
    org: z.string(),
    role: z.string(),
    period: z.string(),
    location: z.string().optional(),
    tech: z.array(z.string()).default([]),
    highlights: z.array(z.string()).default([]),
    order: z.number().default(99),
  }),
});

export const collections = { projects, experience };
