import { serve } from "@hono/node-server";
import { app } from "./app";
import { env } from "./config/env";

serve({
  fetch: app.fetch,
  port: env.PORT,
});

console.log(`FocusRoom API running on http://localhost:${env.PORT}`);
