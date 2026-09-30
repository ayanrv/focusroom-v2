import "dotenv/config";

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const port = Number(process.env.PORT ?? "3001");

if (!Number.isInteger(port) || port <= 0) {
  throw new Error("PORT must be a positive integer");
}

export const env = Object.freeze({
  DATABASE_URL: requireEnv("DATABASE_URL"),
  SUPABASE_URL: requireEnv("SUPABASE_URL"),
  SUPABASE_PUBLISHABLE_KEY: requireEnv("SUPABASE_PUBLISHABLE_KEY"),
  WEB_ORIGIN: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  PORT: port,
});
