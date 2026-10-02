import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AtmosphereLayer, FocusMark, type Room } from "../../components/AtmosphereLayer";
import { apiFetch } from "../../lib/api";
import { focusAudioEngine, roomAudioConfig, type LayerKey } from "../audio/FocusAudioEngine";
import {
  CustomMediaEmbed,
  CustomRoomBackdrop,
  customRoomThemes,
  mediaItemLabel,
  parseCustomMedia,
  type CustomRoomConfig,
} from "../custom-room/CustomRoomMedia";
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

type DashboardTab = "focus" | "sound" | "progress";
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
const CUSTOM_ROOM_KEY = "focusroom-custom-room";

const defaultCustomRoom: CustomRoomConfig = {
  name: "My Room",
  theme: "ember",
  queue: [],
};

type StoredSession = {
  room: Room;
  intention: string;
  plannedSeconds: number;
  remainingSeconds: number;
  startedAt: string | null;
  deadline?: number | null;
  runningSince?: number | null;
  controlA: number;
  controlB: number;
  controlC: number;
  customRoom?: CustomRoomConfig | null;
  customQueueIndex?: number;
};

function resolveRoom(value: string | null): Room {
  if (value === "night-train" || value === "orbital-lab" || value === "cozy-cafe") {
    return value;
  }
  return "rain-city";
}

