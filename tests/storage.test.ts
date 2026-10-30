import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Store } from "../electron/storage";
import { generatePages } from "../src/core/layout";
let temp: string;
let store: Store;
beforeEach(async () => {
  temp = await fs.mkdtemp(path.join(os.tmpdir(), "storyweaver-test-"));
  store = new Store(temp);
  await store.init();
});
afterEach(async () => {
  await fs.rm(temp, { recursive: true, force: true });
});
describe("local projects", () => {
  it("saves atomically and restores exact content and layout from a new store", async () => {
    const p = await store.create({ title: "A story", story: "A\n\nB  \nC" });
    p.presentations.comic.pages[0].text = "Comic edit";
    p.mode = "comic";
    await store.save(p);
    const next = new Store(temp);
    await next.init();
    expect((await next.open(p.id)).project).toEqual(p);
    expect(await next.list()).toHaveLength(1);
    expect(
      await fs.readFile(path.join(store.dir(p.id), "project.json.bak"), "utf8"),
    ).toContain("A story");
  });
  it("recovers a corrupt current save from its previous valid save", async () => {
    const p = await store.create({ title: "Recovery", story: "Safe text" });
    await store.save(p);
    await fs.writeFile(path.join(store.dir(p.id), "project.json"), "{broken");
    const r = await store.open(p.id);
    expect(r.project.story).toBe("Safe text");
    expect(r.warnings[0]).toContain("Recovered");
  });
  it("preserves originals, thumbnails large and mixed-format images, and rejects bad images", async () => {
    const p = await store.create({ title: "Pictures", story: "Photo story" });
    for (const format of ["jpeg", "png", "webp"] as const) {
      const buffer = await sharp({
        create: {
          width: format === "png" ? 6000 : 300,
          height: format === "png" ? 4000 : 500,
          channels: 3,
          background: "#39694b",
        },
      })
        .toFormat(format)
        .toBuffer();
      const a = await store.importImage(
        p.id,
        "image." + format.replace("jpeg", "jpg"),
        buffer,
      );
      expect(await fs.readFile(await store.assetPath(p.id, a))).toEqual(buffer);
      const thumb = await sharp(await store.thumbnail(p.id, a)).metadata();
      expect(thumb.width).toBeLessThanOrEqual(1000);
      p.assets.push(a);
    }
    await store.save(p);
    await expect(
      store.importImage(p.id, "bad.png", Buffer.from("corrupt")),
    ).rejects.toThrow();
    await fs.rm(await store.assetPath(p.id, p.assets[0]));
    expect((await store.open(p.id)).warnings[0]).toContain("Missing picture");
  });
  it("round-trips portable backups with assets and all modes; never overwrites an existing project", async () => {
    const p = await store.sample();
    p.presentations.comic.pages[0].bubbles = [
      {
        id: "bubble",
        text: "Hello",
        x: 12,
        y: 18,
        type: "speech",
        color: "#ffffff",
        size: 18,
      },
    ];
    await store.save(p);
    const archive = path.join(temp, "backup.storyweaver");
    await store.backup(p.id, archive);
    const restored = await store.restore(archive);
    expect(restored.id).not.toBe(p.id);
    expect(restored.assets).toEqual(p.assets);
    expect(restored.presentations).toEqual(p.presentations);
    for (const a of restored.assets)
      expect(await fs.readFile(await store.assetPath(restored.id, a))).toEqual(
        await fs.readFile(await store.assetPath(p.id, a)),
      );
    expect(await store.list()).toHaveLength(2);
  });
  it("rejects malformed archives and traversal identifiers", async () => {
    const archive = path.join(temp, "bad.storyweaver");
    await fs.writeFile(archive, "not a zip");
    await expect(store.restore(archive)).rejects.toThrow();
    expect(() => store.dir("../outside")).toThrow();
    expect(
      (await fs.readdir(store.root)).filter((n) => n.startsWith(".import")),
    ).toEqual([]);
  });
  it("duplicates and deletes only the selected project; retains settings", async () => {
    const p = await store.sample();
    const d = await store.duplicate(p.id);
    expect(d.assets).toEqual(p.assets);
    await store.remove(d.id);
    expect(await store.list()).toHaveLength(1);
    await store.setSettings({
      ...store.settings,
      dark: true,
      reducedMotion: true,
    });
    const next = new Store(temp);
    await next.init();
    expect(next.settings.dark).toBe(true);
    expect(next.settings.reducedMotion).toBe(true);
  });
  it("migrates storage into a separate directory while retaining the previous copy", async () => {
    const p = await store.sample();
    const old = store.dir(p.id);
    await store.setSettings({
      ...store.settings,
      projectLocation: path.join(temp, "moved"),
    });
    expect((await store.open(p.id)).project.title).toBe(p.title);
    expect((await fs.stat(old)).isDirectory()).toBe(true);
  });
  it("places all 100 pictures into each presentation in stable order", async () => {
    const p = await store.create({
      title: "Large",
      story: Array.from({ length: 3000 }, (_, i) => `word${i} `).join(""),
    });
    const bytes = await sharp({
      create: { width: 80, height: 120, channels: 3, background: "#789267" },
    })
      .png()
      .toBuffer();
    for (let i = 0; i < 100; i++)
      p.assets.push(await store.importImage(p.id, `${i}.png`, bytes));
    for (const mode of ["storybook", "cinematic", "comic"] as const) {
      p.presentations[mode].pages = generatePages(
        p.story,
        p.assets.map((a) => a.id),
        mode,
      );
      expect(p.presentations[mode].pages.flatMap((pg) => pg.assetIds)).toEqual(
        p.assets.map((a) => a.id),
      );
    }
    await store.save(p);
    expect((await store.open(p.id)).project.assets).toHaveLength(100);
  });
});
