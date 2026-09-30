import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { prisma } from "./lib/prisma";

const app = new Hono();

app.get("/health", async (c) => {
  const profileCount = await prisma.profile.count();

  return c.json({
    status: "ok",
    service: "focusroom-api",
    database: "connected",
    profiles: profileCount,
  });
});

serve({
  fetch: app.fetch,
  port: 3001,
});

console.log("FocusRoom API running on http://localhost:3001");