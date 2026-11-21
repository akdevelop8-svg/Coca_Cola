-- The client application communicates only through the authenticated
-- Vercel gateway and Supabase Edge Function. Direct browser access to
-- the Supabase public Data API is not part of the application architecture.
REVOKE USAGE, CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;

-- Preserve the server-side Edge Function's access to public tables/functions.
GRANT USAGE ON SCHEMA public TO service_role;
