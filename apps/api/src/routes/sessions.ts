import { Hono } from "hono";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/require-auth";
import type { AppEnv } from "../types/app";

export const sessionRoutes = new Hono<AppEnv>();

sessionRoutes.use("*", requireAuth);

const MAX_SESSION_SECONDS = 24 * 60 * 60;

function clamp(value: unknown, fallback: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function safeTimeZone(value: string | undefined) {
  if (!value) return "UTC";

  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format(new Date());
    return value;
  } catch {
    return "UTC";
  }
}

function dateKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

function keyDate(key: string) {
  return new Date(`${key}T00:00:00.000Z`);
}

function shiftKey(key: string, days: number) {
  const date = keyDate(key);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function ordinal(key: string) {
  return Math.floor(keyDate(key).getTime() / 86_400_000);
}

function completedSession(session: {
  completed: boolean | null;
  elapsedSeconds: number;
  plannedSeconds: number;
}) {
  return session.completed ?? session.elapsedSeconds >= session.plannedSeconds;
}

sessionRoutes.get("/progress", async (c) => {
  const user = c.get("user");
  const timeZone = safeTimeZone(c.req.query("timeZone"));

  const sessions = await prisma.focusSession.findMany({
    where: { profileId: user.id },
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      intention: true,
      room: true,
      plannedSeconds: true,
      initialPlannedSeconds: true,
      elapsedSeconds: true,
      completed: true,
      ambienceA: true,
      ambienceB: true,
      ambienceC: true,
      startedAt: true,
      endedAt: true,
    },
  });

  const today = dateKey(new Date(), timeZone);
  const todayDate = keyDate(today);
  const weekday = todayDate.getUTCDay();
  const weekStart = shiftKey(today, -((weekday + 6) % 7));
  const monthPrefix = today.slice(0, 7);

  const dailySeconds = new Map<string, number>();
  const roomSeconds = new Map<string, number>();
  let totalSeconds = 0;
  let completedCount = 0;

  for (const session of sessions) {
    const key = dateKey(session.startedAt, timeZone);
    dailySeconds.set(key, (dailySeconds.get(key) ?? 0) + session.elapsedSeconds);
    roomSeconds.set(session.room, (roomSeconds.get(session.room) ?? 0) + session.elapsedSeconds);
    totalSeconds += session.elapsedSeconds;
    if (completedSession(session)) completedCount += 1;
  }

  const activeDays = [...dailySeconds.keys()]
    .filter((key) => (dailySeconds.get(key) ?? 0) > 0)
    .sort();

  let bestStreak = 0;
  let streakRun = 0;
  let previousOrdinal: number | null = null;

  for (const key of activeDays) {
    const currentOrdinal = ordinal(key);
    streakRun =
      previousOrdinal !== null && currentOrdinal === previousOrdinal + 1
        ? streakRun + 1
        : 1;
    bestStreak = Math.max(bestStreak, streakRun);
    previousOrdinal = currentOrdinal;
  }

  const activeSet = new Set(activeDays);
  let currentStreak = 0;
  let streakCursor = activeSet.has(today) ? today : shiftKey(today, -1);

  while (activeSet.has(streakCursor)) {
    currentStreak += 1;
    streakCursor = shiftKey(streakCursor, -1);
  }

  const weekly = Array.from({ length: 7 }, (_, index) => {
    const key = shiftKey(today, index - 6);
    return { date: key, seconds: dailySeconds.get(key) ?? 0 };
  });

  const heatmap = Array.from({ length: 91 }, (_, index) => {
    const key = shiftKey(today, index - 90);
    return { date: key, seconds: dailySeconds.get(key) ?? 0 };
  });

  const thisWeekSeconds = [...dailySeconds.entries()].reduce(
    (sum, [key, seconds]) => sum + (key >= weekStart && key <= today ? seconds : 0),
    0,
  );

  const thisMonthSeconds = [...dailySeconds.entries()].reduce(
    (sum, [key, seconds]) => sum + (key.startsWith(monthPrefix) ? seconds : 0),
    0,
  );

  return c.json({
    generatedAt: new Date().toISOString(),
    timeZone,
    summary: {
      totalSessions: sessions.length,
      totalSeconds,
      todaySeconds: dailySeconds.get(today) ?? 0,
      thisWeekSeconds,
      thisMonthSeconds,
      averageSeconds: sessions.length ? Math.round(totalSeconds / sessions.length) : 0,
      completionRate: sessions.length
        ? Math.round((completedCount / sessions.length) * 1000) / 10
        : 0,
      currentStreak,
      bestStreak,
    },
    weekly,
    heatmap,
    rooms: [...roomSeconds.entries()]
      .map(([room, seconds]) => ({ room, seconds }))
      .sort((a, b) => b.seconds - a.seconds),
    recentSessions: sessions.slice(0, 30),
  });
});

