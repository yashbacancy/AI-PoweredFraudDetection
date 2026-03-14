export const APP_DB_MODE = process.env.APP_DB_MODE ?? "local";
export const IS_LOCAL_DB_MODE = APP_DB_MODE === "local";
export const HAS_SUPABASE_ENV =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) && Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export const CLIENT_DB_MODE =
  process.env.NEXT_PUBLIC_APP_DB_MODE ?? process.env.APP_DB_MODE ?? "local";
export const IS_LOCAL_DB_MODE_CLIENT = CLIENT_DB_MODE === "local";

export const LOCAL_DEMO_USER_ID = "local-demo-user";
