"use client";
import { useTransition } from "react";
import { SCHEMA, resetSettings, setSetting, useSettings, type Field } from "../../lib/settings";
import { setAccepted } from "./actions";

/* Settings panel for one schema group. Selects render as segmented pills, ranges as filled bars.
   `icon` lets a select draw glyphs instead of text (used for shapes).
   Accept records the current values in accepted.json and moves the component to "Ready to use". */
export function Panel({
  group, title, description, icon, accepted,
}: {
  group: string; title: string; description: string; accepted: boolean;
  icon?: Record<string, Record<string, string>>;
}) {
  const values = useSettings()[group];
  const fields = SCHEMA[group];
  const [pending, start] = useTransition();
  const toggle = () => start(() => setAccepted(group, accepted ? null : values));

  const control = (f: Field) =>
    f.kind === "select" ? (
      <div className="cc-row" key={f.key} data-wrap={f.options.length > 4 || undefined}>
        <span>{f.label}</span>
        <div className="cc-seg" role="group" aria-label={f.label}>
          {f.options.map((o) => (
            <button
              key={o} aria-pressed={values[f.key] === o} aria-label={o}
              onClick={() => setSetting(group, f.key, o)}
            >
              {icon?.[f.key]?.[o] ? (
                <svg viewBox="0 0 100 100"><path d={icon[f.key][o]} /></svg>
              ) : o}
            </button>
          ))}
        </div>
      </div>
    ) : (
      <label className="cc-slider" key={f.key}>
        <div className="cc-fill" style={{ width: `${((Number(values[f.key]) - f.min) / (f.max - f.min)) * 100}%` }} />
        <span>{f.label}<b>{values[f.key]}{f.unit}</b></span>
        <input
          type="range" min={f.min} max={f.max} step={f.step} aria-label={f.label}
          value={values[f.key] as number}
          onChange={(e) => setSetting(group, f.key, Number(e.target.value))}
        />
      </label>
    );

  return (
    <aside className="cc-panel">
      <h1>{title}</h1>
      <p className="cc-desc">{description}</p>
      {fields.filter((f) => !f.adv).map(control)}
      {fields.some((f) => f.adv) && (
        <details className="cc-more">
          <summary>More</summary>
          {fields.filter((f) => f.adv).map(control)}
        </details>
      )}
      <div className="cc-actions">
        <button className="cc-ghost" onClick={resetSettings}>Reset all</button>
        <button className="cc-primary" onClick={toggle} disabled={pending} data-done={accepted || undefined}>
          {accepted ? "Accepted · undo" : "Accept"}
        </button>
      </div>
    </aside>
  );
}
