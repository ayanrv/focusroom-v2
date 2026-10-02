import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AtmosphereLayer, FocusMark, type Room } from "../../components/AtmosphereLayer";
import { apiFetch } from "../../lib/api";
import { focusAudioEngine } from "../audio/FocusAudioEngine";
import { useAuth } from "./AuthContext";
import "./focus-app.css";

type SessionRecord = {
  id: string;
  intention: string | null;
  room: Room;
  plannedSeconds: number;
  elapsedSeconds: number;
  ambienceA: number;
  ambienceB: number;
  ambienceC: number;
  startedAt: string;
  endedAt: string;
};

type SessionsResponse = {
  sessions: SessionRecord[];
  summary: {
    totalSessions: number;
    totalSeconds: number;
  };
};

const roomNames: Record<Room, string> = {
  "rain-city": "Rain City",
  "night-train": "Night Train",
  "orbital-lab": "Orbital Lab",
  "cozy-cafe": "Cozy Café",
};

const roomNotes: Record<Room, string> = {
  "rain-city": "rain / traffic / neon hum",
  "night-train": "rails / cabin / night air",
  "orbital-lab": "ventilation / comms / drone",
  "cozy-cafe": "murmur / cups / vinyl",
};

const roomControls: Record<Room, [string, string, string]> = {
  "rain-city": ["Rain", "Traffic", "Neon hum"],
  "night-train": ["Rails", "Cabin", "Night air"],
  "orbital-lab": ["Ventilation", "Comms", "Drone"],
  "cozy-cafe": ["Murmur", "Cups", "Vinyl"],
};

const rooms = Object.keys(roomNames) as Room[];

const STORAGE_KEY = "focusroom-active-session";
const AUDIO_SETTINGS_KEY = "focusroom-audio-settings";

type StoredSession = {
  room: Room;
  intention: string;
  plannedSeconds: number;
  remainingSeconds: number;
  startedAt: string | null;
  runningSince: number | null;
  controlA: number;
  controlB: number;
  controlC: number;
};

function resolveRoom(value: string | null): Room {
  if (value === "night-train" || value === "orbital-lab" || value === "cozy-cafe") {
    return value;
  }
  return "rain-city";
}

function formatClock(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60).toString().padStart(2, "0");
  const secs = (safe % 60).toString().padStart(2, "0");
  return `${minutes}:${secs}`;
}

