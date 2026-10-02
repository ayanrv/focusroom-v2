import type { MiddlewareHandler } from "hono";
import { getAuthUser } from "../lib/supabase-auth";
import type { AppEnv } from "../types/app";

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const authorization = c.req.header("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const accessToken = authorization.slice("Bearer ".length).trim();

  if (!accessToken) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user = await getAuthUser(accessToken);

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("user", user);
  await next();
};
