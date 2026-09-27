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

  if (nombreTab === "wellness") loadWellness();
  if (nombreTab === "garmin") loadGarmin();
  if (nombreTab === "partidos") loadPartidos();
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

function fmtMinSec(totalMin) {
  if (totalMin == null) return "—";
  const h = Math.floor(totalMin / 60);
  const m = Math.round(totalMin % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

let chartBattery, chartSleep, chartGoles, chartMotivos;

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
  }

  document.getElementById("rc-fc-reposo").textContent =
    last.fc_reposo != null ? Math.round(last.fc_reposo) + " ppm" : "—";

  const garminData = await apiGet("/api/garmin?tipo=todos&limit=30").catch(() => null);
  const actividadesRecientes = (garminData && garminData.activities) || [];
  renderCargaMuscular(actividadesRecientes);
  renderUltimoEntreno(actividadesRecientes);
  renderFormaFisica(actividadesRecientes);
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
async function loadWellness() {
  const days = document.getElementById("wellness-days").value || 30;
  const data = await apiGet(`/api/wellness?days=${days}`);
  const snapshots = data.snapshots || [];

  document.getElementById("wellness-empty").style.display = snapshots.length ? "none" : "block";
  if (!snapshots.length) return;

  const labels = snapshots.map((s) => s.fecha);
  const battery = snapshots.map((s) => s.bateria_corporal ?? null);
  const sleep = snapshots.map((s) => s.sueno_horas ?? null);

  if (chartBattery) chartBattery.destroy();
  chartBattery = new Chart(document.getElementById("chart-battery"), {
    type: "line",
    data: { labels, datasets: [{ label: "Batería corporal (%)", data: battery, borderColor: "#4FA3FF", tension: 0.3 }] },
    options: {
      maintainAspectRatio: false,
      plugins: { title: { display: true, text: "Batería corporal" } },
      scales: { y: { min: 0, max: 100 } },
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

  return `<div class="activity-stats-grid">${statsHtml}</div>${ejerciciosHtml}`;
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
        <span class="activity-tipo">${actTipoLabel(act)}</span>
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

// Trae todas las actividades del servidor (el filtrado por tipo se hace en el
// cliente, así el desplegable puede construirse con los tipos reales).
async function loadGarmin() {
  const data = await apiGet(`/api/garmin?tipo=todos&limit=60`);
  garminActividadesCache = data.activities || [];
  actualizarSelectorTipoGarmin();
  renderGarminList();
}

function renderGarminList() {
  const tipo = document.getElementById("garmin-tipo").value;
  const activities =
    tipo === "todos" ? garminActividadesCache : garminActividadesCache.filter((a) => claveTipo(a) === tipo);

  const list = document.getElementById("garmin-list");
  list.innerHTML = "";
  document.getElementById("garmin-empty").style.display = activities.length ? "none" : "block";

  for (const act of activities) {
    list.appendChild(crearActivityItem(act));
  }
}

document.getElementById("garmin-reload").addEventListener("click", loadGarmin);
document.getElementById("garmin-tipo").addEventListener("change", renderGarminList);

async function lanzarSyncGarmin() {
  const btn = document.getElementById("garmin-sync-btn");
  const statusEl = document.getElementById("garmin-sync-status");
  btn.disabled = true;
  statusEl.textContent = "Lanzando sincronización...";
  try {
    const res = await fetch("/api/garmin-sync", { method: "POST" });
    const data = await res.json();
    if (!data.ok) {
      statusEl.textContent = `Error al lanzar la sincronización: ${data.error || "desconocido"}`;
    } else {
      statusEl.textContent = "Sincronización lanzada. Garmin tarda ~30-60s en responder; pulsa \"Actualizar\" dentro de un minuto para ver los datos nuevos.";
    }
  } catch (err) {
    statusEl.textContent = "Error de red al lanzar la sincronización.";
  } finally {
    btn.disabled = false;
  }
}

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
  animateValue("pc-ratio", minutos ? (goles / minutos) * 40 : null, { decimals: 2 });

  // ---- Gráfica: tipos de gol encajado ----
  const tipoCount = {};
  for (const p of partidos) {
    for (const g of p.goles_detalle || []) {
      tipoCount[g.tipo] = (tipoCount[g.tipo] || 0) + 1;
    }
  }
  const tipos = Object.keys(tipoCount);
  if (chartGoles) chartGoles.destroy();
  chartGoles = new Chart(document.getElementById("chart-tipos-gol"), {
    type: "doughnut",
    data: {
      labels: tipos.map(tipoLabel),
      datasets: [{ data: tipos.map((t) => tipoCount[t]), backgroundColor: tipos.map(tipoColor) }],
    },
    options: { maintainAspectRatio: false, plugins: { title: { display: true, text: "Tipos de gol encajado" } } },
  });

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
let pendingAfterLogin = null;

document.getElementById("partidos-nuevo-btn").addEventListener("click", () => {
  if (document.getElementById("partidos-temporada").value === "todas") {
    alert('Elige primero una temporada concreta (no "Todas") para añadir un partido.');
    return;
  }
  pendingAfterLogin = () => modalPartido.showModal();
  modalLogin.showModal();
});

document.getElementById("garmin-sync-btn").addEventListener("click", () => {
  pendingAfterLogin = lanzarSyncGarmin;
  modalLogin.showModal();
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

  const res = await fetch("/api/partidos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ temporada, partido }),
  });
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

// ---------- Carga inicial + pantalla de bienvenida ----------
// El splash se muestra siempre un mínimo de 3s (para que la animación se vea
// bien), y más si el Resumen tarda más en cargar de lo que tarda ese mínimo.
const splashMinimo = new Promise((resolve) => setTimeout(resolve, 3000));
const cargaResumen = loadResumen().catch(() => null);

Promise.all([splashMinimo, cargaResumen]).then(() => {
  const splash = document.getElementById("splash-screen");
  if (splash) splash.classList.add("hide");
});
