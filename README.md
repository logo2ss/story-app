# StoryWeaver

An offline Electron studio for turning your own writing and pictures into a digital storybook, a cinematic slideshow, or a photo comic. There are no accounts, API keys, AI models, analytics, hosted assets, or runtime network requirements. Picture placement follows import order, never image analysis.

## Run

Use Node.js 24 and npm on a desktop with a graphical display:

```sh
npm ci
npm run dev
```

`npm run dev` builds the desktop process and preload, starts local Vite, and opens Electron. Restart it after changing `electron/`. The React interface supports hot reload. The browser-only Vite page deliberately cannot access native project storage: use the Electron window.

For a production development build:

```sh
npm run build
npm start
```

On a managed network proxy with Node 24, `NODE_USE_ENV_PROXY=1 npm ci` enables the supported proxy route for Electron's initial download. Keep the platform's CA trust and TLS verification enabled.

## Build a desktop distribution

```sh
npm run pack          # unpacked desktop application in release/
npm run dist          # installer(s) for the current OS
# Linux AppImage only:
npm run dist -- --linux AppImage
```

Packaging configuration includes Linux AppImage/deb, Windows NSIS, and macOS DMG targets. Build Windows and macOS installers on those platforms; code signing requires your own signing configuration. The Linux unpacked distribution was exercised in this environment. See `VALIDATION.md` for the actual checks performed, rather than treating configured targets as verified releases.

## Create a story

1. Select **Create new story**, enter a title, optional subtitle/author, and English or Arabic direction.
2. Write or paste text, or import a UTF-8 TXT/Markdown file. Paragraphs, whitespace, and the original manuscript remain intact. A photo-only project is also supported.
3. Select pictures, drop them into the wizard, or select a whole folder. JPEG, PNG, and WebP originals are copied into your project. Choose a cover.
4. Choose a presentation. Each mode gets a separate layout using the same source text and pictures.

Use **Open sample** on an empty dashboard for an original story and six locally generated landscape illustrations. Original sample assets also live in `public/samples/` under CC0.

## Editor

- The left panel contains pages and the picture library. Drag pages to reorder them, or drag a library picture onto a page to move it there. The center canvas accepts image files dropped from your desktop. Folder import sorts filenames naturally.
- The right inspector edits text, layouts, typography, colors, margins, image height, picture borders/corners, page dimensions, numbering, and captions. Select a picture to rotate, crop to its frame, move its crop focus, select the cover, edit its caption, or move it to a particular page. Cropping and rotation preserve the original image.
- Removing a picture from a page keeps it in the library. **Remove project picture** removes its association from all modes; the original copied file is retained on disk for recovery/undo until the project directory is deleted. Exports and backups contain only the active project assets.
- Comic mode adds speech, thought, and caption lettering with editable text, color, size, and position controls. Layouts include single, two, three/mixed, grid, and vertical arrangements.
- Cinematic mode has timed playback, pause, restart, page navigation, transitions, zoom, and fullscreen. Optional narration appears only when the OS reports a local voice. Arabic text uses RTL; the editor labels currently remain English.
- Source text is separate from page text. **Original story → Update & rebuild** explicitly replaces all mode layouts after confirmation. The reset icon by **Add page** rebuilds only the current mode. Other customizations survive mode switches.
- Deleting a page merges its content into its neighbor. Explicit text edits change that page's intended export content; the original manuscript remains available.
- **Ctrl/Cmd+S** saves; **Ctrl/Cmd+Z** and **Ctrl/Cmd+Shift+Z** undo/redo outside text inputs. Text fields retain native text undo. Arrow keys navigate pages outside inputs; Escape leaves preview. Panel visibility, zoom, full-screen preview, table of contents, and reduced motion are available.

## Local storage and recovery

Projects default to Electron's per-user application data directory, inside `projects/<project-id>/`. Each project contains `project.json`, `assets/` originals, and regenerable `cache/` thumbnails. Autosave runs after a short editing pause; explicit Save and normal window close also save. Keep backups for unexpected OS termination before an autosave completes.

Writes use a temporary file, flush it, and rename it into place. The previous valid JSON is kept as `.bak`. A damaged current save can reopen from its recovery copy, with a warning. Damaged saves are preserved when overwritten; if both versions are invalid, restore a portable project backup. Missing asset warnings identify pictures that need recovery. One corrupt imported picture does not stop other imports.

Settings persist locally. Changing the project storage location copies projects into the new folder and retains the previous location as a backup. Choose a separate empty destination; collisions are rejected. No original source file outside the project is modified.

## Exports

- **PDF** (storybook/comic): Electron prints the actual local document. Supports A4, A5, US Letter, custom dimensions, orientation, margins, cover, and layout page numbering. Text flows onto additional sheets rather than being clipped. Large layout pages can span several PDF sheets; folios refer to layout pages, not physical sheet numbers. Comic bubbles become in-flow lettering on print to avoid covering story text.
- **Offline HTML** (storybook/cinematic): a new folder containing `index.html` and relative local image assets. Open `index.html` directly without StoryWeaver or a server. Next/previous, timed playback, keyboard navigation, and fullscreen work offline. Keep the folder together when sharing it. Export refuses to replace an existing folder.
- **Portable backup**: `.storyweaver` ZIP package containing the complete manuscript, originals, settings, and all three layouts. Dashboard **Import** restores it under a new project ID, preserving existing projects. Archives are validated and never execute imported content.

The original source is not silently rewritten or semantically matched. Large collections use cached thumbnails, lazy decoding, and sequential image processing. There is no artificial count/length limit, but available disk, memory, JSON serialization capacity, and Sharp's image decoder safety limits still apply. Back up significant work. Very large documents and exports can take time.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e       # real Electron, needs a display
npm run test:desktop   # uses DISPLAY, or starts a temporary Linux Xorg dummy display
```

For Linux desktop tests install Electron's system libraries, Xorg with `xserver-xorg-video-dummy` (or use `xvfb-run -a npm run test:e2e`), and Poppler's `pdftotext`. Tests use `--no-sandbox` only in the container test launcher; the shipped renderer retains context isolation, sandboxing, disabled Node integration, validated scoped IPC, and blocked runtime HTTP traffic.

## Code map

- `electron/main.ts`: native dialogs, scoped IPC, asset protocol, offline network policy, window lifecycle, PDF/HTML export orchestration.
- `electron/preload.ts`: narrow renderer bridge; no generic filesystem or IPC exposure.
- `electron/storage.ts`: atomic saves, recovery, thumbnail/image import, settings, ZIP backup/restoration.
- `src/core/model.ts`: shared validated document model and bridge types.
- `src/core/layout.ts`: lossless segmentation, deterministic placement, safe page removal, history.
- `src/core/render.ts`: escaped, shared preview/export renderer and standalone HTML reader.
- `src/components/`: project wizard, editor, settings, and shared UI components.
- `tests/`: content/storage tests and a real desktop workflow with native exports and restart checks.