function readCustomRoom(): CustomRoomConfig {
  try {
    const raw = window.localStorage.getItem(CUSTOM_ROOM_KEY);
    if (!raw) return defaultCustomRoom;

    const parsed = JSON.parse(raw) as Partial<CustomRoomConfig> & {
      provider?: "youtube" | "spotify" | "apple-music";
      sourceUrl?: string;
      embedUrl?: string;
    };

    const queue = Array.isArray(parsed.queue) ? parsed.queue : [];
    const legacyQueue =
      !queue.length && parsed.provider && parsed.sourceUrl && parsed.embedUrl
        ? [{
            id: "legacy-media",
            provider: parsed.provider,
            sourceUrl: parsed.sourceUrl,
            embedUrl: parsed.embedUrl,
            kind: "media",
          }]
        : queue;

    return {
      name:
        typeof parsed.name === "string" && parsed.name.trim()
          ? parsed.name.slice(0, 28)
          : defaultCustomRoom.name,
      theme: parsed.theme ?? defaultCustomRoom.theme,
      queue: legacyQueue,
    };
  } catch {
    return defaultCustomRoom;
  }
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
  if (value.startsWith("custom:")) {
    return value.slice("custom:".length) || "Custom Room";
  }
  return roomNames[resolveRoom(value)];
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
  const initialDeadline =
    saved?.deadline ??
    (saved?.runningSince ? Date.now() + Math.max(0, saved.remainingSeconds) * 1000 : null);

  const [tab, setTab] = useState<DashboardTab>("focus");
  const [setupStep, setSetupStep] = useState<SetupStep>("goal");
  const [inFocusView, setInFocusView] = useState(Boolean(saved?.startedAt));
  const [customBuilder, setCustomBuilder] = useState(false);
  const [previewRoom, setPreviewRoom] = useState<Room | "custom" | null>(null);

  const [room, setRoom] = useState<Room>(initialRoom);
  const [intention, setIntention] = useState(saved?.intention ?? "");
  const [plannedSeconds, setPlannedSeconds] = useState(saved?.plannedSeconds ?? 25 * 60);
  const [remainingSeconds, setRemainingSeconds] = useState(saved?.remainingSeconds ?? 25 * 60);
  const [startedAt, setStartedAt] = useState<string | null>(saved?.startedAt ?? null);
  const [deadline, setDeadline] = useState<number | null>(initialDeadline);
  const [activeCustomRoom, setActiveCustomRoom] = useState<CustomRoomConfig | null>(saved?.customRoom ?? null);

  const [customDraft, setCustomDraft] = useState<CustomRoomConfig>(() => saved?.customRoom ?? readCustomRoom());
  const [customMediaInput, setCustomMediaInput] = useState("");
  const [customMediaError, setCustomMediaError] = useState<string | null>(null);
  const [customPreviewIndex, setCustomPreviewIndex] = useState(0);
  const [customQueueIndex, setCustomQueueIndex] = useState(saved?.customQueueIndex ?? 0);
  const [customQueueOpen, setCustomQueueOpen] = useState(false);
  const [activeQueueInput, setActiveQueueInput] = useState("");

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

  const running = deadline !== null;
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
    if (!activeCustomRoom) focusAudioEngine.setRoom(room);
  }, [room, activeCustomRoom]);

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
    window.localStorage.setItem(CUSTOM_ROOM_KEY, JSON.stringify(customDraft));
  }, [customDraft]);

  useEffect(() => {
    const snapshot: StoredSession = {
      room,
      intention,
      plannedSeconds,
      remainingSeconds,
      startedAt,
      deadline,
      controlA,
      controlB,
      controlC,
      customRoom: activeCustomRoom,
      customQueueIndex,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }, [
    room,
    intention,
    plannedSeconds,
    remainingSeconds,
    startedAt,
    deadline,
    controlA,
    controlB,
    controlC,
    activeCustomRoom,
    customQueueIndex,
  ]);

  useEffect(() => {
    if (deadline === null) return;

    const tick = () => {
      const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemainingSeconds(next);
      if (next <= 0) setDeadline(null);
    };

    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [deadline]);

  const enableSound = async () => {
    try {
      await focusAudioEngine.enable();
      focusAudioEngine.setRoom(room);
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
    setActiveCustomRoom(null);
    setCustomBuilder(false);
    const now = new Date().toISOString();
    setStartedAt(now);
    setRemainingSeconds(plannedSeconds);
    setDeadline(Date.now() + plannedSeconds * 1000);
    setInFocusView(true);

    try {
      await focusAudioEngine.enable();
      focusAudioEngine.setRoom(selectedRoom);
      focusAudioEngine.setLayerVolumes(controlA, controlB, controlC);
      focusAudioEngine.setMasterVolume(masterVolume);
      focusAudioEngine.setMuted(muted);
      setSoundEnabled(true);
    } catch {
      // The focus session can still run silently.
    }
  };

  const beginCustomSession = () => {
    if (!customDraft.queue.length) {
      setCustomMediaError("Add at least one video, track, album or playlist.");
      return;
    }

    const roomConfig = {
      ...customDraft,
      name: customDraft.name.trim().slice(0, 28) || "My Room",
    };

    focusAudioEngine.destroy();
    setSoundEnabled(false);
    setCustomQueueIndex(Math.min(customPreviewIndex, roomConfig.queue.length - 1));
    setActiveCustomRoom(roomConfig);
    setCustomDraft(roomConfig);
    setCustomBuilder(false);

    const now = new Date().toISOString();
    setStartedAt(now);
    setRemainingSeconds(plannedSeconds);
    setDeadline(Date.now() + plannedSeconds * 1000);
    setInFocusView(true);
  };

  const pauseOrResume = () => {
    if (deadline !== null) {
      const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemainingSeconds(next);
      setDeadline(null);
      return;
    }

    if (!startedAt || remainingSeconds <= 0) return;
    setDeadline(Date.now() + remainingSeconds * 1000);
  };

  const endAndSave = async () => {
    if (!startedAt || saving) return;

    if (deadline !== null) {
      setRemainingSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    }
    setDeadline(null);
    setSaving(true);

    const endedAt = new Date().toISOString();
    const currentRemaining =
      deadline !== null ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : remainingSeconds;
    const elapsed = Math.max(1, plannedSeconds - currentRemaining);

    try {
      await apiFetch("/sessions", {
        method: "POST",
        body: JSON.stringify({
          intention,
          room: activeCustomRoom ? `custom:${activeCustomRoom.name}` : room,
          plannedSeconds,
          elapsedSeconds: elapsed,
          ambienceA: activeCustomRoom ? 0 : controlA,
          ambienceB: activeCustomRoom ? 0 : controlB,
          ambienceC: activeCustomRoom ? 0 : controlC,
          startedAt,
          endedAt,
        }),
      });

      setStartedAt(null);
      setRemainingSeconds(plannedSeconds);
      setActiveCustomRoom(null);
      setCustomQueueIndex(0);
      setCustomQueueOpen(false);
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

  const addCustomMedia = () => {
    const result = parseCustomMedia(customMediaInput);

    if ("error" in result) {
      setCustomMediaError(result.error);
      return;
    }

    if (customDraft.queue.some((item) => item.sourceUrl === result.item.sourceUrl)) {
      setCustomMediaError("That item is already in this room.");
      return;
    }

    setCustomMediaError(null);
    setCustomDraft((current) => ({
      ...current,
      queue: [...current.queue, result.item],
    }));
    setCustomPreviewIndex(customDraft.queue.length);
    setCustomMediaInput("");
  };

  const removeCustomMedia = (index: number) => {
    setCustomDraft((current) => ({
      ...current,
      queue: current.queue.filter((_, itemIndex) => itemIndex !== index),
    }));
    setCustomPreviewIndex((current) => Math.max(0, Math.min(current, customDraft.queue.length - 2)));
  };

  const moveCustomMedia = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= customDraft.queue.length) return;

    setCustomDraft((current) => {
      const queue = [...current.queue];
      [queue[index], queue[target]] = [queue[target], queue[index]];
      return { ...current, queue };
    });

    setCustomPreviewIndex((current) => {
      if (current === index) return target;
      if (current === target) return index;
      return current;
    });
  };

  const addActiveQueueItem = () => {
    if (!activeCustomRoom) return;
    const result = parseCustomMedia(activeQueueInput);

    if ("error" in result) {
      setCustomMediaError(result.error);
      return;
    }

    if (activeCustomRoom.queue.some((item) => item.sourceUrl === result.item.sourceUrl)) {
      setCustomMediaError("That item is already in the queue.");
      return;
    }

    const updated = {
      ...activeCustomRoom,
      queue: [...activeCustomRoom.queue, result.item],
    };

    setActiveCustomRoom(updated);
    setCustomDraft(updated);
    setCustomMediaError(null);
    setActiveQueueInput("");
  };

  const goToCustomQueueItem = (nextIndex: number) => {
    if (!activeCustomRoom?.queue.length) return;
    const length = activeCustomRoom.queue.length;
    setCustomQueueIndex(((nextIndex % length) + length) % length);
  };

  const nextCustomMedia = () => goToCustomQueueItem(customQueueIndex + 1);
  const previousCustomMedia = () => goToCustomQueueItem(customQueueIndex - 1);

  const totalHours = (summary.totalSeconds / 3600).toFixed(summary.totalSeconds >= 36000 ? 0 : 1);
  const backgroundRoom = previewRoom && previewRoom !== "custom" ? previewRoom : room;
  const showCustomBackdrop = customBuilder || previewRoom === "custom" || Boolean(activeCustomRoom);
  const customTheme = activeCustomRoom?.theme ?? customDraft.theme;
  const customPreviewItem = customDraft.queue[customPreviewIndex] ?? customDraft.queue[0] ?? null;
  const currentCustomItem = activeCustomRoom
    ? activeCustomRoom.queue[Math.min(customQueueIndex, Math.max(0, activeCustomRoom.queue.length - 1))] ?? null
    : null;

  if (inFocusView && active) {
    if (activeCustomRoom) {
      return (
        <main className={`focus-state focus-state--custom custom-shell--${activeCustomRoom.theme}`}>
          <CustomRoomBackdrop theme={activeCustomRoom.theme} roomName={activeCustomRoom.name} />

          <button className="focus-state__back" type="button" onClick={() => setInFocusView(false)}>
            ← Back
          </button>

          <section className="custom-focus">
            <div className="custom-focus__session">
              <div className="custom-focus__heading">
                <span>{activeCustomRoom.name}</span>
                <p>{intention || "Focus session"}</p>
              </div>

              <div className="focus-state__timer custom-focus__timer" style={{ "--progress": progress } as React.CSSProperties}>
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
                  {running ? "Stop" : "Resume"}
                </button>
                <button className="focus-state__end" type="button" onClick={() => void endAndSave()} disabled={saving}>
                  {saving ? "Saving…" : "End"}
                </button>
              </div>
            </div>

            <div className="custom-focus__media">
              <div className="custom-focus__media-head">
                <span>{currentCustomItem ? mediaItemLabel(currentCustomItem) : "Queue"}</span>
                <small>{activeCustomRoom.queue.length} item{activeCustomRoom.queue.length === 1 ? "" : "s"}</small>
              </div>

              {currentCustomItem ? (
                <CustomMediaEmbed
                  key={currentCustomItem.id}
                  item={currentCustomItem}
                  roomName={activeCustomRoom.name}
                  onEnded={activeCustomRoom.queue.length > 1 ? nextCustomMedia : undefined}
                />
              ) : null}

              <div className="custom-transport">
                <button type="button" onClick={previousCustomMedia} disabled={activeCustomRoom.queue.length < 2} aria-label="Previous media">
                  ←
                </button>
                <span>{customQueueIndex + 1} / {activeCustomRoom.queue.length}</span>
                <button type="button" onClick={nextCustomMedia} disabled={activeCustomRoom.queue.length < 2} aria-label="Next media">
                  →
                </button>
                <button className="custom-transport__queue" type="button" onClick={() => setCustomQueueOpen((value) => !value)}>
                  Queue
                </button>
              </div>

              {customQueueOpen ? (
                <div className="custom-focus-queue">
                  <div className="custom-focus-queue__list">
                    {activeCustomRoom.queue.map((item, index) => (
                      <button
                        key={item.id}
                        type="button"
                        className={index === customQueueIndex ? "is-active" : ""}
                        onClick={() => setCustomQueueIndex(index)}
                      >
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <b>{mediaItemLabel(item)}</b>
                      </button>
                    ))}
                  </div>
                  <div className="custom-focus-queue__add">
                    <input
                      type="url"
                      value={activeQueueInput}
                      onChange={(event) => setActiveQueueInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && activeQueueInput.trim()) addActiveQueueItem();
                      }}
                      placeholder="Add another media link"
                    />
                    <button type="button" onClick={addActiveQueueItem} disabled={!activeQueueInput.trim()}>
                      Add
                    </button>
                  </div>
                  {customMediaError ? <small className="custom-focus-queue__error">{customMediaError}</small> : null}
                  <p className="custom-focus-queue__hint">
                    YouTube videos advance automatically through this queue. Spotify and Apple Music playlists/albums continue inside their own players; for separate cross-provider items, use previous/next.
                  </p>
                </div>
              ) : null}
            </div>
          </section>
        </main>
      );
    }

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
              {running ? "Stop" : "Resume"}
            </button>
            <button className="focus-state__end" type="button" onClick={() => void endAndSave()} disabled={saving}>
              {saving ? "Saving…" : "End"}
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
    <main className={`focus-dashboard landing-alive--${backgroundRoom} ${showCustomBackdrop ? `focus-dashboard--custom-preview custom-shell--${customTheme}` : ""}`}>
      {showCustomBackdrop ? (
        <CustomRoomBackdrop
          theme={customTheme}
          roomName={activeCustomRoom?.name ?? (customDraft.name.trim() || "My Room")}
        />
      ) : (
        <AtmosphereLayer
          room={backgroundRoom}
          rainIntensity={backgroundRoom === "rain-city" ? controlA / 100 : 0}
        />
      )}

      <header className="focus-dashboard__topbar">
        <Link className="focus-dashboard__brand" to="/">
          <FocusMark />
          <span>FOCUSROOM</span>
        </Link>

        <nav className="focus-dashboard__tabs" aria-label="Workspace">
          <button
            type="button"
            className={tab === "focus" ? "is-active" : ""}
            onClick={() => {
              setCustomBuilder(false);
              setTab("focus");
            }}
          >
            Focus
          </button>

          {active ? (
            <button
              type="button"
              onClick={() => {
                setCustomBuilder(false);
                setInFocusView(true);
              }}
            >
              My current space
            </button>
          ) : null}

          <button
            type="button"
            className={tab === "sound" ? "is-active" : ""}
            onClick={() => {
              setCustomBuilder(false);
              setTab("sound");
            }}
          >
            Sound
          </button>

          <button
            type="button"
            className={tab === "progress" ? "is-active" : ""}
            onClick={() => {
              setCustomBuilder(false);
              setTab("progress");
            }}
          >
            Progress
          </button>
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
                <span className="focus-setup__active-space">
                  {activeCustomRoom ? activeCustomRoom.name : roomNames[room]}
                </span>
                <button type="button" onClick={() => setInFocusView(true)}>Return to focus</button>
              </div>
            ) : customBuilder ? (
              <div className="custom-builder custom-builder--live">
                <button className="custom-builder__back" type="button" onClick={() => setCustomBuilder(false)}>
                  ← Choose another room
                </button>

                <div className="custom-builder__copy">
                  <p className="custom-builder__kicker">CUSTOM ROOM</p>
                  <h1>Build the room<br />around your media.</h1>
                  <p className="custom-builder__intro">
                    Build a queue from YouTube, Spotify and Apple Music. Playlists and albums continue inside their own player; individual sources can be moved through with FocusRoom's queue controls.
                  </p>
                </div>

                <div className="custom-builder__layout">
                  <div className="custom-builder__form">
                    <label className="custom-field">
                      <span>Room name</span>
                      <input
                        type="text"
                        maxLength={28}
                        value={customDraft.name}
                        onChange={(event) => setCustomDraft((current) => ({ ...current, name: event.target.value }))}
                        placeholder="My night room"
                      />
                    </label>

                    <div className="custom-field custom-field--queue-add">
                      <span>Add media</span>
                      <div>
                        <input
                          type="url"
                          value={customMediaInput}
                          onChange={(event) => {
                            setCustomMediaInput(event.target.value);
                            if (customMediaError) setCustomMediaError(null);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" && customMediaInput.trim()) addCustomMedia();
                          }}
                          placeholder="YouTube, Spotify or Apple Music link"
                        />
                        <button type="button" onClick={addCustomMedia} disabled={!customMediaInput.trim()}>
                          Add
                        </button>
                      </div>
                      {customMediaError ? (
                        <small className="custom-field__error">{customMediaError}</small>
                      ) : (
                        <small>Mix providers, add playlists, albums, videos or individual tracks.</small>
                      )}
                    </div>

                    <div className="custom-queue-editor">
                      <div className="custom-queue-editor__head">
                        <span>QUEUE</span>
                        <b>{customDraft.queue.length}</b>
                      </div>
                      {customDraft.queue.length ? (
                        <div className="custom-queue-editor__list">
                          {customDraft.queue.map((item, index) => (
                            <div className={index === customPreviewIndex ? "is-active" : ""} key={item.id}>
                              <button type="button" onClick={() => setCustomPreviewIndex(index)}>
                                <span>{String(index + 1).padStart(2, "0")}</span>
                                <b>{mediaItemLabel(item)}</b>
                              </button>
                              <div>
                                <button type="button" onClick={() => moveCustomMedia(index, -1)} disabled={index === 0} aria-label="Move up">↑</button>
                                <button type="button" onClick={() => moveCustomMedia(index, 1)} disabled={index === customDraft.queue.length - 1} aria-label="Move down">↓</button>
                                <button type="button" onClick={() => removeCustomMedia(index)} aria-label="Remove">×</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p>Your queue is empty.</p>
                      )}
                    </div>

                    <div className="custom-theme-picker">
                      <span>Room color</span>
                      <div>
                        {customRoomThemes.map((theme) => (
                          <button
                            key={theme.id}
                            type="button"
                            className={customDraft.theme === theme.id ? "is-active" : ""}
                            data-theme={theme.id}
                            onClick={() => setCustomDraft((current) => ({ ...current, theme: theme.id }))}
                          >
                            <i />
                            <strong>{theme.label}</strong>
                            <small>{theme.note}</small>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="custom-builder__meta">
                      <span>Saved automatically on this device</span>
                      <span>{customDraft.queue.length ? `${customDraft.queue.length} queued` : "No media yet"}</span>
                    </div>

                    <button
                      className="custom-builder__start"
                      type="button"
                      disabled={!customDraft.queue.length}
                      onClick={beginCustomSession}
                    >
                      Start in {customDraft.name.trim() || "My Room"} →
                    </button>
                  </div>

                  <div className="custom-builder__preview">
                    <div className="custom-builder__preview-head">
                      <span>LIVE PREVIEW</span>
                      <b>{customDraft.name.trim() || "My Room"}</b>
                    </div>
                    {customPreviewItem ? (
                      <CustomMediaEmbed
                        key={customPreviewItem.id}
                        item={customPreviewItem}
                        roomName={customDraft.name.trim() || "My Room"}
                        compact
                      />
                    ) : (
                      <div className="custom-media-placeholder">
                        <FocusMark />
                        <span>Your media appears here</span>
                        <small>YouTube · Spotify · Apple Music</small>
                      </div>
                    )}
                  </div>
                </div>
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
                          onMouseEnter={() => setPreviewRoom(item)}
                          onMouseLeave={() => setPreviewRoom(null)}
                          onFocus={() => setPreviewRoom(item)}
                          onBlur={() => setPreviewRoom(null)}
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
                        onMouseEnter={() => setPreviewRoom("custom")}
                        onMouseLeave={() => setPreviewRoom(null)}
                        onFocus={() => setPreviewRoom("custom")}
                        onBlur={() => setPreviewRoom(null)}
                        onClick={() => {
                          setPreviewRoom(null);
                          setCustomBuilder(true);
                        }}
                      >
                        <span>your media / your colors / your room</span>
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

        {tab === "sound" ? (
          activeCustomRoom ? (
            <section className="dashboard-panel dashboard-panel--sound custom-sound-panel">
              <p className="focus-app__eyebrow">SOUND</p>
              <h1>{activeCustomRoom.name}</h1>
              <p>Your room has {activeCustomRoom.queue.length} queued source{activeCustomRoom.queue.length === 1 ? "" : "s"}.</p>
              {currentCustomItem ? (
                <div className="custom-sound-panel__player">
                  <CustomMediaEmbed
                    key={currentCustomItem.id}
                    item={currentCustomItem}
                    roomName={activeCustomRoom.name}
                    compact
                  />
                </div>
              ) : null}
            </section>
          ) : (
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
                  <span>{control.label}<small>audio file</small></span>
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
          )
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
