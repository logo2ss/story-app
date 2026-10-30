import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import sharp from "sharp";
import * as yauzl from "yauzl";
import * as yazl from "yazl";
import { createProject, generatePages } from "../src/core/layout";
import {
  defaultSettings,
  idSchema,
  projectSchema,
  settingsSchema,
  type Asset,
  type Project,
  type ProjectSummary,
  type Settings,
} from "../src/core/model";
export async function atomicJson(file: string, value: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  try {
    const handle = await fs.open(temp, "wx", 0o600);
    try {
      await handle.writeFile(JSON.stringify(value));
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      const previous = JSON.parse(await fs.readFile(file, "utf8"));
      const valid = file.endsWith("project.json")
        ? projectSchema.safeParse(previous).success
        : settingsSchema.safeParse(previous).success;
      if (valid) await fs.copyFile(file, file + ".bak");
      else await fs.copyFile(file, file + ".damaged-" + Date.now());
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
        if (e instanceof SyntaxError)
          await fs.copyFile(file, file + ".damaged-" + Date.now());
        else throw e;
      }
    }
    await fs.rename(temp, file);
  } finally {
    await fs.rm(temp, { force: true });
  }
}
export class Store {
  private assetCache = new Map<string, Asset>();
  private queue: Promise<unknown> = Promise.resolve();
  settings: Settings = defaultSettings;
  constructor(public dataDir: string) {}
  async init() {
    await fs.mkdir(this.dataDir, { recursive: true });
    try {
      this.settings = settingsSchema.parse(
        JSON.parse(
          await fs.readFile(path.join(this.dataDir, "settings.json"), "utf8"),
        ),
      );
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
        try {
          this.settings = settingsSchema.parse(
            JSON.parse(
              await fs.readFile(
                path.join(this.dataDir, "settings.json.bak"),
                "utf8",
              ),
            ),
          );
        } catch {
          throw new Error(
            "Settings are damaged. Preserve the settings files in your application data folder, then restore a valid backup.",
          );
        }
      }
    }
    await fs.mkdir(this.root, { recursive: true });
  }
  get root() {
    return this.settings.projectLocation || path.join(this.dataDir, "projects");
  }
  dir(id: string) {
    return path.join(this.root, idSchema.parse(id));
  }
  setSettings(settings: Settings) {
    const operation = this.queue.then(() => this.applySettings(settings));
    this.queue = operation.catch(() => {});
    return operation;
  }
  private async applySettings(settings: Settings) {
    const s = settingsSchema.parse(settings);
    const old = this.root;
    const next = s.projectLocation || path.join(this.dataDir, "projects");
    if (path.resolve(old) !== path.resolve(next)) {
      if (
        path.resolve(next).startsWith(path.resolve(old) + path.sep) ||
        path.resolve(old).startsWith(path.resolve(next) + path.sep)
      )
        throw new Error(
          "Choose a separate project folder, outside the existing storage folder.",
        );
      await fs.mkdir(next, { recursive: true });
      const entries = await fs.readdir(old, { withFileTypes: true });
      for (const e of entries.filter(
        (e) => e.isDirectory() && !e.name.startsWith("."),
      )) {
        try {
          await fs.access(path.join(next, e.name));
          throw new Error(
            "Destination already contains a project with the same ID. Choose an empty folder.",
          );
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
        }
      }
      for (const e of entries.filter(
        (e) => e.isDirectory() && !e.name.startsWith("."),
      ))
        await fs.cp(path.join(old, e.name), path.join(next, e.name), {
          recursive: true,
          errorOnExist: true,
          force: false,
        });
    }
    await atomicJson(path.join(this.dataDir, "settings.json"), s);
    this.settings = s;
    return s;
  }
  async save(input: Project) {
    const p = projectSchema.parse(input);
    const operation = this.queue.then(async () => {
      await atomicJson(path.join(this.dir(p.id), "project.json"), p);
    });
    this.queue = operation.catch(() => {});
    await operation;
  }
  async open(id: string) {
    const file = path.join(this.dir(id), "project.json");
    let project: Project;
    const warnings: string[] = [];
    try {
      project = projectSchema.parse(
        JSON.parse(await fs.readFile(file, "utf8")),
      );
    } catch {
      try {
        project = projectSchema.parse(
          JSON.parse(await fs.readFile(file + ".bak", "utf8")),
        );
        warnings.push(
          "Recovered the previous saved version. The damaged file has been preserved until your next save.",
        );
      } catch {
        throw new Error(
          "This project and its recovery copy could not be read. Restore a .storyweaver backup; the existing files have been preserved.",
        );
      }
    }
    if (project.id !== id)
      throw new Error("Project identity does not match its folder.");
    for (const a of project.assets) {
      try {
        await this.assetPath(project.id, a);
      } catch {
        warnings.push(
          `Missing picture: ${a.name}. Reimport it or restore a project backup.`,
        );
      }
    }
    return { project, warnings };
  }
  async list(): Promise<ProjectSummary[]> {
    await fs.mkdir(this.root, { recursive: true });
    const entries = await fs.readdir(this.root, { withFileTypes: true });
    const result: ProjectSummary[] = [];
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith(".")) continue;
      try {
        const { project: p, warnings } = await this.open(e.name);
        result.push({
          id: p.id,
          title: p.title,
          subtitle: p.subtitle,
          mode: p.mode,
          updatedAt: p.updatedAt,
          coverId: p.coverId,
          assetCount: p.assets.length,
          pages: p.presentations[p.mode].pages.length,
          warning: warnings.length ? warnings[0] : undefined,
        });
      } catch {
        if (idSchema.safeParse(e.name).success)
          result.push({
            id: e.name,
            title: "Project needs recovery",
            subtitle: "Restore a backup to recover this project.",
            mode: "storybook",
            updatedAt: "",
            coverId: null,
            assetCount: 0,
            pages: 0,
            warning: "Saved data is damaged.",
          });
      }
    }
    return result;
  }
  async create(input: Parameters<typeof createProject>[0]) {
    const p = createProject(input, this.settings);
    await this.save(p);
    return p;
  }
  async remove(id: string) {
    await this.queue;
    await fs.rm(this.dir(id), { recursive: true, force: true });
  }
  async duplicate(id: string) {
    const { project } = await this.open(id);
    const source = this.dir(id);
    project.id = randomUUID();
    project.title += " — copy";
    project.createdAt = project.updatedAt = new Date().toISOString();
    await fs.cp(source, this.dir(project.id), { recursive: true });
    await this.save(project);
    return project;
  }
  async findAsset(id: string, assetId: string) {
    const key = id + ":" + assetId;
    const cached = this.assetCache.get(key);
    if (cached) return cached;
    const p = projectSchema.parse(
      JSON.parse(
        await fs.readFile(path.join(this.dir(id), "project.json"), "utf8"),
      ),
    );
    for (const a of p.assets) this.assetCache.set(id + ":" + a.id, a);
    return this.assetCache.get(key);
  }
  async assetPath(id: string, a: Asset) {
    const candidate = path.join(this.dir(id), a.file);
    const real = await fs.realpath(candidate);
    const root = await fs.realpath(this.dir(id));
    if (!real.startsWith(root + path.sep))
      throw new Error("Unsafe asset path.");
    return real;
  }
  async importImage(
    id: string,
    name: string,
    source: string | Buffer,
  ): Promise<Asset> {
    const ext = path.extname(name).toLowerCase();
    if (![".jpg", ".jpeg", ".png", ".webp"].includes(ext))
      throw new Error("Use JPEG, PNG, or WebP pictures.");
    const meta = await sharp(source, { failOn: "error" }).metadata();
    if (
      !meta.width ||
      !meta.height ||
      !["jpeg", "png", "webp"].includes(meta.format || "")
    )
      throw new Error("This image could not be decoded.");
    const assetId = randomUUID();
    const file = `assets/${assetId}${ext}`;
    const dir = this.dir(id);
    await fs.mkdir(path.join(dir, "assets"), { recursive: true });
    if (typeof source === "string")
      await fs.copyFile(source, path.join(dir, file));
    else await fs.writeFile(path.join(dir, file), source);
    const a: Asset = {
      id: assetId,
      name,
      file,
      width: meta.autoOrient?.width ?? meta.width,
      height: meta.autoOrient?.height ?? meta.height,
      caption: "",
      rotation: 0,
      crop: "cover",
      focusX: 50,
      focusY: 50,
    };
    this.assetCache.set(id + ":" + a.id, a);
    await this.thumbnail(id, a);
    return a;
  }
  async thumbnail(id: string, a: Asset) {
    const dir = path.join(this.dir(id), "cache");
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, a.id + ".webp");
    try {
      await fs.access(file);
    } catch {
      await sharp(await this.assetPath(id, a))
        .rotate()
        .resize(1000, 1000, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(file);
    }
    return file;
  }
  async clearCache() {
    for (const p of await this.list())
      await fs.rm(path.join(this.dir(p.id), "cache"), {
        recursive: true,
        force: true,
      });
  }
  async backup(id: string, destination: string) {
    const { project } = await this.open(id);
    const files = await Promise.all(
      project.assets.map(async (a) => ({
        file: await this.assetPath(id, a),
        name: a.file,
      })),
    );
    const temp = destination + ".partial-" + randomUUID();
    try {
      const zip = new yazl.ZipFile();
      zip.addBuffer(Buffer.from(JSON.stringify(project)), "project.json");
      for (const a of files) zip.addFile(a.file, a.name);
      const result = pipeline(
        zip.outputStream,
        createWriteStream(temp, { flags: "wx" }),
      );
      zip.end();
      await result;
      if (!(await fs.stat(temp)).size) throw new Error("Backup is empty.");
      await fs.rename(temp, destination);
    } finally {
      await fs.rm(temp, { force: true });
    }
  }

  async restore(archive: string): Promise<Project> {
    const temp = path.join(this.root, ".import-" + randomUUID());
    await fs.mkdir(temp, { recursive: true });
    try {
      await new Promise<void>((resolve, reject) => {
        yauzl.open(
          archive,
          { lazyEntries: true, validateEntrySizes: true },
          (err, zip) => {
            if (err || !zip)
              return reject(new Error("Invalid project package."));
            const seen = new Set<string>();
            let failed = false;
            const fail = (e: unknown) => {
              if (!failed) {
                failed = true;
                zip.close();
                reject(e);
              }
            };
            zip.on("error", fail);
            zip.on("end", () => resolve());
            zip.on("entry", (entry) => {
              void (async () => {
                const name = entry.fileName;
                if (
                  !/^(project\.json|assets\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp))$/.test(
                    name,
                  ) ||
                  seen.has(name)
                )
                  throw new Error(
                    "Unsafe or duplicate entry in project package.",
                  );
                if (
                  ((entry.externalFileAttributes >>> 16) & 0o170000) ===
                  0o120000
                )
                  throw new Error(
                    "Project packages cannot contain symbolic links.",
                  );
                seen.add(name);
                const space = await fs.statfs(temp);
                if (entry.uncompressedSize > space.bavail * space.bsize)
                  throw new Error(
                    "Not enough disk space to restore this package.",
                  );
                await fs.mkdir(path.dirname(path.join(temp, name)), {
                  recursive: true,
                });
                await new Promise<void>((res, rej) =>
                  zip.openReadStream(entry, (error, stream) => {
                    if (error || !stream) return rej(error);
                    pipeline(
                      stream,
                      createWriteStream(path.join(temp, name), { flags: "wx" }),
                    ).then(() => res(), rej);
                  }),
                );
                zip.readEntry();
              })().catch(fail);
            });
            zip.readEntry();
          },
        );
      });
      const project = projectSchema.parse(
        JSON.parse(await fs.readFile(path.join(temp, "project.json"), "utf8")),
      );
      const used = new Set(project.assets.map((a) => a.id));
      for (const mode of Object.values(project.presentations))
        for (const page of mode.pages)
          if (page.assetIds.some((id) => !used.has(id)))
            throw new Error("A layout refers to a missing picture.");
      for (const a of project.assets) {
        const meta = await sharp(path.join(temp, a.file)).metadata();
        if (!meta.width) throw new Error(`Invalid picture: ${a.name}`);
      }
      project.id = randomUUID();
      project.updatedAt = new Date().toISOString();
      await atomicJson(path.join(temp, "project.json"), project);
      await fs.rename(temp, this.dir(project.id));
      return project;
    } catch (e) {
      await fs.rm(temp, { recursive: true, force: true });
      throw e;
    }
  }
  async sample() {
    const p = await this.create({
      title: "The quiet way home",
      subtitle: "A small journey, beautifully remembered",
      author: "A StoryWeaver original",
      story: sampleStory,
    });
    for (let i = 0; i < 6; i++) {
      const colors = [
        ["#d8d9b9", "#526a56"],
        ["#eed8ae", "#b08055"],
        ["#bdd2ca", "#4e7471"],
        ["#d7bdad", "#94715e"],
        ["#ded4b8", "#728065"],
        ["#e9c6a4", "#88644e"],
      ][i];
      const svg = `<svg width="1200" height="800" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="800" fill="${colors[0]}"/><circle cx="${750 - i * 50}" cy="230" r="100" fill="#fff5d2"/><path d="M0 600 Q300 ${150 + i * 30} 650 530 T1200 420 V800 H0Z" fill="${colors[1]}"/><path d="M0 700 Q400 400 1200 620 V800 H0Z" fill="#293e36" opacity=".7"/></svg>`;
      const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
      const a = await this.importImage(p.id, `Landscape ${i + 1}.png`, buffer);
      a.caption = [
        "The hills beyond the station",
        "Afternoon light",
        "A river to follow",
        "The long way round",
        "Familiar horizons",
        "Home, at last",
      ][i];
      p.assets.push(a);
    }
    p.coverId = p.assets[0].id;
    for (const mode of ["storybook", "cinematic", "comic"] as const)
      p.presentations[mode].pages = generatePages(
        p.story,
        p.assets.map((a) => a.id),
        mode,
      );
    await this.save(p);
    return p;
  }
}
export const sampleStory = `# The quiet way home\n\nThere was a road that Mara had never taken, though it began just beyond her garden gate. Every morning she watched the sunlight reach its bend. Every evening she promised herself that tomorrow she would follow it.\n\nOne autumn morning, she packed a notebook, an apple, and the camera her grandfather had given her. The house settled into silence behind her. For once, she did not make a list of things to finish before leaving.\n\n# The river\n\nBeyond the station, the road became a path. It led between low stone walls and through an orchard where the last pears hung like little lanterns. Mara stopped to photograph a leaf floating in a puddle. It was a very small thing, and it was enough.\n\nAt the river she sat on a smooth grey rock and ate her apple. A boat moved slowly upstream. Its owner raised one hand, and she raised hers in return. Neither of them needed to say anything.\n\nShe wrote in her notebook: Perhaps a journey does not need to take you far. Perhaps it only needs to help you notice where you are.\n\n# Home, again\n\nThe afternoon turned gold. Mara followed the river until it curved toward the village, then crossed a wooden bridge she remembered from childhood. From there she could see her own roof between the trees.\n\nShe had spent the whole day walking away from home, only to find a new way back. In her camera were six pictures. In her notebook were three lines. In her pocket was a smooth stone from the river.\n\nThat evening, she left the notebook open on the kitchen table. Tomorrow, there would be other roads. Tonight, there was the quiet pleasure of remembering this one.`;
