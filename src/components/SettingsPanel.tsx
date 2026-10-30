import { FolderOpen, Trash2 } from "lucide-react";
import { themes, type Settings, type Style } from "../core/model";
import { Button, Field, type Run } from "./ui";
export default function SettingsPanel({
  value: s,
  onChange,
  run,
  notify,
}: {
  value: Settings;
  onChange: (s: Settings) => void;
  run: Run;
  notify: (s: string) => void;
}) {
  const change = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    onChange({ ...s, [key]: value });
  return (
    <div className="settings-content">
      <div className="eyebrow">MAKE YOURSELF AT HOME</div>
      <h1>Your workspace, your way.</h1>
      <p>Preferences stay on this device.</p>
      <section className="settings-card">
        <h2>Appearance & comfort</h2>
        <div className="settings-row">
          <div>
            <strong>Dark mode</strong>
            <p>A little easier on the eyes after sunset.</p>
          </div>
          <input
            aria-label="Dark mode"
            type="checkbox"
            checked={s.dark}
            onChange={(e) => change("dark", e.target.checked)}
          />
        </div>
        <div className="settings-row">
          <div>
            <strong>Reduced motion</strong>
            <p>Keep transitions calm and simple.</p>
          </div>
          <input
            aria-label="Reduced motion"
            type="checkbox"
            checked={s.reducedMotion}
            onChange={(e) => change("reducedMotion", e.target.checked)}
          />
        </div>
        <Field label="Interface language">
          <select
            value={s.language}
            onChange={(e) => change("language", e.target.value as "en" | "ar")}
          >
            <option value="en">English</option>
            <option value="ar">العربية (story text; English editor)</option>
          </select>
        </Field>
      </section>
      <section className="settings-card">
        <h2>Defaults for new stories</h2>
        <div className="two-cols">
          <Field label="Storybook theme">
            <select
              value={s.theme}
              onChange={(e) =>
                change("theme", e.target.value as Style["theme"])
              }
            >
              {Object.entries(themes).map(([k, t]) => (
                <option key={k} value={k}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Font size">
            <input
              type="number"
              min={12}
              max={36}
              value={s.fontSize}
              onChange={(e) => change("fontSize", +e.target.value)}
            />
          </Field>
          <Field label="Seconds per slide">
            <input
              type="number"
              min={1}
              max={120}
              value={s.duration}
              onChange={(e) => change("duration", +e.target.value)}
            />
          </Field>
          <Field label="Picture placement">
            <select
              value={s.placement}
              onChange={(e) =>
                change("placement", e.target.value as Settings["placement"])
              }
            >
              <option value="spread">Spread throughout the story</option>
              <option value="group">Group from the beginning</option>
            </select>
          </Field>
        </div>
      </section>
      <section className="settings-card">
        <h2>Storage & saving</h2>
        <div className="settings-row">
          <div>
            <strong>Automatic saving</strong>
            <p>Save changes after a short pause while editing.</p>
          </div>
          <input
            aria-label="Automatic saving"
            type="checkbox"
            checked={s.autosave}
            onChange={(e) => change("autosave", e.target.checked)}
          />
        </div>
        <Field label="Project storage location">
          <div className="input-action">
            <input
              readOnly
              value={s.projectLocation || "Application data / projects"}
            />
            <Button
              onClick={() =>
                void run(async () => {
                  const dir = await window.storyweaver.chooseDirectory();
                  if (dir) change("projectLocation", dir);
                })
              }
            >
              <FolderOpen size={16} />
              Choose
            </Button>
          </div>
        </Field>
        <p className="hint">
          Existing projects are copied safely to the new folder. The old folder
          is retained as a backup.
        </p>
        <Field label="Default export location">
          <div className="input-action">
            <input readOnly value={s.exportLocation || "Documents"} />
            <Button
              onClick={() =>
                void run(async () => {
                  const dir = await window.storyweaver.chooseDirectory();
                  if (dir) change("exportLocation", dir);
                })
              }
            >
              <FolderOpen size={16} />
              Choose
            </Button>
          </div>
        </Field>
        <Button
          onClick={() =>
            void run(async () => {
              await window.storyweaver.clearCache();
              notify(
                "Thumbnail caches cleared. Pictures regenerate on demand.",
              );
            })
          }
        >
          <Trash2 size={16} />
          Clear thumbnail caches
        </Button>
      </section>
    </div>
  );
}
