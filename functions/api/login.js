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
      // 48 horas: pides la contraseña como mucho una vez cada 2 días, no en
      // cada sync/partido. El frontend ya no pide login "por si acaso" —
      // intenta la acción directamente y solo abre el modal si el servidor
      // responde 401 (sesión caducada o inexistente), así que esta duración
      // es la que realmente notas.
      "Set-Cookie": `bp_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=172800`,
    },
  });
}
