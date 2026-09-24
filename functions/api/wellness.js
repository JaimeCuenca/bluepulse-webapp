import { listDir, readJson } from "../_lib/github.js";

// GET /api/wellness?days=30  -> array de snapshots diarios (sueño, batería corporal, kcal...)
// Lectura pública (no requiere contraseña): solo se protege la escritura manual de partidos.
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const days = Math.min(parseInt(url.searchParams.get("days") || "30", 10), 180);

  const files = await listDir(env, "garmin/wellness");
  const jsonFiles = files
    .filter((f) => f.type === "file" && f.name.endsWith(".json"))
    .sort((a, b) => (a.name < b.name ? 1 : -1)) // más reciente primero (nombre = fecha)
    .slice(0, days);

  const results = await Promise.all(
    jsonFiles.map(async (f) => {
      const entry = await readJson(env, f.path);
      return entry ? entry.json : null;
    })
  );

  const snapshots = results.filter(Boolean).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));

  return new Response(JSON.stringify({ ok: true, snapshots }), {
    headers: { "Content-Type": "application/json" },
  });
}
