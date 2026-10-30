import { z } from "zod";
export const idSchema = z.string().regex(/^[a-zA-Z0-9_-]+$/);
export const modes = ["storybook", "cinematic", "comic"] as const;
export type Mode = (typeof modes)[number];
export const layouts = [
  "above",
  "below",
  "beside",
  "text",
  "full",
  "two",
  "three",
  "grid",
  "overlay",
  "vertical",
] as const;
export const themes = {
  classic: {
    name: "Classic Novel",
    paper: "#faf7ef",
    ink: "#302b25",
    accent: "#9e643f",
    font: "Georgia",
  },
  minimal: {
    name: "Modern Minimal",
    paper: "#ffffff",
    ink: "#222b32",
    accent: "#526c64",
    font: "Arial",
  },
  children: {
    name: "Children’s Storybook",
    paper: "#fff8df",
    ink: "#343844",
    accent: "#e2994b",
    font: "Trebuchet MS",
  },
  vintage: {
    name: "Vintage Journal",
    paper: "#eee1c9",
    ink: "#4b3628",
    accent: "#856b44",
    font: "Georgia",
  },
  travel: {
    name: "Travel Memories",
    paper: "#f0f3ec",
    ink: "#243d35",
    accent: "#617b59",
    font: "Georgia",
  },
  elegant: {
    name: "Elegant Photo Album",
    paper: "#f3f0ed",
    ink: "#34303e",
    accent: "#89708b",
    font: "Georgia",
  },
  graphic: {
    name: "Modern Graphic Novel",
    paper: "#1f2630",
    ink: "#f8f4e9",
    accent: "#e5a451",
    font: "Arial",
  },
  colorful: {
    name: "Colorful Comic",
    paper: "#fff4e6",
    ink: "#34303e",
    accent: "#bc5672",
    font: "Trebuchet MS",
  },
} as const;
export const assetSchema = z.object({
  id: idSchema,
  name: z.string(),
  file: z.string().regex(/^assets\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/),
  width: z.number().positive(),
  height: z.number().positive(),
  caption: z.string(),
  rotation: z.number().int().multipleOf(90),
  crop: z.enum(["contain", "cover"]),
  focusX: z.number().min(0).max(100),
  focusY: z.number().min(0).max(100),
});
export const bubbleSchema = z.object({
  id: idSchema,
  text: z.string(),
  type: z.enum(["speech", "thought", "caption"]),
  x: z.number().min(0).max(85),
  y: z.number().min(0).max(85),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  size: z.number().min(10).max(48),
});
export const pageSchema = z.object({
  id: idSchema,
  text: z.string(),
  heading: z.string(),
  assetIds: z.array(idSchema),
  layout: z.enum(layouts),
  bubbles: z.array(bubbleSchema),
});
export const styleSchema = z.object({
  theme: z.enum(
    Object.keys(themes) as [keyof typeof themes, ...(keyof typeof themes)[]],
  ),
  font: z.enum(["Georgia", "Arial", "Trebuchet MS", "Times New Roman"]),
  fontSize: z.number().min(12).max(36),
  lineHeight: z.number().min(1.1).max(2.5),
  margin: z.number().min(12).max(80),
  align: z.enum(["start", "center", "justify"]),
  background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  radius: z.number().min(0).max(40),
  border: z.number().min(0).max(12),
  gap: z.number().min(0).max(48),
  imageHeight: z.number().min(120).max(700),
  pageSize: z.enum(["A4", "A5", "Letter", "Custom"]),
  customWidth: z.number().min(80).max(600),
  customHeight: z.number().min(80).max(600),
  landscape: z.boolean(),
  numbers: z.boolean(),
  captions: z.boolean(),
  cover: z.boolean(),
  duration: z.number().min(1).max(120),
  transition: z.enum(["fade", "slide", "zoom", "dissolve"]),
  transitionSpeed: z.number().min(0).max(3),
  textPosition: z.enum(["top", "center", "bottom"]),
});
export const projectSchema = z
  .object({
    version: z.literal(1),
    id: idSchema,
    title: z.string().min(1),
    subtitle: z.string(),
    author: z.string(),
    language: z.enum(["en", "ar"]),
    story: z.string(),
    coverId: idSchema.nullable(),
    assets: z.array(assetSchema),
    mode: z.enum(modes),
    presentations: z.object({
      storybook: z.object({ pages: z.array(pageSchema), style: styleSchema }),
      cinematic: z.object({ pages: z.array(pageSchema), style: styleSchema }),
      comic: z.object({ pages: z.array(pageSchema), style: styleSchema }),
    }),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .superRefine((p, ctx) => {
    const ids = new Set(p.assets.map((a) => a.id));
    if (ids.size !== p.assets.length)
      ctx.addIssue({ code: "custom", message: "Picture IDs must be unique." });
    if (p.coverId && !ids.has(p.coverId))
      ctx.addIssue({
        code: "custom",
        message: "The cover picture is missing from this project.",
      });
    for (const [mode, presentation] of Object.entries(p.presentations)) {
      if (!presentation.pages.length)
        ctx.addIssue({
          code: "custom",
          message: mode + " must contain at least one page.",
        });
      if (
        new Set(presentation.pages.map((pg) => pg.id)).size !==
        presentation.pages.length
      )
        ctx.addIssue({
          code: "custom",
          message: "Page IDs must be unique within a mode.",
        });
      for (const page of presentation.pages)
        if (page.assetIds.some((id) => !ids.has(id)))
          ctx.addIssue({
            code: "custom",
            message: "A layout refers to a picture outside this project.",
          });
    }
  });
export type Project = z.infer<typeof projectSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type Page = z.infer<typeof pageSchema>;
export type Style = z.infer<typeof styleSchema>;
export type Bubble = z.infer<typeof bubbleSchema>;
export const settingsSchema = z.object({
  dark: z.boolean(),
  reducedMotion: z.boolean(),
  autosave: z.boolean(),
  projectLocation: z.string(),
  exportLocation: z.string(),
  theme: styleSchema.shape.theme,
  fontSize: z.number().min(12).max(36),
  duration: z.number().min(1).max(120),
  placement: z.enum(["spread", "group"]),
  language: z.enum(["en", "ar"]),
});
export type Settings = z.infer<typeof settingsSchema>;
export const defaultSettings: Settings = {
  dark: false,
  reducedMotion: false,
  autosave: true,
  projectLocation: "",
  exportLocation: "",
  theme: "classic",
  fontSize: 18,
  duration: 6,
  placement: "spread",
  language: "en",
};
export const uid = () => crypto.randomUUID();
export function defaultStyle(mode: Mode = "storybook"): Style {
  return {
    theme: mode === "comic" ? "minimal" : "classic",
    font: "Georgia",
    fontSize: 18,
    lineHeight: 1.7,
    margin: 40,
    align: "start",
    background: mode === "cinematic" ? "#172b25" : "#faf7ef",
    color: mode === "cinematic" ? "#f8f4e9" : "#302b25",
    radius: 4,
    border: mode === "comic" ? 3 : 0,
    gap: 12,
    imageHeight: 300,
    pageSize: "A4",
    customWidth: 210,
    customHeight: 297,
    landscape: false,
    numbers: true,
    captions: true,
    cover: true,
    duration: 6,
    transition: "fade",
    transitionSpeed: 0.5,
    textPosition: "bottom",
  };
}
export interface ProjectSummary {
  id: string;
  title: string;
  subtitle: string;
  mode: Mode;
  updatedAt: string;
  coverId: string | null;
  assetCount: number;
  pages: number;
  warning?: string;
}
export interface ImportResult {
  assets: Asset[];
  errors: string[];
}
export interface Bridge {
  imageBytes(id: string, name: string, bytes: Uint8Array): Promise<Asset>;
  onBeforeClose(cb: () => void): () => void;
  finishClose(): void;
  list(): Promise<ProjectSummary[]>;
  open(id: string): Promise<{ project: Project; warnings: string[] }>;
  save(project: Project): Promise<void>;
  create(input: {
    title: string;
    subtitle: string;
    author: string;
    language: "en" | "ar";
    story: string;
    mode: Mode;
  }): Promise<Project>;
  remove(id: string): Promise<void>;
  duplicate(id: string): Promise<Project>;
  images(id: string, folder?: boolean, paths?: string[]): Promise<ImportResult>;
  text(): Promise<string | null>;
  backup(id: string): Promise<string | null>;
  restore(): Promise<Project | null>;
  export(project: Project, format: "html" | "pdf"): Promise<string | null>;
  settings(): Promise<Settings>;
  setSettings(s: Settings): Promise<Settings>;
  chooseDirectory(): Promise<string | null>;
  clearCache(): Promise<void>;
  sample(): Promise<Project>;
  onProgress(cb: (text: string) => void): () => void;
}
declare global {
  interface Window {
    storyweaver: Bridge;
  }
}
export const assetUrl = (
  projectId: string,
  assetId: string,
  thumbnail = true,
) => `storyasset://local/${projectId}/${assetId}${thumbnail ? "?thumb=1" : ""}`;
