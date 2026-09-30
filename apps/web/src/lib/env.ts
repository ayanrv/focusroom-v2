function requireViteEnv(name: "VITE_SUPABASE_URL" | "VITE_SUPABASE_PUBLISHABLE_KEY"): string {
  const value = import.meta.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const env = Object.freeze({
  SUPABASE_URL: requireViteEnv("VITE_SUPABASE_URL"),
  SUPABASE_PUBLISHABLE_KEY: requireViteEnv("VITE_SUPABASE_PUBLISHABLE_KEY"),
  API_URL: import.meta.env.VITE_API_URL ?? "http://localhost:3001",
});
