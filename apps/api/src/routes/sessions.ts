import { Hono } from "hono";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/require-auth";
import type { AppEnv } from "../types/app";

export const sessionRoutes = new Hono<AppEnv>();

sessionRoutes.use("*", requireAuth);

sessionRoutes.get("/", async (c) => {
  const user = c.get("user");

  const sessions = await prisma.focusSession.findMany({
    where: { profileId: user.id },
    orderBy: { startedAt: "desc" },
    take: 20,
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
    elapsedSeconds?: number;
    ambienceA?: number;
    ambienceB?: number;
    ambienceC?: number;
    startedAt?: string;
    endedAt?: string;
  }>();

  const room = typeof body.room === "string" ? body.room : "rain-city";
  const plannedSeconds = Number(body.plannedSeconds);
  const elapsedSeconds = Number(body.elapsedSeconds);
  const startedAt = body.startedAt ? new Date(body.startedAt) : null;
  const endedAt = body.endedAt ? new Date(body.endedAt) : null;

  if (
    !Number.isFinite(plannedSeconds) ||
    plannedSeconds <= 0 ||
    !Number.isFinite(elapsedSeconds) ||
    elapsedSeconds < 0 ||
    !startedAt ||
    Number.isNaN(startedAt.getTime()) ||
    !endedAt ||
    Number.isNaN(endedAt.getTime())
  ) {
    return c.json({ error: "Invalid focus session payload." }, 400);
  }

  const clamp = (value: unknown, fallback: number) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(0, Math.min(100, Math.round(number)));
  };

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
      plannedSeconds: Math.round(plannedSeconds),
      elapsedSeconds: Math.round(elapsedSeconds),
      ambienceA: clamp(body.ambienceA, 70),
      ambienceB: clamp(body.ambienceB, 45),
      ambienceC: clamp(body.ambienceC, 55),
      startedAt,
      endedAt,
    },
  });

  return c.json({ session }, 201);
});
