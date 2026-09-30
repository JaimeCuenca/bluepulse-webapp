// ---------- Iconos (Lucide) ----------
if (window.lucide) {
  lucide.createIcons({ attrs: { width: 16, height: 16, "stroke-width": 1.75 } });
}

// ---------- Estilo global de Chart.js (Rajdhani en tooltips, animación de entrada) ----------
if (window.Chart) {
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.color = "#8A99B5"; // --text-secondary
  // OJO: nunca sustituir Chart.defaults.animation por completo — Chart.js usa
  // ahí una estructura interna compleja (con "_fn" por tipo de propiedad) y
  // reemplazarla rompe TODAS las gráficas con "this._fn is not a function".
  // Hay que fusionar solo duration/easing con Object.assign.
  Object.assign(Chart.defaults.animation, { duration: 800, easing: "easeOutQuart" });
  Chart.defaults.plugins.tooltip.backgroundColor = "#152038"; // --bg-surface-elevated
  Chart.defaults.plugins.tooltip.borderColor = "#2D82FF"; // --accent-blue
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.titleFont = { family: "'Rajdhani', sans-serif", weight: "600" };
  Chart.defaults.plugins.tooltip.bodyFont = { family: "'Rajdhani', sans-serif", weight: "600" };
  Chart.defaults.plugins.title.font = { family: "'Rajdhani', sans-serif", size: 14, weight: "600" };
}

// ---------- Diagrama de cuerpo (carga muscular en Resumen) ----------
// Librería: body-muscles (https://github.com/vulovix/body-muscles), vanilla
// JS vía CDN, sin dependencias. Dos instancias (delante/espalda) porque cada
// BodyChart solo pinta los músculos de SU vista; se actualizan juntas con
// bodyState distintos (front/back) en renderCargaMuscular.
let bodyChartFront, bodyChartBack;
if (window.BodyMuscles) {
  const { BodyChart, ViewSide } = window.BodyMuscles;
  const elFront = document.getElementById("muscular-front");
  const elBack = document.getElementById("muscular-back");
  if (elFront) bodyChartFront = new BodyChart(elFront, { view: ViewSide.FRONT, bodyState: {} });
  if (elBack) bodyChartBack = new BodyChart(elBack, { view: ViewSide.BACK, bodyState: {} });
}

/** Anima un número de 0 a su valor final (count-up), sustituyendo cualquier
 *  skeleton de carga que tuviera el elemento. */
function animateValue(elId, endValue, { suffix = "", decimals = 0, duration = 600 } = {}) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.classList.remove("skeleton");
  if (endValue == null || Number.isNaN(endValue)) {
    el.textContent = "—";
    return;
  }
  const startTime = performance.now();
  function step(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // aprox. cubic-bezier(0.16, 1, 0.3, 1)
    const current = endValue * eased;
    el.textContent = (decimals > 0 ? current.toFixed(decimals) : Math.round(current)) + suffix;
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ---------- Navegación por pestañas ----------
const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");

/** Cambia a la pestaña "nombreTab" (el valor de data-tab: resumen, wellness,
 *  garmin o partidos) y dispara la carga de esa sección. La usan tanto los
 *  botones de la barra superior como los subtítulos-enlace del Resumen
 *  (Bienestar/Entrenos/Performance), para no duplicar la lógica. */
function irATab(nombreTab) {
  const btn = document.querySelector(`.tab-btn[data-tab="${nombreTab}"]`);
  const panel = document.getElementById(`tab-${nombreTab}`);
  if (!btn || !panel) return;

  tabButtons.forEach((b) => b.classList.remove("active"));
  tabPanels.forEach((p) => p.classList.remove("active"));
  btn.classList.add("active");
  panel.classList.add("active");

  // "resumen" también se recarga al volver a entrar (antes solo se cargaba
  // una vez al abrir la app, así que si sincronizabas y volvías aquí veías
  // datos viejos hasta recargar la página entera).
  if (nombreTab === "resumen") loadResumen();
  if (nombreTab === "wellness") loadWellness();
  if (nombreTab === "garmin") loadGarmin();
  if (nombreTab === "partidos") loadPartidos();
}

/** Vuelve a cargar los datos de la pestaña que esté activa ahora mismo (la
 *  usa el FAB de sincronización para refrescar sin que el usuario tenga que
 *  acordarse de pulsar "Actualizar" después de lanzar un sync). */
function refrescarPestanaActual() {
  const activo = document.querySelector(".tab-panel.active");
  if (!activo) return;
  const nombreTab = activo.id.replace("tab-", "");
  if (nombreTab === "resumen") loadResumen();
  else if (nombreTab === "wellness") loadWellness();
  else if (nombreTab === "garmin") loadGarmin();
  else if (nombreTab === "partidos") loadPartidos();
}

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => irATab(btn.dataset.tab));
});

// Subtítulos-enlace del Resumen: "Bienestar" -> pestaña wellness,
// "Entrenos" -> pestaña garmin, "Performance" -> pestaña partidos.
document.querySelectorAll("[data-ir-a-tab]").forEach((el) => {
  el.addEventListener("click", () => irATab(el.dataset.irATab));
});

// ---------- Helpers ----------
async function apiGet(path) {
  const res = await fetch(path);
  return res.json();
}

/** Fecha en formato YYYY-MM-DD según el calendario LOCAL del dispositivo,
 *  no UTC. `Date.toISOString()` convierte a UTC antes de formatear, así que
 *  para cualquiera con offset positivo (p.ej. Canarias en horario de
 *  verano, UTC+1) la medianoche local del día X es todavía el día X-1 en
 *  UTC — eso hacía que el calendario de entrenos desplazara cada actividad
 *  un día hacia atrás. Usar los getters locales evita ese desfase. */
