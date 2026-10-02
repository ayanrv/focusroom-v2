import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AtmosphereLayer, FocusMark, type Room } from "../../components/AtmosphereLayer";
import { apiFetch } from "../../lib/api";
import { focusAudioEngine, roomAudioConfig, type LayerKey } from "../audio/FocusAudioEngine";
import { useAuth } from "./AuthContext";
import "./focus-app.css";

type SessionRecord = {
  id: string;
  intention: string | null;
  room: string;
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

type DashboardTab = "focus" | "space" | "sound" | "progress";
type SetupStep = "goal" | "time" | "room";

const roomNames: Record<Room, string> = {
  "rain-city": "Rain City",
  "night-train": "Night Train",
  "orbital-lab": "Orbital Lab",
  "cozy-cafe": "Cozy Café",
};

const roomNotes: Record<Room, string> = {
  "rain-city": "rain / traffic / city life",
  "night-train": "rails / wind / lo-fi",
  "orbital-lab": "cosmos / ventilation / systems",
  "cozy-cafe": "crowd / coffee bar / jazz + vinyl",
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

function displayRoom(value: string) {
  return roomNames[resolveRoom(value)] ?? value;
}

function CustomRoomBackdrop() {
  return (
    <div className="custom-room-backdrop" aria-hidden="true">
      <i className="custom-room-backdrop__orb custom-room-backdrop__orb--one" />
      <i className="custom-room-backdrop__orb custom-room-backdrop__orb--two" />
      <i className="custom-room-backdrop__line" />
      <span>YOUR SPACE</span>
    </div>
  );
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

  const [tab, setTab] = useState<DashboardTab>("focus");
  const [setupStep, setSetupStep] = useState<SetupStep>("goal");
  const [inFocusView, setInFocusView] = useState(Boolean(saved?.startedAt));
  const [customBuilder, setCustomBuilder] = useState(false);

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

  const layerMeta = roomAudioConfig[room];
  const controls: Array<{
    key: LayerKey;
    label: string;
    value: number;
    setter: React.Dispatch<React.SetStateAction<number>>;
  }> = [
    { key: "a", label: layerMeta.a.label, value: controlA, setter: setControlA },
    { key: "b", label: layerMeta.b.label, value: controlB, setter: setControlB },
    { key: "c", label: layerMeta.c.label, value: controlC, setter: setControlC },
  ];

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
    return () => focusAudioEngine.destroy();
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
    window.localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify({ masterVolume }));
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
      if (next === 0) setRunningSince(null);
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

  const beginSession = async (selectedRoom: Room) => {
    setRoom(selectedRoom);
    setCustomBuilder(false);
    const now = new Date().toISOString();
    setStartedAt(now);
    setRemainingSeconds(plannedSeconds);
    setRunningSince(Date.now());
    setInFocusView(true);

    if (!soundEnabled) {
      try {
        await focusAudioEngine.enable();
        focusAudioEngine.setRoom(selectedRoom);
        focusAudioEngine.setLayerVolumes(controlA, controlB, controlC);
        focusAudioEngine.setMasterVolume(masterVolume);
        focusAudioEngine.setMuted(muted);
        setSoundEnabled(true);
      } catch {
        // Session can continue silently.
      }
    }
  };

  const pauseOrResume = () => {
    if (running) {
      setRunningSince(null);
      return;
    }

    if (!startedAt) return;
    setRunningSince(Date.now());
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
      setInFocusView(false);
      setSetupStep("goal");
      window.localStorage.removeItem(STORAGE_KEY);
      await refreshHistory();
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "Could not save the session.");
    } finally {
      setSaving(false);
    }
  };

  const totalHours = (summary.totalSeconds / 3600).toFixed(summary.totalSeconds >= 36000 ? 0 : 1);

  if (inFocusView && active) {
    return (
      <main className={`focus-state landing-alive--${room}`}>
        <AtmosphereLayer
          room={room}
          rainIntensity={room === "rain-city" ? controlA / 100 : 0}
        />

        <button className="focus-state__back" type="button" onClick={() => setInFocusView(false)}>
          ← Back
        </button>

        <section className="focus-state__content">
          <p className="focus-state__goal">{intention || "Focus session"}</p>

          <div className="focus-state__timer" style={{ "--progress": progress } as React.CSSProperties}>
            <svg viewBox="0 0 240 240" aria-hidden="true">
              <circle cx="120" cy="120" r="106" />
              <circle className="is-progress" cx="120" cy="120" r="106" />
            </svg>
            <div>
              <strong>{formatClock(remainingSeconds)}</strong>
              <span>{running ? "FOCUSING" : "PAUSED"}</span>
            </div>
          </div>

          <div className="focus-state__actions">
            <button type="button" onClick={pauseOrResume}>
              {running ? "Pause" : "Resume"}
            </button>
            <button type="button" onClick={() => void endAndSave()} disabled={saving}>
              {saving ? "Saving…" : "Finish"}
            </button>
          </div>

          <div className="focus-state__mixer">
            {controls.map((control) => (
              <label key={control.key}>
                <span>{control.label}</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={control.value}
                  onChange={(event) => control.setter(Number(event.target.value))}
                />
              </label>
            ))}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={`focus-dashboard landing-alive--${room}`}>
      {customBuilder ? <CustomRoomBackdrop /> : (
        <AtmosphereLayer
          room={room}
          rainIntensity={room === "rain-city" ? controlA / 100 : 0}
        />
      )}

      <header className="focus-dashboard__topbar">
        <Link className="focus-dashboard__brand" to="/">
          <FocusMark />
          <span>FOCUSROOM</span>
        </Link>

        <nav className="focus-dashboard__tabs" aria-label="Workspace">
          {([
            ["focus", "Focus"],
            ["space", "My current space"],
            ["sound", "Sound"],
            ["progress", "Progress"],
          ] as Array<[DashboardTab, string]>).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={tab === value ? "is-active" : ""}
              onClick={() => {
                setCustomBuilder(false);
                setTab(value);
              }}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="focus-dashboard__account">
          <span>{user?.email}</span>
          <button type="button" onClick={() => void signOut()}>Sign out</button>
        </div>
      </header>

      <section className="focus-dashboard__body">
        {tab === "focus" ? (
          <section className="focus-setup">
            {active ? (
              <div className="focus-setup__active">
                <p className="focus-app__eyebrow">CURRENT SESSION</p>
                <h1>{intention || "Focus session"}</h1>
                <strong>{formatClock(remainingSeconds)}</strong>
                <button type="button" onClick={() => setInFocusView(true)}>Return to focus</button>
              </div>
            ) : customBuilder ? (
              <div className="custom-builder">
                <button className="custom-builder__back" type="button" onClick={() => setCustomBuilder(false)}>
                  ← Choose another room
                </button>
                <p>CREATE YOUR OWN ROOM</p>
                <h1>Your media.<br />Your atmosphere.</h1>
                <div className="custom-builder__providers">
                  <span>YouTube</span>
                  <span>Spotify</span>
                  <span>Apple Music</span>
                </div>
                <p className="custom-builder__note">
                  This room will have its own visual system, media player, timer and goal. It will not inherit a curated FocusRoom ambience.
                </p>
                <button className="custom-builder__disabled" type="button" disabled>
                  Custom room builder · next
                </button>
              </div>
            ) : (
              <>
                <div className="focus-setup__steps" aria-label="Focus setup progress">
                  <span className={setupStep === "goal" ? "is-active" : ""}>01</span>
                  <i />
                  <span className={setupStep === "time" ? "is-active" : ""}>02</span>
                  <i />
                  <span className={setupStep === "room" ? "is-active" : ""}>03</span>
                </div>

                {setupStep === "goal" ? (
                  <div className="focus-setup__stage">
                    <p className="focus-app__eyebrow">STEP 01</p>
                    <h1>What is your goal?</h1>
                    <input
                      className="focus-setup__input"
                      type="text"
                      maxLength={180}
                      autoFocus
                      value={intention}
                      onChange={(event) => setIntention(event.target.value)}
                      placeholder="One clear thing to finish"
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && intention.trim()) setSetupStep("time");
                      }}
                    />
                    <button
                      className="focus-setup__continue"
                      type="button"
                      disabled={!intention.trim()}
                      onClick={() => setSetupStep("time")}
                    >
                      Continue
                    </button>
                  </div>
                ) : null}

                {setupStep === "time" ? (
                  <div className="focus-setup__stage">
                    <button className="focus-setup__back" type="button" onClick={() => setSetupStep("goal")}>← Goal</button>
                    <p className="focus-app__eyebrow">STEP 02</p>
                    <h1>How long?</h1>
                    <div className="focus-setup__durations">
                      {[25, 50, 90].map((minutes) => (
                        <button
                          key={minutes}
                          type="button"
                          className={plannedSeconds === minutes * 60 ? "is-active" : ""}
                          onClick={() => chooseDuration(minutes)}
                        >
                          <strong>{minutes}</strong>
                          <span>minutes</span>
                        </button>
                      ))}
                    </div>
                    <button className="focus-setup__continue" type="button" onClick={() => setSetupStep("room")}>
                      Choose a space
                    </button>
                  </div>
                ) : null}

                {setupStep === "room" ? (
                  <div className="focus-setup__stage focus-setup__stage--rooms">
                    <button className="focus-setup__back" type="button" onClick={() => setSetupStep("time")}>← Time</button>
                    <p className="focus-app__eyebrow">STEP 03</p>
                    <h1>Choose your space.</h1>

                    <div className="focus-room-grid">
                      {rooms.map((item) => (
                        <button
                          key={item}
                          className={`focus-room-card focus-room-card--${item}`}
                          type="button"
                          onClick={() => void beginSession(item)}
                        >
                          <span>{roomNotes[item]}</span>
                          <strong>{roomNames[item]}</strong>
                          <i>Enter →</i>
                        </button>
                      ))}

                      <button
                        className="focus-room-card focus-room-card--custom"
                        type="button"
                        onClick={() => setCustomBuilder(true)}
                      >
                        <span>your media / your visuals / your rules</span>
                        <strong>Custom Room</strong>
                        <i>Create →</i>
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </section>
        ) : null}

        {tab === "space" ? (
          <section className="dashboard-panel dashboard-panel--space">
            <p className="focus-app__eyebrow">MY CURRENT SPACE</p>
            <h1>{roomNames[room]}</h1>
            <p>{roomNotes[room]}</p>
            <div className="dashboard-room-list">
              {rooms.map((item) => (
                <button
                  key={item}
                  className={room === item ? "is-active" : ""}
                  type="button"
                  onClick={() => setRoom(item)}
                >
                  <span>{roomNames[item]}</span>
                  <small>{roomNotes[item]}</small>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {tab === "sound" ? (
          <section className="dashboard-panel dashboard-panel--sound">
            <p className="focus-app__eyebrow">SOUND</p>
            <h1>{roomNames[room]}</h1>

            <div className="sound-engine-controls">
              <button
                className={`sound-power ${soundEnabled ? "is-on" : ""}`}
                type="button"
                onClick={() => void enableSound()}
              >
                <i />
                {soundEnabled ? "Sound on" : "Enable sound"}
              </button>
              <button type="button" className="sound-mute" disabled={!soundEnabled} onClick={() => setMuted((value) => !value)}>
                {muted ? "Unmute" : "Mute"}
              </button>
            </div>

            <label className="dashboard-sound-row">
              <span>Master</span>
              <input type="range" min="0" max="100" value={masterVolume} onChange={(event) => setMasterVolume(Number(event.target.value))} />
              <b>{masterVolume}</b>
            </label>

            {controls.map((control) => (
              <label className="dashboard-sound-row" key={control.key}>
                <span>{control.label}<small>{layerMeta[control.key].kind === "procedural" ? "generated" : "audio file"}</small></span>
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
          </section>
        ) : null}

        {tab === "progress" ? (
          <section className="dashboard-panel dashboard-panel--progress">
            <p className="focus-app__eyebrow">PROGRESS</p>
            <h1>Your focus history.</h1>

            <div className="progress-summary">
              <div><strong>{summary.totalSessions}</strong><span>sessions</span></div>
              <div><strong>{totalHours}</strong><span>hours focused</span></div>
            </div>

            <div className="progress-session-list">
              {history.map((session) => (
                <article key={session.id}>
                  <div>
                    <strong>{session.intention || "Untitled focus session"}</strong>
                    <span>{displayRoom(session.room)}</span>
                  </div>
                  <div>
                    <b>{formatDuration(session.elapsedSeconds)}</b>
                    <small>{new Date(session.startedAt).toLocaleDateString()}</small>
                  </div>
                </article>
              ))}
              {!history.length && !historyError ? <p>No completed sessions yet.</p> : null}
              {historyError ? <p>{historyError}</p> : null}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
