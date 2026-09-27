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

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabButtons.forEach((b) => b.classList.remove("active"));
    tabPanels.forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");

    if (btn.dataset.tab === "wellness") loadWellness();
    if (btn.dataset.tab === "garmin") loadGarmin();
    if (btn.dataset.tab === "partidos") loadPartidos();
  });
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

// ---------- Resumen ----------
async function loadResumen() {
  const wellness = await apiGet("/api/wellness?days=1").catch(() => null);
  const last = wellness && wellness.snapshots && wellness.snapshots.length
    ? wellness.snapshots[wellness.snapshots.length - 1]
    : {};
  animateValue("rc-battery", last.bateria_corporal, { suffix: "%" });
  animateValue("rc-sleep", last.sueno_horas, { suffix: " h", decimals: 2 });
  const partidos = await apiGet("/api/partidos?temporada=26-27").catch(() => null);
  if (partidos && partidos.partidos) {
    animateValue("rc-partidos", partidos.partidos.length);
    const goles = partidos.partidos.reduce((s, p) => s + (p.goles_encajados || 0), 0);
    animateValue("rc-goles", goles);
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
    list.appendChild(item);
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
