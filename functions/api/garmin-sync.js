import { isAuthed } from "../_lib/github.js";

// POST /api/garmin-sync -> lanza el GitHub Action "Sync Garmin data" (workflow_dispatch)
// del repo garmin-sync. Requiere sesión (misma contraseña que añadir partidos).
export async function onRequestPost({ request, env }) {
  if (!isAuthed(request, env)) {
    return new Response(JSON.stringify({ ok: false, error: "No autenticado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const repo = env.GARMIN_SYNC_REPO; // ej. "JaimeCuenca/garmin-sync"
  const workflow = env.GARMIN_SYNC_WORKFLOW || "garmin_sync.yml";
  const url = `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GARMIN_SYNC_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "bluepulse-webapp",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref: env.GARMIN_SYNC_BRANCH || "main" }),
  });

  if (res.status !== 204) {
    const text = await res.text().catch(() => "");
    return new Response(JSON.stringify({ ok: false, error: `GitHub respondió ${res.status}`, detalle: text }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
}
