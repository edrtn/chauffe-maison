// Chauffe Maison — Cloudflare Worker Thermostat
// Tourne toutes les 60s via cron trigger
// Stocke config dans Workers KV
// Communique avec Shelly Cloud API

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// =========================================================================
// SHELLY CLOUD API
// =========================================================================
async function shellyV1(env, endpoint, params) {
  const body = `auth_key=${encodeURIComponent(env.SHELLY_AUTH_KEY)}&${params}`;
  const res = await fetch(`https://${env.SHELLY_SERVER}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return res.json();
}

async function shellyV2(env, endpoint, payload) {
  payload.auth_key = env.SHELLY_AUTH_KEY;
  const res = await fetch(`https://${env.SHELLY_SERVER}/v2/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

async function getDeviceStatus(env) {
  const ids = [env.DEVICE_PRO];
  if (env.DEVICE_HT) ids.push(env.DEVICE_HT);

  const data = await shellyV2(env, "devices/api/get", {
    ids,
    select: ["status"],
  });

  const result = { temp: null, relay: null, power: null, online: false };

  if (!data || !data.length) return result;

  // Pro 1PM
  const pro = data.find((d) => d.id === env.DEVICE_PRO);
  if (pro && pro.online) {
    result.online = true;
    const sw = pro.status?.["switch:0"];
    if (sw) {
      result.relay = sw.output;
      result.power = sw.apower;
    }
  }

  // H&T
  const ht = data.find((d) => d.id === env.DEVICE_HT);
  if (ht?.status?.["temperature:0"]) {
    result.temp = ht.status["temperature:0"].tC;
  }

  return result;
}

async function setRelay(env, on) {
  return shellyV1(
    env,
    "device/relay/control",
    `id=${env.DEVICE_PRO}&channel=0&turn=${on ? "on" : "off"}`
  );
}

// =========================================================================
// KV HELPERS
// =========================================================================
async function getConfig(kv) {
  const raw = await kv.get("config", "json");
  return raw || {
    enabled: false,
    tempTarget: 18,
    tempHyst: 1,
    schedule: Array.from({ length: 7 }, () => Array(48).fill(false)),
  };
}

async function getLog(kv) {
  const raw = await kv.get("log", "json");
  return raw || [];
}

async function appendLog(kv, msg) {
  const logs = await getLog(kv);
  const ts = new Date().toISOString();
  logs.push({ ts, msg });
  // Keep last 200 entries
  if (logs.length > 200) logs.splice(0, logs.length - 200);
  await kv.put("log", JSON.stringify(logs));
}

// =========================================================================
// THERMOSTAT LOGIC (runs every minute via cron)
// =========================================================================
async function thermostatCheck(env) {
  const config = await getConfig(env.KV);

  if (!config.enabled) return;

  // Get current device status
  const status = await getDeviceStatus(env);

  // Save last status
  await env.KV.put("last_status", JSON.stringify({
    ...status,
    updatedAt: new Date().toISOString(),
  }));

  if (!status.online) {
    await appendLog(env.KV, "Pro 1PM hors ligne");
    return;
  }

  if (status.temp === null) {
    await appendLog(env.KV, "Pas de temperature disponible");
    return;
  }

  // Determine current day and slot
  // Use UTC+2 (Paris time) — simplified
  const now = new Date();
  const utcOffset = 2; // CEST, adjust to 1 for CET if needed
  const local = new Date(now.getTime() + utcOffset * 3600000);
  const dayJS = local.getUTCDay(); // 0=dim
  const ourDay = dayJS === 0 ? 6 : dayJS - 1; // 0=lun ... 6=dim
  const hour = local.getUTCHours();
  const min = local.getUTCMinutes();
  const slot = hour * 2 + (min >= 30 ? 1 : 0);

  const inSchedule = config.schedule[ourDay]?.[slot] || false;
  const target = config.tempTarget;
  const hyst = config.tempHyst;

  if (!inSchedule) {
    if (status.relay === true) {
      await setRelay(env, false);
      await appendLog(env.KV, `Hors plage -> OFF (${status.temp.toFixed(1)}°C)`);
    }
    return;
  }

  // In schedule: check temperature
  if (status.temp < target) {
    if (status.relay !== true) {
      await setRelay(env, true);
      await appendLog(env.KV, `${status.temp.toFixed(1)}°C < ${target}°C -> ON`);
    }
  } else if (status.temp >= target + hyst) {
    if (status.relay !== false) {
      await setRelay(env, false);
      await appendLog(env.KV, `${status.temp.toFixed(1)}°C >= ${target + hyst}°C -> OFF`);
    }
  }
}

// =========================================================================
// HTTP API (called by the frontend)
// =========================================================================
async function handleAPI(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Auth check
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || authHeader !== `Bearer ${env.API_KEY}`) {
    return new Response(JSON.stringify({ error: "Non autorise" }), {
      status: 401,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // GET /api/status — current status + config
  if (path === "/api/status" && request.method === "GET") {
    const config = await getConfig(env.KV);
    const lastStatus = await env.KV.get("last_status", "json");
    return jsonResponse({ config, status: lastStatus });
  }

  // GET /api/log — thermostat log
  if (path === "/api/log" && request.method === "GET") {
    const logs = await getLog(env.KV);
    return jsonResponse({ logs });
  }

  // POST /api/config — save config (schedule + temp settings)
  if (path === "/api/config" && request.method === "POST") {
    const body = await request.json();
    const config = await getConfig(env.KV);

    if (body.enabled !== undefined) config.enabled = !!body.enabled;
    if (body.tempTarget !== undefined) config.tempTarget = parseFloat(body.tempTarget);
    if (body.tempHyst !== undefined) config.tempHyst = parseFloat(body.tempHyst);
    if (body.schedule !== undefined) config.schedule = body.schedule;

    await env.KV.put("config", JSON.stringify(config));
    await appendLog(env.KV, `Config mise a jour (${config.enabled ? "actif" : "inactif"}, cible ${config.tempTarget}°C)`);
    return jsonResponse({ ok: true, config });
  }

  // POST /api/relay — manual relay control
  if (path === "/api/relay" && request.method === "POST") {
    const body = await request.json();
    const on = !!body.on;

    // Disable thermostat on manual control
    const config = await getConfig(env.KV);
    config.enabled = false;
    await env.KV.put("config", JSON.stringify(config));

    const result = await setRelay(env, on);
    await appendLog(env.KV, `Relais ${on ? "ON" : "OFF"} (manuel) — thermostat desactive`);
    return jsonResponse({ ok: result.isok, relay: on });
  }

  // POST /api/refresh — force status refresh
  if (path === "/api/refresh" && request.method === "POST") {
    const status = await getDeviceStatus(env);
    await env.KV.put("last_status", JSON.stringify({
      ...status,
      updatedAt: new Date().toISOString(),
    }));
    return jsonResponse({ status });
  }

  return new Response("Not found", { status: 404, headers: CORS_HEADERS });
}

function jsonResponse(data) {
  return new Response(JSON.stringify(data), {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// =========================================================================
// ENTRY POINT
// =========================================================================
export default {
  // HTTP requests (from frontend)
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }
    return handleAPI(request, env);
  },

  // Cron trigger (every minute)
  async scheduled(event, env) {
    await thermostatCheck(env);
  },
};
