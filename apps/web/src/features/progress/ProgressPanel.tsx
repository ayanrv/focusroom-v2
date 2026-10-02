import { useEffect, useMemo, useState, type CSSProperties } from "react";

export type ProgressSession = {
  id: string;
  intention: string | null;
  room: string;
  plannedSeconds: number;
  initialPlannedSeconds: number | null;
  elapsedSeconds: number;
  completed: boolean | null;
  ambienceA: number;
  ambienceB: number;
  ambienceC: number;
  startedAt: string;
  endedAt: string;
};

export type ProgressResponse = {
  generatedAt: string;
  timeZone: string;
  summary: {
    totalSessions: number;
    totalSeconds: number;
    todaySeconds: number;
    thisWeekSeconds: number;
    thisMonthSeconds: number;
    averageSeconds: number;
    completionRate: number;
    currentStreak: number;
    bestStreak: number;
  };
  weekly: Array<{ date: string; seconds: number }>;
  heatmap: Array<{ date: string; seconds: number }>;
  rooms: Array<{ room: string; seconds: number }>;
  recentSessions: ProgressSession[];
};

const curatedRoomNames: Record<string, string> = {
  "rain-city": "Rain City",
  "night-train": "Night Train",
  "orbital-lab": "Orbital Lab",
  "cozy-cafe": "Cozy Café",
};

function roomName(value: string) {
  if (value.startsWith("custom:")) return value.slice(7) || "Custom Room";
  return curatedRoomNames[value] ?? value;
}

function formatDuration(seconds: number, compact = false) {
  const totalMinutes = Math.max(0, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (!hours) return `${totalMinutes}m`;
  if (!minutes) return `${hours}h`;
  return compact ? `${hours}h ${minutes}m` : `${hours} hr ${minutes} min`;
}

function localDay(date: string) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(
    new Date(`${date}T12:00:00`),
  );
}

function sessionCompleted(session: ProgressSession) {
  return session.completed ?? session.elapsedSeconds >= session.plannedSeconds;
}

