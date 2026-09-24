import { expectedToken } from "../_lib/github.js";

// POST /api/login  { password }  -> set-cookie de sesión simple
export async function onRequestPost({ request, env }) {
  const { password } = await request.json().catch(() => ({}));

  if (!password || password !== env.APP_PASSWORD) {
    return new Response(JSON.stringify({ ok: false, error: "Contraseña incorrecta" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const token = expectedToken(env);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      // 30 días, solo accesible por el propio sitio
      "Set-Cookie": `bp_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`,
    },
  });
}