function fechaLocalISO(d) {
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function fmtMinSec(totalMin) {
  if (totalMin == null) return "—";
  const h = Math.floor(totalMin / 60);
  const m = Math.round(totalMin % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

let chartBattery, chartSleep, chartKcal, chartGoles, chartMotivos, chartGolesPorPartido;

// ---------- Tipos de gol: nombre visible y color ----------
const TIPO_LABELS = {
  error: "Error",
  dudoso: "Dudoso",
  nada_que_hacer: "Nada que hacer",
};
const TIPO_COLORS = {
  error: "#FF3B5C",         // rojo (--goal-error)
  dudoso: "#FFB800",        // amarillo (--goal-doubtful)
  nada_que_hacer: "#2D82FF", // azul (--goal-no-chance)
};
function tipoLabel(tipo) {
  return TIPO_LABELS[tipo] || tipo;
}
function tipoColor(tipo) {
  return TIPO_COLORS[tipo] || "#9aa3b5";
}

const COMPETICION_ORDEN = { liga: 0, copa_del_rey: 1, supercopa: 2, playoff: 3 };
const TODAS_TEMPORADAS = ["26-27", "25-26", "24-25", "23-24", "22-23"];

/** Anima igual que animateValue pero mostrando "Xh Ym" en vez de horas decimales
 *  (8.8h no es intuitivo; 8h 48m sí). */
function animateSleep(elId, horasDecimal) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.classList.remove("skeleton");
  if (horasDecimal == null || Number.isNaN(horasDecimal)) {
    el.textContent = "—";
    return;
  }
  const totalMin = Math.round(horasDecimal * 60);
  const startTime = performance.now();
  const duration = 600;
  function step(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = fmtMinSec(Math.round(totalMin * eased));
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ---------- Resumen ----------
async function loadResumen() {
  const wellness = await apiGet("/api/wellness?days=1").catch(() => null);
  const last = wellness && wellness.snapshots && wellness.snapshots.length
    ? wellness.snapshots[wellness.snapshots.length - 1]
    : {};
  animateValue("rc-battery", last.bateria_corporal, { suffix: "%" });
  animateSleep("rc-sleep", last.sueno_horas);
  animateValue("rc-kcal-total", last.kcal_totales, { suffix: " kcal" });
  const kcalActivasEl = document.getElementById("rc-kcal-activas");
  const kcalPasivasEl = document.getElementById("rc-kcal-pasivas");
  kcalActivasEl.textContent = last.kcal_activas != null ? Math.round(last.kcal_activas) + " kcal" : "—";
  kcalPasivasEl.textContent = last.kcal_pasivas != null ? Math.round(last.kcal_pasivas) + " kcal" : "—";

  // Pista de cuándo se sincronizó Garmin de verdad por última vez: si el
  // "Body Battery" u otro dato no cuadra con lo que marca el reloj, suele ser
  // porque Garmin Connect (la nube) todavía no ha recibido ese dato del
  // teléfono, no porque BluePulse esté leyendo algo viejo.
  const syncHint = document.getElementById("rc-sync-hint");
  if (wellness && wellness.last_sync && wellness.last_sync.sincronizado_en) {
    const fecha = new Date(wellness.last_sync.sincronizado_en + "Z");
    syncHint.textContent = `Última sincronización con Garmin: ${fecha.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}. Si un dato no coincide con el reloj, suele ser porque Garmin Connect (la nube) aún no lo ha recibido del teléfono — abre la app de Garmin Connect para forzar el envío y vuelve a sincronizar aquí.`;
  } else {
    syncHint.textContent = "";
  }

  const partidos = await apiGet("/api/partidos?temporada=26-27").catch(() => null);
  if (partidos && partidos.partidos) {
    animateValue("rc-partidos", partidos.partidos.length);
    const goles = partidos.partidos.reduce((s, p) => s + (p.goles_encajados || 0), 0);
    animateValue("rc-goles", goles);
    renderGolesDesgloseResumen(partidos.partidos, goles);
  }

  document.getElementById("rc-fc-reposo").textContent =
    last.fc_reposo != null ? Math.round(last.fc_reposo) + " ppm" : "—";

  const garminData = await apiGet("/api/garmin?tipo=todos&limit=30").catch(() => null);
  const actividadesRecientes = (garminData && garminData.activities) || [];
  renderCargaMuscular(actividadesRecientes);
  renderUltimoEntreno(actividadesRecientes);
  renderFormaFisica(actividadesRecientes);

  // Riesgo de lesión: tarjeta resumida (el desglose completo está en
  // Bienestar). Necesita histórico aparte (35 días de wellness + entrenos),
  // así que se pide a parte de lo que ya se ha cargado arriba.
  fetchHistoricoRiesgo()
    .then(({ snapshotsTodos, actividades }) => renderRiesgoResumen(snapshotsTodos, actividades))
    .catch(() => renderRiesgoResumen([], []));
}

/** Bajo el número de goles encajados (Resumen), el % que son de cada tipo:
 *  rojo = error propio, amarillo = dudoso, verde = no se podía hacer nada
 *  (a diferencia del donut de Performance, que usa el azul de marca para
 *  "nada que hacer" — aquí se pide expresamente un semáforo rojo/ámbar/verde
 *  porque es justo lo que transmite "de quién es la culpa" del gol). */
function renderGolesDesgloseResumen(partidos, totalGoles) {
  const cont = document.getElementById("rc-goles-desglose");
  if (!totalGoles) {
    cont.innerHTML = "";
    return;
  }
  const count = { error: 0, dudoso: 0, nada_que_hacer: 0 };
  for (const p of partidos) {
    for (const g of p.goles_detalle || []) {
      if (count[g.tipo] != null) count[g.tipo]++;
    }
  }
  const COLOR_SEMAFORO = { error: "var(--status-danger)", dudoso: "var(--status-warning)", nada_que_hacer: "var(--status-success)" };
  // Solo los porcentajes en color, sin etiqueta de texto (el semáforo ya
  // dice de sobra cuál es cuál: rojo/ámbar/verde en ese orden, siempre).
  cont.innerHTML = ["error", "dudoso", "nada_que_hacer"]
    .map((tipo) => {
      const pct = Math.round((count[tipo] / totalGoles) * 100);
      return `<span class="card-subvalue-pct" style="color: ${COLOR_SEMAFORO[tipo]}">${pct}%</span>`;
    })
    .join("");
}

/** Primera actividad (ya vienen ordenadas de más a menos reciente) que
 *  tenga un valor no nulo en raw_garmin[campo]. VO2 Max y el efecto de
 *  entreno aeróbico/anaeróbico solo los calcula Garmin tras ciertos
 *  entrenos (sobre todo running), así que no siempre está en la última
 *  actividad — hay que buscar hacia atrás hasta encontrarla. */
function actividadConDato(actividades, campo) {
  return actividades.find((a) => a.raw_garmin && a.raw_garmin[campo] != null) || null;
}

function origenActividad(act) {
  return act ? `Según ${actTipoLabel(act).toLowerCase()} del ${act.fecha}` : "";
}

// ---------- VO2 Max + efecto de entreno (Resumen) ----------
// A diferencia de la batería corporal, estos dos son valores que Garmin
// recalcula solo de tanto en tanto (no cada minuto), así que en cuanto
// aparecen ya son fiables — no sufren el mismo lag de sincronización.
function renderFormaFisica(actividades) {
  const actVo2 = actividadConDato(actividades, "vO2MaxValue");
  animateValue("rc-vo2max", actVo2 ? actVo2.raw_garmin.vO2MaxValue : null, { decimals: 1 });
  document.getElementById("rc-vo2max-origen").textContent = origenActividad(actVo2);

  const actEfecto = actividadConDato(actividades, "aerobicTrainingEffect");
  const aerobicoEl = document.getElementById("rc-efecto-aerobico");
  const anaerobicoEl = document.getElementById("rc-efecto-anaerobico");
  const origenEl = document.getElementById("rc-efecto-origen");
  if (actEfecto) {
    aerobicoEl.textContent = Number(actEfecto.raw_garmin.aerobicTrainingEffect).toFixed(1);
    anaerobicoEl.textContent =
      actEfecto.raw_garmin.anaerobicTrainingEffect != null
        ? Number(actEfecto.raw_garmin.anaerobicTrainingEffect).toFixed(1)
        : "—";
    origenEl.textContent = origenActividad(actEfecto);
  } else {
    aerobicoEl.textContent = "—";
    anaerobicoEl.textContent = "—";
    origenEl.textContent = "Sin datos de efecto de entreno en los últimos entrenos sincronizados.";
  }
}

// ---------- Carga muscular (Resumen) ----------
// Mapa best-effort de categorías de ejercicio de Garmin -> grupos musculares.
// Las categorías exactas que devuelve Garmin pueden variar; cualquier
// categoría que no reconozcamos simplemente no se cuenta (no rompe nada).
const EJERCICIO_A_GRUPOS = {
  BENCH_PRESS: ["pecho", "hombros", "triceps"],
  CHEST_PRESS: ["pecho", "hombros", "triceps"],
  FLYE: ["pecho"],
  PEC_FLY: ["pecho"],
  PUSH_UP: ["pecho", "triceps", "hombros"],
  SHOULDER_PRESS: ["hombros", "triceps"],
  LATERAL_RAISE: ["hombros"],
  FRONT_RAISE: ["hombros"],
  REAR_DELT: ["hombros", "espalda"],
  LAT_PULLDOWN: ["espalda", "biceps"],
  ROW: ["espalda", "biceps"],
  SEATED_ROW: ["espalda", "biceps"],
  PULL_UP: ["espalda", "biceps"],
  CHIN_UP: ["espalda", "biceps"],
  DEADLIFT: ["espalda", "piernas", "gluteos"],
  CURL: ["biceps"],
  BICEP_CURL: ["biceps"],
  HAMMER_CURL: ["biceps"],
  TRICEPS_EXTENSION: ["triceps"],
  TRICEP_EXTENSION: ["triceps"],
  DIP: ["triceps", "pecho"],
  SQUAT: ["piernas", "gluteos"],
  LUNGE: ["piernas", "gluteos"],
  LEG_PRESS: ["piernas"],
  LEG_CURL: ["piernas"],
  LEG_EXTENSION: ["piernas"],
  CALF_RAISE: ["piernas"],
  HIP_THRUST: ["gluteos", "piernas"],
  GLUTE_BRIDGE: ["gluteos"],
  PLANK: ["core"],
  SIT_UP: ["core"],
  CRUNCH: ["core"],
  CORE: ["core"],
  RUSSIAN_TWIST: ["core"],
};

// Para actividades cardio/otras (sin detalle de ejercicios), grupos que
// razonablemente quedan cargados según el tipo de actividad completo.
const CARDIO_A_GRUPOS = {
  running: ["piernas"],
  trail_running: ["piernas"],
  treadmill_running: ["piernas"],
  walking: ["piernas"],
  cycling: ["piernas", "gluteos"],
  indoor_cycling: ["piernas", "gluteos"],
  swimming: ["espalda", "hombros", "piernas"],
  lap_swimming: ["espalda", "hombros", "piernas"],
  hiit: ["piernas", "core", "pecho"],
  yoga: ["core"],
};

const GRUPO_LABELS = {
  pecho: "Pecho",
  espalda: "Espalda",
  hombros: "Hombros",
  biceps: "Bíceps",
  triceps: "Tríceps",
  piernas: "Piernas",
  gluteos: "Glúteos",
  core: "Core / Abdomen",
  cuerpo_completo: "Cuerpo completo",
};
const GRUPO_ORDEN = ["pecho", "espalda", "hombros", "biceps", "triceps", "piernas", "gluteos", "core", "cuerpo_completo"];

// A partir de cuántos días sin repetir ese grupo se considera que ya no hay
// carga/fatiga residual y deja de mostrarse.
const DIAS_DECAIMIENTO_CARGA = 3;

function extraerCategoriasEjercicio(act) {
  const raw = act.ejercicios_raw;
  if (!raw) return [];
  const sets = raw.exerciseSets || raw.exercise_sets || [];
  if (!Array.isArray(sets)) return [];
  const categorias = new Set();
  for (const s of sets) {
    if ((s.setType || s.set_type || "ACTIVE") === "REST") continue;
    const ex = (s.exercises && s.exercises[0]) || {};
    const cat = (ex.category || s.category || "").toUpperCase();
    if (cat) categorias.add(cat);
  }
  return Array.from(categorias);
}

/** Devuelve los grupos musculares que carga una actividad: por ejercicio
 *  concreto si es fuerza y tenemos el detalle, o por tipo de actividad si es
 *  cardio (o fuerza sin detalle de series). */
function gruposDeActividad(act) {
  const clave = claveTipo(act);
  if (clave === "strength_training" || act.tipo === "fuerza") {
    const categorias = extraerCategoriasEjercicio(act);
    const grupos = new Set();
    for (const c of categorias) {
      (EJERCICIO_A_GRUPOS[c] || []).forEach((g) => grupos.add(g));
    }
    return grupos.size ? Array.from(grupos) : ["cuerpo_completo"];
  }
  return CARDIO_A_GRUPOS[clave] || [];
}

// Traduce nuestros grupos "lógicos" (pecho, hombros, ...) a los ids de
// músculo concretos de la librería body-muscles, por separado para la vista
// de delante y la de espalda (cada BodyChart solo entiende los ids de SU
// vista). Un mismo grupo puede aportar ids a las dos (p.ej. "piernas": quads
// delante, isquios/gemelos detrás).
const GRUPO_MUSCULOS_FRONT = {
  pecho: ["chest-upper-left", "chest-upper-right", "chest-lower-left", "chest-lower-right"],
  hombros: ["shoulder-front-left", "shoulder-front-right", "shoulder-side-left", "shoulder-side-right"],
  biceps: ["biceps-left", "biceps-right"],
  piernas: [
    "quads-left", "quads-right",
    "adductors-left", "adductors-right",
    "hip-flexor-left", "hip-flexor-right",
    "tibialis-anterior-left", "tibialis-anterior-right",
  ],
  core: [
    "abs-upper-left", "abs-upper-right",
    "abs-lower-left", "abs-lower-right",
    "obliques-left", "obliques-right",
    "serratus-anterior-left", "serratus-anterior-right",
  ],
};

const GRUPO_MUSCULOS_BACK = {
  hombros: ["deltoid-rear-left", "deltoid-rear-right", "traps-upper-left", "traps-upper-right"],
  triceps: ["triceps-long-left", "triceps-long-right", "triceps-lateral-left", "triceps-lateral-right"],
  espalda: [
    "lats-upper-left", "lats-upper-right",
    "lats-mid-left", "lats-mid-right",
    "lats-lower-left", "lats-lower-right",
    "spine",
    "lower-back-erectors-left", "lower-back-erectors-right",
    "lower-back-ql-left", "lower-back-ql-right",
    "traps-mid-left", "traps-mid-right",
    "traps-lower-left", "traps-lower-right",
  ],
  gluteos: ["gluteus-medius-left", "gluteus-medius-right", "gluteus-maximus-left", "gluteus-maximus-right"],
  piernas: [
    "hamstrings-medial-left", "hamstrings-medial-right",
    "hamstrings-lateral-left", "hamstrings-lateral-right",
    "calves-gastroc-medial-left", "calves-gastroc-medial-right",
    "calves-gastroc-lateral-left", "calves-gastroc-lateral-right",
    "calves-soleus-left", "calves-soleus-right",
  ],
};

/** Convierte "días desde el entreno" en la intensidad 0-10 que espera
 *  body-muscles (0 = gris/sin carga ... 10 = rojo intenso). */
function intensidadPorDias(dias) {
  if (dias <= 1) return 10; // hoy / ayer
  if (dias === 2) return 6;
  return 3; // 3 días (DIAS_DECAIMIENTO_CARGA ya filtra lo que pasa de ahí)
}

function diasDesde(fechaStr) {
  const fecha = new Date(fechaStr + "T00:00:00");
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round((hoy - fecha) / 86400000);
}

function textoDias(dias) {
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  return `hace ${dias} días`;
}

function colorPorDias(dias) {
  if (dias <= 1) return "carga-alta";
  if (dias === 2) return "carga-media";
  return "carga-baja";
}

function renderCargaMuscular(actividades) {
  const empty = document.getElementById("muscular-empty");
  const leyenda = document.getElementById("muscular-leyenda");

  // Por cada grupo muscular, nos quedamos con la actividad MÁS RECIENTE que
  // lo trabajó (si hay varias, la de menos días manda).
  const cargaPorGrupo = {};
  for (const act of actividades) {
    if (!act.fecha) continue;
    const dias = diasDesde(act.fecha);
    if (dias > DIAS_DECAIMIENTO_CARGA || dias < 0) continue;
    for (const g of gruposDeActividad(act)) {
      if (!cargaPorGrupo[g] || dias < cargaPorGrupo[g].dias) {
        cargaPorGrupo[g] = { dias, act };
      }
    }
  }

  // Pinta el diagrama de cuerpo: cada grupo con carga se traduce a los ids
  // de músculo de body-muscles (por delante y/o por espalda) con una
  // intensidad 0-10; el resto queda a 0 (gris) por no incluirse en bodyState.
  const grupos = GRUPO_ORDEN.filter((g) => cargaPorGrupo[g]);
  const frontState = {};
  const backState = {};
  for (const g of grupos) {
    const { dias } = cargaPorGrupo[g];
    const intensity = intensidadPorDias(dias);
    const idsFront = g === "cuerpo_completo" ? Object.values(GRUPO_MUSCULOS_FRONT).flat() : GRUPO_MUSCULOS_FRONT[g] || [];
    const idsBack = g === "cuerpo_completo" ? Object.values(GRUPO_MUSCULOS_BACK).flat() : GRUPO_MUSCULOS_BACK[g] || [];
    idsFront.forEach((id) => { frontState[id] = { intensity, selected: false }; });
    idsBack.forEach((id) => { backState[id] = { intensity, selected: false }; });
  }
  if (bodyChartFront) bodyChartFront.update({ bodyState: frontState });
  if (bodyChartBack) bodyChartBack.update({ bodyState: backState });

  // Leyenda textual con el detalle exacto (grupo, hace cuánto, con qué entreno)
  leyenda.innerHTML = "";
  empty.style.display = grupos.length ? "none" : "block";
  for (const g of grupos) {
    const { dias, act } = cargaPorGrupo[g];
    const color = colorPorDias(dias) === "carga-baja" ? "carga-media" : colorPorDias(dias);
    const item = document.createElement("span");
    item.className = "muscular-leyenda-item";
    item.innerHTML = `<span class="dot ${color}"></span> <strong>${GRUPO_LABELS[g] || g}</strong> · ${textoDias(dias)} (${actTipoLabel(act)})`;
    leyenda.appendChild(item);
  }
}

function renderUltimoEntreno(actividades) {
  const list = document.getElementById("ultimo-entreno-list");
  const empty = document.getElementById("ultimo-entreno-empty");
  list.innerHTML = "";

  if (!actividades.length) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  // El servidor ya devuelve las actividades ordenadas de más a menos
  // reciente, así que la fecha del primer elemento es "la última vez que
  // entrené". Mostramos TODAS las actividades de ese mismo día (si hubo
  // varias), no solo una.
  const fechaMasReciente = actividades[0].fecha;
  const delDia = actividades.filter((a) => a.fecha === fechaMasReciente);
  for (const act of delDia) {
    list.appendChild(crearActivityItem(act));
  }
}

// ---------- Bienestar ----------

// ---------- Riesgo de lesión / descanso: cálculo propio ----------
// En vez de leer el "training readiness" que calcula cada marca con una
// fórmula que no controlamos (y que dejó de traerse — ver extract_garmin.py),
// lo calculamos aquí a partir de datos crudos que cualquier fuente (Garmin
// hoy, otro dispositivo mañana) puede rellenar igual: sueño, batería al
// despertar, FC en reposo, y la carga de los entrenos recientes medida con
// ACWR (Acute:Chronic Workload Ratio — la métrica de carga/lesión más usada
// en deporte de equipo). Nada de caja negra: siempre se explican los
// factores que pesan en el resultado.
const RIESGO_MIN_DIAS_BASELINE = 5; // mínimo de días con dato para fiarse de "tu media"
const RIESGO_VENTANA_BASELINE = 14; // días previos a hoy para calcular esa media
const RIESGO_VENTANA_AGUDA = 7; // días para la carga "reciente"
const RIESGO_VENTANA_CRONICA = 28; // días para la carga "habitual"

function mediaMovil(valores) {
  const limpios = valores.filter((v) => v != null && !Number.isNaN(v));
  if (limpios.length < RIESGO_MIN_DIAS_BASELINE) return null;
  return limpios.reduce((s, v) => s + v, 0) / limpios.length;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/** No tenemos tu edad ni tu FC máxima real, así que se estima con el valor
 *  más alto visto en tu propio histórico de actividades (o 190 si todavía
 *  no hay ninguna con ese dato). */
function fcMaxEstimada(actividades) {
  let max = 0;
  for (const act of actividades) {
    const m = act.raw_garmin && act.raw_garmin.maxHR;
    if (m != null && m > max) max = m;
    if (act.fc_media != null && act.fc_media > max) max = act.fc_media;
  }
  return max > 120 ? max : 190;
}

/** Carga de una actividad para el ACWR: si tiene RPE anotado a mano (escala
 *  de esfuerzo percibido 1-10), duración × RPE — es el método estándar
 *  (Foster) y el más fiable porque lo dices tú. Si no lo has anotado, se
 *  estima con la FC media de la sesión frente a tu FC de reposo de ese día
 *  y tu FC máxima estimada. Nunca se deja en 0 (sesgaría la media a la
 *  baja); como último recurso se usa un RPE neutro (5/10). */
function cargaActividad(act, fcReposoDelDia, fcMax) {
  if (act.duracion_min == null) return 0;
  if (act.rpe != null) return act.duracion_min * act.rpe;
  if (act.fc_media != null && fcReposoDelDia != null && fcMax > fcReposoDelDia) {
    const intensidad = clamp((act.fc_media - fcReposoDelDia) / (fcMax - fcReposoDelDia), 0, 1);
    const rpeEstimado = 2 + intensidad * 8; // 0-1 -> 2-10
    return act.duracion_min * rpeEstimado;
  }
  return act.duracion_min * 5;
}

/** Cálculo puro del riesgo de lesión/descanso propio, sin tocar el DOM —
 *  así lo puede usar tanto la caja detallada de Bienestar como la tarjeta
 *  resumida de Resumen (y, en JS aparte, el widget de iOS). Recibe
 *  snapshots de wellness (histórico amplio, no solo lo que se ve en la
 *  gráfica) y actividades de al menos los últimos RIESGO_VENTANA_CRONICA
 *  días. Devuelve null si no hay ni un snapshot; { suficiente: false } si
 *  hay snapshots pero ningún componente es calculable todavía (poco
 *  histórico); si no, { score, nivel, nivelTexto, componentes,
 *  factoresNegativos }. */
function calcularRiesgo(snapshots, actividades) {
  if (!snapshots.length) return null;

  const hoy = snapshots[snapshots.length - 1];
  const historicoPrevio = snapshots.slice(0, -1).slice(-RIESGO_VENTANA_BASELINE);

  // ---- Recuperación: hoy vs. tu media de los últimos 14 días ----
  const mediaSueno = mediaMovil(historicoPrevio.map((s) => s.sueno_horas));
  const compSueno =
    mediaSueno != null && hoy.sueno_horas != null ? clamp((hoy.sueno_horas - mediaSueno) / 1.0, -2, 1) : null;

  const mediaBateria = mediaMovil(historicoPrevio.map((s) => s.bateria_corporal_inicio ?? s.bateria_corporal));
  const bateriaHoy = hoy.bateria_corporal_inicio ?? hoy.bateria_corporal;
  const compBateria =
    mediaBateria != null && bateriaHoy != null ? clamp((bateriaHoy - mediaBateria) / 15, -2, 1) : null;

  const mediaFc = mediaMovil(historicoPrevio.map((s) => s.fc_reposo));
  const compFc = mediaFc != null && hoy.fc_reposo != null ? clamp(-(hoy.fc_reposo - mediaFc) / 4, -2, 1) : null;

  // ---- Carga de entreno: ACWR (carga de los últimos 7 días / media semanal de los últimos 28) ----
  const fcMax = fcMaxEstimada(actividades);
  const snapshotPorFecha = {};
  snapshots.forEach((s) => (snapshotPorFecha[s.fecha] = s));
  const hoyFecha = new Date(hoy.fecha + "T00:00:00");
  const diasDesdeHoy = (fechaStr) => Math.round((hoyFecha - new Date(fechaStr + "T00:00:00")) / 86400000);

  let cargaAguda = 0;
  let cargaCronica = 0;
  const diasConEntreno = new Set();
  for (const act of actividades) {
    if (!act.fecha || act.duracion_min == null) continue;
    const dias = diasDesdeHoy(act.fecha);
    if (dias < 0 || dias >= RIESGO_VENTANA_CRONICA) continue;
    const fcReposoDelDia = snapshotPorFecha[act.fecha] && snapshotPorFecha[act.fecha].fc_reposo;
    const carga = cargaActividad(act, fcReposoDelDia ?? mediaFc, fcMax);
    cargaCronica += carga;
    diasConEntreno.add(act.fecha);
    if (dias < RIESGO_VENTANA_AGUDA) cargaAguda += carga;
  }
  // Con menos de ~4 días distintos de entreno en 28 días el ACWR no dice nada fiable.
  let compAcwr = null;
  let acwr = null;
  if (diasConEntreno.size >= 4 && cargaCronica > 0) {
    const cargaCronicaSemanal = cargaCronica / (RIESGO_VENTANA_CRONICA / 7);
    acwr = cargaCronicaSemanal > 0 ? cargaAguda / cargaCronicaSemanal : null;
    if (acwr != null) {
      if (acwr > 1.3) compAcwr = clamp(-(acwr - 1.3) / 0.3, -2, 0);
      else if (acwr < 0.8) compAcwr = clamp((-(0.8 - acwr) / 0.8) * 0.5, -1, 0);
      else compAcwr = 0.3; // zona recomendada 0.8-1.3
    }
  }

  const componentes = [
    {
      nombre: "sueño",
      valor: compSueno,
      detalle:
        mediaSueno != null && hoy.sueno_horas != null
          ? `${fmtMinSec(Math.round(hoy.sueno_horas * 60))} anoche vs. ${fmtMinSec(Math.round(mediaSueno * 60))} de media`
          : null,
    },
    {
      nombre: "batería al despertar",
      valor: compBateria,
      detalle:
        mediaBateria != null && bateriaHoy != null
          ? `${Math.round(bateriaHoy)}% hoy vs. ${Math.round(mediaBateria)}% de media`
          : null,
    },
    {
      nombre: "FC en reposo",
      valor: compFc,
      detalle:
        mediaFc != null && hoy.fc_reposo != null
          ? `${Math.round(hoy.fc_reposo)} ppm hoy vs. ${Math.round(mediaFc)} ppm de media`
          : null,
    },
    {
      nombre: "carga de entreno (ACWR)",
      valor: compAcwr,
      detalle: acwr != null ? `${acwr.toFixed(2)} (zona recomendada: 0.8-1.3)` : null,
    },
  ].filter((c) => c.valor != null);

  if (!componentes.length) return { suficiente: false };

  const suma = componentes.reduce((s, c) => s + c.valor, 0);
  const score = clamp(Math.round(50 + 12.5 * suma), 0, 100);
  const nivel =
    score < 30 ? "muy-alto" : score < 40 ? "alto" : score < 60 ? "neutro" : score < 70 ? "bajo" : "muy-bajo";
  const nivelTexto = {
    "muy-alto": "Riesgo muy alto",
    alto: "Riesgo alto",
    neutro: "Riesgo neutro",
    bajo: "Riesgo bajo",
    "muy-bajo": "Riesgo muy bajo",
  }[nivel];

  const factoresNegativos = componentes.filter((c) => c.valor < -0.3).sort((a, b) => a.valor - b.valor);

  return { suficiente: true, score, nivel, nivelTexto, componentes, factoresNegativos };
}

const CLASES_NIVEL_RIESGO = ["riesgo-muy-alto", "riesgo-alto", "riesgo-neutro", "riesgo-bajo", "riesgo-muy-bajo"];

/** Pinta la caja detallada de "riesgo de lesión y descanso" en Bienestar
 *  (score + qué factores pesan + el detalle de cada uno). */
function renderRiesgoPropio(snapshots, actividades) {
  const box = document.getElementById("wellness-readiness");
  box.classList.remove(...CLASES_NIVEL_RIESGO);

  const riesgo = calcularRiesgo(snapshots, actividades);
  if (!riesgo) {
    box.style.display = "none";
    return;
  }

  if (!riesgo.suficiente) {
    box.innerHTML = `
      <span class="wellness-readiness-titulo">Riesgo de lesión y descanso</span>
      <span class="wellness-readiness-item">Todavía no hay suficiente histórico (hacen falta ~2 semanas de sueño/batería/FC y varios entrenos) para calcular esto de forma fiable.</span>
    `;
    box.style.display = "flex";
    return;
  }

  const { score, nivel, nivelTexto, componentes, factoresNegativos } = riesgo;
  box.classList.add(`riesgo-${nivel}`);

  const explicacion = factoresNegativos.length
    ? `Pesan en contra: ${factoresNegativos.map((c) => c.nombre).join(", ")}.`
    : "Ningún factor destaca especialmente hoy.";

  const detalles = componentes
    .filter((c) => c.detalle)
    .map(
      (c) =>
        `<span class="wellness-readiness-item">${c.nombre[0].toUpperCase() + c.nombre.slice(1)}: ${c.detalle}</span>`
    )
    .join("");

  box.innerHTML = `
    <span class="wellness-readiness-titulo">${nivelTexto} <span class="wellness-readiness-score">(${score}/100)</span></span>
    <span class="wellness-readiness-item">${explicacion}</span>
    ${detalles}
    <span class="wellness-readiness-origen">Cálculo propio a partir de tu sueño, batería, FC en reposo y carga de entreno (con RPE si lo anotas en cada actividad) — no es lo que calcula Garmin, así que puede no coincidir con su app. Con poco histórico, tómalo con cautela.</span>
  `;
  box.style.display = "flex";
}

/** Tarjeta resumida de riesgo en Resumen: solo el nivel y el score, sin
 *  desglosar — el desglose completo está a un clic, en Bienestar (la
 *  tarjeta ya lleva ahí via data-ir-a-tab, como el resto de tarjetas
 *  "card-clicable"). */
function renderRiesgoResumen(snapshots, actividades) {
  const card = document.getElementById("rc-riesgo-card");
  const valorEl = document.getElementById("rc-riesgo");
  card.classList.remove(...CLASES_NIVEL_RIESGO);

  const riesgo = calcularRiesgo(snapshots, actividades);
  if (!riesgo || !riesgo.suficiente) {
    valorEl.textContent = "—";
    card.title = "Todavía no hay suficiente histórico para calcularlo.";
    return;
  }

  card.classList.add(`riesgo-${riesgo.nivel}`);
  valorEl.textContent = riesgo.nivelTexto.replace("Riesgo ", "");
  card.title = `${riesgo.nivelTexto} (${riesgo.score}/100) — toca para ver el desglose`;
}

// El cálculo de riesgo necesita ~35 días de histórico (ventana crónica de
// 28 + margen para la media móvil de 14), tanto de wellness como de
// entrenos. Se usa igual en Bienestar (caja detallada) y en Resumen
// (tarjeta compacta), así que se pide una vez desde aquí en los dos sitios
// en vez de duplicar el fetch.
const DIAS_HISTORICO_RIESGO = 35;

async function fetchHistoricoRiesgo(diasWellnessMin = DIAS_HISTORICO_RIESGO) {
  const diasFetch = Math.max(diasWellnessMin, DIAS_HISTORICO_RIESGO);
  const wellness = await apiGet(`/api/wellness?days=${diasFetch}`).catch(() => null);
  const snapshotsTodos = (wellness && wellness.snapshots) || [];

  const desdeRiesgo = new Date();
  desdeRiesgo.setDate(desdeRiesgo.getDate() - DIAS_HISTORICO_RIESGO);
  const garminRiesgo = await apiGet(
    `/api/garmin?tipo=todos&limit=200&desde=${fechaLocalISO(desdeRiesgo)}`
  ).catch(() => null);

  return { snapshotsTodos, actividades: (garminRiesgo && garminRiesgo.activities) || [], wellness };
}

async function loadWellness() {
  const days = parseInt(document.getElementById("wellness-days").value, 10) || 30;
  const { snapshotsTodos, actividades } = await fetchHistoricoRiesgo(days);
  const snapshots = snapshotsTodos.slice(-days);

  document.getElementById("wellness-empty").style.display = snapshots.length ? "none" : "block";
  renderRiesgoPropio(snapshotsTodos, actividades);

  if (!snapshots.length) return;

  const labels = snapshots.map((s) => s.fecha);
  const sleep = snapshots.map((s) => s.sueno_horas ?? null);

  // Batería corporal: en vez de un único punto (la última lectura del día),
  // se dibuja como una barra "flotante" entre el valor de inicio y el de
  // final del día, para que se vea cómo ha variado. Verde si terminó más
  // alta que empezó, naranja si terminó más baja (lo habitual).
  const batteryRango = snapshots.map((s) => {
    const inicio = s.bateria_corporal_inicio ?? s.bateria_corporal ?? null;
    const fin = s.bateria_corporal ?? s.bateria_corporal_inicio ?? null;
    if (inicio == null && fin == null) return null;
    return [inicio, fin];
  });
  const batteryColores = snapshots.map((s) => {
    const inicio = s.bateria_corporal_inicio;
    const fin = s.bateria_corporal;
    if (inicio == null || fin == null) return "#4FA3FF";
    return fin >= inicio ? "#00E676" : "#FF9100";
  });

  if (chartBattery) chartBattery.destroy();
  chartBattery = new Chart(document.getElementById("chart-battery"), {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: "Batería corporal: inicio → final (%)", data: batteryRango, backgroundColor: batteryColores, borderRadius: 4 }],
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: "Batería corporal (al despertar → al acostarte)" },
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const val = ctx.raw;
              if (!Array.isArray(val)) return "Sin datos";
              const [ini, fin] = val;
              const ventana = snapshots[ctx.dataIndex] && snapshots[ctx.dataIndex].bateria_corporal_ventana;
              const horaDespertar = ventana && ventana.despertar;
              const horaAcostarse = ventana && ventana.acostarse;
              return [
                `Al despertar${horaDespertar ? " (" + horaDespertar + ")" : ""}: ${Math.round(ini)}%`,
                `Al acostarte${horaAcostarse ? " (" + horaAcostarse + ")" : " (o última lectura)"}: ${Math.round(fin)}%`,
              ];
            },
          },
        },
      },
      scales: { y: { min: 0, max: 100 } },
    },
  });

  // Calorías por día: histograma con totales, activas y pasivas juntas.
  const kcalTotales = snapshots.map((s) => s.kcal_totales ?? null);
  const kcalActivas = snapshots.map((s) => s.kcal_activas ?? null);
  const kcalPasivas = snapshots.map((s) => s.kcal_pasivas ?? null);

  if (chartKcal) chartKcal.destroy();
  chartKcal = new Chart(document.getElementById("chart-kcal"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Totales", data: kcalTotales, backgroundColor: "#2D82FF" },
        { label: "Activas", data: kcalActivas, backgroundColor: "#00E676" },
        { label: "Pasivas", data: kcalPasivas, backgroundColor: "#4C5975" },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: { title: { display: true, text: "Calorías por día" } },
    },
  });

  if (chartSleep) chartSleep.destroy();
  chartSleep = new Chart(document.getElementById("chart-sleep"), {
    type: "bar",
    data: { labels, datasets: [{ label: "Horas de sueño", data: sleep, backgroundColor: "#00C4B3" }] },
    options: {
      maintainAspectRatio: false,
      plugins: { title: { display: true, text: "Sueño" } },
    },
  });
}

