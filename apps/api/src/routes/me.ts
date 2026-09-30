import { Hono } from "hono";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/require-auth";
import type { AppEnv } from "../types/app";

export const meRoutes = new Hono<AppEnv>();

meRoutes.use("*", requireAuth);

meRoutes.get("/", async (c) => {
  const user = c.get("user");
  const metadata = user.user_metadata ?? {};

  const displayName =
    typeof metadata.full_name === "string"
      ? metadata.full_name
      : typeof metadata.name === "string"
        ? metadata.name
        : null;

  const avatarUrl =
    typeof metadata.avatar_url === "string" ? metadata.avatar_url : null;

  const profile = await prisma.profile.upsert({
    where: { id: user.id },
    update: {},
    create: {
      id: user.id,
      displayName,
      avatarUrl,
    },
  });

  return c.json({
    user: {
      id: user.id,
      email: user.email ?? null,
    },
    profile,
  });
});
