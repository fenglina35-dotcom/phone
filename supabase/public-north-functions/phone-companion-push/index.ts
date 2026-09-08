import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function base64url(value: Uint8Array | string) {
  const bytes = typeof value === "string"
    ? new TextEncoder().encode(value)
    : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");
}

function pemBytes(pem: string) {
  const normalized = pem.replaceAll("\\n", "\n");
  const body = normalized
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  return Uint8Array.from(atob(body), (char) => char.charCodeAt(0));
}

function derToRaw(signature: Uint8Array) {
  if (signature.length === 64) return signature;
  if (signature[0] !== 0x30) throw new Error("unsupported ES256 signature");
  let offset = 2;
  if (signature[1] & 0x80) offset = 2 + (signature[1] & 0x7f);
  if (signature[offset++] !== 0x02) throw new Error("invalid ES256 r");
  const rLength = signature[offset++];
  const r = signature.slice(offset, offset + rLength);
  offset += rLength;
  if (signature[offset++] !== 0x02) throw new Error("invalid ES256 s");
  const sLength = signature[offset++];
  const s = signature.slice(offset, offset + sLength);
  const raw = new Uint8Array(64);
  raw.set(r.slice(Math.max(0, r.length - 32)), 32 - Math.min(32, r.length));
  raw.set(s.slice(Math.max(0, s.length - 32)), 64 - Math.min(32, s.length));
  return raw;
}

async function apnsJWT(teamId: string, keyId: string, privateKey: string) {
  const header = base64url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const claims = base64url(JSON.stringify({
    iss: teamId,
    iat: Math.floor(Date.now() / 1000),
  }));
  const input = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemBytes(privateKey),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const signed = new Uint8Array(await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(input),
  ));
  return `${input}.${base64url(derToRaw(signed))}`;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") return json({ error: "method-not-allowed" }, 405);

  try {
    const input = await request.json();
    const target = String(input?.target ?? "").trim();
    const ownerSecret = String(input?.ownerSecret ?? "");
    const commandId = String(input?.commandId ?? "").trim();
    if (!target || ownerSecret.length < 24 || !commandId) {
      return json({ error: "invalid-request" }, 400);
    }

    const supabaseURL = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const client = createClient(supabaseURL, serviceRoleKey, {
      auth: { persistSession: false },
    });
    const { data: context, error } = await client.rpc(
      "phone_companion_get_push_context",
      {
        p_target: target,
        p_owner_secret: ownerSecret,
        p_command_id: commandId,
      },
    );
    if (error) throw error;
    if (!context) return json({ error: "command-not-pending" }, 404);
    if (!context.deviceToken) return json({ queued: true, pushed: false, reason: "no-token" });

    const keyId = Deno.env.get("APNS_KEY_ID") ?? "";
    const teamId = Deno.env.get("APNS_TEAM_ID") ?? "";
    const privateKey = Deno.env.get("APNS_PRIVATE_KEY") ?? "";
    const bundleId = Deno.env.get("APNS_BUNDLE_ID") ?? "";
    if (!keyId || !teamId || !privateKey || !bundleId) {
      return json({ queued: true, pushed: false, reason: "apns-not-configured" });
    }

    const token = await apnsJWT(teamId, keyId, privateKey);
    const host = context.environment === "production"
      ? "https://api.push.apple.com"
      : "https://api.sandbox.push.apple.com";
    const payload = {
      aps: {
        "content-available": 1,
      },
      companion: { commandId },
    };
    const response = await fetch(
      `${host}/3/device/${encodeURIComponent(context.deviceToken)}`,
      {
        method: "POST",
        headers: {
          authorization: `bearer ${token}`,
          "apns-topic": bundleId,
          "apns-push-type": "background",
          "apns-priority": "5",
          "apns-collapse-id": "phone-companion-commands",
          "apns-expiration": String(Math.floor(Date.now() / 1000) + 900),
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );
    if (!response.ok) {
      const detail = await response.text();
      return json({ queued: true, pushed: false, status: response.status, detail }, 502);
    }
    return json({ queued: true, pushed: true });
  } catch (error) {
    return json({ error: String(error?.message ?? error) }, 500);
  }
});
