import {
  defaultStyle,
  themes,
  uid,
  type Mode,
  type Page,
  type Project,
  type Settings,
} from "./model";
// Lossless segmentation: each section is a slice of the original string, including whitespace.
export function segmentStory(
  story: string,
  target = 1500,
): { text: string; heading: string }[] {
  const sections: { text: string; heading: string }[] = [];
  let start = 0;
  const chapters = [
    ...story.matchAll(/^(?:#{1,4}\s+.+|(?:chapter|part|فصل|الفصل)\s+.+)$/gim),
  ].map((m) => m.index!);
  while (start < story.length) {
    let end = Math.min(start + target, story.length);
    const nextChapter = chapters.find((i) => i > start && i <= end);
    if (nextChapter !== undefined) end = nextChapter;
    else if (end < story.length) {
      const slice = story.slice(start, end);
      const paragraph = slice.lastIndexOf("\n\n");
      const sentence = Math.max(
        slice.lastIndexOf(". "),
        slice.lastIndexOf("! "),
        slice.lastIndexOf("؟ "),
      );
      const boundary =
        paragraph > target * 0.35
          ? paragraph + 2
          : sentence > target * 0.35
            ? sentence + 2
            : slice.lastIndexOf(" ") + 1;
      if (boundary > 0) end = start + boundary;
      else {
        const next = story.slice(end).search(/\s/);
        end = next < 0 ? story.length : end + next + 1;
      }
    }
    const text = story.slice(start, end);
    const heading = text.match(
      /^(?:#{1,4}\s+(.+)|((?:chapter|part|فصل|الفصل)\s+.+))/im,
    );
    sections.push({ text, heading: heading?.[1] || heading?.[2] || "" });
    start = end;
  }
  return sections;
}
export function generatePages(
  story: string,
  assetIds: string[],
  mode: Mode,
  placement: "spread" | "group" = "spread",
): Page[] {
  const chunks = segmentStory(
    story,
    mode === "cinematic" ? 650 : mode === "comic" ? 900 : 1500,
  );
  const count = Math.max(
    chunks.length,
    Math.ceil(assetIds.length / (mode === "comic" ? 4 : 3)),
    1,
  );
  const pages = Array.from({ length: count }, (_, i): Page => ({
    id: uid(),
    text: chunks[i]?.text ?? "",
    heading: chunks[i]?.heading ?? "",
    assetIds: [],
    layout: mode === "comic" ? "grid" : "above",
    bubbles: [],
  }));
  assetIds.forEach((id, i) => {
    const index =
      placement === "group"
        ? Math.min(Math.floor(i / (mode === "comic" ? 4 : 3)), count - 1)
        : Math.min(Math.floor((i * count) / assetIds.length), count - 1);
    pages[index].assetIds.push(id);
  });
  pages.forEach((p) => {
    if (!p.assetIds.length) p.layout = "text";
    else if (p.assetIds.length > 1)
      p.layout =
        p.assetIds.length === 2
          ? "two"
          : p.assetIds.length === 3
            ? "three"
            : "grid";
  });
  return pages;
}
export function createProject(
  input: {
    title: string;
    subtitle?: string;
    author?: string;
    language?: "en" | "ar";
    story: string;
    mode?: Mode;
  },
  settings?: Settings,
): Project {
  const now = new Date().toISOString();
  const presentations = Object.fromEntries(
    (["storybook", "cinematic", "comic"] as const).map((mode) => {
      const style = defaultStyle(mode);
      if (settings) {
        style.fontSize = settings.fontSize;
        style.duration = settings.duration;
        if (mode === "storybook") {
          style.theme = settings.theme;
          const theme = themes[settings.theme];
          style.background = theme.paper;
          style.color = theme.ink;
          style.font = theme.font as typeof style.font;
        }
      }
      return [
        mode,
        {
          pages: generatePages(input.story, [], mode, settings?.placement),
          style,
        },
      ];
    }),
  ) as Project["presentations"];
  return {
    version: 1,
    id: uid(),
    title: input.title.trim() || "Untitled story",
    subtitle: input.subtitle || "",
    author: input.author || "",
    language: input.language || "en",
    story: input.story,
    assets: [],
    coverId: null,
    mode: input.mode || "storybook",
    presentations,
    createdAt: now,
    updatedAt: now,
  };
}
export function moveAsset(
  pages: Page[],
  assetId: string,
  targetId: string,
): Page[] {
  return pages.map((p) => ({
    ...p,
    assetIds: [
      ...p.assetIds.filter((id) => id !== assetId),
      ...(p.id === targetId ? [assetId] : []),
    ],
  }));
}
export const storyStats = (text: string) => ({
  words: text.trim() ? text.trim().split(/\s+/u).length : 0,
  characters: text.length,
  minutes: Math.max(
    1,
    Math.ceil((text.trim() ? text.trim().split(/\s+/u).length : 0) / 220),
  ),
});
export function removePageSafely(pages: Page[], id: string): Page[] {
  if (pages.length === 1) throw new Error("Keep at least one page.");
  const i = pages.findIndex((p) => p.id === id);
  if (i < 0) return pages;
  const result = structuredClone(pages);
  const [removed] = result.splice(i, 1);
  const target = result[Math.max(0, i - 1)];
  target.text =
    i === 0 ? removed.text + target.text : target.text + removed.text;
  target.assetIds =
    i === 0
      ? [...removed.assetIds, ...target.assetIds]
      : [...target.assetIds, ...removed.assetIds];
  target.bubbles.push(...removed.bubbles);
  return result;
}
export class History<T> {
  private past: T[] = [];
  private future: T[] = [];
  constructor(public present: T) {}
  set(next: T) {
    this.past.push(this.present);
    if (this.past.length > 60) this.past.shift();
    this.present = next;
    this.future = [];
  }
  undo() {
    const next = this.past.pop();
    if (next) {
      this.future.push(this.present);
      this.present = next;
    }
    return this.present;
  }
  redo() {
    const next = this.future.pop();
    if (next) {
      this.past.push(this.present);
      this.present = next;
    }
    return this.present;
  }
  get canUndo() {
    return this.past.length > 0;
  }
  get canRedo() {
    return this.future.length > 0;
  }
}
