import {
  ArrowLeft,
  ArrowRight,
  Check,
  FolderOpen,
  Image as ImageIcon,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { generatePages, storyStats } from "../core/layout";
import { type Mode, type Project } from "../core/model";
import { Button, Field, Modal, ModeIcon, modeNames, type Run } from "./ui";
export default function NewProject({
  onClose,
  onCreate,
  run,
}: {
  onClose: () => void;
  onCreate: (p: Project) => void;
  run: Run;
}) {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [author, setAuthor] = useState("");
  const [language, setLanguage] = useState<"en" | "ar">("en");
  const [story, setStory] = useState("");
  const [mode, setMode] = useState<Mode>(
    (sessionStorage.getItem("new-mode") as Mode) || "storybook",
  );
  const [files, setFiles] = useState<File[]>([]);
  const [creating, setCreating] = useState(false);
  const [cover, setCover] = useState<number>(0);
  const [completed, setCompleted] = useState(0);
  const stats = storyStats(story);
  useEffect(() => {
    sessionStorage.removeItem("new-mode");
  }, []);
  const create = () =>
    void run(async () => {
      setCreating(true);
      try {
        const p = await window.storyweaver.create({
          title,
          subtitle,
          author,
          language,
          story,
          mode,
        });
        const errors: string[] = [];
        for (const file of files) {
          setCompleted(files.indexOf(file) + 1);
          try {
            p.assets.push(
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
        p.coverId = p.assets[cover]?.id ?? p.assets[0]?.id ?? null;
        for (const m of ["storybook", "cinematic", "comic"] as Mode[])
          p.presentations[m].pages = generatePages(
            story,
            p.assets.map((a) => a.id),
            m,
          );
        await window.storyweaver.save(p);
        onCreate(p);
        if (errors.length)
          throw new Error(
            "The project was created. Some pictures could not be imported:\n" +
              errors.join("\n"),
          );
      } finally {
        setCreating(false);
      }
    });
  return (
    <Modal
      title="A new story begins"
      onClose={creating ? () => {} : onClose}
      wide
    >
      <div className="wizard-steps">
        {["The basics", "Your words", "Your pictures", "Your style"].map(
          (s, i) => (
            <span
              key={s}
              className={step === i ? "active" : step > i ? "done" : ""}
            >
              <b>{step > i ? <Check size={13} /> : i + 1}</b>
              {s}
            </span>
          ),
        )}
      </div>
      {step === 0 ? (
        <div className="wizard-body">
          <div className="eyebrow">FIRST, GIVE IT A NAME</div>
          <h3>What story will you tell?</h3>
          <Field label="Project title *">
            <input
              autoFocus
              placeholder="A summer to remember"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field label="Subtitle (optional)">
            <input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Every adventure starts somewhere"
            />
          </Field>
          <div className="two-cols">
            <Field label="Author (optional)">
              <input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
              />
            </Field>
            <Field label="Story language">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as "en" | "ar")}
              >
                <option value="en">English</option>
                <option value="ar">العربية · Arabic</option>
              </select>
            </Field>
          </div>
        </div>
      ) : step === 1 ? (
        <div className="wizard-body">
          <div className="section-heading">
            <div>
              <h3>Your words, just as you wrote them.</h3>
              <p>Paste, write, or import a UTF-8 TXT or Markdown file.</p>
            </div>
            <Button
              onClick={() =>
                void run(async () => {
                  const s = await window.storyweaver.text();
                  if (s !== null) setStory(s);
                })
              }
            >
              <Upload size={16} />
              Import text
            </Button>
          </div>
          <textarea
            className="story-input"
            dir={language === "ar" ? "rtl" : "ltr"}
            value={story}
            onChange={(e) => setStory(e.target.value)}
            placeholder="Once upon a time…"
          />
          <div className="text-stats">
            {stats.words.toLocaleString()} words ·{" "}
            {stats.characters.toLocaleString()} characters · {stats.minutes} min
            read
          </div>
          <p className="hint">
            A photo-only story is welcome, too. Your original text is always
            preserved.
          </p>
        </div>
      ) : step === 2 ? (
        <div className="wizard-body">
          <h3>Bring your story into focus.</h3>
          <p className="muted">
            Pictures follow your chosen order. Pick the cover, or reorder
            pictures later in the editor.
          </p>
          <label
            className="dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              setFiles([...files, ...Array.from(e.dataTransfer.files)]);
            }}
          >
            <Upload size={28} />
            <strong>Add your pictures</strong>
            <span>Drop files here or browse · JPEG, PNG, WebP</span>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) =>
                setFiles([...files, ...Array.from(e.target.files || [])])
              }
            />
          </label>
          <div className="file-list">
            {files.map((f, i) => (
              <div key={`${f.name}-${i}`}>
                <ImageIcon size={15} />
                <span>{f.name}</span>
                <button
                  className={cover === i ? "selected" : ""}
                  onClick={() => setCover(i)}
                >
                  {cover === i ? "Cover" : "Set cover"}
                </button>
                <button
                  aria-label={`Remove ${f.name}`}
                  onClick={() => setFiles(files.filter((_, j) => j !== i))}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          <Button
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.multiple = true;
              input.setAttribute("webkitdirectory", "");
              input.onchange = () =>
                setFiles([
                  ...files,
                  ...Array.from(input.files || []).filter((f) =>
                    /\.(jpe?g|png|webp)$/i.test(f.name),
                  ),
                ]);
              input.click();
            }}
          >
            <FolderOpen size={16} />
            Add a folder
          </Button>
          <p className="hint">
            {files.length} pictures selected. You can also add pictures after
            creating your project.
          </p>
        </div>
      ) : (
        <div className="wizard-body">
          <h3>Choose how your story unfolds.</h3>
          <p className="muted">
            Switch styles at any time. Your story and pictures stay with you.
          </p>
          <div className="wizard-modes">
            {(["storybook", "cinematic", "comic"] as Mode[]).map((m) => (
              <button
                className={mode === m ? "selected" : ""}
                key={m}
                onClick={() => setMode(m)}
              >
                <div className={`format-preview ${m}`}>
                  <ModeIcon mode={m} size={42} />
                </div>
                <h4>{modeNames[m]}</h4>
                <p>
                  {m === "storybook"
                    ? "A timeless, interactive book."
                    : m === "cinematic"
                      ? "A moving slideshow of memories."
                      : "A playful, panel-by-panel story."}
                </p>
                {mode === m && <Check size={18} />}
              </button>
            ))}
          </div>
          <div className="info-note">
            <Check size={17} />
            Arranged in story and picture order. No AI, no uploads, entirely
            yours.
          </div>
        </div>
      )}
      <div className="modal-actions">
        <Button
          disabled={creating}
          onClick={() => (step === 0 ? onClose() : setStep(step - 1))}
        >
          {step === 0 ? (
            "Cancel"
          ) : (
            <>
              <ArrowLeft size={15} />
              Back
            </>
          )}
        </Button>
        <span className="step-counter">Step {step + 1} of 4</span>
        {step < 3 ? (
          <Button
            variant="primary"
            disabled={step === 0 && !title.trim()}
            onClick={() => setStep(step + 1)}
          >
            Continue
            <ArrowRight size={15} />
          </Button>
        ) : (
          <Button variant="primary" disabled={creating} onClick={create}>
            {creating
              ? `Creating… ${completed} / ${files.length} pictures`
              : "Create my story"}
            <ArrowRight size={15} />
          </Button>
        )}
      </div>
    </Modal>
  );
}
