import { describe, expect, it } from "vitest";
import {
  createProject,
  generatePages,
  History,
  moveAsset,
  removePageSafely,
  segmentStory,
} from "../src/core/layout";
import { projectSchema } from "../src/core/model";
import { exportHtml, renderPage } from "../src/core/render";
const story = (words: number) =>
  `# Chapter 1\n\n${Array.from({ length: words }, (_, i) => `word${i}${i % 24 === 0 ? "\n\n" : " "}`).join("")}\n\nالفصل الثاني\n\nالنص يبقى كما كتبته.\n`;
describe("lossless arrangement", () => {
  for (const count of [100, 5000, 50000])
    for (const mode of ["storybook", "cinematic", "comic"] as const)
      it(`preserves ${count} words in ${mode}`, () => {
        const text = story(count);
        const pages = generatePages(
          text,
          Array.from({ length: 100 }, (_, i) => `asset-${i}`),
          mode,
        );
        expect(pages.map((p) => p.text).join("")).toBe(text);
        expect(pages.flatMap((p) => p.assetIds)).toEqual(
          Array.from({ length: 100 }, (_, i) => `asset-${i}`),
        );
      });
  it("preserves unusual whitespace, long words, line endings, and paragraphs", () => {
    for (const text of [
      "hello\r\n\r\nworld\n\n",
      "x".repeat(10000),
      "a   b\n\n  c\tend",
      story(5000),
    ])
      expect(
        segmentStory(text)
          .map((s) => s.text)
          .join(""),
      ).toBe(text);
  });
  it("creates photo-only and text-only layouts without limits", () => {
    expect(
      generatePages(
        "",
        Array.from({ length: 500 }, (_, i) => `a${i}`),
        "comic",
      ).flatMap((p) => p.assetIds),
    ).toHaveLength(500);
    expect(generatePages("text", [], "storybook")[0].text).toBe("text");
  });
  it("moves one picture to a different page without touching source or order of other assets", () => {
    const pages = generatePages(story(5000), ["a", "b", "c"], "storybook");
    const result = moveAsset(pages, "a", pages.at(-1)!.id);
    expect(
      result.flatMap((p) => p.assetIds).filter((a) => a === "a"),
    ).toHaveLength(1);
    expect(result.at(-1)!.assetIds).toContain("a");
    expect(result.map((p) => p.text)).toEqual(pages.map((p) => p.text));
  });
  it("merges content when removing pages, including the first and last", () => {
    for (const pick of [0, 1, 3]) {
      const text = story(1000);
      const pages = generatePages(
        text,
        Array.from({ length: 15 }, (_, i) => `a${i}`),
        "storybook",
      );
      const result = removePageSafely(pages, pages[pick].id);
      expect(result.map((p) => p.text).join("")).toBe(text);
      expect(result.flatMap((p) => p.assetIds)).toEqual(
        pages.flatMap((p) => p.assetIds),
      );
    }
    expect(() =>
      removePageSafely(generatePages("", [], "storybook"), "x"),
    ).toThrow();
  });
  it("keeps mode-specific customizations and supports undo/redo", () => {
    const p = createProject({ title: "Test", story: story(100) });
    const history = new History(p);
    const next = structuredClone(p);
    next.presentations.comic.pages[0].text = "custom";
    next.mode = "comic";
    history.set(next);
    expect(history.undo()).toEqual(p);
    expect(history.redo()).toEqual(next);
    expect(
      next.presentations.storybook.pages.map((pg) => pg.text).join(""),
    ).toBe(p.story);
    expect(projectSchema.safeParse(next).success).toBe(true);
  });
  it("escapes malicious story, titles, captions and bubbles in offline output", () => {
    const p = createProject({
      title: "<script>oops</script>",
      story: "<img src=x onerror=alert(1)>",
    });
    p.presentations.storybook.pages[0].bubbles = [
      {
        id: "b",
        type: "speech",
        text: "</div><script>oops</script>",
        x: 0,
        y: 0,
        color: "#ffffff",
        size: 18,
      },
    ];
    const html = exportHtml(p, () => "");
    expect(html).not.toContain("<script>oops");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("https://");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });
  it("never hides text when an image-only or overlay layout is selected", () => {
    const p = createProject({ title: "T", story: story(100) });
    for (const layout of ["full", "overlay", "text", "grid"] as const) {
      p.presentations.storybook.pages[0].layout = layout;
      const html = renderPage(
        p,
        p.presentations.storybook.pages[0],
        () => "",
        p.presentations.storybook.style,
        0,
      );
      expect(html).toContain("word99");
    }
  });
});
