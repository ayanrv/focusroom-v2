import { useEffect, useRef } from "react";

export type CustomRoomProvider = "youtube" | "spotify" | "apple-music";
export type CustomRoomTheme = "ember" | "moss" | "paper" | "plum";

export type CustomMediaItem = {
  id: string;
  provider: CustomRoomProvider;
  sourceUrl: string;
  embedUrl: string;
  kind: string;
};

export type CustomRoomConfig = {
  name: string;
  theme: CustomRoomTheme;
  queue: CustomMediaItem[];
};

export const customRoomThemes: Array<{
  id: CustomRoomTheme;
  label: string;
  note: string;
}> = [
  { id: "ember", label: "Ember", note: "oxblood / copper / smoke" },
  { id: "moss", label: "Moss", note: "olive / acid / charcoal" },
  { id: "paper", label: "Paper", note: "ivory / graphite / warm light" },
  { id: "plum", label: "Plum", note: "aubergine / coral / ink" },
];

let youtubeReadyPromise: Promise<void> | null = null;

type YouTubePlayer = {
  destroy: () => void;
};

type YouTubePlayerApi = {
  Player: new (
    element: HTMLIFrameElement,
    options: {
      events?: {
        onStateChange?: (event: { data: number }) => void;
      };
    },
  ) => YouTubePlayer;
  PlayerState?: {
    ENDED?: number;
  };
};

declare global {
  interface Window {
    YT?: YouTubePlayerApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve();
  if (youtubeReadyPromise) return youtubeReadyPromise;

  youtubeReadyPromise = new Promise<void>((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.appendChild(script);
    }
  });

  return youtubeReadyPromise;
}

function makeId() {
  if ("randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function extractIframeSrc(value: string) {
  const match = value.match(/src=["']([^"']+)["']/i);
  return match?.[1] ?? value.trim();
}

function parseYouTube(url: URL) {
  let videoId = "";
  let playlistId = url.searchParams.get("list") ?? "";

  if (url.hostname === "youtu.be") {
    videoId = url.pathname.split("/").filter(Boolean)[0] ?? "";
  } else if (url.pathname.startsWith("/shorts/")) {
    videoId = url.pathname.split("/")[2] ?? "";
  } else if (url.pathname.startsWith("/embed/")) {
    const id = url.pathname.split("/")[2] ?? "";
    if (id === "videoseries") {
      playlistId = url.searchParams.get("list") ?? playlistId;
    } else {
      videoId = id;
    }
  } else {
    videoId = url.searchParams.get("v") ?? "";
  }

  if (playlistId && !videoId) {
    return {
      embedUrl: `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(playlistId)}&playsinline=1&loop=1&enablejsapi=1`,
      kind: "playlist",
    };
  }

  if (!videoId) return null;

  const params = new URLSearchParams({
    playsinline: "1",
    loop: "1",
    playlist: videoId,
    enablejsapi: "1",
  });

  if (playlistId) params.set("list", playlistId);

  return {
    embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`,
    kind: playlistId ? "playlist" : "video",
  };
}

function parseSpotify(url: URL) {
  const parts = url.pathname.split("/").filter(Boolean);
  const intlIndex = parts[0]?.startsWith("intl-") ? 1 : 0;
  const type = parts[intlIndex];
  const id = parts[intlIndex + 1];

  if (!type || !id) return null;

  const supported = new Set(["track", "album", "playlist", "artist", "show", "episode"]);
  if (!supported.has(type)) return null;

  return {
    embedUrl: `https://open.spotify.com/embed/${type}/${encodeURIComponent(id)}?utm_source=generator`,
    kind: type,
  };
}

function parseAppleMusic(url: URL) {
  const allowed = url.hostname === "music.apple.com" || url.hostname === "embed.music.apple.com";
  if (!allowed) return null;

  const embed = new URL(url.toString());
  embed.hostname = "embed.music.apple.com";
  embed.protocol = "https:";

  const path = embed.pathname.toLowerCase();
  const kind =
    path.includes("/playlist/") ? "playlist" :
    path.includes("/album/") ? "album" :
    path.includes("/music-video/") ? "video" :
    "music";

  return { embedUrl: embed.toString(), kind };
}

export function parseCustomMedia(value: string):
  | { item: CustomMediaItem }
  | { error: string } {
  const raw = extractIframeSrc(value);

  if (!raw) {
    return { error: "Paste a YouTube, Spotify or Apple Music link." };
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { error: "That does not look like a valid media link." };
  }

  const host = url.hostname.replace(/^www\./, "");
  let parsed: { embedUrl: string; kind: string } | null = null;
  let provider: CustomRoomProvider | null = null;

  if (host === "youtube.com" || host === "music.youtube.com" || host === "youtu.be") {
    parsed = parseYouTube(url);
    provider = "youtube";
    if (!parsed) return { error: "I could not read that YouTube video or playlist." };
  } else if (host === "open.spotify.com") {
    parsed = parseSpotify(url);
    provider = "spotify";
    if (!parsed) return { error: "Use a Spotify track, album, artist, show, episode or playlist link." };
  } else if (host === "music.apple.com" || host === "embed.music.apple.com") {
    parsed = parseAppleMusic(url);
    provider = "apple-music";
    if (!parsed) return { error: "I could not read that Apple Music link." };
  } else {
    return { error: "Use a link from YouTube, Spotify or Apple Music." };
  }

  return {
    item: {
      id: makeId(),
      provider,
      sourceUrl: url.toString(),
      embedUrl: parsed.embedUrl,
      kind: parsed.kind,
    },
  };
}

export function providerLabel(provider: CustomRoomProvider) {
  if (provider === "apple-music") return "Apple Music";
  if (provider === "youtube") return "YouTube";
  return "Spotify";
}

export function mediaItemLabel(item: CustomMediaItem) {
  const kind = item.kind.replace("-", " ");
  return `${providerLabel(item.provider)} · ${kind}`;
}

function YouTubeEmbed({
  item,
  roomName,
  compact,
  onEnded,
}: {
  item: CustomMediaItem;
  roomName: string;
  compact: boolean;
  onEnded?: () => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!onEnded || item.kind === "playlist") return;
    let player: YouTubePlayer | null = null;
    let cancelled = false;

    void loadYouTubeApi().then(() => {
      if (cancelled || !iframeRef.current || !window.YT?.Player) return;

      player = new window.YT.Player(iframeRef.current, {
        events: {
          onStateChange: (event) => {
            const ended = window.YT?.PlayerState?.ENDED ?? 0;
            if (event.data === ended) onEnded();
          },
        },
      });
    });

    return () => {
      cancelled = true;
      try {
        player?.destroy();
      } catch {
        // The provider may already have disposed the player.
      }
    };
  }, [item.id, item.kind, onEnded]);

  const mediaUrl = new URL(item.embedUrl);
  if (!compact) mediaUrl.searchParams.set("autoplay", "1");
  if (onEnded && item.kind !== "playlist") mediaUrl.searchParams.set("loop", "0");

  return (
    <iframe
      ref={iframeRef}
      className={`custom-media custom-media--youtube ${compact ? "is-compact" : ""}`}
      src={mediaUrl.toString()}
      title={`${roomName} · YouTube`}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
    />
  );
}