document.getElementById("wellness-reload").addEventListener("click", loadWellness);

// ---------- Garmin actividades ----------
// Etiquetas "bonitas" para los tipos de actividad de Garmin que conocemos;
// cualquier tipo nuevo que no esté aquí se formatea automáticamente
// (p. ej. "indoor_cycling" -> "Indoor cycling") en vez de agruparse en "Otro".
const GARMIN_TIPO_LABELS = {
  running: "Running",
  trail_running: "Trail running",
  treadmill_running: "Running (cinta)",
  strength_training: "Entreno de fuerza",
  hiit: "HIIT",
  cycling: "Ciclismo",
  indoor_cycling: "Ciclismo indoor",
  walking: "Andar",
  swimming: "Natación",
  lap_swimming: "Natación (piscina)",
  yoga: "Yoga",
  futsal: "Futsal",
};

/** Clave con la que se agrupa/filtra una actividad: el tipo específico de
 *  Garmin si lo tenemos, o si no la categoría genérica que ya calculó el script. */
function claveTipo(act) {
  return act.tipo_garmin || act.tipo || "otro";
}

function formatTipoGarmin(key) {
  if (GARMIN_TIPO_LABELS[key]) return GARMIN_TIPO_LABELS[key];
  if (!key) return "Otro";
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function actTipoLabel(act) {
  return formatTipoGarmin(claveTipo(act));
}

/** Extrae de forma defensiva las series de ejercicios (peso/reps) si Garmin las trae.
 *  La forma exacta del JSON de Garmin puede variar; si no se reconoce, se muestra
 *  igualmente el resto de datos de la actividad. */
// ---------- "Ver más datos" en el detalle de actividad ----------
// Nombres de campo tal cual los devuelve el resumen de actividad de Garmin
// Connect (pueden variar algo según el tipo de reloj/actividad); cualquier
// campo que no aparezca simplemente no se muestra, no rompe nada.
const CAMPOS_EXTRA_ACTIVIDAD = [
  { claves: ["averageRunningCadenceInStepsPerMinute", "averageBikingCadenceInRevPerMinute", "avgCadence"], label: "Cadencia media", fmt: (v) => Math.round(v) + " spm" },
  { claves: ["maxRunningCadenceInStepsPerMinute", "maxBikingCadenceInRevPerMinute", "maxCadence"], label: "Cadencia máxima", fmt: (v) => Math.round(v) + " spm" },
  { claves: ["avgPower"], label: "Potencia media", fmt: (v) => Math.round(v) + " W" },
  { claves: ["maxPower"], label: "Potencia máxima", fmt: (v) => Math.round(v) + " W" },
  { claves: ["normPower"], label: "Potencia normalizada", fmt: (v) => Math.round(v) + " W" },
  { claves: ["avgStrideLength"], label: "Zancada media", fmt: (v) => (v / 100).toFixed(2) + " m" },
  { claves: ["avgVerticalOscillation"], label: "Oscilación vertical", fmt: (v) => v.toFixed(1) + " cm" },
  { claves: ["avgGroundContactTime"], label: "Tiempo de contacto (vuelo)", fmt: (v) => Math.round(v) + " ms" },
  { claves: ["avgVerticalRatio"], label: "Ratio vertical", fmt: (v) => v.toFixed(1) + " %" },
  { claves: ["maxHR"], label: "FC máxima", fmt: (v) => Math.round(v) + " ppm" },
  { claves: ["recoveryHeartRate"], label: "FC recuperación", fmt: (v) => Math.round(v) + " ppm" },
  { claves: ["activityTrainingLoad"], label: "Carga de entreno", fmt: (v) => Math.round(v) },
  { claves: ["elevationLoss"], label: "Desnivel −", fmt: (v) => Math.round(v) + " m" },
  { claves: ["moderateIntensityMinutes"], label: "Min. intensidad moderada", fmt: (v) => Math.round(v) + " min" },
  { claves: ["vigorousIntensityMinutes"], label: "Min. intensidad vigorosa", fmt: (v) => Math.round(v) + " min" },
  { claves: ["minTemperature"], label: "Temp. mín", fmt: (v) => Math.round(v) + " °C" },
  { claves: ["maxTemperature"], label: "Temp. máx", fmt: (v) => Math.round(v) + " °C" },
];

function extraerStatsExtra(act) {
  const raw = act.raw_garmin || {};
  const stats = [];
  for (const campo of CAMPOS_EXTRA_ACTIVIDAD) {
    const clave = campo.claves.find((c) => raw[c] != null);
    if (clave) stats.push({ label: campo.label, value: campo.fmt(raw[clave]) });
  }
  return stats;
}

/** Zonas de frecuencia cardiaca (1-5) si Garmin las trajo, con el % del
 *  tiempo total del entreno pasado en cada una. */
function extraerZonasFC(act) {
  const raw = act.raw_garmin || {};
  const zonas = [];
  for (let z = 1; z <= 5; z++) {
    const clave = ["hrTimeInZone_" + z, "hrTimeInZone" + z].find((c) => raw[c] != null);
    if (clave) zonas.push({ zona: z, segundos: raw[clave] });
  }
  return zonas;
}

function extraerSeriesEjercicio(act) {
  const raw = act.ejercicios_raw;
  if (!raw) return null;
  const sets = raw.exerciseSets || raw.exercise_sets || [];
  if (!Array.isArray(sets) || !sets.length) return null;
  return sets
    .filter((s) => (s.setType || s.set_type || "ACTIVE") !== "REST")
    .map((s) => {
      const nombre =
        (s.exercises && s.exercises[0] && (s.exercises[0].name || s.exercises[0].category)) ||
        s.category ||
        "Ejercicio";
      const pesoG = s.weight ?? s.weight_g ?? null;
      return {
        nombre,
        repeticiones: s.repetitionCount ?? s.repetition_count ?? null,
        peso_kg: pesoG != null ? Math.round((pesoG / 1000) * 10) / 10 : null,
        duracion_seg: s.duration ?? null,
      };
    });
}

function renderActivityDetail(act) {
  const stats = [
    { label: "Duración", value: fmtMinSec(act.duracion_min) },
    { label: "Distancia", value: act.distancia_km != null ? act.distancia_km + " km" : "—" },
    { label: "FC media", value: act.fc_media ?? "—" },
    { label: "Calorías", value: act.calorias ?? "—" },
  ];
  const extra = act.raw_garmin || {};
  if (extra.vO2MaxValue != null) stats.push({ label: "VO2 Max", value: extra.vO2MaxValue });
  if (extra.aerobicTrainingEffect != null) stats.push({ label: "Efecto aeróbico", value: extra.aerobicTrainingEffect });
  if (extra.anaerobicTrainingEffect != null) stats.push({ label: "Efecto anaeróbico", value: extra.anaerobicTrainingEffect });
  if (extra.elevationGain != null) stats.push({ label: "Desnivel +", value: extra.elevationGain + " m" });

  const statsHtml = stats
    .map((s) => `<div class="activity-stat"><span class="label">${s.label}</span><span class="value">${s.value}</span></div>`)
    .join("");

  const series = extraerSeriesEjercicio(act);
  let ejerciciosHtml = "";
  if (series && series.length) {
    ejerciciosHtml = `
      <table class="exercise-table">
        <thead><tr><th>Ejercicio</th><th>Reps</th><th>Peso</th></tr></thead>
        <tbody>
          ${series
            .map(
              (s) => `<tr><td>${s.nombre}</td><td>${s.repeticiones ?? "—"}</td><td>${s.peso_kg != null ? s.peso_kg + " kg" : "—"}</td></tr>`
            )
            .join("")}
        </tbody>
      </table>`;
  } else if (claveTipo(act) === "strength_training" || act.tipo === "fuerza") {
    ejerciciosHtml = `<p class="hint">No hay detalle de series/repeticiones para este entreno.</p>`;
  }

  // "Ver más datos": cadencia, potencia, zancada, tiempo de contacto,
  // zonas de FC, etc. — todo lo que Garmin trae en el resumen crudo de la
  // actividad y que antes se descartaba. Nota: el recorrido GPS (mapa) no
  // se muestra todavía — pedirlo requeriría una llamada extra por actividad
  // a la API de Garmin, con riesgo de rate-limit en el sync.
  const extraStats = extraerStatsExtra(act);
  const zonasFC = extraerZonasFC(act);
  let extraHtml = "";
  if (extraStats.length || zonasFC.length) {
    const extraStatsHtml = extraStats
      .map((s) => `<div class="activity-stat"><span class="label">${s.label}</span><span class="value">${s.value}</span></div>`)
      .join("");
    let zonasHtml = "";
    if (zonasFC.length) {
      const totalSeg = zonasFC.reduce((s, z) => s + z.segundos, 0) || 1;
      zonasHtml = `
        <p class="activity-detail-section-titulo">Tiempo en zonas de FC</p>
        <div class="activity-stats-grid-extra">
          ${zonasFC
            .map(
              (z) =>
                `<div class="activity-stat"><span class="label">Zona ${z.zona}</span><span class="value">${fmtMinSec(Math.round(z.segundos / 60))} (${Math.round((z.segundos / totalSeg) * 100)}%)</span></div>`
            )
            .join("")}
        </div>`;
    }
    extraHtml = `
      <div class="activity-extra" style="display:none;">
        ${extraStats.length ? `<p class="activity-detail-section-titulo">Más datos de Garmin</p><div class="activity-stats-grid-extra">${extraStatsHtml}</div>` : ""}
        ${zonasHtml}
      </div>
      <button type="button" class="activity-ver-mas-btn">Ver más datos ▾</button>
    `;
  }

  // Esfuerzo percibido (RPE, 1-10): lo anotas tú a mano y alimenta el
  // cálculo propio de carga de entreno (ACWR) de la caja de riesgo de
  // lesión en Bienestar — con esto es más fiable que estimarlo solo con la
  // FC media de la sesión.
  const rpeHtml = renderRpeSelector(act);

  const notasHtml = act.notas
    ? `<p class="activity-detail-section-titulo">Notas</p><p class="hint activity-notas">${act.notas}</p>`
    : "";

  return `<div class="activity-stats-grid">${statsHtml}</div>${ejerciciosHtml}${extraHtml}${notasHtml}${rpeHtml}`;
}

function renderRpeSelector(act) {
  const valorActual = act.rpe ?? null;
  const botones = Array.from({ length: 10 }, (_, i) => i + 1)
    .map((n) => `<button type="button" class="rpe-btn${valorActual === n ? " selected" : ""}" data-rpe="${n}">${n}</button>`)
    .join("");
  const etiqueta = valorActual != null ? `guardado: ${valorActual}/10` : "sin anotar — para el cálculo de carga";
  return `
    <div class="activity-rpe">
      <p class="activity-detail-section-titulo activity-rpe-titulo">Esfuerzo percibido (RPE) — ${etiqueta}</p>
      <div class="rpe-selector">${botones}</div>
    </div>
  `;
}

/** Construye el elemento <div class="activity-item"> plegable/desplegable
 *  usado tanto en la pestaña Garmin como en la tarjeta "Último entreno" del
 *  Resumen, para no duplicar el mismo markup en dos sitios. */
function crearActivityItem(act) {
  const item = document.createElement("div");
  item.className = "activity-item";
  item.innerHTML = `
    <div class="activity-summary">
      <div class="activity-summary-main">
        <span class="activity-tipo">${actTipoLabel(act)}${act.manual ? '<span class="activity-manual-badge">manual</span>' : ""}</span>
        <span class="activity-fecha">${act.fecha ?? "—"}</span>
      </div>
      <div class="activity-summary-right">
        <span>${fmtMinSec(act.duracion_min)}</span>
        <span class="activity-chevron">▶</span>
      </div>
    </div>
    <div class="activity-detail"></div>
  `;
  const detail = item.querySelector(".activity-detail");
  const summary = item.querySelector(".activity-summary");
  summary.addEventListener("click", () => {
    const abierto = item.classList.toggle("open");
    if (abierto && !detail.dataset.loaded) {
      detail.innerHTML = renderActivityDetail(act);
      detail.dataset.loaded = "1";
      const verMasBtn = detail.querySelector(".activity-ver-mas-btn");
      if (verMasBtn) {
        verMasBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const extra = detail.querySelector(".activity-extra");
          const visible = extra.style.display !== "none";
          extra.style.display = visible ? "none" : "block";
          verMasBtn.textContent = visible ? "Ver más datos ▾" : "Ocultar datos ▲";
        });
      }
      const rpeSelector = detail.querySelector(".rpe-selector");
      const rpeTitulo = detail.querySelector(".activity-rpe-titulo");
      if (rpeSelector) {
        rpeSelector.querySelectorAll(".rpe-btn").forEach((btn) => {
          btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const rpe = parseInt(btn.dataset.rpe, 10);
            rpeSelector.querySelectorAll(".rpe-btn").forEach((b) => b.classList.remove("selected"));
            btn.classList.add("selected");
            if (rpeTitulo) rpeTitulo.textContent = `Esfuerzo percibido (RPE) — guardando...`;
            try {
              const res = await conAuth(() =>
                fetch("/api/garmin", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ fecha: act.fecha, id: act.id, rpe }),
                })
              );
              const data = await res.json().catch(() => ({}));
              if (data.ok) {
                act.rpe = rpe; // refleja en el objeto en memoria (afecta al próximo cálculo de riesgo)
                if (rpeTitulo) rpeTitulo.textContent = `Esfuerzo percibido (RPE) — guardado: ${rpe}/10`;
              } else {
                if (rpeTitulo) rpeTitulo.textContent = `Esfuerzo percibido (RPE) — sin anotar — para el cálculo de carga`;
                mostrarToast(`Error al guardar el RPE: ${data.error || "desconocido"}`, { id: "rpe" });
              }
            } catch (err) {
              if (rpeTitulo) rpeTitulo.textContent = `Esfuerzo percibido (RPE) — sin anotar — para el cálculo de carga`;
              mostrarToast("Error de red al guardar el RPE.", { id: "rpe" });
            }
          });
        });
      }
    }
  });
  return item;
}

