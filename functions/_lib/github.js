/**
 * Helper mínimo para leer/escribir archivos en el repo privado de datos
 * (bluepulse-data) usando la API REST de GitHub Contents.
 *
 * Variables de entorno esperadas (se configuran como "Secrets" en el
 * proyecto de Cloudflare Pages, nunca en el código ni en el frontend):
 *   GITHUB_TOKEN   -> token con permiso "contents: write" sobre el repo de datos
 *   DATA_REPO      -> "usuario/bluepulse-data"
 *   DATA_BRANCH    -> normalmente "main"
 *   APP_PASSWORD   -> contraseña simple para desbloquear escrituras manuales
 */

const API_BASE = "https://api.github.com";

function authHeaders(env) {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "bluepulse-webapp",
  };
}

/** Lee un archivo JSON del repo de datos. Devuelve null si no existe (404). */
export async function readJson(env, path) {
  const url = `${API_BASE}/repos/${env.DATA_REPO}/contents/${path}?ref=${env.DATA_BRANCH || "main"}`;
  const res = await fetch(url, { headers: authHeaders(env) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub GET ${path} -> ${res.status}`);
  const data = await res.json();
  const content = atob(data.content.replace(/\n/g, ""));
  return { json: JSON.parse(content), sha: data.sha };
}

/** Lista archivos de un directorio del repo de datos. Devuelve [] si no existe. */
export async function listDir(env, path) {
  const url = `${API_BASE}/repos/${env.DATA_REPO}/contents/${path}?ref=${env.DATA_BRANCH || "main"}`;
  const res = await fetch(url, { headers: authHeaders(env) });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`GitHub GET ${path} -> ${res.status}`);
  return res.json(); // array de {name, path, type, ...}
}

/** Crea o actualiza un archivo JSON en el repo de datos (commit directo a la rama). */
export async function writeJson(env, path, jsonValue, message, sha /* opcional, para update */) {
  const url = `${API_BASE}/repos/${env.DATA_REPO}/contents/${path}`;
  const body = {
    message,
    content: btoa(unescape(encodeURIComponent(JSON.stringify(jsonValue, null, 2)))),
    branch: env.DATA_BRANCH || "main",
  };
  if (sha) body.sha = sha;
  const res = await fetch(url, {
    method: "PUT",
    headers: { ...authHeaders(env), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub PUT ${path} -> ${res.status}: ${text}`);
  }
  return res.json();
}

/** Comprueba la cookie de sesión simple emitida por /api/login. */
export function isAuthed(request, env) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/bp_session=([^;]+)/);
  if (!match) return false;
  return match[1] === expectedToken(env);
}

/** Token de sesión derivado de la contraseña (no es JWT, es intencionalmente simple). */
export function expectedToken(env) {
  return `ok-${env.APP_PASSWORD}`;
}
