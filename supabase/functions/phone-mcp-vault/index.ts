import {createSupabaseVault} from './core.mjs';
// Deployed without the legacy JWT gateway check. Every request is still verified
// through Auth /user, matched to JWT sub/session, then checked against this device.
Deno.serve(createSupabaseVault({
 url:Deno.env.get('SUPABASE_URL')??'',
 serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'',
 masterKey:Deno.env.get('PRIVATE_PHONE_SYNC_MASTER_KEY_V1')??'',
}));