sessionRoutes.get("/", async (c) => {
  const user = c.get("user");

  const sessions = await prisma.focusSession.findMany({
    where: { profileId: user.id },
    orderBy: { startedAt: "desc" },
    take: 30,
  });

  const totals = await prisma.focusSession.aggregate({
    where: { profileId: user.id },
    _sum: { elapsedSeconds: true },
    _count: { _all: true },
  });

  return c.json({
    sessions,
    summary: {
      totalSessions: totals._count._all,
      totalSeconds: totals._sum.elapsedSeconds ?? 0,
    },
  });
});

sessionRoutes.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json<{
    intention?: string | null;
    room?: string;
    plannedSeconds?: number;
    initialPlannedSeconds?: number;
    elapsedSeconds?: number;
    completed?: boolean;
    ambienceA?: number;
    ambienceB?: number;
    ambienceC?: number;
    startedAt?: string;
    endedAt?: string;
  }>();

  const room = typeof body.room === "string" ? body.room : "rain-city";
  const plannedSeconds = Math.round(Number(body.plannedSeconds));
  const initialPlannedSeconds = Math.round(
    Number(body.initialPlannedSeconds ?? body.plannedSeconds),
  );
  const elapsedSeconds = Math.round(Number(body.elapsedSeconds));
  const startedAt = body.startedAt ? new Date(body.startedAt) : null;
  const endedAt = body.endedAt ? new Date(body.endedAt) : null;

  if (
    !Number.isFinite(plannedSeconds) ||
    plannedSeconds < 60 ||
    plannedSeconds > MAX_SESSION_SECONDS ||
    !Number.isFinite(initialPlannedSeconds) ||
    initialPlannedSeconds < 60 ||
    initialPlannedSeconds > plannedSeconds ||
    !Number.isFinite(elapsedSeconds) ||
    elapsedSeconds < 0 ||
    elapsedSeconds > plannedSeconds ||
    !startedAt ||
    Number.isNaN(startedAt.getTime()) ||
    !endedAt ||
    Number.isNaN(endedAt.getTime()) ||
    endedAt.getTime() < startedAt.getTime()
  ) {
    return c.json({ error: "Invalid focus session payload." }, 400);
  }

  await prisma.profile.upsert({
    where: { id: user.id },
    update: {},
    create: { id: user.id },
  });

  const session = await prisma.focusSession.create({
    data: {
      profileId: user.id,
      intention:
        typeof body.intention === "string" && body.intention.trim()
          ? body.intention.trim().slice(0, 180)
          : null,
      room: room.slice(0, 40),
      plannedSeconds,
      initialPlannedSeconds,
      elapsedSeconds,
      completed: typeof body.completed === "boolean" ? body.completed : null,
      ambienceA: clamp(body.ambienceA, 70),
      ambienceB: clamp(body.ambienceB, 45),
      ambienceC: clamp(body.ambienceC, 55),
      startedAt,
      endedAt,
    },
  });

  return c.json({ session }, 201);
});
