import {
  ArrowRight,
  BookMarked,
  BookOpen,
  Check,
  ChevronRight,
  Clock,
  Copy,
  FolderInput,
  LayoutDashboard,
  Library,
  Moon,
  Plus,
  Search,
  Settings as SettingsIcon,
  Sparkles,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Editor from "./components/Editor";
import NewProject from "./components/NewProject";
import SettingsPanel from "./components/SettingsPanel";
import { Button, Field, Modal, ModeIcon, modeNames } from "./components/ui";
import {
  assetUrl,
  defaultSettings,
  type Mode,
  type Project,
  type ProjectSummary,
  type Settings,
} from "./core/model";
import { presentationCss } from "./core/render";
export default function App() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [view, setView] = useState<"dashboard" | "projects" | "settings">(
    "dashboard",
  );
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [wizard, setWizard] = useState(false);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [confirm, setConfirm] = useState<{
    message: string;
    action: () => void;
  } | null>(null);
  const [rename, setRename] = useState<ProjectSummary | null>(null);
  const [renamed, setRenamed] = useState("");
  const api = window.storyweaver;
  const refresh = async () => setProjects(await api.list());
  const run = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  };
  useEffect(() => {
    if (!api) return;
    void run(async () => {
      setSettings(await api.settings());
      await refresh();
    });
    return api.onProgress(setBusy);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = settings.dark ? "dark" : "light";
    document.documentElement.dataset.motion = settings.reducedMotion
      ? "reduced"
      : "full";
    document.documentElement.lang = settings.language;
  }, [settings]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!api || project) return;
    return api.onBeforeClose(() => api.finishClose());
  }, [project]);
  const open = (id: string) =>
    run(async () => {
      const result = await api.open(id);
      setProject(result.project);
      if (result.warnings.length) setError(result.warnings.join("\n"));
    });
  const restore = () =>
    run(async () => {
      setBusy("Restoring project…");
      const p = await api.restore();
      if (p) {
        setProject(p);
        await refresh();
        setNotice("Project restored as a separate copy.");
      }
    });
  const settingsRevision = useRef(0);
  const updateSettings = (s: Settings) => {
    const previous = settings;
    const revision = ++settingsRevision.current;
    setSettings(s);
    return run(async () => {
      try {
        const saved = await api.setSettings(s);
        if (revision === settingsRevision.current) setSettings(saved);
        setNotice("Settings saved");
        await refresh();
      } catch (e) {
        if (revision === settingsRevision.current) setSettings(previous);
        throw e;
      }
    });
  };
  if (!api)
    return (
      <div className="desktop-required">
        <BookOpen size={48} />
        <h1>StoryWeaver is a desktop app</h1>
        <p>
          Open StoryWeaver with <code>npm run dev</code> to use private, local
          project storage and native exports.
        </p>
      </div>
    );
  const filtered = projects
    .filter((p) => p.title.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) =>
      sort === "name"
        ? a.title.localeCompare(b.title)
        : b.updatedAt.localeCompare(a.updatedAt),
    );
  return (
    <>
      <style>{presentationCss}</style>
      {project ? (
        <Editor
          initial={project}
          settings={settings}
          onBack={async () => {
            setProject(null);
            await refresh();
          }}
          run={run}
          notify={setNotice}
          ask={(message, action) => setConfirm({ message, action })}
        />
      ) : (
        <div className="app-shell">
          <aside className="app-sidebar">
            <a className="brand" onClick={() => setView("dashboard")}>
              <span className="brand-mark">
                <BookOpen size={24} />
              </span>
              <span>
                StoryWeaver<small>EVERY STORY, BEAUTIFULLY TOLD</small>
              </span>
            </a>
            <div className="workspace-label">YOUR WORKSPACE</div>
            <nav>
              {(
                [
                  ["dashboard", "Dashboard", LayoutDashboard],
                  ["projects", "My projects", Library],
                ] as const
              ).map(([key, label, Icon]) => (
                <button
                  key={key}
                  className={view === key ? "active" : ""}
                  onClick={() => setView(key)}
                >
                  <Icon size={19} />
                  {label}
                  {key === "projects" && (
                    <span className="nav-count">{projects.length}</span>
                  )}
                </button>
              ))}
              <button onClick={() => setWizard(true)}>
                <Plus size={19} />
                Create new
              </button>
            </nav>
            <div className="sidebar-spacer" />
            <div className="privacy-card">
              <span className="privacy-dot" />
              Your stories stay yours
              <p>
                Stored on your device.
                <br />
                Created entirely offline.
              </p>
            </div>
            <nav>
              <button
                className={view === "settings" ? "active" : ""}
                onClick={() => setView("settings")}
              >
                <SettingsIcon size={18} />
                Settings
              </button>
            </nav>
            <div className="sidebar-bottom">
              <span className="avatar">S</span>
              <div>
                Personal workspace<small>Local & private</small>
              </div>
              <button
                className="icon-button"
                onClick={() =>
                  void updateSettings({ ...settings, dark: !settings.dark })
                }
                aria-label="Toggle dark mode"
              >
                {settings.dark ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>
          </aside>
          <main className="dashboard">
            <header className="dashboard-header">
              <div className="breadcrumb">
                Your workspace <ChevronRight size={14} />{" "}
                <strong>
                  {view === "dashboard"
                    ? "Dashboard"
                    : view === "projects"
                      ? "My projects"
                      : "Settings"}
                </strong>
              </div>
              <span className="local-badge">
                <span />
                Offline workspace
              </span>
            </header>
            {view === "settings" ? (
              <SettingsPanel
                value={settings}
                onChange={(s) => void updateSettings(s)}
                run={run}
                notify={setNotice}
              />
            ) : (
              <div className="dashboard-content">
                <section className="welcome">
                  <div>
                    <div className="eyebrow">
                      A LITTLE INSPIRATION, A NEW BEGINNING
                    </div>
                    <h1>
                      {view === "dashboard"
                        ? "Make room for your stories."
                        : "Your shelf of stories."}
                    </h1>
                    <p>
                      Turn the words and pictures you love into something worth
                      keeping.
                    </p>
                  </div>
                  <Button variant="primary" onClick={() => setWizard(true)}>
                    <Plus size={18} />
                    Create new story
                  </Button>
                </section>
                {view === "dashboard" && (
                  <>
                    <section className="feature-banner">
                      <div className="banner-copy">
                        <span className="tag">YOUR MEMORIES. YOUR WAY.</span>
                        <h2>
                          Every picture has a story.
                          <br />
                          Let’s tell yours.
                        </h2>
                        <p>
                          A journey, a family memory, or a world of your own.
                          <br />
                          Bring it to life, one beautiful page at a time.
                        </p>
                        <Button variant="cream" onClick={() => setWizard(true)}>
                          Start a new story
                          <ArrowRight size={16} />
                        </Button>
                      </div>
                      <div className="book-illustration" aria-hidden="true">
                        <div className="floating-label">
                          <BookOpen size={14} />
                          Made to be remembered
                        </div>
                        <div className="illustrated-book">
                          <div className="book-left">
                            <div className="mini-landscape">
                              <i />
                              <b />
                            </div>
                            <span>THE QUIET WAY HOME</span>
                            <div className="book-lines" />
                          </div>
                          <div className="book-right">
                            <small>CHAPTER ONE</small>
                            <h3>
                              A road
                              <br />
                              of our own.
                            </h3>
                            <div className="book-lines" />
                            <div className="mini-landscape small">
                              <i />
                              <b />
                            </div>
                          </div>
                        </div>
                        <span className="banner-star">✧</span>
                      </div>
                    </section>
                    <section className="style-section">
                      <div className="section-heading">
                        <h2>One story. Three ways to tell it.</h2>
                        <span>Find the format that feels like you</span>
                      </div>
                      <div className="mode-cards">
                        {(["storybook", "cinematic", "comic"] as Mode[]).map(
                          (mode) => (
                            <button
                              key={mode}
                              className={`mode-card ${mode}`}
                              onClick={() => {
                                setWizard(true);
                                sessionStorage.setItem("new-mode", mode);
                              }}
                            >
                              <span className="mode-card-icon">
                                <ModeIcon mode={mode} size={24} />
                              </span>
                              <div>
                                <h3>{modeNames[mode]}</h3>
                                <p>
                                  {mode === "storybook"
                                    ? "A keepsake, page by beautiful page."
                                    : mode === "cinematic"
                                      ? "Let your memories take the spotlight."
                                      : "Big moments. A whole new perspective."}
                                </p>
                              </div>
                              <ArrowRight size={17} />
                            </button>
                          ),
                        )}
                      </div>
                    </section>
                  </>
                )}
                <section className="projects-section">
                  <div className="section-heading">
                    <div>
                      <h2>
                        {view === "dashboard"
                          ? "Your recent stories"
                          : "All projects"}
                        <span className="count-badge">{projects.length}</span>
                      </h2>
                      <p>Pick up where your imagination left off.</p>
                    </div>
                    <div className="project-tools">
                      <label className="search">
                        <Search size={16} />
                        <input
                          aria-label="Search projects"
                          placeholder="Search your stories…"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                      </label>
                      <select
                        aria-label="Sort projects"
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                      >
                        <option value="recent">Last edited</option>
                        <option value="name">Name A–Z</option>
                      </select>
                      <Button
                        onClick={() => void restore()}
                        title="Restore portable project"
                      >
                        <FolderInput size={16} />
                        Import
                      </Button>
                    </div>
                  </div>
                  <div className="project-grid">
                    {filtered
                      .slice(0, view === "dashboard" ? 6 : undefined)
                      .map((p) => (
                        <div className="project-card" key={p.id}>
                          <button
                            className={`project-cover ${p.coverId ? "" : "no-cover"}`}
                            onClick={() => void open(p.id)}
                            aria-label={`Open ${p.title}`}
                          >
                            {p.coverId ? (
                              <img
                                loading="lazy"
                                src={assetUrl(p.id, p.coverId)}
                                alt=""
                              />
                            ) : (
                              <>
                                <BookOpen size={42} />
                                <span>{p.title}</span>
                              </>
                            )}
                            <span className="project-mode">
                              <ModeIcon mode={p.mode} size={12} />
                              {modeNames[p.mode]}
                            </span>
                          </button>
                          <div className="project-card-body">
                            <button
                              className="project-title"
                              onClick={() => void open(p.id)}
                            >
                              {p.title}
                            </button>
                            <div className="project-meta">
                              <span>
                                <Clock size={12} />
                                {p.updatedAt
                                  ? new Date(p.updatedAt).toLocaleDateString(
                                      undefined,
                                      { month: "short", day: "numeric" },
                                    )
                                  : "Needs recovery"}
                              </span>
                              <span>
                                {p.pages} pages · {p.assetCount} pictures
                              </span>
                            </div>
                            {p.warning && (
                              <p className="warning-text">{p.warning}</p>
                            )}
                            <div className="project-actions">
                              <button
                                onClick={() => {
                                  setRename(p);
                                  setRenamed(p.title);
                                }}
                              >
                                Rename
                              </button>
                              <button
                                title="Duplicate project"
                                onClick={() =>
                                  void run(async () => {
                                    await api.duplicate(p.id);
                                    await refresh();
                                    setNotice("Project duplicated");
                                  })
                                }
                              >
                                <Copy size={14} />
                              </button>
                              <button
                                title="Delete project"
                                onClick={() =>
                                  setConfirm({
                                    message: `Delete “${p.title}” and all its local pictures? Export a project backup first if you want to keep a copy.`,
                                    action: () =>
                                      void run(async () => {
                                        await api.remove(p.id);
                                        await refresh();
                                      }),
                                  })
                                }
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    <button
                      className="new-project-card"
                      onClick={() => setWizard(true)}
                    >
                      <span>
                        <Plus size={25} />
                      </span>
                      <h3>A new story starts here</h3>
                      <p>Give your next idea a home.</p>
                      <small>
                        Create a story <ArrowRight size={14} />
                      </small>
                    </button>
                  </div>
                  {!projects.length && (
                    <div className="sample-invitation">
                      <Sparkles size={18} />
                      <span>
                        Need a little inspiration? Explore an original sample
                        story with six illustrated landscapes.
                      </span>
                      <Button
                        onClick={() =>
                          void run(async () => {
                            setBusy("Creating sample story…");
                            setProject(await api.sample());
                            await refresh();
                          })
                        }
                      >
                        Open sample
                        <ArrowRight size={15} />
                      </Button>
                    </div>
                  )}
                </section>
                <footer className="dashboard-footer">
                  <BookMarked size={15} />
                  <span>The best stories are the ones only you can tell.</span>
                  <span>Made for memories. Built for privacy.</span>
                </footer>
              </div>
            )}
          </main>
        </div>
      )}
      {wizard && (
        <NewProject
          onClose={() => setWizard(false)}
          onCreate={(p) => {
            setWizard(false);
            setProject(p);
            void refresh();
          }}
          run={run}
        />
      )}
      {rename && (
        <Modal title="Rename your story" onClose={() => setRename(null)}>
          <Field label="Project title">
            <input
              autoFocus
              value={renamed}
              onChange={(e) => setRenamed(e.target.value)}
            />
          </Field>
          <div className="modal-actions">
            <Button onClick={() => setRename(null)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!renamed.trim()}
              onClick={() =>
                void run(async () => {
                  const { project: p } = await api.open(rename.id);
                  p.title = renamed.trim();
                  p.updatedAt = new Date().toISOString();
                  await api.save(p);
                  await refresh();
                  setRename(null);
                })
              }
            >
              Save name
            </Button>
          </div>
        </Modal>
      )}
      {confirm && (
        <Modal title="Please confirm" onClose={() => setConfirm(null)}>
          <p className="dialog-message">{confirm.message}</p>
          <div className="modal-actions">
            <Button onClick={() => setConfirm(null)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                const action = confirm.action;
                setConfirm(null);
                action();
              }}
            >
              Continue
            </Button>
          </div>
        </Modal>
      )}
      {error && (
        <Modal
          title="Something needs your attention"
          onClose={() => setError("")}
        >
          <p className="dialog-message prewrap">{error}</p>
          <div className="modal-actions">
            <Button variant="primary" onClick={() => setError("")}>
              Got it
            </Button>
          </div>
        </Modal>
      )}
      {busy && (
        <div className="progress-toast" role="status">
          <span className="spinner" />
          {busy}
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          <Check size={16} />
          {notice}
          <button
            className="icon-button"
            aria-label="Dismiss message"
            onClick={() => setNotice("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </>
  );
}