let garminActividadesCache = [];

/** Reconstruye las opciones del desplegable "Tipo" a partir de los tipos
 *  que realmente hay en los datos cargados, en vez de una lista fija. */
function actualizarSelectorTipoGarmin() {
  const select = document.getElementById("garmin-tipo");
  const valorPrevio = select.value;
  const tipos = Array.from(new Set(garminActividadesCache.map(claveTipo))).sort((a, b) =>
    formatTipoGarmin(a).localeCompare(formatTipoGarmin(b))
  );
  select.innerHTML =
    '<option value="todos">Todos</option>' +
    tipos.map((t) => `<option value="${t}">${formatTipoGarmin(t)}</option>`).join("");
  if (valorPrevio === "todos" || tipos.includes(valorPrevio)) select.value = valorPrevio;
}

/** Fecha "desde" (YYYY-MM-DD) según el rango elegido en el filtro de
 *  Entrenos. "todo" no filtra por fecha (devuelve null). Por defecto el
 *  desplegable empieza en "semana" para que la pestaña cargue rápido (antes
 *  traía todas las actividades sincronizadas, que tardaba mucho). */
function desdeParaRango(rango) {
  const d = new Date();
  if (rango === "semana") {
    const diaSemana = (d.getDay() + 6) % 7; // 0 = lunes
    d.setDate(d.getDate() - diaSemana);
  } else if (rango === "mes") {
    d.setDate(1);
  } else if (rango === "3meses") {
    d.setMonth(d.getMonth() - 3);
  } else {
    return null; // "todo"
  }
  return fechaLocalISO(d);
}

