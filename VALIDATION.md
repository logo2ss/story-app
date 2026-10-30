# Validation record

Validated on Linux x64 with Node 24.19.0 and Electron 40.10.6. Tests run against the actual desktop app using an Xorg dummy display, not a mocked storage adapter. Native dialog destinations are supplied by the test runner so real import/export code can run unattended.

## Passed

- Lockfile installation: `NODE_USE_ENV_PROXY=1 npm ci --no-audit --no-fund`.
- Production build and strict TypeScript: `npm run build`.
- ESLint: `npm run lint`.
- Vitest: `npm test` — **24 tests passed**.
- Desktop: `npm run test:desktop` — **2 end-to-end tests passed**; the command started and cleaned up its own virtual display.
- Development Vite renderer opened in Electron, created the local sample, and saved without renderer errors. React refresh's inline preamble is enabled only for local development; the production content policy stays strict.
- Linux unpacked packaging and AppImage generation through electron-builder. The packaged executable was launched separately and successfully created a six-picture sample, saved its project, and decoded its thumbnail through the bundled native Sharp library.

The desktop workflow creates a project with 3,000 numbered story words and 25 portrait/landscape pictures, checks original text and picture ordering, moves a picture, changes theme and font size, saves, exports native storybook PDF, plays cinematic mode, exports standalone HTML and a portable backup, edits comic lettering, exports comic PDF, changes dark mode, closes/relaunches Electron, verifies restoration, and imports the portable backup as a separate project.

The exported HTML is opened separately without StoryWeaver's preload APIs; navigation and decoding all relative local pictures are verified. PDF output is opened with Poppler: all 3,000 numbered words and the final sentence are verified in both PDFs, in exact order without duplication. Both PDFs contain the final sentence and 26 image occurrences (25 pictures plus the cover); the comic PDF also contains the edited lettering. The tested large-font layout produced 51 nonempty physical sheets, with text flowing across sheets instead of being clipped.

The second desktop test exercises the original sample, page text edits, undo/redo, safe page removal, rotation, captions, image fitting, project rename/duplicate/delete, and UTF-8 Markdown importing including Arabic text and exact whitespace.

Unit/storage tests cover 100-, 5,000-, and 50,000-word stories in all modes; paragraph and chapter boundaries; unusually long words; 500-photo layout generation; lossless ordered placement; manual repositioning; safe page deletion; independent mode customization; history; escaped HTML; atomic persistence and reopening; corrupt-save recovery; missing files; corrupt images; JPEG/PNG/WebP; 24-megapixel image thumbnailing; portable backup restoration; invalid archives/identifiers; settings and storage migration; and actual importing/placement of 100 pictures.

## Practical limits and release scope

- Windows/macOS packaging is configured but has not been built or tested on those operating systems. Distributions are unsigned; production signing is not configured.
- Interface labels are English; English and Arabic/RTL story content is supported. Narration depends on OS-provided local voices and is disabled when no such voice is available.
- PDF prioritizes complete, readable content over a fixed one-layout-page-to-one-sheet mapping. Layout folios are not physical-sheet counters. Comic lettering is printed in document flow to avoid hiding text. For interactive bubble positioning, use the editor.
- Cropping uses non-destructive frame fitting and horizontal/vertical focal controls. Picture height is a mode setting. Fonts use local system families and fallbacks.
- Slideshow output is HTML, not video. There is no AI matching or generated dialogue.
- Hundreds of full-resolution images are not decoded together. Imports/exports process sequentially and use thumbnails for editing. Hardware, available disk, JSON serialization memory, and image-decoder safety limits still apply. Stress testing beyond the cases above has not been performed.
- Removed project pictures remain as recoverable original files in the project folder until project deletion; active exports/backups omit them. Normal close saves pending work; unexpected process/OS termination before autosave can lose the most recent unsaved edits, so keep portable backups.

Saved cloud setup fields are `install_script` and `start_skill`. Saving the draft does not publish the environment or prove restoration in a newly created task.

Final Linux artifact: `release/StoryWeaver-1.0.0.AppImage` (137,565,294 bytes). SHA-256: `f7e26e01a00b98421c15d46a61a597ab8838f461db6a3c0a016ee1a69f8a775b`. The unpacked binary was launch-tested; FUSE-mounted AppImage execution was not tested in the container.
