import {createSupabaseSync} from './core.mjs';

// Supabase JWT verification also runs at the edge; core verifies the active Auth session.
const handler = createSupabaseSync({
  url: Deno.env.get('SUPABASE_URL') ?? '',
  serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  masterKey: Deno.env.get('PRIVATE_PHONE_SYNC_MASTER_KEY_V1') ?? '',
});
Deno.serve(handler);