/** Límites {desde, hasta} (YYYY-MM-DD o null) según el filtro de periodo.
 *  Para "personalizado" los lee de los inputs de fecha; para el resto,
 *  "hasta" siempre es null (hasta hoy) y "desde" sale de desdeParaRango(). */
function limitesRango() {
  const rango = document.getElementById("garmin-rango").value;
  if (rango === "personalizado") {
    return {
      desde: document.getElementById("garmin-desde").value || null,
      hasta: document.getElementById("garmin-hasta").value || null,
    };
  }
  return { desde: desdeParaRango(rango), hasta: null };
}

function actualizarVisibilidadFechasPersonalizadas() {
  const esPersonalizado = document.getElementById("garmin-rango").value === "personalizado";
  document.getElementById("garmin-desde-label").style.display = esPersonalizado ? "" : "none";
  document.getElementById("garmin-hasta-label").style.display = esPersonalizado ? "" : "none";
}

// Trae las actividades del servidor ya acotadas por "desde" (el servidor
// sabe cortar el listado ahí); "hasta" no lo soporta la API (pensada para
// "desde hoy hacia atrás"), así que en el rango personalizado se recorta
// aparte, en el cliente. El filtrado por tipo se sigue haciendo en el
// cliente, así el desplegable de tipo puede construirse con los tipos
// reales que hay en ese rango.
async function loadGarmin() {
  const { desde, hasta } = limitesRango();
  const url = desde ? `/api/garmin?tipo=todos&limit=200&desde=${desde}` : `/api/garmin?tipo=todos&limit=200`;
  const data = await apiGet(url);
  let activities = data.activities || [];
  if (hasta) activities = activities.filter((a) => a.fecha <= hasta);
  garminActividadesCache = activities;
  actualizarSelectorTipoGarmin();
  renderGarminList();
  cargarCalendarioEntrenos();
}

// Color fijo por tipo de entreno: SIEMPRE el mismo tipo -> el mismo color,
// pase lo que pase con qué otros tipos aparezcan al lado (nunca se asigna
// por índice/orden, que cambia según el filtro). Los tipos que no están
// aquí caen en el color "otro".
//
// Toda la gama son tonos de azul: el rojo/amarillo/verde y el gris quedan
// reservados para semáforos e indicadores de estado (riesgo de lesión,
// goles de error/dudoso/nada que hacer); esto es solo una distribución,
// sin ninguna lectura de "bueno/malo", así que no debía competir
// visualmente con esos otros colores.
const TIPO_ENTRENO_COLOR = {
  futsal: "#0F78F0",
  strength_training: "#318DF6",
  fuerza: "#318DF6",
  hiit: "#1866BF",
  running: "#5AA3F6",
  cycling: "#185395",
  indoor_cycling: "#185395",
  walking: "#86B9F3",
  swimming: "#143F71",
  lap_swimming: "#143F71",
  yoga: "#0E2C4E",
  otro: "#5F6F81",
};
function colorTipoEntreno(clave) {
  return TIPO_ENTRENO_COLOR[clave] || TIPO_ENTRENO_COLOR.otro;
}

