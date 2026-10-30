import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
let app: ElectronApplication;
let page: Page;
let data: string;
const errors: string[] = [];
async function launch() {
  app = await electron.launch({
    args: ["--no-sandbox", "--disable-gpu", "."],
    env: {
      ...process.env,
      DISPLAY: process.env.DISPLAY || ":99",
      STORYWEAVER_DATA: data,
    },
    timeout: 30000,
  });
  page = await app.firstWindow();
  page.on("pageerror", (e) => errors.push(e.message));
  await expect(page.getByText("Make room for your stories.")).toBeVisible();
}
async function saveDialog(file: string) {
  await app.evaluate(({ dialog }, out) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: out });
  }, file);
}
async function exportFile(button: string, file: string, message: string) {
  await saveDialog(file);
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByRole("button", { name: button, exact: false }).click();
  await expect(page.getByText(message, { exact: false })).toBeVisible({
    timeout: 60000,
  });
}
test("offline desktop workflow, three modes, restoration, PDF and HTML exports", async () => {
  data = await fs.mkdtemp(path.join(os.tmpdir(), "storyweaver-e2e-"));
  await launch();
  await page.screenshot({ path: "test-results/dashboard.png", fullPage: true });
  await page
    .getByRole("button", { name: "Create new story", exact: true })
    .click();
  await page.getByLabel("Project title *").fill("A journey offline");
  await page.getByLabel("Subtitle (optional)").fill("Twenty-five memories");
  await page.getByLabel("Author (optional)").fill("StoryWeaver tests");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  const story =
    "# Chapter One\n\n" +
    Array.from(
      { length: 3000 },
      (_, i) => `memory${i}${i % 30 === 0 ? "\n\n" : " "}`,
    ).join("") +
    "\n\nTHE LAST WORD.";
  await page.locator("textarea.story-input").fill(story);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  const files = [];
  for (let i = 0; i < 25; i++) {
    const file = path.join(data, `picture-${String(i).padStart(2, "0")}.png`);
    await sharp({
      create: {
        width: i % 2 ? 100 : 180,
        height: i % 2 ? 180 : 100,
        channels: 3,
        background: i % 2 ? "#718c66" : "#bfa276",
      },
    })
      .png()
      .toFile(file);
    files.push(file);
  }
  await page.locator(".dropzone input").setInputFiles(files);
  await expect(
    page.getByText("25 pictures selected.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Create my story", exact: true })
    .click();
  await expect(page.locator(".editor")).toBeVisible({ timeout: 60000 });
  await expect(
    page.getByText("Something needs your attention"),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  let project = await page.evaluate(async () => {
    const all = await window.storyweaver.list();
    return (await window.storyweaver.open(all[0].id)).project;
  });
  expect(project.story).toBe(story);
  expect(project.assets).toHaveLength(25);
  expect(
    project.presentations.storybook.pages.flatMap((p) => p.assetIds),
  ).toEqual(project.assets.map((a) => a.id));
  expect(
    project.presentations.storybook.pages.map((p) => p.text).join(""),
  ).toBe(story);
  await page.locator(".placed-image>button").first().click();
  await page
    .getByLabel("Place / move to page")
    .selectOption(project.presentations.storybook.pages[1].id);
  await page
    .getByRole("button", { name: "Travel Memories", exact: true })
    .click();
  await page.getByLabel("Font size", { exact: true }).press("Home");
  for (let i = 0; i < 10; i++)
    await page.getByLabel("Font size", { exact: true }).press("ArrowRight");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.screenshot({ path: "test-results/editor.png", fullPage: true });
  const id = project.id;
  project = await page.evaluate(
    async (id) => (await window.storyweaver.open(id)).project,
    id,
  );
  expect(project.presentations.storybook.style.fontSize).toBe(22);
  expect(project.presentations.storybook.pages[1].assetIds).toContain(
    project.assets[0].id,
  );
  const pdf = path.join(data, "storybook.pdf");
  await exportFile("PDF document", pdf, "PDF created:");
  expect((await fs.readFile(pdf)).subarray(0, 5).toString()).toBe("%PDF-");
  const pdfText = execFileSync("pdftotext", ["-layout", pdf, "-"], {
    encoding: "utf8",
  });
  expect(pdfText.match(/\bmemory\d+\b/g)).toEqual(
    Array.from({ length: 3000 }, (_, i) => `memory${i}`),
  );
  expect(pdfText).toContain("THE LAST WORD.");
  await page
    .getByRole("button", { name: "Cinematic Story", exact: true })
    .click();
  await page.getByRole("button", { name: "Play presentation" }).click();
  await expect(
    page.getByRole("button", { name: "Pause playback" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pause playback" }).click();
  const htmlDir = path.join(data, "offline-html");
  await exportFile("Offline HTML experience", htmlDir, "Offline HTML created:");
  const html = await fs.readFile(path.join(htmlDir, "index.html"), "utf8");
  expect(html).toContain("THE LAST WORD.");
  expect(html).not.toContain("https://");
  expect(await fs.readdir(path.join(htmlDir, "assets"))).toHaveLength(25);
  const exportedWindow = app.waitForEvent("window");
  await app.evaluate(
    async ({ BrowserWindow }, file) => {
      const viewer = new BrowserWindow({
        show: false,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });
      await viewer.loadFile(file);
    },
    path.join(htmlDir, "index.html"),
  );
  const viewer = await exportedWindow;
  await expect(viewer.locator("#position")).toHaveText(/^1 \/ /);
  await viewer.getByRole("button", { name: "Next →", exact: true }).click();
  await expect(viewer.locator("#position")).toHaveText(/^2 \/ /);
  await viewer.locator("img").evaluateAll(async (imgs) => {
    for (const img of imgs) {
      (img as HTMLImageElement).loading = "eager";
      await (img as HTMLImageElement).decode();
    }
  });
  await viewer.close();
  const backup = path.join(data, "portable.storyweaver");
  await exportFile(
    "Portable project backup",
    backup,
    "Project backup created:",
  );
  await page.getByRole("button", { name: "Photo Comic", exact: true }).click();
  await page.getByRole("button", { name: "Speech", exact: true }).click();
  await page
    .getByLabel("speech 1", { exact: true })
    .fill("A memory, in my own words.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const comicPdf = path.join(data, "comic.pdf");
  await exportFile("PDF document", comicPdf, "PDF created:");
  expect((await fs.stat(comicPdf)).size).toBeGreaterThan(10000);
  const comicText = execFileSync("pdftotext", ["-layout", comicPdf, "-"], {
    encoding: "utf8",
  });
  expect(comicText.match(/\bmemory\d+\b/g)).toEqual(
    Array.from({ length: 3000 }, (_, i) => `memory${i}`),
  );
  expect(comicText).toContain("THE LAST WORD.");
  expect(comicText).toContain("A memory, in my own words.");
  await page
    .getByRole("button", { name: "Back to dashboard", exact: true })
    .click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Dark mode", { exact: true }).check();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({
    path: "test-results/dark-settings.png",
    fullPage: true,
  });
  await app.close();
  await launch();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page
    .getByRole("button", { name: "Open A journey offline", exact: true })
    .click();
  await expect(page.getByLabel("speech 1", { exact: true })).toHaveValue(
    "A memory, in my own words.",
  );
  const reopened = await page.evaluate(
    async (id) => (await window.storyweaver.open(id)).project,
    id,
  );
  expect(reopened.story).toBe(story);
  expect(reopened.presentations.storybook.style.fontSize).toBe(22);
  await page
    .getByRole("button", { name: "Back to dashboard", exact: true })
    .click();
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
  }, backup);
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await expect(page.locator(".editor")).toBeVisible();
  expect(
    await page.evaluate(async () => (await window.storyweaver.list()).length),
  ).toBe(2);
  expect(errors).toEqual([]);
  await fs.writeFile(
    "test-results/artifacts.json",
    JSON.stringify({ data, pdf, comicPdf, htmlDir, backup }),
  );
  await app.close();
});
test.afterEach(async () => {
  if (page)
    await page
      .screenshot({ path: "test-results/last-state.png", fullPage: true })
      .catch(() => {});
  if (app) await app.close().catch(() => {});
});
