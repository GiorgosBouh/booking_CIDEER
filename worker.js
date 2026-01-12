const REQUIRED_FIELDS = [
  "beneficiaryName",
  "beneficiaryEmail",
  "beneficiaryPhone",
  "serviceType",
  "date",
  "time",
  "room",
  "clinician"
];

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response("", { headers: cors() });
    }

    const url = new URL(request.url);

    if (url.pathname === "/bookings" && request.method === "GET") {
      const authError = requireAuth(request, env);
      if (authError) return authError;
      return listBookings(env);
    }

    if (url.pathname === "/bookings" && request.method === "POST") {
      const authError = requireAuth(request, env);
      if (authError) return authError;
      return createBooking(request, env);
    }

    return new Response("Not Found", { status: 404, headers: cors() });
  }
};

function requireAuth(request, env) {
  if (!env.ACCESS_TOKEN) {
    return new Response("Server misconfigured", { status: 500, headers: cors() });
  }

  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (token !== env.ACCESS_TOKEN) {
    return new Response("Unauthorized", { status: 401, headers: cors() });
  }

  return null;
}

async function listBookings(env) {
  if (!env.BOOKING_KV) {
    return new Response("Storage unavailable", { status: 500, headers: cors() });
  }

  const bookings = await readBookings(env);
  return jsonResponse(
    bookings.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
  );
}

async function createBooking(request, env) {
  if (!env.BOOKING_KV) {
    return new Response("Storage unavailable", { status: 500, headers: cors() });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400, headers: cors() });
  }

  for (const field of REQUIRED_FIELDS) {
    if (!payload?.[field]) {
      return new Response(`Missing field: ${field}`, { status: 400, headers: cors() });
    }
  }

  const booking = {
    id: crypto.randomUUID(),
    beneficiaryName: payload.beneficiaryName.trim(),
    beneficiaryEmail: payload.beneficiaryEmail.trim(),
    beneficiaryPhone: payload.beneficiaryPhone.trim(),
    serviceType: payload.serviceType.trim(),
    date: payload.date,
    time: payload.time,
    room: payload.room.trim(),
    clinician: payload.clinician.trim(),
    notes: payload.notes?.trim() || "",
    createdAt: new Date().toISOString()
  };

  await env.BOOKING_KV.put(storageKey(booking.id), JSON.stringify(booking));

  return jsonResponse(booking, 201);
}

async function readBookings(env) {
  const keys = await listAllBookingKeys(env);
  if (!keys.length) return [];

  const values = await Promise.all(keys.map((key) => env.BOOKING_KV.get(key)));

  return values
    .filter(Boolean)
    .map((raw) => {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

async function listAllBookingKeys(env) {
  const keys = [];
  let cursor;

  do {
    const page = await env.BOOKING_KV.list({ prefix: "booking:", cursor });
    page.keys.forEach((key) => keys.push(key.name));
    cursor = page.cursor;
  } while (cursor);

  return keys;
}

function storageKey(id) {
  return `booking:${id}`;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...cors(),
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}