/** Color de texto legible (claro u oscuro) sobre un fondo hexadecimal
 *  dado, según su luminancia relativa — necesario aquí porque la gama de
 *  azules va de tonos muy oscuros a bastante claros, así que un único
 *  color de texto fijo no seria legible en todos los casos. */
function colorTextoSobre(hex) {
  const [r, g, b] = hex.match(/[0-9a-f]{2}/gi).map((h) => parseInt(h, 16) / 255);
  const toLin = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const luminancia = 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
  return luminancia > 0.35 ? "var(--bg-main)" : "var(--text-primary)";
}

/** Algoritmo "squarify" (Bruls/Huizing/van Wijk) para un treemap: reparte
 *  un rectángulo x0,y0,w0,h0 en sub-rectángulos cuya área es proporcional
 *  al "value" de cada item, intentando mantenerlos lo más cuadrados
 *  posible (evita tiras finísimas ilegibles). `values` debe venir ya
 *  ordenado de mayor a menor. Devuelve cada item con {x,y,w,h} añadidos,
 *  en las mismas unidades que x0/y0/w0/h0 (aquí, puntos porcentuales). */
function squarify(values, x0, y0, w0, h0) {
  const result = [];
  function worst(lens, length) {
    let max = -Infinity, min = Infinity, sum = 0;
    for (const v of lens) {
      if (v > max) max = v;
      if (v < min) min = v;
      sum += v;
    }
    const s2 = sum * sum, l2 = length * length;
    return Math.max((l2 * max) / s2, s2 / (l2 * min));
  }
  function layoutRow(row, x, y, w, h, horizontal) {
    const sum = row.reduce((s, r) => s + r.value, 0);
    let offset = 0;
    for (const item of row) {
      const frac = sum > 0 ? item.value / sum : 0;
      if (horizontal) {
        const rw = frac * w;
        result.push({ ...item, x: x + offset, y, w: rw, h });
        offset += rw;
      } else {
        const rh = frac * h;
        result.push({ ...item, x, y: y + offset, w, h: rh });
        offset += rh;
      }
    }
  }
  function recurse(items, x, y, w, h) {
    if (!items.length) return;
    if (items.length === 1) {
      result.push({ ...items[0], x, y, w, h });
      return;
    }
    const total = items.reduce((s, i) => s + i.value, 0);
    const length = Math.min(w, h);
    const scale = (w * h) / total;
    let row = [items[0]];
    let i = 1;
    while (i < items.length) {
      const nextRow = row.concat(items[i]);
      const rowLen = row.map((v) => v.value * scale);
      const nextLen = nextRow.map((v) => v.value * scale);
      if (worst(rowLen, length) >= worst(nextLen, length)) {
        row = nextRow;
        i++;
      } else break;
    }
    const remaining = items.slice(row.length);
    const rowSum = row.reduce((a, b) => a + b.value, 0);
    const rowArea = rowSum * scale;
    const horizontal = w >= h;
    if (horizontal) {
      const rowWidth = rowArea / h;
      layoutRow(row, x, y, rowWidth, h, false);
      recurse(remaining, x + rowWidth, y, w - rowWidth, h);
    } else {
      const rowHeight = rowArea / w;
      layoutRow(row, x, y, w, rowHeight, true);
      recurse(remaining, x, y + rowHeight, w, h - rowHeight);
    }
  }
  recurse(values, x0, y0, w0, h0);
  return result;
}

/** Treemap (cuadrilátero dividido en cuadriláteros más grandes o pequeños
 *  según la duración) con la distribución del tipo de entrenamiento en el
 *  periodo filtrado. Solo tiene sentido viendo TODOS los tipos a la vez —
 *  si se filtra por uno concreto no hay nada que distribuir, así que el
 *  bloque entero se oculta. */
function renderDistribucionTipos(actividades) {
  const container = document.getElementById("garmin-distribucion-container");
  const treemapEl = document.getElementById("treemap-tipos-entreno");
  const tipo = document.getElementById("garmin-tipo").value;

  if (tipo !== "todos" || !actividades.length) {
    container.style.display = "none";
    return;
  }

  const duracionPorTipo = {};
  for (const act of actividades) {
    const clave = claveTipo(act);
    duracionPorTipo[clave] = (duracionPorTipo[clave] || 0) + (act.duracion_min || 0);
  }
  const items = Object.keys(duracionPorTipo)
    .map((clave) => ({ clave, value: Math.round(duracionPorTipo[clave]) }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);

  if (!items.length) {
    container.style.display = "none";
    return;
  }

  container.style.display = "flex";
  treemapEl.innerHTML = "";

  const total = items.reduce((s, i) => s + i.value, 0);
  // El contenedor ya no es cuadrado (ahora es rectangular, del mismo ancho
  // que el calendario), así que el squarify se calcula sobre su forma real
  // en píxeles — si se calculara sobre un cuadrado ficticio de 100x100 y
  // luego se estirara a un rectángulo ancho, los rectángulos "cuadrados"
  // del algoritmo saldrían distorsionados (más anchos que altos de más).
  const rectContenedor = treemapEl.getBoundingClientRect();
  const anchoPx = rectContenedor.width || 300;
  const altoPx = rectContenedor.height || 220;
  const rects = squarify(items, 0, 0, anchoPx, altoPx);

  for (const r of rects) {
    const cell = document.createElement("div");
    cell.className = "treemap-cell";
    cell.style.left = (r.x / anchoPx) * 100 + "%";
    cell.style.top = (r.y / altoPx) * 100 + "%";
    cell.style.width = (r.w / anchoPx) * 100 + "%";
    cell.style.height = (r.h / altoPx) * 100 + "%";
    const colorFondo = colorTipoEntreno(r.clave);
    cell.style.background = colorFondo;
    cell.style.color = colorTextoSobre(colorFondo);
    const pct = Math.round((r.value / total) * 100);
    cell.title = `${formatTipoGarmin(r.clave)}: ${fmtMinSec(r.value)} (${pct}%)`;
    // Si el rectángulo es demasiado pequeño (en píxeles reales), el texto
    // no cabe y se omite (queda igualmente el color + el tooltip al
    // pasar/tocar).
    if (r.w >= 60 && r.h >= 28) {
      const label = document.createElement("span");
      label.className = "treemap-cell-label";
      label.textContent = formatTipoGarmin(r.clave);
      cell.appendChild(label);
      if (r.h >= 44) {
        const value = document.createElement("span");
        value.className = "treemap-cell-value";
        value.textContent = fmtMinSec(r.value);
        cell.appendChild(value);
      }
    }
    treemapEl.appendChild(cell);
  }
}

// ---------- Calendario de entrenos (estilo "heatmap de commits" de GitHub) ----------
const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/** El calendario no depende del filtro de "Periodo" de arriba (igual que el
 *  gráfico de contribuciones de GitHub no depende de ningún filtro externo):
 *  tiene su propio selector de nº de meses (por defecto 3) y pide sus
 *  propios datos en vez de reutilizar garminActividadesCache. */
async function cargarCalendarioEntrenos() {
  const meses = parseInt(document.getElementById("calendario-meses").value, 10) || 3;
  const desde = new Date();
  desde.setMonth(desde.getMonth() - meses);
  const desdeStr = fechaLocalISO(desde);
  let actividades = [];
  try {
    const data = await apiGet(`/api/garmin?tipo=todos&limit=1000&desde=${desdeStr}`);
    actividades = data.activities || [];
  } catch (e) {
    console.error("No se pudo cargar el calendario de entrenos:", e);
  }
  renderCalendarioEntrenos(actividades, meses);
}

function renderCalendarioEntrenos(actividades, meses) {
  const container = document.getElementById("garmin-calendario-container");
  const el = document.getElementById("calendario-entrenos");

  if (!actividades.length) {
    container.style.display = "none";
    return;
  }
  container.style.display = "block";
  el.innerHTML = "";

  const minutosPorDia = {};
  for (const act of actividades) {
    if (!act.fecha) continue;
    minutosPorDia[act.fecha] = (minutosPorDia[act.fecha] || 0) + (act.duracion_min || 0);
  }
  const maxMinutos = Math.max(1, ...Object.values(minutosPorDia));

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const inicio = new Date(hoy);
  inicio.setMonth(inicio.getMonth() - meses);
  // Retrocede hasta el lunes de esa semana, para que las columnas queden
  // alineadas lunes-domingo de arriba abajo.
  const diaSemanaISO = (inicio.getDay() + 6) % 7; // 0=lunes .. 6=domingo
  inicio.setDate(inicio.getDate() - diaSemanaISO);

  // Tamaño de celda dinámico: con pocos meses filtrados (pocas semanas) el
  // calendario quedaba apretado en la esquina izquierda con un rectángulo
  // vacío al lado. Calculando el tamaño de celda a partir del ancho
  // disponible / nº de semanas, el calendario rellena siempre todo el
  // ancho de la tarjeta; solo si hay demasiadas semanas para que las
  // celdas sigan siendo legibles (rangos largos, 12-24 meses) se fija un
  // tamaño mínimo y aparece scroll horizontal, como en GitHub.
  const totalDias = Math.floor((hoy - inicio) / 86400000) + 1;
  const numSemanas = Math.ceil(totalDias / 7);
  const scrollEl = el.parentElement;
  const anchoDisponible = scrollEl.clientWidth || 300;
  const gapPx = numSemanas > 40 ? 2 : 3;
  const CELL_MIN = 9;
  let cellSize = (anchoDisponible - gapPx * (numSemanas - 1)) / numSemanas;
  cellSize = Math.max(CELL_MIN, Math.floor(cellSize));
  const rellenaSinScroll = cellSize * numSemanas + gapPx * (numSemanas - 1) <= anchoDisponible + 1;

  el.style.gap = gapPx + "px";
  el.style.gridTemplateRows = `16px repeat(7, ${cellSize}px)`;
  el.style.gridAutoColumns = `${cellSize}px`;
  el.style.width = rellenaSinScroll ? "100%" : "max-content";

  const etiquetasMes = [{ weekIndex: 0, texto: MESES_CORTOS[inicio.getMonth()] }];
  let mesVisto = `${inicio.getFullYear()}-${inicio.getMonth()}`;

  const cursor = new Date(inicio);
  let dia = 0;
  while (cursor <= hoy) {
    const weekIndex = Math.floor(dia / 7);
    const weekday = (cursor.getDay() + 6) % 7;
    const fechaStr = fechaLocalISO(cursor);
    const minutos = minutosPorDia[fechaStr] || 0;
    const nivel = minutos <= 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((minutos / maxMinutos) * 4)));

    const celda = document.createElement("div");
    celda.className = `training-calendar-day nivel-${nivel}`;
    celda.style.gridColumn = String(weekIndex + 1);
    celda.style.gridRow = String(weekday + 2);
    const etiquetaFecha = cursor.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
    celda.title = minutos > 0 ? `${etiquetaFecha}: ${fmtMinSec(minutos)} de entreno` : `${etiquetaFecha}: sin entreno`;
    celda.addEventListener("click", () => mostrarToast(celda.title, { id: "calendario-dia", duracion: 2500 }));
    el.appendChild(celda);

    if (cursor.getDate() === 1) {
      const clave = `${cursor.getFullYear()}-${cursor.getMonth()}`;
      if (clave !== mesVisto) {
        mesVisto = clave;
        etiquetasMes.push({ weekIndex, texto: MESES_CORTOS[cursor.getMonth()] });
      }
    }

    cursor.setDate(cursor.getDate() + 1);
    dia++;
  }

  // Si dos etiquetas de mes quedan a menos de 2 columnas de distancia (p.ej.
  // el calendario arranca a finales de mes, justo antes de que empiece el
  // siguiente) se solapan ("SepOct"). En ese caso se descarta la primera,
  // que además es la de un mes casi sin columnas propias.
  const mesesFiltrados = etiquetasMes.filter((m, i) => {
    const siguiente = etiquetasMes[i + 1];
    return !siguiente || siguiente.weekIndex - m.weekIndex >= 2;
  });

  for (const m of mesesFiltrados) {
    const label = document.createElement("div");
    label.className = "training-calendar-month-label";
    label.style.gridColumn = String(m.weekIndex + 1);
    label.textContent = m.texto;
    el.appendChild(label);
  }
}

