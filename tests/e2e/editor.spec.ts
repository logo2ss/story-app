import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
let app: ElectronApplication;
let page: Page;
test("sample, text import, editing, history, layout safety and project management", async () => {
  const data = await fs.mkdtemp(path.join(os.tmpdir(), "storyweaver-edit-"));
  app = await electron.launch({
    args: ["--no-sandbox", "--disable-gpu", "."],
    env: {
      ...process.env,
      DISPLAY: process.env.DISPLAY || ":99",
      STORYWEAVER_DATA: data,
    },
  });
  page = await app.firstWindow();
  await page.getByRole("button", { name: "Open sample", exact: false }).click();
  await expect(page.locator(".editor")).toBeVisible();
  await expect(page.locator(".paper-scale img").first()).toBeVisible();
  expect(
    await page
      .locator(".paper-scale img")
      .first()
      .evaluate(async (img) => {
        await (img as HTMLImageElement).decode();
        return (img as HTMLImageElement).naturalWidth > 0;
      }),
  ).toBe(true);
  const text = page.getByLabel("Page text", { exact: true });
  const original = await text.inputValue();
  await text.fill(original + "\nA carefully added sentence.");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(text).toHaveValue(original);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(text).toHaveValue(original + "\nA carefully added sentence.");
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  await expect(text).toHaveValue("");
  await text.fill("A new page.");
  await page.getByRole("button", { name: "Page", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByText("Please confirm", { exact: true }),
  ).not.toBeVisible();
  await expect(text).not.toHaveValue("");
  await page.getByRole("button", { name: "Pictures 6", exact: true }).click();
  await page.locator(".asset-tile").first().click();
  await page.getByRole("button", { name: "Rotate", exact: true }).click();
  await page
    .getByLabel("Picture caption", { exact: true })
    .fill("A new caption");
  await page
    .getByLabel("Crop / fit (original preserved)", { exact: true })
    .selectOption("contain");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  let p = await page.evaluate(async () => {
    const all = await window.storyweaver.list();
    return (await window.storyweaver.open(all[0].id)).project;
  });
  expect(p.assets[0].rotation).toBe(90);
  expect(p.assets[0].caption).toBe("A new caption");
  expect(p.story).not.toContain("A carefully added sentence.");
  await page
    .getByRole("button", { name: "Back to dashboard", exact: true })
    .click();
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  await page
    .getByLabel("Project title", { exact: true })
    .fill("Renamed sample");
  await page.getByRole("button", { name: "Save name", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Open Renamed sample", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Duplicate project", exact: true })
    .click();
  await expect(page.locator(".project-card")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Delete project", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.locator(".project-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Create new story", exact: true })
    .click();
  await page
    .getByLabel("Project title *", { exact: true })
    .fill("Imported words");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  const file = path.join(data, "original.md");
  const source =
    "# Imported chapter\n\nEvery  space stays.\nAnother line.\n\nالنص الأصلي.";
  await fs.writeFile(file, source);
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
  }, file);
  await page.getByRole("button", { name: "Import text", exact: true }).click();
  await expect(page.locator(".story-input")).toHaveValue(source);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Create my story", exact: true })
    .click();
  await expect(page.locator(".editor")).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  p = await page.evaluate(async () => {
    const all = await window.storyweaver.list();
    return (
      await window.storyweaver.open(
        all.find((p) => p.title === "Imported words")!.id,
      )
    ).project;
  });
  expect(p.story).toBe(source);
  expect(p.assets).toHaveLength(0);
  await app.close();
});
test.afterEach(async () => {
  if (app) await app.close().catch(() => {});
});
