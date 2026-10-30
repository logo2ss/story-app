import { app, BrowserWindow, dialog, ipcMain, net, protocol } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { z } from "zod";
import {
  idSchema,
  modes,
  projectSchema,
  settingsSchema,
  type Project,
} from "../src/core/model";
import { exportHtml } from "../src/core/render";
import { Store } from "./storage";
protocol.registerSchemesAsPrivileged([
  {
    scheme: "storyasset",
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);
let win: BrowserWindow;
let store: Store;
const progress = (s: string) => win?.webContents.send("progress", s);
const safeName = (s: string) =>
  s.replace(/[^\p{L}\p{N}_ -]/gu, "").slice(0, 100) || "StoryWeaver";
function handle(channel: string, fn: (...args: any[]) => unknown) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (
      event.sender !== win.webContents ||
      event.senderFrame !== win.webContents.mainFrame
    )
      throw new Error("Untrusted IPC sender.");
    try {
      return await fn(...args);
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      throw new Error(
        code === "ENOSPC"
          ? "Your disk is full. Free some space and retry."
          : code === "EACCES"
            ? "Permission denied. Choose a writable folder and retry."
            : e instanceof Error
              ? e.message
              : "The operation failed. Your original files have been preserved.",
      );
    } finally {
      progress("");
    }
  });
}
async function walk(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const result: string[] = [];
  for (const e of entries) {
    if (e.isDirectory()) result.push(...(await walk(path.join(dir, e.name))));
    else if (e.isFile() && /\.(jpe?g|png|webp)$/i.test(e.name))
      result.push(path.join(dir, e.name));
  }
  return result.sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
}
async function exportProject(
  project: Project,
  format: "html" | "pdf",
  destination: string,
) {
  const p = projectSchema.parse(project);
  const style = p.presentations[p.mode].style;
  if (format === "html") {
    const stage = destination + ".partial-" + Date.now();
    await fs.mkdir(path.join(stage, "assets"), { recursive: true });
    try {
      let i = 0;
      for (const a of p.assets) {
        progress(`Preparing picture ${++i} of ${p.assets.length}`);
        await sharp(await store.assetPath(p.id, a))
          .rotate()
          .png()
          .toFile(path.join(stage, "assets", a.id + ".png"));
      }
      await fs.writeFile(
        path.join(stage, "index.html"),
        exportHtml(p, (a) => `assets/${a.id}.png`),
      );
      await fs.rename(stage, destination);
      if (!(await fs.stat(path.join(destination, "index.html"))).size)
        throw new Error("The export file is empty.");
    } catch (e) {
      await fs.rm(stage, { recursive: true, force: true });
      throw e;
    }
  } else {
    const temp = path.join(
      app.getPath("temp"),
      "storyweaver-export-" + crypto.randomUUID(),
    );
    await fs.mkdir(temp, { recursive: true });
    let hidden: BrowserWindow | undefined;
    try {
      const source = path.join(temp, "story.html");
      let i = 0;
      for (const a of p.assets) {
        progress(`Preparing picture ${++i} of ${p.assets.length}`);
        await sharp(await store.assetPath(p.id, a))
          .rotate()
          .png()
          .toFile(path.join(temp, a.id + ".png"));
      }
      await fs.writeFile(
        source,
        exportHtml(p, (a) => a.id + ".png", true),
      );
      hidden = new BrowserWindow({
        show: false,
        webPreferences: {
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
        },
      });
      hidden.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      hidden.webContents.on("will-navigate", (e) => e.preventDefault());
      await hidden.loadFile(source);
      await hidden.webContents.executeJavaScript(
        `Promise.all(Array.from(document.images).map(i=>{i.loading='eager';return i.decode().catch(()=>{throw new Error('An export picture could not be decoded.')})}))`,
      );
      progress("Printing the complete document…");
      const pdf = await hidden.webContents.printToPDF({
        printBackground: true,
        preferCSSPageSize: false,
        pageSize:
          style.pageSize === "Custom"
            ? {
                width: style.customWidth / 25.4,
                height: style.customHeight / 25.4,
              }
            : style.pageSize,
        landscape: style.landscape,
        margins: { top: 0.35, bottom: 0.35, left: 0.35, right: 0.35 },
      });
      if (pdf.subarray(0, 5).toString() !== "%PDF-")
        throw new Error("PDF output could not be validated.");
      await fs.writeFile(destination + ".partial", pdf);
      await fs.rename(destination + ".partial", destination);
    } finally {
      hidden?.destroy();
      await fs.rm(temp, { recursive: true, force: true });
    }
  }
  return destination;
}
app.whenReady().then(async () => {
  if (process.env.STORYWEAVER_DATA)
    app.setPath("userData", process.env.STORYWEAVER_DATA);
  store = new Store(app.getPath("userData"));
  try {
    await store.init();
  } catch (e) {
    dialog.showErrorBox("StoryWeaver could not open local storage", String(e));
    app.quit();
    return;
  }
  protocol.handle("storyasset", async (request) => {
    try {
      const url = new URL(request.url);
      if (url.hostname !== "local") throw new Error("Invalid host");
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length !== 2) throw new Error("Invalid asset");
      const [id, assetId] = parts.map((s) => idSchema.parse(s));
      const a = await store.findAsset(id, assetId);
      if (!a) return new Response("Missing picture", { status: 404 });
      const file = url.searchParams.has("thumb")
        ? await store.thumbnail(id, a)
        : await store.assetPath(id, a);
      return net.fetch(pathToFileURL(file).href);
    } catch {
      return new Response("Picture unavailable", { status: 404 });
    }
  });
  win = new BrowserWindow({
    width: 1510,
    height: 980,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: "#f6f5f0",
    title: "StoryWeaver",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  let closing = false;
  win.on("close", (event) => {
    if (!closing) {
      event.preventDefault();
      win.webContents.send("before-close");
    }
  });
  ipcMain.on("close:finish", (event) => {
    if (event.sender === win.webContents) {
      closing = true;
      win.close();
    }
  });
  win.setMenuBarVisibility(false);
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  // Runtime never needs the Internet. Development only permits the exact local Vite origin.
  const dev = process.env.STORYWEAVER_DEV;
  if (dev && dev !== "http://localhost:5173")
    throw new Error("Invalid development origin");
  win.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    const url = new URL(details.url);
    callback({
      cancel:
        ["http:", "https:", "ws:", "wss:"].includes(url.protocol) &&
        !(dev && url.hostname === "localhost" && url.port === "5173"),
    });
  });
  handle("projects:list", () => store.list());
  handle("projects:open", (id) => store.open(idSchema.parse(id)));
  handle("projects:save", (p) => store.save(projectSchema.parse(p)));
  handle("projects:create", (input) =>
    store.create(
      z
        .object({
          title: z.string().min(1),
          subtitle: z.string(),
          author: z.string(),
          language: z.enum(["en", "ar"]),
          story: z.string(),
          mode: z.enum(modes),
        })
        .parse(input),
    ),
  );
  handle("projects:remove", (id) => store.remove(idSchema.parse(id)));
  handle("projects:duplicate", (id) => store.duplicate(idSchema.parse(id)));
  handle("text:import", async () => {
    const r = await dialog.showOpenDialog(win, {
      properties: ["openFile"],
      filters: [{ name: "Story text", extensions: ["txt", "md", "markdown"] }],
    });
    if (r.canceled) return null;
    const text = await fs.readFile(r.filePaths[0], "utf8");
    if (text.includes("\u0000") || text.includes("\ufffd"))
      throw new Error("Import a valid UTF-8 text or Markdown file.");
    return text;
  });
  handle("images:import", async (id, folder = false) => {
    id = idSchema.parse(id);
    z.boolean().parse(folder);
    await store.open(id);
    const r = await dialog.showOpenDialog(win, {
      properties: folder ? ["openDirectory"] : ["openFile", "multiSelections"],
      filters: [
        { name: "Pictures", extensions: ["jpg", "jpeg", "png", "webp"] },
      ],
    });
    if (r.canceled) return { assets: [], errors: [] };
    const paths = folder ? await walk(r.filePaths[0]) : r.filePaths;
    const assets = [];
    const errors = [];
    for (let i = 0; i < paths.length; i++) {
      progress(`Importing picture ${i + 1} of ${paths.length}`);
      try {
        assets.push(
          await store.importImage(id, path.basename(paths[i]), paths[i]),
        );
      } catch (e) {
        errors.push(`${path.basename(paths[i])}: ${String(e)}`);
      }
    }
    return { assets, errors };
  });
  handle("images:bytes", async (id, name, bytes) => {
    id = idSchema.parse(id);
    z.string().parse(name);
    await store.open(id);
    if (!(bytes instanceof Uint8Array))
      throw new Error("Invalid picture data.");
    return store.importImage(id, path.basename(name), Buffer.from(bytes));
  });
  handle("projects:backup", async (id) => {
    id = idSchema.parse(id);
    const { project } = await store.open(id);
    const r = await dialog.showSaveDialog(win, {
      defaultPath: path.join(
        store.settings.exportLocation || app.getPath("documents"),
        safeName(project.title) + ".storyweaver",
      ),
      filters: [{ name: "StoryWeaver project", extensions: ["storyweaver"] }],
    });
    if (r.canceled || !r.filePath) return null;
    await store.backup(id, r.filePath);
    return r.filePath;
  });
  handle("projects:restore", async () => {
    const r = await dialog.showOpenDialog(win, {
      properties: ["openFile"],
      filters: [{ name: "StoryWeaver project", extensions: ["storyweaver"] }],
    });
    return r.canceled ? null : store.restore(r.filePaths[0]);
  });
  handle("export", async (input, format) => {
    const p = projectSchema.parse(input);
    z.enum(["pdf", "html"]).parse(format);
    await store.save(p);
    const r = await dialog.showSaveDialog(win, {
      defaultPath: path.join(
        store.settings.exportLocation || app.getPath("documents"),
        safeName(p.title) + (format === "pdf" ? ".pdf" : "-html"),
      ),
      filters:
        format === "pdf" ? [{ name: "PDF document", extensions: ["pdf"] }] : [],
    });
    if (r.canceled || !r.filePath) return null;
    if (format === "html") {
      try {
        await fs.access(r.filePath);
        throw new Error(
          "Choose a new folder name for HTML export to protect existing files.",
        );
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      }
    }
    return exportProject(p, format, r.filePath);
  });
  handle("settings:get", () => store.settings);
  handle("settings:set", (s) => store.setSettings(settingsSchema.parse(s)));
  handle("directory:choose", async () => {
    const r = await dialog.showOpenDialog(win, {
      properties: ["openDirectory", "createDirectory"],
    });
    return r.canceled ? null : r.filePaths[0];
  });
  handle("cache:clear", () => store.clearCache());
  handle("sample", () => store.sample());
  if (dev) await win.loadURL(dev);
  else await win.loadFile(path.join(__dirname, "../dist/index.html"));
});
app.on("window-all-closed", () => app.quit());