function renderGarminList() {
  const tipo = document.getElementById("garmin-tipo").value;
  const activities =
    tipo === "todos" ? garminActividadesCache : garminActividadesCache.filter((a) => claveTipo(a) === tipo);

  renderDistribucionTipos(garminActividadesCache);

  const list = document.getElementById("garmin-list");
  list.innerHTML = "";
  document.getElementById("garmin-empty").style.display = activities.length ? "none" : "block";

  for (const act of activities) {
    list.appendChild(crearActivityItem(act));
  }
}

document.getElementById("garmin-reload").addEventListener("click", loadGarmin);
document.getElementById("garmin-rango").addEventListener("change", () => {
  actualizarVisibilidadFechasPersonalizadas();
  if (document.getElementById("garmin-rango").value !== "personalizado") loadGarmin();
});
document.getElementById("garmin-desde").addEventListener("change", loadGarmin);
document.getElementById("garmin-hasta").addEventListener("change", loadGarmin);
document.getElementById("garmin-tipo").addEventListener("change", renderGarminList);
document.getElementById("calendario-meses").addEventListener("change", cargarCalendarioEntrenos);

// ---------- Toasts del FAB ----------
const fabToastContainer = document.getElementById("fabToastContainer");
const fabToastTimers = {};

/** Muestra (o actualiza, si ya hay uno con el mismo "id") un toast flotante
 *  encima del FAB. Con duracion=0 se queda fijo hasta el siguiente
 *  mostrarToast con ese mismo id (útil mientras dura la sincronización). */
function mostrarToast(mensaje, { id = "default", duracion = 5000 } = {}) {
  let toast = fabToastContainer.querySelector(`[data-toast-id="${id}"]`);
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "fab-toast";
    toast.dataset.toastId = id;
    fabToastContainer.appendChild(toast);
  }
  toast.textContent = mensaje;
  requestAnimationFrame(() => toast.classList.add("show"));

  if (fabToastTimers[id]) clearTimeout(fabToastTimers[id]);
  if (duracion > 0) {
    fabToastTimers[id] = setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 250);
    }, duracion);
  }
}

// ---------- Autenticación "perezosa": intenta primero, pide login solo si hace falta ----------
// Antes se pedía la contraseña ANTES de cada sync/partido, aunque la sesión
// (cookie de 48h) siguiera viva. Ahora se intenta la acción directamente; si
// el servidor responde 401 (sesión caducada o inexistente) se abre el modal
// de login una sola vez y, en cuanto entras, se reintenta automáticamente la
// misma acción — así solo lo notas cuando de verdad ha caducado.
async function conAuth(fn) {
  const res = await fn();
  if (res.status !== 401) return res;
  return new Promise((resolve, reject) => {
    pendingAfterLogin = async () => {
      try {
        resolve(await fn());
      } catch (err) {
        reject(err);
      }
    };
    modalLogin.showModal();
  });
}

// ---------- Sincronización (FAB) ----------
async function iniciarSync(etiqueta) {
  fabMain.classList.add("syncing");
  mostrarToast(`Sincronizando con ${etiqueta}...`, { id: "sync", duracion: 0 });
  try {
    const res = await conAuth(() => fetch("/api/garmin-sync", { method: "POST" }));
    const data = await res.json().catch(() => ({}));
    if (!data.ok) {
      mostrarToast(`Error al sincronizar: ${data.error || "desconocido"}`, { id: "sync", duracion: 6000 });
      fabMain.classList.remove("syncing");
      return;
    }
    mostrarToast(`Sincronización con ${etiqueta} lanzada. Actualizando en ~45s...`, { id: "sync", duracion: 0 });
    setTimeout(() => {
      refrescarPestanaActual();
      fabMain.classList.remove("syncing");
      mostrarToast("Datos actualizados.", { id: "sync", duracion: 3500 });
    }, 45000);
  } catch (err) {
    mostrarToast("Error de red al sincronizar.", { id: "sync", duracion: 6000 });
    fabMain.classList.remove("syncing");
  }
}

// ---------- FAB: abrir/cerrar menú y wiring de cada fuente ----------
const fabContainer = document.getElementById("fabContainer");
const fabMain = document.getElementById("fabMain");
const fabBackdrop = document.getElementById("fabBackdrop");

function cerrarFab() {
  fabContainer.classList.remove("active");
  fabBackdrop.classList.remove("active");
}
function toggleFab() {
  fabContainer.classList.toggle("active");
  fabBackdrop.classList.toggle("active", fabContainer.classList.contains("active"));
}
fabMain.addEventListener("click", toggleFab);
fabBackdrop.addEventListener("click", cerrarFab);

document.getElementById("fab-sync-garmin").addEventListener("click", () => {
  cerrarFab();
  iniciarSync("Garmin");
});
// Nota: de momento solo hay una fuente (Garmin). Cuando se conecte el
// dispositivo Arduino/BLE u otra marca, aquí se añaden más <div class="fab-option">
// en el HTML (con su icono y color) y su listener correspondiente — el
// backdrop, la animación en cascada y conAuth/iniciarSync ya están listos
// para varias opciones.

// ---------- Partidos ----------
let partidosActuales = []; // último dataset cargado (ya con _temporada añadido)
let partidosSort = { field: null, dir: 1 };

async function fetchTemporada(temporada) {
  const data = await apiGet(`/api/partidos?temporada=${temporada}`).catch(() => null);
  const partidos = (data && data.partidos) || [];
  return partidos.map((p) => ({ ...p, _temporada: temporada }));
}

async function loadPartidos() {
  const temporadaSel = document.getElementById("partidos-temporada").value;
  const mostrarTemporada = temporadaSel === "todas";
  document.getElementById("th-temporada").style.display = mostrarTemporada ? "" : "none";

  let partidos;
  if (mostrarTemporada) {
    const resultados = await Promise.all(TODAS_TEMPORADAS.map(fetchTemporada));
    partidos = resultados.flat();
  } else {
    partidos = await fetchTemporada(temporadaSel);
  }
  partidosActuales = partidos;

  renderPartidos();
}

function competicionesSeleccionadas() {
  return Array.from(document.querySelectorAll(".comp-filter:not([value='todas'])"))
    .filter((cb) => cb.checked)
    .map((cb) => cb.value);
}

/** Orden fijo por competición + jornada (temporada primero si hay varias),
 *  para las gráficas de tendencia — independiente de cómo esté ordenada la
 *  tabla en ese momento (el usuario puede tenerla ordenada por goles, etc.,
 *  lo que no tendría sentido para ver una evolución cronológica). */
function ordenarCronologico(lista) {
  return [...lista].sort((a, b) => {
    const ta = a._temporada || "";
    const tb = b._temporada || "";
    if (ta !== tb) return ta < tb ? -1 : 1;
    const oa = COMPETICION_ORDEN[a.competicion] ?? 99;
    const ob = COMPETICION_ORDEN[b.competicion] ?? 99;
    if (oa !== ob) return oa - ob;
    return (a.jornada ?? 0) - (b.jornada ?? 0);
  });
}

/** Tarjetas de desglose de goles encajados por tipo (Performance): cuántos,
 *  qué % suponen del total de goles, en qué % de los partidos aparece al
 *  menos uno de ese tipo, y cuántos caen de media por partido. */
function renderTarjetasTipoGol(partidos, totalGoles) {
  const numPartidos = partidos.length;
  for (const tipo of ["error", "dudoso", "nada_que_hacer"]) {
    let count = 0;
    let partidosConEseTipo = 0;
    for (const p of partidos) {
      const enEsePartido = (p.goles_detalle || []).filter((g) => g.tipo === tipo).length;
      count += enEsePartido;
      if (enEsePartido > 0) partidosConEseTipo++;
    }
    animateValue(`ptg-${tipo}-count`, count);
    document.getElementById(`ptg-${tipo}-pct-goles`).textContent =
      totalGoles ? Math.round((count / totalGoles) * 100) + "%" : "—";
    document.getElementById(`ptg-${tipo}-pct-partidos`).textContent =
      numPartidos ? Math.round((partidosConEseTipo / numPartidos) * 100) + "%" : "—";
    document.getElementById(`ptg-${tipo}-partido`).textContent =
      numPartidos ? (count / numPartidos).toFixed(2) : "—";
  }
}

/** Gráfica de barras apiladas: composición (error/dudoso/nada que hacer)
 *  de los goles encajados partido a partido, en orden cronológico — para
 *  ver de un vistazo tanto el total encajado como de qué tipo son. */
// Nombres "bonitos" de competición para las etiquetas del eje X cuando no
// hay jornada (copa del Rey, supercopa, playoff suelen ser partido único).
const COMPETICION_LABELS = { liga: "Liga", copa_del_rey: "Copa del Rey", supercopa: "Supercopa", playoff: "Playoff" };

function renderGolesPorPartido(partidosOrdenados) {
  const canvas = document.getElementById("chart-goles-partido");
  const conMostrarTemporada = document.getElementById("th-temporada").style.display !== "none";
  const labels = partidosOrdenados.map((p) => {
    // Con jornada (normalmente liga): "J3 Rival". Sin jornada (copa del
    // Rey, supercopa, playoff — partido único): "Copa del Rey Rival", no
    // "Rival Rival" (antes se repetía el rival cuando no había jornada).
    const base =
      p.jornada != null
        ? `J${p.jornada} ${p.rival}`
        : `${COMPETICION_LABELS[p.competicion] || p.competicion} ${p.rival}`;
    return conMostrarTemporada ? `${base} (${p._temporada})` : base;
  });

  const datasets = ["error", "dudoso", "nada_que_hacer"].map((tipo) => ({
    label: tipoLabel(tipo),
    data: partidosOrdenados.map((p) => (p.goles_detalle || []).filter((g) => g.tipo === tipo).length),
    backgroundColor: tipoColor(tipo),
  }));

  if (chartGolesPorPartido) chartGolesPorPartido.destroy();
  try {
    chartGolesPorPartido = new Chart(canvas, {
      type: "bar",
      data: { labels, datasets },
      options: {
        maintainAspectRatio: false,
        plugins: { title: { display: true, text: "Goles encajados por partido (cronológico)" } },
        scales: {
          x: { stacked: true, ticks: { autoSkip: true, maxRotation: 60, minRotation: 0 } },
          y: { stacked: true, ticks: { precision: 0 } },
        },
      },
    });
  } catch (e) {
    console.error("No se pudo dibujar el gráfico de goles por partido:", e);
  }
}

function ordenarPartidos(lista) {
  const { field, dir } = partidosSort;
  if (!field) return lista;
  const copia = [...lista];
  copia.sort((a, b) => {
    let va, vb;
    if (field === "competicion") {
      const oa = COMPETICION_ORDEN[a.competicion] ?? 99;
      const ob = COMPETICION_ORDEN[b.competicion] ?? 99;
      if (oa !== ob) return (oa - ob) * dir;
      va = a.jornada ?? 0;
      vb = b.jornada ?? 0;
    } else if (field === "rival") {
      va = (a.rival || "").toLowerCase();
      vb = (b.rival || "").toLowerCase();
    } else if (field === "temporada") {
      va = a._temporada || "";
      vb = b._temporada || "";
    } else {
      va = a[field] ?? 0;
      vb = b[field] ?? 0;
    }
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });
  return copia;
}