export function ProgressPanel({
  data,
  loading,
  error,
  onRetry,
}: {
  data: ProgressResponse | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const [selected, setSelected] = useState<ProgressSession | null>(null);

  const maxWeekly = useMemo(
    () => Math.max(1, ...(data?.weekly.map((item) => item.seconds) ?? [1])),
    [data],
  );

  const maxHeat = useMemo(
    () => Math.max(1, ...(data?.heatmap.map((item) => item.seconds) ?? [1])),
    [data],
  );

  const maxRoom = useMemo(
    () => Math.max(1, ...(data?.rooms.map((item) => item.seconds) ?? [1])),
    [data],
  );

  useEffect(() => {
    if (!selected) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected]);

  if (loading && !data) {
    return (
      <section className="progress-v2 progress-v2--loading">
        <p className="focus-app__eyebrow">PROGRESS</p>
        <h1>Reading your focus history.</h1>
        <div className="progress-v2__loading-line" />
      </section>
    );
  }

  if (error && !data) {
    return (
      <section className="progress-v2 progress-v2--error">
        <p className="focus-app__eyebrow">PROGRESS</p>
        <h1>Progress is temporarily unavailable.</h1>
        <p>{error}</p>
        <button type="button" onClick={onRetry}>Try again</button>
      </section>
    );
  }

  if (!data) return null;

  const { summary } = data;

  return (
    <section className="progress-v2">
      <header className="progress-v2__hero">
        <div>
          <p className="focus-app__eyebrow">PROGRESS</p>
          <h1>Your attention,<br />over time.</h1>
        </div>
        <div className="progress-v2__hero-total">
          <span>ALL TIME</span>
          <strong>{formatDuration(summary.totalSeconds, true)}</strong>
          <small>{summary.totalSessions} sessions</small>
        </div>
      </header>

      <div className="progress-v2__metrics">
        <article>
          <span>Today</span>
          <strong>{formatDuration(summary.todaySeconds, true)}</strong>
        </article>
        <article>
          <span>This week</span>
          <strong>{formatDuration(summary.thisWeekSeconds, true)}</strong>
        </article>
        <article>
          <span>This month</span>
          <strong>{formatDuration(summary.thisMonthSeconds, true)}</strong>
        </article>
        <article>
          <span>Average</span>
          <strong>{formatDuration(summary.averageSeconds, true)}</strong>
        </article>
        <article>
          <span>Completion</span>
          <strong>{summary.completionRate}%</strong>
        </article>
        <article>
          <span>Current streak</span>
          <strong>{summary.currentStreak}<small>d</small></strong>
        </article>
        <article>
          <span>Best streak</span>
          <strong>{summary.bestStreak}<small>d</small></strong>
        </article>
      </div>

      <div className="progress-v2__grid">
        <article className="progress-v2__panel progress-v2__panel--weekly">
          <header>
            <div>
              <span>LAST 7 DAYS</span>
              <h2>Focus rhythm</h2>
            </div>
            <small>{formatDuration(summary.thisWeekSeconds, true)} this week</small>
          </header>

          <div className="progress-weekly">
            {data.weekly.map((item) => (
              <div className="progress-weekly__day" key={item.date}>
                <div className="progress-weekly__track">
                  <i style={{ "--height": `${Math.max(3, (item.seconds / maxWeekly) * 100)}%` } as CSSProperties} />
                </div>
                <strong>{item.seconds ? formatDuration(item.seconds, true) : "—"}</strong>
                <span>{localDay(item.date)}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="progress-v2__panel progress-v2__panel--streak">
          <header>
            <div>
              <span>91 DAYS</span>
              <h2>Consistency</h2>
            </div>
          </header>

          <div className="progress-heatmap" aria-label="Focus activity over the last 91 days">
            {data.heatmap.map((item) => {
              const intensity = item.seconds ? Math.max(.14, Math.sqrt(item.seconds / maxHeat)) : 0;
              return (
                <i
                  key={item.date}
                  title={`${item.date}: ${formatDuration(item.seconds)}`}
                  style={{ "--heat": intensity } as CSSProperties}
                />
              );
            })}
          </div>

          <div className="progress-v2__streak-copy">
            <div>
              <strong>{summary.currentStreak}</strong>
              <span>current streak</span>
            </div>
            <div>
              <strong>{summary.bestStreak}</strong>
              <span>best streak</span>
            </div>
          </div>
        </article>

        <article className="progress-v2__panel progress-v2__panel--rooms">
          <header>
            <div>
              <span>SPACES</span>
              <h2>Where you focus</h2>
            </div>
          </header>

          <div className="progress-rooms">
            {data.rooms.length ? data.rooms.map((item) => (
              <div key={item.room}>
                <div>
                  <span>{roomName(item.room)}</span>
                  <b>{formatDuration(item.seconds, true)}</b>
                </div>
                <i><em style={{ "--width": `${(item.seconds / maxRoom) * 100}%` } as CSSProperties} /></i>
              </div>
            )) : <p>No room data yet.</p>}
          </div>
        </article>
      </div>

      <section className="progress-v2__sessions">
        <header>
          <div>
            <span>RECENT SESSIONS</span>
            <h2>Session history</h2>
          </div>
          {error ? <button type="button" onClick={onRetry}>Refresh</button> : null}
        </header>

        <div className="progress-session-table">
          {data.recentSessions.map((session) => (
            <button type="button" key={session.id} onClick={() => setSelected(session)}>
              <span className="progress-session-table__status" data-completed={sessionCompleted(session)} />
              <span className="progress-session-table__goal">
                <strong>{session.intention || "Untitled focus session"}</strong>
                <small>{roomName(session.room)}</small>
              </span>
              <span>{formatDuration(session.elapsedSeconds, true)}</span>
              <span>{new Date(session.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
              <i>→</i>
            </button>
          ))}
          {!data.recentSessions.length ? (
            <p className="progress-session-table__empty">Your completed sessions will appear here.</p>
          ) : null}
        </div>
      </section>

      {selected ? (
        <div className="progress-detail" role="dialog" aria-modal="true" aria-label="Focus session details">
          <button className="progress-detail__scrim" type="button" aria-label="Close" onClick={() => setSelected(null)} />
          <article>
            <button className="progress-detail__close" type="button" onClick={() => setSelected(null)}>×</button>
            <p>{sessionCompleted(selected) ? "COMPLETED SESSION" : "ENDED SESSION"}</p>
            <h2>{selected.intention || "Untitled focus session"}</h2>

            <div className="progress-detail__stats">
              <div><span>Focused</span><strong>{formatDuration(selected.elapsedSeconds)}</strong></div>
              <div><span>Planned</span><strong>{formatDuration(selected.plannedSeconds)}</strong></div>
              <div><span>Space</span><strong>{roomName(selected.room)}</strong></div>
              <div>
                <span>Date</span>
                <strong>{new Date(selected.startedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</strong>
              </div>
            </div>

            {selected.initialPlannedSeconds && selected.initialPlannedSeconds !== selected.plannedSeconds ? (
              <p className="progress-detail__extension">
                Started as {formatDuration(selected.initialPlannedSeconds)} and extended by {formatDuration(selected.plannedSeconds - selected.initialPlannedSeconds)}.
              </p>
            ) : null}

            {!selected.room.startsWith("custom:") ? (
              <div className="progress-detail__mix">
                <span>LAST MIX</span>
                <div><i style={{ "--mix": `${selected.ambienceA}%` } as CSSProperties} /><b>A {selected.ambienceA}</b></div>
                <div><i style={{ "--mix": `${selected.ambienceB}%` } as CSSProperties} /><b>B {selected.ambienceB}</b></div>
                <div><i style={{ "--mix": `${selected.ambienceC}%` } as CSSProperties} /><b>C {selected.ambienceC}</b></div>
              </div>
            ) : null}
          </article>
        </div>
      ) : null}
    </section>
  );
}
