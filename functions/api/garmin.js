import { listDir, readJson } from "../_lib/github.js";

// GET /api/garmin?tipo=running|fuerza|todos&limit=20 -> últimas actividades sincronizadas de Garmin
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const tipo = url.searchParams.get("tipo") || "todos";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10), 100);

  const files = await listDir(env, "garmin/activities");
  const jsonFiles = files
    .filter((f) => f.type === "file" && f.name.endsWith(".json"))
    .sort((a, b) => (a.name < b.name ? 1 : -1));

  const activities = [];
  for (const f of jsonFiles) {
    if (activities.length >= limit) break;
    const entry = await readJson(env, f.path);
    if (!entry) continue;
    const act = entry.json;
    if (tipo !== "todos" && act.tipo !== tipo) continue;
    activities.push(act);
  }

  return new Response(JSON.stringify({ ok: true, activities }), {
    headers: { "Content-Type": "application/json" },
  });
}