function formatDuration(seconds: number) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function AuthenticatedHome() {
  const { user, signOut } = useAuth();
  const savedRef = useRef<StoredSession | null>(null);

  if (savedRef.current === null) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      savedRef.current = raw ? (JSON.parse(raw) as StoredSession) : null;
    } catch {
      savedRef.current = null;
    }
  }

  const saved = savedRef.current;
  const initialRoom = saved?.room ?? resolveRoom(window.localStorage.getItem("focusroom-room"));

  const [room, setRoom] = useState<Room>(initialRoom);
  const [intention, setIntention] = useState(saved?.intention ?? "");
  const [plannedSeconds, setPlannedSeconds] = useState(saved?.plannedSeconds ?? 25 * 60);
  const [remainingSeconds, setRemainingSeconds] = useState(saved?.remainingSeconds ?? 25 * 60);
  const [startedAt, setStartedAt] = useState<string | null>(saved?.startedAt ?? null);
  const [runningSince, setRunningSince] = useState<number | null>(saved?.runningSince ?? null);
  const [controlA, setControlA] = useState(saved?.controlA ?? 72);
  const [controlB, setControlB] = useState(saved?.controlB ?? 46);
  const [controlC, setControlC] = useState(saved?.controlC ?? 58);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [masterVolume, setMasterVolume] = useState(() => {
    try {
      const raw = window.localStorage.getItem(AUDIO_SETTINGS_KEY);
      if (!raw) return 72;
      const parsed = JSON.parse(raw) as { masterVolume?: number };
      return typeof parsed.masterVolume === "number" ? parsed.masterVolume : 72;
    } catch {
      return 72;
    }
  });
  const [muted, setMuted] = useState(false);
  const [history, setHistory] = useState<SessionRecord[]>([]);
  const [summary, setSummary] = useState({ totalSessions: 0, totalSeconds: 0 });
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const running = runningSince !== null;
  const active = startedAt !== null;
  const elapsedSeconds = Math.max(0, plannedSeconds - remainingSeconds);
  const progress = plannedSeconds > 0 ? Math.min(1, elapsedSeconds / plannedSeconds) : 0;

  const labels = roomControls[room];

  const refreshHistory = async () => {
    try {
      const response = await apiFetch<SessionsResponse>("/sessions");
      setHistory(response.sessions);
      setSummary(response.summary);
      setHistoryError(null);
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "Could not load session history.");
    }
  };

  useEffect(() => {
    void refreshHistory();

    return () => {
      focusAudioEngine.destroy();
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem("focusroom-room", room);
    focusAudioEngine.setRoom(room);
  }, [room]);

  useEffect(() => {
    focusAudioEngine.setLayerVolumes(controlA, controlB, controlC);
  }, [controlA, controlB, controlC]);

  useEffect(() => {
    focusAudioEngine.setMasterVolume(masterVolume);
    window.localStorage.setItem(
      AUDIO_SETTINGS_KEY,
      JSON.stringify({ masterVolume }),
    );
  }, [masterVolume]);

  useEffect(() => {
    focusAudioEngine.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    const snapshot: StoredSession = {
      room,
      intention,
      plannedSeconds,
      remainingSeconds,
      startedAt,
      runningSince,
      controlA,
      controlB,
      controlC,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }, [
    room,
    intention,
    plannedSeconds,
    remainingSeconds,
    startedAt,
    runningSince,
    controlA,
    controlB,
    controlC,
  ]);

  useEffect(() => {
    if (runningSince === null) return;

    const initialRemaining = remainingSeconds;
    const interval = window.setInterval(() => {
      const elapsedSinceRun = Math.floor((Date.now() - runningSince) / 1000);
      const next = Math.max(0, initialRemaining - elapsedSinceRun);
      setRemainingSeconds(next);

      if (next === 0) {
        setRunningSince(null);
      }
    }, 250);

    return () => window.clearInterval(interval);
  }, [runningSince]);

  const enableSound = async () => {
    try {
      await focusAudioEngine.enable();
      focusAudioEngine.setLayerVolumes(controlA, controlB, controlC);
      focusAudioEngine.setMasterVolume(masterVolume);
      focusAudioEngine.setMuted(muted);
      setSoundEnabled(true);
    } catch {
      setHistoryError("Your browser could not start audio playback.");
    }
  };

  const chooseDuration = (minutes: number) => {
    if (active) return;
    const seconds = minutes * 60;
    setPlannedSeconds(seconds);
    setRemainingSeconds(seconds);
  };

  const startOrPause = () => {
    if (running) {
      setRunningSince(null);
      return;
    }

    if (!startedAt) {
      setStartedAt(new Date().toISOString());
    }

    if (remainingSeconds <= 0) {
      setRemainingSeconds(plannedSeconds);
      setStartedAt(new Date().toISOString());
    }

    setRunningSince(Date.now());
  };

  const resetSession = () => {
    setRunningSince(null);
    setStartedAt(null);
    setRemainingSeconds(plannedSeconds);
  };

  const endAndSave = async () => {
    if (!startedAt || saving) return;

    setRunningSince(null);
    setSaving(true);

    const endedAt = new Date().toISOString();
    const elapsed = Math.max(1, plannedSeconds - remainingSeconds);

    try {
      await apiFetch("/sessions", {
        method: "POST",
        body: JSON.stringify({
          intention,
          room,
          plannedSeconds,
          elapsedSeconds: elapsed,
          ambienceA: controlA,
          ambienceB: controlB,
          ambienceC: controlC,
          startedAt,
          endedAt,
        }),
      });

      setStartedAt(null);
      setRemainingSeconds(plannedSeconds);
      window.localStorage.removeItem(STORAGE_KEY);
      await refreshHistory();
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "Could not save the session.");
    } finally {
      setSaving(false);
    }
  };

  const totalHours = (summary.totalSeconds / 3600).toFixed(summary.totalSeconds >= 36000 ? 0 : 1);

  return (
    <main className={`focus-app landing-alive--${room}`}>
      <AtmosphereLayer
        room={room}
        rainIntensity={room === "rain-city" ? controlA / 100 : 0}
      />

      <header className="focus-app__topbar">
        <Link className="focus-app__brand" to="/">
          <FocusMark />
          <span>FOCUSROOM</span>
        </Link>

        <div className="focus-app__identity">
          <span>{user?.email}</span>
          <button type="button" onClick={() => void signOut()}>Sign out</button>
        </div>
      </header>

      <aside className="focus-app__rail">
        <button className="focus-app__rail-item is-active" type="button">
          <span>01</span>
          <b>Focus</b>
        </button>
        <button className="focus-app__rail-item" type="button">
          <span>02</span>
          <b>Spaces</b>
        </button>
        <button className="focus-app__rail-item" type="button">
          <span>03</span>
          <b>Sound</b>
        </button>
        <button className="focus-app__rail-item" type="button">
          <span>04</span>
          <b>Progress</b>
        </button>
      </aside>

      <section className="focus-app__workspace">
        <div className="focus-session-panel">
          <div className="focus-session-panel__intro">
            <p className="focus-app__eyebrow">FOCUS SESSION</p>
            <h1>What are you<br />working on?</h1>

            <input
              className="focus-intention"
              type="text"
              maxLength={180}
              value={intention}
              onChange={(event) => setIntention(event.target.value)}
              placeholder="Write an intention…"
            />

            <div className="duration-presets" aria-label="Session duration">
              {[25, 50, 90].map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  disabled={active}
                  className={plannedSeconds === minutes * 60 ? "is-active" : ""}
                  onClick={() => chooseDuration(minutes)}
                >
                  {minutes} min
                </button>
              ))}
            </div>
          </div>

          <div className="focus-core">
            <div className="focus-core__dial" style={{ "--progress": progress } as React.CSSProperties}>
              <svg viewBox="0 0 240 240" aria-hidden="true">
                <circle className="focus-core__track" cx="120" cy="120" r="106" />
                <circle className="focus-core__progress" cx="120" cy="120" r="106" />
              </svg>

              <div className="focus-core__time">
                <strong>{formatClock(remainingSeconds)}</strong>
                <span>{running ? "FOCUSING" : active ? "PAUSED" : "READY"}</span>
              </div>
            </div>

            <div className="focus-core__actions">
              <button className="focus-action focus-action--primary" type="button" onClick={startOrPause}>
                <span>{running ? "Ⅱ" : "▶"}</span>
                {running ? "Pause" : active ? "Resume" : "Start focus"}
              </button>
              <button className="focus-action" type="button" onClick={resetSession} disabled={!active}>
                Reset
              </button>
              <button
                className="focus-action focus-action--end"
                type="button"
                onClick={() => void endAndSave()}
                disabled={!active || saving}
              >
                {saving ? "Saving…" : "End & save"}
              </button>
            </div>
          </div>
        </div>

        <div className="focus-app__lower">
          <section className="room-switcher">
            <div className="focus-panel-heading">
              <div>
                <p className="focus-app__eyebrow">SPACE</p>
                <h2>{roomNames[room]}</h2>
              </div>
              <span>{roomNotes[room]}</span>
            </div>

            <div className="room-switcher__list">
              {rooms.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={room === item ? "is-active" : ""}
                  onClick={() => setRoom(item)}
                >
                  <i />
                  <span>{roomNames[item]}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="focus-sound">
            <div className="focus-panel-heading">
              <div>
                <p className="focus-app__eyebrow">SOUND</p>
                <h2>Atmosphere</h2>
              </div>
              <span>{soundEnabled ? "live audio" : "audio ready"}</span>
            </div>

            <div className="sound-engine-controls">
              <button
                className={`sound-power ${soundEnabled ? "is-on" : ""}`}
                type="button"
                onClick={() => void enableSound()}
              >
                <i />
                {soundEnabled ? "Sound on" : "Enable sound"}
              </button>

              <button
                className="sound-mute"
                type="button"
                disabled={!soundEnabled}
                onClick={() => setMuted((value) => !value)}
              >
                {muted ? "Unmute" : "Mute"}
              </button>
            </div>

            <label className="focus-slider focus-slider--master">
              <span>Master</span>
              <input
                type="range"
                min="0"
                max="100"
                value={masterVolume}
                onChange={(event) => setMasterVolume(Number(event.target.value))}
              />
              <b>{masterVolume}</b>
            </label>

            {[
              { label: labels[0], value: controlA, setter: setControlA },
              { label: labels[1], value: controlB, setter: setControlB },
              { label: labels[2], value: controlC, setter: setControlC },
            ].map((control) => (
              <label className="focus-slider" key={control.label}>
                <span>{control.label}</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={control.value}
                  onChange={(event) => control.setter(Number(event.target.value))}
                />
                <b>{control.value}</b>
              </label>
            ))}

            <p className="focus-sound__note">
              Procedural ambience preview. Recorded seamless room audio comes next.
            </p>
          </section>

          <section className="focus-history">
            <div className="focus-panel-heading">
              <div>
                <p className="focus-app__eyebrow">PROGRESS</p>
                <h2>Recent work</h2>
              </div>
              <span>{summary.totalSessions} sessions · {totalHours}h</span>
            </div>

            <div className="focus-history__list">
              {history.slice(0, 4).map((session) => (
                <div className="focus-history__item" key={session.id}>
                  <div>
                    <strong>{session.intention || "Untitled focus session"}</strong>
                    <span>{roomNames[resolveRoom(session.room)]}</span>
                  </div>
                  <b>{formatDuration(session.elapsedSeconds)}</b>
                </div>
              ))}

              {!history.length && !historyError ? (
                <p className="focus-history__empty">Your completed sessions will collect here.</p>
              ) : null}

              {historyError ? <p className="focus-history__empty">{historyError}</p> : null}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
