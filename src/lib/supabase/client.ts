import { createBrowserClient } from "@supabase/ssr";

// Client-side Supabase client — used inside "use client" components.
//
// NOTE: not parameterized with a generated `Database` type yet. Hand-rolled
// types (see ./types.ts) don't cover joins/relationships well enough for
// supabase-js's generic inference. Once this project is linked to a real
// Supabase project, run `npx supabase gen types typescript --project-id <id>`
// and pass the result here as `createBrowserClient<Database>(...)`.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