function renderPartidos() {
  const compsFiltro = competicionesSeleccionadas();
  const partidos = partidosActuales.filter((p) => compsFiltro.includes(p.competicion));
  const ordenados = ordenarPartidos(partidos);

  animateValue("pc-num", partidos.length);
  const minutos = partidos.reduce((s, p) => s + (p.minutos_jugados || 0), 0);
  const goles = partidos.reduce((s, p) => s + (p.goles_encajados || 0), 0);
  animateValue("pc-min", minutos);
  animateValue("pc-goles", goles);
  animateValue("pc-goles-partido", partidos.length ? goles / partidos.length : null, { decimals: 2 });
  animateValue("pc-ratio", minutos ? (goles / minutos) * 40 : null, { decimals: 2 });

  // Tarjetas y tabla se calculan antes de tocar Chart.js: si la librería no
  // ha cargado bien (red lenta, bloqueador, etc.) el resto de la pestaña
  // sigue funcionando igual.
  renderTarjetasTipoGol(partidos, goles);

  // ---- Gráfica: tipos de gol encajado ----
  const tipoCount = {};
  for (const p of partidos) {
    for (const g of p.goles_detalle || []) {
      tipoCount[g.tipo] = (tipoCount[g.tipo] || 0) + 1;
    }
  }
  const tipos = Object.keys(tipoCount);
  if (chartGoles) chartGoles.destroy();
  try {
    chartGoles = new Chart(document.getElementById("chart-tipos-gol"), {
      type: "doughnut",
      data: {
        labels: tipos.map(tipoLabel),
        datasets: [{ data: tipos.map((t) => tipoCount[t]), backgroundColor: tipos.map(tipoColor) }],
      },
      options: { maintainAspectRatio: false, plugins: { title: { display: true, text: "Tipos de gol encajado" } } },
    });
  } catch (e) {
    console.error("No se pudo dibujar el gráfico de tipos de gol:", e);
  }

  renderGolesPorPartido(ordenarCronologico(partidos));

  // ---- Gráfica: motivos de los goles de tipo "error" ----
  const motivoCount = {};
  for (const p of partidos) {
    for (const g of p.goles_detalle || []) {
      if (g.tipo !== "error") continue;
      const motivo = g.analisis || "Sin detalle anotado";
      motivoCount[motivo] = (motivoCount[motivo] || 0) + 1;
    }
  }
  const motivos = Object.keys(motivoCount);
  const motivosEmpty = document.getElementById("chart-motivos-empty");
  const motivosCanvas = document.getElementById("chart-motivos-error");
  if (chartMotivos) chartMotivos.destroy();
  if (!motivos.length) {
    motivosEmpty.style.display = "block";
    motivosCanvas.style.display = "none";
  } else {
    motivosEmpty.style.display = "none";
    motivosCanvas.style.display = "block";
    try {
      chartMotivos = new Chart(motivosCanvas, {
        type: "bar",
        data: {
          labels: motivos,
          datasets: [{ label: "Goles", data: motivos.map((m) => motivoCount[m]), backgroundColor: "#FF3B5C" }],
        },
        options: {
          maintainAspectRatio: false,
          indexAxis: "y",
          plugins: { title: { display: true, text: "Motivos de los goles por error" }, legend: { display: false } },
          scales: { x: { ticks: { precision: 0 } } },
        },
      });
    } catch (e) {
      console.error("No se pudo dibujar el gráfico de motivos de error:", e);
    }
  }

  // ---- Tabla ----
  const tbody = document.querySelector("#partidos-table tbody");
  tbody.innerHTML = "";
  for (const p of ordenados) {
    const tr = document.createElement("tr");
    const tiposTexto = (p.goles_detalle || []).map((g) => tipoLabel(g.tipo)).join(", ") || "—";
    const temporadaCelda = document.getElementById("th-temporada").style.display === "none"
      ? ""
      : `<td>${p._temporada}</td>`;
    tr.innerHTML = `
      <td>${p.competicion}${p.jornada ? " J" + p.jornada : ""}</td>
      <td>${p.rival}</td>
      <td>${p.minutos_jugados}</td>
      <td>${p.goles_encajados}</td>
      <td>${tiposTexto}</td>
      ${temporadaCelda}
    `;
    tbody.appendChild(tr);
  }

  // Flechas de orden en las cabeceras
  document.querySelectorAll("#partidos-table th.sortable").forEach((th) => {
    const arrow = th.querySelector(".sort-arrow");
    if (th.dataset.sort === partidosSort.field) {
      arrow.textContent = partidosSort.dir === 1 ? "▲" : "▼";
    } else {
      arrow.textContent = "";
    }
  });
}

document.getElementById("partidos-reload").addEventListener("click", loadPartidos);
document.getElementById("partidos-temporada").addEventListener("change", loadPartidos);

// Filtro "Todas" las competiciones: marca/desmarca el resto
document.querySelectorAll(".comp-filter").forEach((cb) => {
  cb.addEventListener("change", () => {
    const todasCb = document.querySelector(".comp-filter[value='todas']");
    const otras = Array.from(document.querySelectorAll(".comp-filter:not([value='todas'])"));
    if (cb.value === "todas") {
      otras.forEach((o) => (o.checked = todasCb.checked));
    } else {
      todasCb.checked = otras.every((o) => o.checked);
    }
    renderPartidos();
  });
});

// Ordenar al pulsar las cabeceras
document.querySelectorAll("#partidos-table th.sortable").forEach((th) => {
  th.addEventListener("click", () => {
    const field = th.dataset.sort;
    if (partidosSort.field === field) {
      partidosSort.dir *= -1;
    } else {
      partidosSort = { field, dir: 1 };
    }
    renderPartidos();
  });
});

// ---------- Login modal ----------
const modalLogin = document.getElementById("modal-login");
const modalPartido = document.getElementById("modal-partido");
const modalEntrenoManual = document.getElementById("modal-entreno-manual");
let pendingAfterLogin = null;

// Antes esto pedía la contraseña ANTES de dejarte ni abrir el formulario.
// Ahora el formulario se abre directo — el login (si hace falta) se pide al
// guardar, dentro de conAuth, y solo si la sesión de 48h ya caducó.
document.getElementById("partidos-nuevo-btn").addEventListener("click", () => {
  if (document.getElementById("partidos-temporada").value === "todas") {
    alert('Elige primero una temporada concreta (no "Todas") para añadir un partido.');
    return;
  }
  modalPartido.showModal();
});

document.getElementById("login-cancel").addEventListener("click", () => modalLogin.close());

document.getElementById("form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const password = document.getElementById("login-password").value;
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const data = await res.json();
  const errorEl = document.getElementById("login-error");
  if (!data.ok) {
    errorEl.textContent = data.error || "Error";
    return;
  }
  errorEl.textContent = "";
  modalLogin.close();
  document.getElementById("login-password").value = "";
  if (pendingAfterLogin) { pendingAfterLogin(); pendingAfterLogin = null; }
});

// ---------- Formulario nuevo partido ----------
document.getElementById("partido-cancel").addEventListener("click", () => modalPartido.close());

document.getElementById("add-gol-btn").addEventListener("click", () => {
  const container = document.getElementById("goles-detalle-container");
  const row = document.createElement("div");
  row.className = "gol-row";
  row.innerHTML = `
    <select class="gol-tipo">
      <option value="error">Error</option>
      <option value="nada_que_hacer">Nada que hacer</option>
      <option value="dudoso">Dudoso</option>
    </select>
    <input type="text" class="gol-nota" placeholder="Nota / análisis (opcional)" />
    <button type="button" class="gol-remove">✕</button>
  `;
  row.querySelector(".gol-remove").addEventListener("click", () => row.remove());
  container.appendChild(row);
});

document.getElementById("form-partido").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const temporada = document.getElementById("partidos-temporada").value;

  const golesDetalle = Array.from(document.querySelectorAll(".gol-row")).map((row) => {
    const tipo = row.querySelector(".gol-tipo").value;
    const nota = row.querySelector(".gol-nota").value;
    return nota ? { tipo, analisis: nota } : { tipo };
  });

  const partido = {
    competicion: form.competicion.value,
    jornada: form.jornada.value ? parseInt(form.jornada.value, 10) : null,
    vuelta: null,
    rival: form.rival.value,
    estimado: false,
    minutos_jugados: parseInt(form.minutos_jugados.value, 10),
    goles_encajados: parseInt(form.goles_encajados.value, 10),
    goles_detalle: golesDetalle,
  };

  const res = await conAuth(() =>
    fetch("/api/partidos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ temporada, partido }),
    })
  );
  const data = await res.json();
  const errorEl = document.getElementById("partido-error");
  if (!data.ok) {
    errorEl.textContent = data.error || "Error al guardar";
    return;
  }
  errorEl.textContent = "";
  modalPartido.close();
  form.reset();
  document.getElementById("goles-detalle-container").innerHTML = "";
  loadPartidos();
});

// ---------- Formulario "Añadir entreno manual" ----------
// Para entrenos que no pasan por el reloj (futsal en partido/entreno, donde
// no se puede llevar el Garmin puesto, y hasta que exista el dispositivo
// Arduino propio): duración, RPE y unas notas, metidos a mano. Se guardan
// con la misma forma que una actividad de Garmin (mismo endpoint /api/garmin,
// mismo listado, mismo cálculo de carga de entreno para el riesgo de lesión),
// solo que con manual: true en vez de venir del sync.
function fechaLocalHoy() {
  return fechaLocalISO(new Date());
}

function construirRpeSelectorManual() {
  const cont = document.getElementById("entreno-manual-rpe");
  cont.innerHTML = Array.from({ length: 10 }, (_, i) => i + 1)
    .map((n) => `<button type="button" class="rpe-btn" data-rpe="${n}">${n}</button>`)
    .join("");
  cont.querySelectorAll(".rpe-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const yaSeleccionado = btn.classList.contains("selected");
      cont.querySelectorAll(".rpe-btn").forEach((b) => b.classList.remove("selected"));
      if (!yaSeleccionado) btn.classList.add("selected"); // permite dejarlo sin anotar, pulsando otra vez
    });
  });
}

document.getElementById("entreno-manual-nuevo-btn").addEventListener("click", () => {
  const form = document.getElementById("form-entreno-manual");
  form.reset();
  form.fecha.value = fechaLocalHoy();
  construirRpeSelectorManual();
  document.getElementById("entreno-manual-error").textContent = "";
  modalEntrenoManual.showModal();
});

document.getElementById("entreno-manual-cancel").addEventListener("click", () => modalEntrenoManual.close());

document.getElementById("form-entreno-manual").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const rpeBtn = document.querySelector("#entreno-manual-rpe .rpe-btn.selected");

  const payload = {
    manual: true,
    fecha: form.fecha.value,
    tipo: form.tipo.value,
    duracion_min: parseInt(form.duracion_min.value, 10),
    fc_media: form.fc_media.value ? parseInt(form.fc_media.value, 10) : null,
    rpe: rpeBtn ? parseInt(rpeBtn.dataset.rpe, 10) : null,
    notas: form.notas.value.trim() || null,
  };

  const errorEl = document.getElementById("entreno-manual-error");
  const res = await conAuth(() =>
    fetch("/api/garmin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  );
  const data = await res.json().catch(() => ({}));
  if (!data.ok) {
    errorEl.textContent = data.error || "Error al guardar";
    return;
  }
  errorEl.textContent = "";
  modalEntrenoManual.close();
  loadGarmin();
  mostrarToast("Entreno manual añadido.", { id: "entreno-manual" });
});

// ---------- Carga inicial + pantalla de bienvenida ----------
// El splash se muestra siempre un mínimo de 3s (para que la animación se vea
// bien), y más si el Resumen tarda más en cargar de lo que tarda ese mínimo.
const splashMinimo = new Promise((resolve) => setTimeout(resolve, 3000));
const cargaResumen = loadResumen().catch(() => null);

Promise.all([splashMinimo, cargaResumen]).then(() => {
  const splash = document.getElementById("splash-screen");
  if (splash) splash.classList.add("hide");
});
