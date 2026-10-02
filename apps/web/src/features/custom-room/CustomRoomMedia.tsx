export type CustomRoomProvider = "youtube" | "spotify" | "apple-music";
export type CustomRoomTheme = "ember" | "moss" | "paper" | "plum";

export type CustomRoomConfig = {
  name: string;
  provider: CustomRoomProvider;
  sourceUrl: string;
  embedUrl: string;
  theme: CustomRoomTheme;
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
    return `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(playlistId)}&playsinline=1&loop=1`;
  }

  if (!videoId) return null;

  const params = new URLSearchParams({
    playsinline: "1",
    loop: "1",
    playlist: videoId,
  });

  if (playlistId) params.set("list", playlistId);

  return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
}

function parseSpotify(url: URL) {
  const parts = url.pathname.split("/").filter(Boolean);
  const intlIndex = parts[0]?.startsWith("intl-") ? 1 : 0;
  const type = parts[intlIndex];
  const id = parts[intlIndex + 1];

  if (!type || !id) return null;

  const supported = new Set(["track", "album", "playlist", "artist", "show", "episode"]);
  if (!supported.has(type)) return null;

  return `https://open.spotify.com/embed/${type}/${encodeURIComponent(id)}?utm_source=generator`;
}

function parseAppleMusic(url: URL) {
  const allowed = url.hostname === "music.apple.com" || url.hostname === "embed.music.apple.com";
  if (!allowed) return null;

  const embed = new URL(url.toString());
  embed.hostname = "embed.music.apple.com";
  embed.protocol = "https:";
  return embed.toString();
}

export function parseCustomMedia(value: string):
  | { provider: CustomRoomProvider; embedUrl: string; sourceUrl: string }
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

  if (host === "youtube.com" || host === "music.youtube.com" || host === "youtu.be") {
    const embedUrl = parseYouTube(url);
    if (!embedUrl) return { error: "I could not read that YouTube video or playlist." };
    return { provider: "youtube", embedUrl, sourceUrl: url.toString() };
  }

  if (host === "open.spotify.com") {
    const embedUrl = parseSpotify(url);
    if (!embedUrl) return { error: "Use a Spotify track, album, artist, show, episode or playlist link." };
    return { provider: "spotify", embedUrl, sourceUrl: url.toString() };
  }

  if (host === "music.apple.com" || host === "embed.music.apple.com") {
    const embedUrl = parseAppleMusic(url);
    if (!embedUrl) return { error: "I could not read that Apple Music link." };
    return { provider: "apple-music", embedUrl, sourceUrl: url.toString() };
  }

  return { error: "Use a link from YouTube, Spotify or Apple Music." };
}

export function providerLabel(provider: CustomRoomProvider) {
  if (provider === "apple-music") return "Apple Music";
  if (provider === "youtube") return "YouTube";
  return "Spotify";
}

export function CustomMediaEmbed({
  config,
  compact = false,
}: {
  config: CustomRoomConfig;
  compact?: boolean;
}) {
  if (config.provider === "youtube") {
    return (
      <iframe
        className={`custom-media custom-media--youtube ${compact ? "is-compact" : ""}`}
        src={config.embedUrl}
        title={`${config.name} · YouTube`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    );
  }

  if (config.provider === "spotify") {
    return (
      <iframe
        className={`custom-media custom-media--spotify ${compact ? "is-compact" : ""}`}
        src={config.embedUrl}
        title={`${config.name} · Spotify`}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      />
    );
  }

  return (
    <iframe
      className={`custom-media custom-media--apple ${compact ? "is-compact" : ""}`}
      src={config.embedUrl}
      title={`${config.name} · Apple Music`}
      allow="autoplay *; encrypted-media *; fullscreen *"
      sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation"
      loading="lazy"
    />
  );
}

export function CustomRoomBackdrop({
  theme,
}: {
  theme: CustomRoomTheme;
}) {
  return (
    <div className={`custom-room-backdrop custom-room-theme--${theme}`} aria-hidden="true">
      <div className="custom-room-backdrop__wash" />
      <i className="custom-room-backdrop__shape custom-room-backdrop__shape--one" />
      <i className="custom-room-backdrop__shape custom-room-backdrop__shape--two" />
      <i className="custom-room-backdrop__shape custom-room-backdrop__shape--three" />
      <i className="custom-room-backdrop__sweep" />
      <span>YOUR SPACE</span>
    </div>
  );
}
