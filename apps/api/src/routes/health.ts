import { Hono } from "hono";
import { prisma } from "../lib/prisma";

export const healthRoutes = new Hono();

healthRoutes.get("/", async (c) => {
  await prisma.$queryRaw`SELECT 1`;

  return c.json({
    status: "ok",
    service: "focusroom-api",
    database: "connected",
  });
});
