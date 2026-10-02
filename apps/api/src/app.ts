import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./config/env";
import { healthRoutes } from "./routes/health";
import { meRoutes } from "./routes/me";
import type { AppEnv } from "./types/app";

export const app = new Hono<AppEnv>();

app.use(
  "*",
  cors({
    origin: env.WEB_ORIGIN,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.route("/health", healthRoutes);
app.route("/me", meRoutes);

app.notFound((c) => c.json({ error: "Not found" }, 404));

app.onError((error, c) => {
  console.error(error);
  return c.json({ error: "Internal server error" }, 500);
});
