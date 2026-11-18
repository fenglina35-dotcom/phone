import {createSupabaseSync} from './core.mjs';

// The handler verifies the bearer with Auth before trusting claims or accessing any data.
// Deploy with --no-verify-jwt for both legacy and asymmetric Auth signing keys.
const handler = createSupabaseSync({
  url: Deno.env.get('SUPABASE_URL') ?? '',
  serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  masterKey: Deno.env.get('PRIVATE_PHONE_SYNC_MASTER_KEY_V1') ?? '',
});
Deno.serve(handler);
