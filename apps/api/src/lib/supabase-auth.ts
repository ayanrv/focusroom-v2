import { env } from "../config/env";
import type { AuthUser } from "../types/app";

export async function getAuthUser(accessToken: string): Promise<AuthUser | null> {
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as AuthUser;
}
