import { listDir, readJson, writeJson, isAuthed } from "../_lib/github.js";

// GET /api/garmin?tipo=running|fuerza|todos&limit=20&desde=YYYY-MM-DD
// "desde" es opcional (rango de fechas, p.ej. "esta semana" desde la webapp).
// Al ir de más a menos reciente, en cuanto un archivo es anterior a "desde"
// se corta el bucle: evita leer+decodificar del repo actividades que de
// todas formas se van a descartar (esto es lo que hacía lenta la pestaña
// cuando el filtro por defecto era "todos").
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const tipo = url.searchParams.get("tipo") || "todos";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10), 200);
  const desde = url.searchParams.get("desde"); // "YYYY-MM-DD" o null

  const files = await listDir(env, "garmin/activities");
  const jsonFiles = files
    .filter((f) => f.type === "file" && f.name.endsWith(".json"))
    .sort((a, b) => (a.name < b.name ? 1 : -1));

  const activities = [];
  for (const f of jsonFiles) {
    if (activities.length >= limit) break;
    if (desde && f.name < desde) break; // el nombre empieza por la fecha
    const entry = await readJson(env, f.path);
    if (!entry) continue;
    const act = entry.json;
    if (tipo !== "todos" && act.tipo !== tipo) continue;
    if (desde && act.fecha < desde) continue;
    activities.push(act);
  }

  return new Response(JSON.stringify({ ok: true, activities }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

// POST /api/garmin
//   { fecha, id, rpe }                     -> anota el esfuerzo percibido (1-10) de
//                                              una actividad ya sincronizada.
//   { manual: true, fecha, tipo, ... }     -> crea un entreno metido a mano (futsal,
//                                              o cualquier otro que no pase por Garmin).
// Ambas requieren sesión (misma contraseña que añadir partidos/lanzar el sync).
// El RPE (anotado o estimado) alimenta el cálculo propio de carga de entreno
// (ACWR) que hace la webapp para el riesgo de lesión.
export async function onRequestPost({ request, env }) {
  if (!isAuthed(request, env)) {
    return new Response(JSON.stringify({ ok: false, error: "No autenticado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json().catch(() => null);
  if (body && body.manual === true) {
    return crearActividadManual(env, body);
  }
  return anotarRpe(env, body);
}

async function anotarRpe(env, body) {
  const fecha = body && body.fecha;
  const id = body && body.id;
  const rpe = body && Number(body.rpe);

  if (!fecha || id == null || !Number.isInteger(rpe) || rpe < 1 || rpe > 10) {
    return new Response(
      JSON.stringify({ ok: false, error: "Faltan o son inválidos los campos: fecha, id, rpe (entero 1-10)" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const path = `garmin/activities/${fecha}_${id}.json`;
  const existing = await readJson(env, path);
  if (!existing) {
    return new Response(JSON.stringify({ ok: false, error: "Actividad no encontrada" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const actualizado = { ...existing.json, rpe };
  await writeJson(env, path, actualizado, `RPE ${rpe}/10 para actividad ${id} (${fecha})`, existing.sha);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
}

// Tipos manuales admitidos de momento; "futsal" es el motivo de ser de esto
// (no se puede llevar el Garmin jugando, y el Arduino aún no existe), pero
// sirve para anotar cualquier entreno que no se sincronice solo.
const TIPOS_MANUALES = ["futsal", "fuerza", "running", "otro"];

async function crearActividadManual(env, body) {
  const fecha = body && body.fecha;
  const tipo = body && body.tipo;
  const duracion_min = body && Number(body.duracion_min);
  const rpeRaw = body && body.rpe;
  const rpe = rpeRaw == null || rpeRaw === "" ? null : Number(rpeRaw);
  const notas = (body && typeof body.notas === "string" && body.notas.trim()) || null;
  const fcRaw = body && body.fc_media;
  const fc_media = fcRaw == null || fcRaw === "" ? null : Number(fcRaw);

  if (!fecha || !TIPOS_MANUALES.includes(tipo) || !Number.isFinite(duracion_min) || duracion_min <= 0) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: `Faltan o son inválidos los campos: fecha, tipo (uno de ${TIPOS_MANUALES.join(", ")}), duracion_min (> 0)`,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (rpe != null && (!Number.isInteger(rpe) || rpe < 1 || rpe > 10)) {
    return new Response(JSON.stringify({ ok: false, error: "rpe debe ser un entero de 1 a 10 (o vacío)" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (fc_media != null && (!Number.isFinite(fc_media) || fc_media <= 0)) {
    return new Response(JSON.stringify({ ok: false, error: "fc_media inválida" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Id propio (no viene de Garmin): timestamp en ms, único de sobra para
  // varios entrenos manuales el mismo día.
  const id = `manual-${Date.now()}`;
  const actividad = {
    id,
    fecha,
    tipo: tipo === "fuerza" ? "fuerza" : tipo === "running" ? "running" : "otro",
    tipo_garmin: tipo, // clave de agrupación/filtrado en la webapp (incluye "futsal")
    manual: true,
    duracion_min,
    distancia_km: null,
    fc_media,
    calorias: null,
    rpe,
    notas,
  };

  const path = `garmin/activities/${fecha}_${id}.json`;
  await writeJson(env, path, actividad, `Entreno manual (${tipo}) ${fecha}`);

  return new Response(JSON.stringify({ ok: true, activity: actividad }), {
    headers: { "Content-Type": "application/json" },
  });
}
