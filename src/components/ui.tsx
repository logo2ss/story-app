import { BookOpen, Clapperboard, PanelsTopLeft, X } from "lucide-react";
import {
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  type ReactElement,
  type ReactNode,
} from "react";
import { type Mode } from "../core/model";
export const modeNames: Record<Mode, string> = {
  storybook: "Digital Storybook",
  cinematic: "Cinematic Story",
  comic: "Photo Comic",
};
export const ModeIcon = ({ mode, ...props }: { mode: Mode; size?: number }) =>
  mode === "storybook" ? (
    <BookOpen {...props} />
  ) : mode === "cinematic" ? (
    <Clapperboard {...props} />
  ) : (
    <PanelsTopLeft {...props} />
  );
export function Button({
  children,
  onClick,
  variant = "",
  title,
  disabled = false,
  ...rest
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: string;
  title?: string;
  disabled?: boolean;
  [key: string]: unknown;
}) {
  return (
    <button
      className={`button ${variant}`}
      onClick={onClick}
      title={title}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {isValidElement(children) &&
      ["input", "textarea", "select"].includes(String(children.type))
        ? cloneElement(children as ReactElement<{ "aria-label"?: string }>, {
            "aria-label": label,
          })
        : children}
    </label>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={onClose}
    >
      <div className="modal-title">
        <h2>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export type Run = <T>(fn: () => Promise<T>) => Promise<T | undefined>;
export function Range({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="range-field">
      <span>
        {label}
        <b>{value}</b>
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
      />
    </label>
  );
}
export function CheckField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (b: boolean) => void;
}) {
  return (
    <label className="check-field">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
