import {
  Archive,
  ArrowRight,
  BookMarked,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  FolderOpen,
  GripVertical,
  Image as ImageIcon,
  Maximize2,
  MoveDown,
  MoveUp,
  PanelLeftClose,
  PanelRightClose,
  Pause,
  Play,
  Plus,
  Redo2,
  RotateCw,
  Save,
  Trash2,
  Undo2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  generatePages,
  History,
  moveAsset,
  removePageSafely,
  storyStats,
} from "../core/layout";
import {
  assetUrl,
  layouts,
  themes,
  uid,
  type Asset,
  type Bubble,
  type Mode,
  type Page,
  type Project,
  type Settings,
  type Style,
} from "../core/model";
import { renderPage } from "../core/render";
import {
  Button,
  CheckField,
  Field,
  Modal,
  ModeIcon,
  modeNames,
  Range,
  type Run,
} from "./ui";
export default function Editor({
  initial,
  settings,
  onBack,
  run,
  notify,
  ask,
}: {
  initial: Project;
  settings: Settings;
  onBack: () => Promise<void>;
  run: Run;
  notify: (s: string) => void;
  ask: (message: string, action: () => void) => void;
}) {
  const history = useRef(new History(initial));
  const [p, setP] = useState(initial);
  const [pageId, setPageId] = useState(
    initial.presentations[initial.mode].pages[0].id,
  );
  const [tab, setTab] = useState<"pages" | "pictures">("pages");
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [saved, setSaved] = useState("Saved locally");
  const [preview, setPreview] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [source, setSource] = useState(false);
  const [sourceText, setSourceText] = useState(initial.story);
  const [zoom, setZoom] = useState(90);
  const [playing, setPlaying] = useState(false);
  const [narrate, setNarrate] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [chapterMenu, setChapterMenu] = useState(false);
  const [saving, setSaving] = useState(false);
  const pRef = useRef(p);
  const stage = useRef<HTMLDivElement>(null);
  const { pages, style } = p.presentations[p.mode];
  const index = Math.max(
    0,
    pages.findIndex((pg) => pg.id === pageId),
  );
  const page = pages[index];
  const asset = p.assets.find((a) => a.id === selectedAsset);
  const stats = storyStats(p.story);
  const commit = (fn: (draft: Project) => void) => {
    const next = structuredClone(pRef.current);
    fn(next);
    next.updatedAt = new Date().toISOString();
    history.current.set(next);
    pRef.current = next;
    setP(next);
    setSaved("Unsaved changes");
  };
  const updatePage = (patch: Partial<Page>) =>
    commit((d) => {
      Object.assign(d.presentations[d.mode].pages[index], patch);
    });
  const updateStyle = (patch: Partial<Style>) =>
    commit((d) => {
      Object.assign(d.presentations[d.mode].style, patch);
    });
  const updateAsset = (patch: Partial<Asset>) =>
    commit((d) => {
      const a = d.assets.find((a) => a.id === selectedAsset);
      if (a) Object.assign(a, patch);
    });
  const save = async () => {
    setSaving(true);
    setSaved("Saving…");
    try {
      const current = pRef.current;
      await window.storyweaver.save(current);
      if (pRef.current === current) setSaved("Saved locally");
    } catch (e) {
      setSaved("Save failed — retry");
      throw e;
    } finally {
      setSaving(false);
    }
  };
  const undo = () => {
    const next = history.current.undo();
    pRef.current = next;
    setP(next);
    setSaved("Unsaved changes");
  };
  const redo = () => {
    const next = history.current.redo();
    pRef.current = next;
    setP(next);
    setSaved("Unsaved changes");
  };
  useEffect(() => {
    if (!settings.autosave) return;
    const timer = setTimeout(() => void run(save), 900);
    return () => clearTimeout(timer);
  }, [p, settings.autosave]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      const input = (e.target as HTMLElement).closest(
        "input,textarea,select,[contenteditable]",
      );
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void run(save);
      }
      if (!input && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if (!input && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        setPageId(
          pages[
            Math.max(
              0,
              Math.min(
                pages.length - 1,
                index + (e.key === "ArrowRight" ? 1 : -1),
              ),
            )
          ].id,
        );
      }
      if (e.key === "Escape") {
        setPreview(false);
        setPlaying(false);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [p, index]);
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => {
      if (index === pages.length - 1) setPlaying(false);
      else setPageId(pages[index + 1].id);
    }, style.duration * 1000);
    return () => clearTimeout(timer);
  }, [playing, index, style.duration]);
  useEffect(() => {
    if (!window.speechSynthesis) return;
    const load = () =>
      setVoices(
        window.speechSynthesis.getVoices().filter((v) => v.localService),
      );
    load();
    speechSynthesis.addEventListener("voiceschanged", load);
    return () => speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);
  useEffect(() => {
    if (!window.speechSynthesis) return;
    speechSynthesis.cancel();
    if (narrate && playing && page.text) {
      const utterance = new SpeechSynthesisUtterance(page.text);
      utterance.voice =
        voices.find((v) => v.lang.startsWith(p.language)) || voices[0];
      utterance.lang = p.language;
      speechSynthesis.speak(utterance);
    }
    return () => speechSynthesis.cancel();
  }, [narrate, playing, page.text]);
  useEffect(
    () =>
      window.storyweaver.onBeforeClose?.(
        () =>
          void run(async () => {
            await save();
            window.storyweaver.finishClose();
          }),
      ),
    [],
  );
  const reset = () =>
    ask(
      "Rebuild this mode from the complete original story and picture order? Custom page edits in this mode will be replaced. The other modes and original content are preserved.",
      () => {
        commit((d) => {
          d.presentations[d.mode].pages = generatePages(
            d.story,
            d.assets.map((a) => a.id),
            d.mode,
            settings.placement,
          );
        });
        setPageId("");
      },
    );
  const importImages = (folder = false) =>
    void run(async () => {
      const r = await window.storyweaver.images(p.id, folder);
      if (r.assets.length)
        commit((d) => {
          d.assets.push(...r.assets);
          if (!d.coverId) d.coverId = r.assets[0].id;
          for (const mode of ["storybook", "cinematic", "comic"] as Mode[]) {
            const target =
              d.presentations[mode].pages[mode === d.mode ? index : 0];
            target.assetIds.push(...r.assets.map((a) => a.id));
            if (target.layout === "text") target.layout = "grid";
          }
        });
      if (r.errors.length) throw new Error(r.errors.join("\n"));
      notify(
        `${r.assets.length} pictures imported. Originals are stored in the project.`,
      );
    });
  const dropFiles = (files: File[]) =>
    void run(async () => {
      const assets: Asset[] = [];
      const errors: string[] = [];
      for (const file of files) {
        try {
          assets.push(
            await window.storyweaver.imageBytes(
              p.id,
              file.name,
              new Uint8Array(await file.arrayBuffer()),
            ),
          );
        } catch (e) {
          errors.push(`${file.name}: ${String(e)}`);
        }
      }
      if (assets.length)
        commit((d) => {
          d.assets.push(...assets);
          if (!d.coverId) d.coverId = assets[0].id;
          for (const mode of ["storybook", "cinematic", "comic"] as Mode[])
            d.presentations[mode].pages[
              mode === d.mode ? index : 0
            ].assetIds.push(...assets.map((a) => a.id));
        });
      if (errors.length) throw new Error(errors.join("\n"));
    });
  const addBubble = (type: Bubble["type"]) =>
    updatePage({
      bubbles: [
        ...page.bubbles,
        {
          id: uid(),
          type,
          text: type === "caption" ? "Your caption" : "Your words here",
          x: 10,
          y: 10,
          color: "#fff8df",
          size: 18,
        },
      ],
    });
  const movePage = (offset: number) => {
    if (index + offset < 0 || index + offset >= pages.length) return;
    commit((d) => {
      const items = d.presentations[d.mode].pages;
      [items[index], items[index + offset]] = [
        items[index + offset],
        items[index],
      ];
    });
  };
  const previewHtml = renderPage(
    p,
    page,
    (a) => assetUrl(p.id, a.id),
    style,
    index,
  );
  return (
    <div className={`editor ${preview ? "reader" : ""}`}>
      <header className="editor-toolbar">
        <button
          className="icon-button"
          aria-label="Back to dashboard"
          onClick={() =>
            void run(async () => {
              await save();
              await onBack();
            })
          }
        >
          <ChevronLeft size={22} />
        </button>
        <div className="editor-title">
          <input
            aria-label="Project title"
            value={p.title}
            onChange={(e) => {
              if (e.target.value)
                commit((d) => {
                  d.title = e.target.value;
                });
            }}
          />
          <span>
            <i
              className={saved === "Saved locally" ? "saved-dot" : "dirty-dot"}
            />
            {saved}
          </span>
        </div>
        <div className="editor-mode-switch">
          {(["storybook", "cinematic", "comic"] as Mode[]).map((m) => (
            <button
              key={m}
              title={modeNames[m]}
              aria-label={modeNames[m]}
              className={p.mode === m ? "active" : ""}
              onClick={() => {
                commit((d) => {
                  d.mode = m;
                });
                setPageId("");
                setPlaying(false);
              }}
            >
              <ModeIcon mode={m} size={17} />
              <span>
                {m === "storybook"
                  ? "Storybook"
                  : m === "cinematic"
                    ? "Cinematic"
                    : "Comic"}
              </span>
            </button>
          ))}
        </div>
        <div className="toolbar-actions">
          <button
            className="icon-button"
            disabled={!history.current.canUndo}
            onClick={undo}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
          >
            <Undo2 size={18} />
          </button>
          <button
            className="icon-button"
            disabled={!history.current.canRedo}
            onClick={redo}
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
          >
            <Redo2 size={18} />
          </button>
          <span className="divider" />
          <Button onClick={() => void run(save)} disabled={saving}>
            <Save size={16} />
            Save
          </Button>
          <Button
            onClick={() => {
              setPreview(!preview);
              setPlaying(false);
            }}
          >
            <Eye size={16} />
            {preview ? "Edit" : "Preview"}
          </Button>
          <Button variant="primary" onClick={() => setExporting(true)}>
            <Download size={16} />
            Export
          </Button>
        </div>
      </header>
      <div className="editor-body">
        {!preview && leftOpen && (
          <aside className="editor-left resizable">
            <div className="editor-tabs">
              <button
                className={tab === "pages" ? "active" : ""}
                onClick={() => setTab("pages")}
              >
                <BookOpen size={15} />
                Pages <b>{pages.length}</b>
              </button>
              <button
                className={tab === "pictures" ? "active" : ""}
                onClick={() => setTab("pictures")}
              >
                <ImageIcon size={15} />
                Pictures <b>{p.assets.length}</b>
              </button>
            </div>
            {tab === "pages" ? (
              <>
                <div className="sidebar-section-actions">
                  <Button
                    onClick={() => {
                      commit((d) => {
                        const pg: Page = {
                          id: uid(),
                          text: "",
                          heading: "",
                          assetIds: [],
                          layout: "above",
                          bubbles: [],
                        };
                        d.presentations[d.mode].pages.splice(index + 1, 0, pg);
                        setPageId(pg.id);
                      });
                    }}
                  >
                    <Plus size={14} />
                    Add page
                  </Button>
                  <button
                    title="Rebuild this mode"
                    className="icon-button"
                    onClick={reset}
                  >
                    <RotateCw size={16} />
                  </button>
                </div>
                <div className="page-list">
                  {pages.map((pg, i) => (
                    <button
                      className={`page-thumbnail ${i === index ? "active" : ""}`}
                      key={pg.id}
                      draggable
                      onDragStart={(e) =>
                        e.dataTransfer.setData("application/story-page", pg.id)
                      }
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const a = e.dataTransfer.getData(
                          "application/story-asset",
                        );
                        const source = e.dataTransfer.getData(
                          "application/story-page",
                        );
                        if (a)
                          commit((d) => {
                            d.presentations[d.mode].pages = moveAsset(
                              d.presentations[d.mode].pages,
                              a,
                              pg.id,
                            );
                          });
                        else if (source && source !== pg.id)
                          commit((d) => {
                            const list = d.presentations[d.mode].pages;
                            const from = list.findIndex((p) => p.id === source);
                            const to = list.findIndex((p) => p.id === pg.id);
                            if (from >= 0)
                              list.splice(to, 0, ...list.splice(from, 1));
                          });
                      }}
                      onClick={() => setPageId(pg.id)}
                    >
                      <span className="mini-page">
                        {pg.assetIds[0] ? (
                          <img
                            loading="lazy"
                            src={assetUrl(p.id, pg.assetIds[0])}
                            alt=""
                          />
                        ) : (
                          <FileText size={24} />
                        )}
                        <span className="mini-lines" />
                      </span>
                      <div>
                        <span>Page {i + 1}</span>
                        <small>
                          {pg.heading ||
                            pg.text.slice(0, 50) ||
                            "A blank canvas"}
                        </small>
                        <em>{pg.assetIds.length} pictures</em>
                      </div>
                      <GripVertical size={14} />
                    </button>
                  ))}
                </div>
                <div className="sidebar-bottom-actions">
                  <Button
                    onClick={() => {
                      setSourceText(p.story);
                      setSource(true);
                    }}
                  >
                    <FileText size={15} />
                    Original story
                  </Button>
                  <span>
                    {stats.words.toLocaleString()} words · {stats.minutes} min
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="sidebar-section-actions">
                  <Button onClick={() => importImages()}>
                    <Plus size={14} />
                    Pictures
                  </Button>
                  <Button
                    onClick={() => importImages(true)}
                    title="Import folder"
                  >
                    <FolderOpen size={15} />
                  </Button>
                </div>
                <div
                  className="asset-library"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files.length)
                      dropFiles(Array.from(e.dataTransfer.files));
                  }}
                >
                  {!p.assets.length ? (
                    <div className="asset-empty">
                      <ImageIcon size={32} />
                      <h3>A picture is worth a page.</h3>
                      <p>Drop pictures here or import them from your device.</p>
                    </div>
                  ) : (
                    p.assets.map((a, i) => (
                      <button
                        className={`asset-tile ${a.id === selectedAsset ? "active" : ""}`}
                        key={a.id}
                        draggable
                        onDragStart={(e) =>
                          e.dataTransfer.setData(
                            "application/story-asset",
                            a.id,
                          )
                        }
                        onClick={() => {
                          setSelectedAsset(a.id);
                          setRightOpen(true);
                        }}
                      >
                        <img
                          loading="lazy"
                          src={assetUrl(p.id, a.id)}
                          alt={a.name}
                        />
                        <span>
                          {i + 1}. {a.name}
                        </span>
                        <small>
                          {pages.some((pg) => pg.assetIds.includes(a.id))
                            ? "Placed in this mode"
                            : "Not placed — drag onto a page"}
                        </small>
                      </button>
                    ))
                  )}
                </div>
                <p className="hint padded">
                  Drag a picture onto any page. Removing it from a page keeps
                  the original in this library.
                </p>
              </>
            )}
          </aside>
        )}
        <section className="editor-workspace" ref={stage}>
          <div className="workspace-toolbar">
            <div>
              {!preview && (
                <>
                  <button
                    className="icon-button"
                    onClick={() => setLeftOpen(!leftOpen)}
                    title="Toggle page panel"
                  >
                    <PanelLeftClose size={17} />
                  </button>
                  <button
                    className="icon-button"
                    onClick={() => setRightOpen(!rightOpen)}
                    title="Toggle customization panel"
                  >
                    <PanelRightClose size={17} />
                  </button>
                </>
              )}
              <span>{modeNames[p.mode]}</span>
            </div>
            <div>
              <button
                className="icon-button"
                onClick={() => setChapterMenu(!chapterMenu)}
                title="Table of contents"
              >
                <BookMarked size={17} />
              </button>
              <button
                className="icon-button"
                onClick={() => setZoom(Math.max(35, zoom - 10))}
                aria-label="Zoom out"
              >
                <ZoomOut size={16} />
              </button>
              <span>{zoom}%</span>
              <button
                className="icon-button"
                onClick={() => setZoom(Math.min(160, zoom + 10))}
                aria-label="Zoom in"
              >
                <ZoomIn size={16} />
              </button>
              <button
                className="icon-button"
                onClick={() =>
                  void run(async () => {
                    if (document.fullscreenElement)
                      await document.exitFullscreen();
                    else await stage.current?.requestFullscreen();
                  })
                }
                title="Fullscreen"
              >
                <Maximize2 size={16} />
              </button>
            </div>
          </div>
          {chapterMenu && (
            <div className="chapter-menu">
              <h3>In this story</h3>
              {pages.some((pg) => pg.heading) ? (
                pages.map(
                  (pg, i) =>
                    pg.heading && (
                      <button
                        key={pg.id}
                        onClick={() => {
                          setPageId(pg.id);
                          setChapterMenu(false);
                        }}
                      >
                        {pg.heading}
                        <span>{i + 1}</span>
                      </button>
                    ),
                )
              ) : (
                <p>
                  Chapter headings appear here when you add them to your story
                  or page.
                </p>
              )}
            </div>
          )}
          <div
            className="page-stage"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("application/story-asset");
              if (id)
                commit((d) => {
                  d.presentations[d.mode].pages = moveAsset(
                    d.presentations[d.mode].pages,
                    id,
                    page.id,
                  );
                });
              else if (e.dataTransfer.files.length)
                dropFiles(Array.from(e.dataTransfer.files));
            }}
          >
            <div
              className={`paper-preview transition-${style.transition} ${settings.reducedMotion ? "reduce-motion" : ""}`}
              key={page.id}
              style={{
                width: (style.landscape ? 880 : 660) * (zoom / 100),
                animationDuration: `${style.transitionSpeed}s`,
              }}
            >
              <div
                className="paper-scale"
                style={{ width: style.landscape ? 880 : 660, zoom: zoom / 100 }}
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          </div>
          <div className="reader-controls">
            <Button
              disabled={index === 0}
              onClick={() => setPageId(pages[index - 1].id)}
              aria-label="Previous page"
            >
              <ChevronLeft size={18} />
            </Button>
            <span>
              Page <strong>{index + 1}</strong> of {pages.length}
            </span>
            <Button
              disabled={index === pages.length - 1}
              onClick={() => setPageId(pages[index + 1].id)}
              aria-label="Next page"
            >
              <ChevronRight size={18} />
            </Button>
            {(p.mode === "cinematic" || preview) && (
              <>
                <span className="divider" />
                <Button
                  onClick={() => setPlaying(!playing)}
                  aria-label={playing ? "Pause playback" : "Play presentation"}
                >
                  {playing ? <Pause size={17} /> : <Play size={17} />}
                </Button>
                <Button
                  onClick={() => {
                    setPageId(pages[0].id);
                    setPlaying(false);
                  }}
                  title="Restart"
                >
                  <RotateCw size={16} />
                </Button>
                {voices.length > 0 && (
                  <label className="narration">
                    <input
                      type="checkbox"
                      checked={narrate}
                      onChange={(e) => setNarrate(e.target.checked)}
                    />
                    Offline narration
                  </label>
                )}
              </>
            )}
          </div>
          <div className="workspace-hint">
            {preview
              ? "Use arrow keys to turn pages · Esc to return to editing"
              : "Your original story is always kept safe. Every page is yours to shape."}
          </div>
        </section>
        {!preview && rightOpen && (
          <aside className="editor-right resizable">
            <h2>
              Make it yours<span>LIVE PREVIEW</span>
            </h2>
            <div className="inspector-scroll">
              <section className="inspector-section">
                <h3>Page {index + 1}</h3>
                <Field label="Layout">
                  <select
                    value={page.layout}
                    onChange={(e) =>
                      updatePage({ layout: e.target.value as Page["layout"] })
                    }
                  >
                    {layouts.map((l) => (
                      <option value={l} key={l}>
                        {
                          {
                            above: "Picture above text",
                            below: "Picture below text",
                            beside: "Picture beside text",
                            text: "Text first",
                            full: "Full-page picture",
                            two: "Two-picture layout",
                            three: "Three-picture collage",
                            grid: "Four-panel grid",
                            overlay: "Photo background",
                            vertical: "Vertical photo story",
                          }[l]
                        }
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Chapter heading / contents label">
                  <input
                    value={page.heading}
                    onChange={(e) => updatePage({ heading: e.target.value })}
                  />
                </Field>
                <Field label="Page text">
                  <textarea
                    className="page-text-editor"
                    dir={p.language === "ar" ? "rtl" : "ltr"}
                    value={page.text}
                    onChange={(e) => updatePage({ text: e.target.value })}
                  />
                </Field>
                <div className="inline-actions">
                  <Button
                    title="Move page earlier"
                    disabled={index === 0}
                    onClick={() => movePage(-1)}
                  >
                    <MoveUp size={14} />
                  </Button>
                  <Button
                    title="Move page later"
                    disabled={index === pages.length - 1}
                    onClick={() => movePage(1)}
                  >
                    <MoveDown size={14} />
                  </Button>
                  <Button
                    disabled={pages.length === 1}
                    onClick={() =>
                      ask(
                        "Remove this page? Its text, pictures, and bubbles will be moved to the neighboring page so nothing is lost.",
                        () =>
                          commit((d) => {
                            d.presentations[d.mode].pages = removePageSafely(
                              d.presentations[d.mode].pages,
                              page.id,
                            );
                            setPageId("");
                          }),
                      )
                    }
                  >
                    <Trash2 size={14} />
                    Page
                  </Button>
                </div>
              </section>
              <section className="inspector-section">
                <h3>
                  Pictures on this page <b>{page.assetIds.length}</b>
                </h3>
                {page.assetIds.map((id, i) => {
                  const a = p.assets.find((a) => a.id === id);
                  return (
                    a && (
                      <div className="placed-image" key={`${id}-${i}`}>
                        <button onClick={() => setSelectedAsset(id)}>
                          <img src={assetUrl(p.id, id)} alt="" />
                          <span>{a.name}</span>
                        </button>
                        <button
                          className="icon-button"
                          disabled={i === 0}
                          title="Move picture earlier"
                          onClick={() => {
                            const ids = [...page.assetIds];
                            [ids[i], ids[i - 1]] = [ids[i - 1], ids[i]];
                            updatePage({ assetIds: ids });
                          }}
                        >
                          <MoveUp size={13} />
                        </button>
                        <button
                          className="icon-button"
                          title="Remove from page, keep in library"
                          onClick={() =>
                            updatePage({
                              assetIds: page.assetIds.filter((_, n) => n !== i),
                            })
                          }
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )
                  );
                })}
                <Button onClick={() => setTab("pictures")}>
                  <Plus size={14} />
                  Add from library
                </Button>
                {asset && (
                  <div className="asset-controls">
                    <div className="section-heading">
                      <strong>{asset.name}</strong>
                      <button
                        className="icon-button"
                        onClick={() => setSelectedAsset(null)}
                        aria-label="Close picture controls"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <Field label="Picture caption">
                      <input
                        value={asset.caption}
                        onChange={(e) =>
                          updateAsset({ caption: e.target.value })
                        }
                      />
                    </Field>
                    <div className="inline-actions">
                      <Button
                        onClick={() =>
                          updateAsset({ rotation: (asset.rotation + 90) % 360 })
                        }
                      >
                        <RotateCw size={14} />
                        Rotate
                      </Button>
                      <Button
                        onClick={() =>
                          commit((d) => {
                            d.coverId = asset.id;
                          })
                        }
                      >
                        {p.coverId === asset.id ? (
                          <Check size={14} />
                        ) : (
                          <ImageIcon size={14} />
                        )}
                        Cover
                      </Button>
                    </div>
                    <Field label="Crop / fit (original preserved)">
                      <select
                        value={asset.crop}
                        onChange={(e) =>
                          updateAsset({ crop: e.target.value as Asset["crop"] })
                        }
                      >
                        <option value="cover">Crop to frame</option>
                        <option value="contain">Show entire picture</option>
                      </select>
                    </Field>
                    <Range
                      label="Crop focus · horizontal"
                      value={asset.focusX}
                      min={0}
                      max={100}
                      onChange={(n) => updateAsset({ focusX: n })}
                    />
                    <Range
                      label="Crop focus · vertical"
                      value={asset.focusY}
                      min={0}
                      max={100}
                      onChange={(n) => updateAsset({ focusY: n })}
                    />
                    <Field label="Place / move to page">
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value)
                            commit((d) => {
                              d.presentations[d.mode].pages = moveAsset(
                                d.presentations[d.mode].pages,
                                asset.id,
                                e.target.value,
                              );
                            });
                        }}
                      >
                        <option value="">Choose a page…</option>
                        {pages.map((pg, i) => (
                          <option key={pg.id} value={pg.id}>
                            Page {i + 1}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <div className="inline-actions">
                      <Button
                        disabled={p.assets[0]?.id === asset.id}
                        onClick={() =>
                          commit((d) => {
                            const i = d.assets.findIndex(
                              (a) => a.id === asset.id,
                            );
                            [d.assets[i], d.assets[i - 1]] = [
                              d.assets[i - 1],
                              d.assets[i],
                            ];
                          })
                        }
                      >
                        <MoveUp size={13} />
                        Import order
                      </Button>
                      <Button
                        disabled={
                          p.assets[p.assets.length - 1]?.id === asset.id
                        }
                        onClick={() =>
                          commit((d) => {
                            const i = d.assets.findIndex(
                              (a) => a.id === asset.id,
                            );
                            [d.assets[i], d.assets[i + 1]] = [
                              d.assets[i + 1],
                              d.assets[i],
                            ];
                          })
                        }
                      >
                        <MoveDown size={13} />
                      </Button>
                    </div>
                    <Button
                      variant="danger"
                      onClick={() =>
                        ask(
                          "Remove this picture from the project and all three layouts? You can undo this change while the editor is open. Your original source file is never changed.",
                          () => {
                            commit((d) => {
                              d.assets = d.assets.filter(
                                (a) => a.id !== asset.id,
                              );
                              if (d.coverId === asset.id) d.coverId = null;
                              for (const m of Object.values(d.presentations))
                                m.pages.forEach(
                                  (pg) =>
                                    (pg.assetIds = pg.assetIds.filter(
                                      (id) => id !== asset.id,
                                    )),
                                );
                            });
                            setSelectedAsset(null);
                          },
                        )
                      }
                    >
                      <Trash2 size={14} />
                      Remove project picture
                    </Button>
                  </div>
                )}
              </section>
              <section className="inspector-section">
                <h3>Theme & typography</h3>
                <div className="theme-swatches">
                  {Object.entries(themes).map(([key, t]) => (
                    <button
                      key={key}
                      title={t.name}
                      aria-label={t.name}
                      className={style.theme === key ? "active" : ""}
                      style={{ background: t.paper, color: t.ink }}
                      onClick={() =>
                        updateStyle({
                          theme: key as Style["theme"],
                          background: t.paper,
                          color: t.ink,
                          font: t.font as Style["font"],
                        })
                      }
                    >
                      Aa{style.theme === key && <Check size={10} />}
                    </button>
                  ))}
                </div>
                <small className="muted">{themes[style.theme].name}</small>
                <Field label="Font family">
                  <select
                    value={style.font}
                    onChange={(e) =>
                      updateStyle({ font: e.target.value as Style["font"] })
                    }
                  >
                    {[
                      "Georgia",
                      "Arial",
                      "Trebuchet MS",
                      "Times New Roman",
                    ].map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                </Field>
                <Range
                  label="Font size"
                  min={12}
                  max={36}
                  value={style.fontSize}
                  onChange={(n) => updateStyle({ fontSize: n })}
                />
                <Range
                  label="Line spacing"
                  min={1.1}
                  max={2.5}
                  step={0.1}
                  value={style.lineHeight}
                  onChange={(n) => updateStyle({ lineHeight: n })}
                />
                <Field label="Text alignment">
                  <select
                    value={style.align}
                    onChange={(e) =>
                      updateStyle({ align: e.target.value as Style["align"] })
                    }
                  >
                    <option value="start">Start</option>
                    <option value="center">Center</option>
                    <option value="justify">Justify</option>
                  </select>
                </Field>
                <div className="two-cols">
                  <Field label="Page color">
                    <input
                      type="color"
                      value={style.background}
                      onChange={(e) =>
                        updateStyle({ background: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Text color">
                    <input
                      type="color"
                      value={style.color}
                      onChange={(e) => updateStyle({ color: e.target.value })}
                    />
                  </Field>
                </div>
              </section>
              <section className="inspector-section">
                <h3>Page & picture settings</h3>
                <Range
                  label="Margins"
                  value={style.margin}
                  min={12}
                  max={80}
                  onChange={(n) => updateStyle({ margin: n })}
                />
                <Range
                  label="Picture height"
                  value={style.imageHeight}
                  min={120}
                  max={700}
                  onChange={(n) => updateStyle({ imageHeight: n })}
                />
                <Range
                  label="Picture corners"
                  value={style.radius}
                  min={0}
                  max={40}
                  onChange={(n) => updateStyle({ radius: n })}
                />
                <Range
                  label="Picture / panel border"
                  value={style.border}
                  min={0}
                  max={12}
                  onChange={(n) => updateStyle({ border: n })}
                />
                <Range
                  label="Picture / panel spacing"
                  value={style.gap}
                  min={0}
                  max={48}
                  onChange={(n) => updateStyle({ gap: n })}
                />
                <Field label="Page size">
                  <select
                    value={style.pageSize}
                    onChange={(e) =>
                      updateStyle({
                        pageSize: e.target.value as Style["pageSize"],
                      })
                    }
                  >
                    {["A4", "A5", "Letter", "Custom"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </Field>
                {style.pageSize === "Custom" && (
                  <div className="two-cols">
                    <Field label="Width (mm)">
                      <input
                        type="number"
                        min={80}
                        max={600}
                        value={style.customWidth}
                        onChange={(e) =>
                          updateStyle({ customWidth: +e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Height (mm)">
                      <input
                        type="number"
                        min={80}
                        max={600}
                        value={style.customHeight}
                        onChange={(e) =>
                          updateStyle({ customHeight: +e.target.value })
                        }
                      />
                    </Field>
                  </div>
                )}
                <CheckField
                  label="Landscape pages"
                  value={style.landscape}
                  onChange={(v) => updateStyle({ landscape: v })}
                />
                <CheckField
                  label="Page numbering"
                  value={style.numbers}
                  onChange={(v) => updateStyle({ numbers: v })}
                />
                <CheckField
                  label="Picture captions"
                  value={style.captions}
                  onChange={(v) => updateStyle({ captions: v })}
                />
                <CheckField
                  label="Include cover in export"
                  value={style.cover}
                  onChange={(v) => updateStyle({ cover: v })}
                />
                <Field label="Subtitle">
                  <input
                    value={p.subtitle}
                    onChange={(e) =>
                      commit((d) => {
                        d.subtitle = e.target.value;
                      })
                    }
                  />
                </Field>
                <Field label="Author">
                  <input
                    value={p.author}
                    onChange={(e) =>
                      commit((d) => {
                        d.author = e.target.value;
                      })
                    }
                  />
                </Field>
                <Field label="Story direction">
                  <select
                    value={p.language}
                    onChange={(e) =>
                      commit((d) => {
                        d.language = e.target.value as "en" | "ar";
                      })
                    }
                  >
                    <option value="en">English · left to right</option>
                    <option value="ar">العربية · right to left</option>
                  </select>
                </Field>
              </section>
              {p.mode === "cinematic" && (
                <section className="inspector-section">
                  <h3>Playback</h3>
                  <Range
                    label="Seconds per slide"
                    value={style.duration}
                    min={1}
                    max={120}
                    onChange={(n) => updateStyle({ duration: n })}
                  />
                  <Field label="Transition">
                    <select
                      value={style.transition}
                      onChange={(e) =>
                        updateStyle({
                          transition: e.target.value as Style["transition"],
                        })
                      }
                    >
                      {["fade", "slide", "zoom", "dissolve"].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </Field>
                  <Range
                    label="Transition duration"
                    value={style.transitionSpeed}
                    min={0}
                    max={3}
                    step={0.1}
                    onChange={(n) => updateStyle({ transitionSpeed: n })}
                  />
                  <p className="hint">
                    {voices.length
                      ? "Offline system voices are available in Preview."
                      : "Offline narration is unavailable: no local system voice was found."}
                  </p>
                </section>
              )}
              {p.mode === "comic" && (
                <section className="inspector-section">
                  <h3>Comic lettering</h3>
                  <div className="inline-actions">
                    <Button onClick={() => addBubble("speech")}>Speech</Button>
                    <Button onClick={() => addBubble("thought")}>
                      Thought
                    </Button>
                    <Button onClick={() => addBubble("caption")}>
                      Caption
                    </Button>
                  </div>
                  {page.bubbles.map((b, i) => (
                    <div className="bubble-controls" key={b.id}>
                      <Field label={`${b.type} ${i + 1}`}>
                        <textarea
                          value={b.text}
                          onChange={(e) =>
                            updatePage({
                              bubbles: page.bubbles.map((bb) =>
                                bb.id === b.id
                                  ? { ...bb, text: e.target.value }
                                  : bb,
                              ),
                            })
                          }
                        />
                      </Field>
                      <Range
                        label="Horizontal position"
                        value={b.x}
                        min={0}
                        max={85}
                        onChange={(n) =>
                          updatePage({
                            bubbles: page.bubbles.map((bb) =>
                              bb.id === b.id ? { ...bb, x: n } : bb,
                            ),
                          })
                        }
                      />
                      <Range
                        label="Vertical position"
                        value={b.y}
                        min={0}
                        max={85}
                        onChange={(n) =>
                          updatePage({
                            bubbles: page.bubbles.map((bb) =>
                              bb.id === b.id ? { ...bb, y: n } : bb,
                            ),
                          })
                        }
                      />
                      <Range
                        label="Lettering size"
                        value={b.size}
                        min={10}
                        max={48}
                        onChange={(n) =>
                          updatePage({
                            bubbles: page.bubbles.map((bb) =>
                              bb.id === b.id ? { ...bb, size: n } : bb,
                            ),
                          })
                        }
                      />
                      <div className="inline-actions">
                        <input
                          aria-label="Bubble color"
                          type="color"
                          value={b.color}
                          onChange={(e) =>
                            updatePage({
                              bubbles: page.bubbles.map((bb) =>
                                bb.id === b.id
                                  ? { ...bb, color: e.target.value }
                                  : bb,
                              ),
                            })
                          }
                        />
                        <Button
                          onClick={() =>
                            updatePage({
                              bubbles: page.bubbles.filter(
                                (bb) => bb.id !== b.id,
                              ),
                            })
                          }
                        >
                          <Trash2 size={14} />
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </section>
              )}
            </div>
          </aside>
        )}
      </div>
      {source && (
        <Modal
          title="Your original story"
          wide
          onClose={() => setSource(false)}
        >
          <p className="muted">
            This is your complete source text. Updating it rebuilds all three
            layouts; save a backup first to keep existing page customizations.
          </p>
          <div className="inline-actions">
            <Button
              onClick={() =>
                void run(async () => {
                  const text = await window.storyweaver.text();
                  if (text !== null) setSourceText(text);
                })
              }
            >
              <Upload size={15} />
              Import TXT / Markdown
            </Button>
          </div>
          <textarea
            className="story-input"
            dir={p.language === "ar" ? "rtl" : "ltr"}
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
          />
          <div className="text-stats">
            {storyStats(sourceText).words.toLocaleString()} words ·{" "}
            {sourceText.length.toLocaleString()} characters
          </div>
          <div className="modal-actions">
            <Button onClick={() => setSource(false)}>
              Keep current layouts
            </Button>
            <Button
              variant="primary"
              onClick={() =>
                ask(
                  "Replace source text and rebuild every presentation layout? Existing page customizations will be replaced. This action can be undone.",
                  () => {
                    commit((d) => {
                      d.story = sourceText;
                      for (const mode of [
                        "storybook",
                        "cinematic",
                        "comic",
                      ] as Mode[])
                        d.presentations[mode].pages = generatePages(
                          sourceText,
                          d.assets.map((a) => a.id),
                          mode,
                          settings.placement,
                        );
                    });
                    setPageId("");
                    setSource(false);
                  },
                )
              }
            >
              Update & rebuild
            </Button>
          </div>
        </Modal>
      )}
      {exporting && (
        <Modal
          title="A story worth sharing"
          onClose={() => setExporting(false)}
        >
          <p className="muted">
            Export the current {modeNames[p.mode].toLowerCase()} layout. All
            files are created on your device.
          </p>
          <div className="export-options">
            {p.mode !== "cinematic" && (
              <button
                onClick={() =>
                  void run(async () => {
                    await save();
                    const path = await window.storyweaver.export(
                      pRef.current,
                      "pdf",
                    );
                    if (path) {
                      notify(`PDF created: ${path}`);
                      setExporting(false);
                    }
                  })
                }
              >
                <FileText size={25} />
                <div>
                  <strong>PDF document</strong>
                  <p>Print-ready pages, cover, and pictures.</p>
                </div>
                <ArrowRight size={17} />
              </button>
            )}
            {p.mode !== "comic" && (
              <button
                onClick={() =>
                  void run(async () => {
                    await save();
                    const path = await window.storyweaver.export(
                      pRef.current,
                      "html",
                    );
                    if (path) {
                      notify(`Offline HTML created: ${path}`);
                      setExporting(false);
                    }
                  })
                }
              >
                <BookOpen size={25} />
                <div>
                  <strong>Offline HTML experience</strong>
                  <p>Interactive story with local picture assets.</p>
                </div>
                <ArrowRight size={17} />
              </button>
            )}
            <button
              onClick={() =>
                void run(async () => {
                  await save();
                  const path = await window.storyweaver.backup(p.id);
                  if (path) {
                    notify(`Project backup created: ${path}`);
                    setExporting(false);
                  }
                })
              }
            >
              <Archive size={25} />
              <div>
                <strong>Portable project backup</strong>
                <p>All originals, settings, and three layouts.</p>
              </div>
              <ArrowRight size={17} />
            </button>
          </div>
          <p className="hint">
            PDF text flows across sheets when needed to keep every word visible.
            A layout page may span multiple printed sheets.
          </p>
        </Modal>
      )}
    </div>
  );
}
