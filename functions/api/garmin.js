import { listDir, readJson } from "../_lib/github.js";

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
