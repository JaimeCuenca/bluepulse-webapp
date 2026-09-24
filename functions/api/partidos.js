import { readJson, writeJson, isAuthed } from "../_lib/github.js";

// GET /api/partidos?temporada=26-27          -> devuelve el JSON completo de esa temporada
// POST /api/partidos { temporada, partido }  -> añade un partido (requiere sesión / contraseña)
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const temporada = url.searchParams.get("temporada") || "26-27";
  const path = `partidos/temporada_${temporada}.json`;

  const entry = await readJson(env, path);
  if (!entry) {
    return new Response(JSON.stringify({ ok: true, temporada, partidos: [], notas_metodologicas: [] }), {
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ ok: true, ...entry.json }), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestPost({ request, env }) {
  if (!isAuthed(request, env)) {
    return new Response(JSON.stringify({ ok: false, error: "No autenticado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json().catch(() => null);
  if (!body || !body.temporada || !body.partido) {
    return new Response(JSON.stringify({ ok: false, error: "Faltan campos: temporada, partido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const path = `partidos/temporada_${body.temporada}.json`;
  const existing = await readJson(env, path);

  const current = existing
    ? existing.json
    : { temporada: body.temporada, notas_metodologicas: [], partidos: [] };

  // Validación mínima del esquema de partido
  const p = body.partido;
  const requiredFields = ["competicion", "rival", "estimado", "minutos_jugados", "goles_encajados", "goles_detalle"];
  for (const field of requiredFields) {
    if (!(field in p)) {
      return new Response(JSON.stringify({ ok: false, error: `Falta el campo '${field}' en el partido` }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  current.partidos.push(p);

  const result = await writeJson(
    env,
    path,
    current,
    `Añade partido vs ${p.rival} (${body.temporada})`,
    existing ? existing.sha : undefined
  );

  return new Response(JSON.stringify({ ok: true, commit: result.commit?.sha }), {
    headers: { "Content-Type": "application/json" },
  });
}