export function CustomMediaEmbed({
  item,
  roomName,
  compact = false,
  onEnded,
}: {
  item: CustomMediaItem;
  roomName: string;
  compact?: boolean;
  onEnded?: () => void;
}) {
  if (item.provider === "youtube") {
    return (
      <YouTubeEmbed
        item={item}
        roomName={roomName}
        compact={compact}
        onEnded={onEnded}
      />
    );
  }

  if (item.provider === "spotify") {
    return (
      <iframe
        className={`custom-media custom-media--spotify ${compact ? "is-compact" : ""}`}
        src={item.embedUrl}
        title={`${roomName} · Spotify`}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      />
    );
  }

  return (
    <iframe
      className={`custom-media custom-media--apple ${compact ? "is-compact" : ""}`}
      src={item.embedUrl}
      title={`${roomName} · Apple Music`}
      allow="autoplay *; encrypted-media *; fullscreen *"
      sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation"
      loading="lazy"
    />
  );
}

export function CustomRoomBackdrop({
  theme,
  roomName,
}: {
  theme: CustomRoomTheme;
  roomName: string;
}) {
  return (
    <div className={`custom-room-backdrop custom-room-theme--${theme}`} aria-hidden="true">
      <div className="custom-room-backdrop__wash" />
      <i className="custom-room-backdrop__shape custom-room-backdrop__shape--one" />
      <i className="custom-room-backdrop__shape custom-room-backdrop__shape--two" />
      <i className="custom-room-backdrop__shape custom-room-backdrop__shape--three" />
      <i className="custom-room-backdrop__sweep" />
      <span>{roomName || "MY ROOM"}</span>
    </div>
  );
}
