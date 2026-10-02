export type AuthUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

export type AppEnv = {
  Variables: {
    user: AuthUser;
  };
};
