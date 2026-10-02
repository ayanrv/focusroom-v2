export function SessionCompletion({
  goal,
  focusedSeconds,
  saving,
  onSave,
  onExtend,
}: {
  goal: string;
  focusedSeconds: number;
  saving: boolean;
  onSave: () => void;
  onExtend: (minutes: number) => void;
}) {
  const minutes = Math.max(1, Math.round(focusedSeconds / 60));

  return (
    <section className="session-complete" aria-live="polite">
      <div className="session-complete__signal" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <p>SESSION COMPLETE</p>
      <h1>{goal || "Focus session"}</h1>
      <strong>{minutes}<span> min focused</span></strong>
      <div className="session-complete__actions">
        <button className="is-primary" type="button" onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Finish & save"}
        </button>
        <button type="button" onClick={() => onExtend(5)} disabled={saving}>+ 5 min</button>
        <button type="button" onClick={() => onExtend(15)} disabled={saving}>+ 15 min</button>
      </div>
    </section>
  );
}
