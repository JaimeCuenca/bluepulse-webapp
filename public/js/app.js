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
  error: "#e2544d",       // rojo
  dudoso: "#f4b942",       // amarillo
  nada_que_hacer: "#4fa3ff", // azul
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
  if (wellness && wellness.snapshots && wellness.snapshots.length) {
    const last = wellness.snapshots[wellness.snapshots.length - 1];
    document.getElementById("rc-battery").textContent = last.bateria_corporal != null ? `${last.bateria_corporal}%` : "—";
    document.getElementById("rc-sleep").textContent = last.sueno_horas != null ? `${last.sueno_horas} h` : "—";
  }
  const partidos = await apiGet("/api/partidos?temporada=26-27").catch(() => null);
  if (partidos && partidos.partidos) {
    document.getElementById("rc-partidos").textContent = partidos.partidos.length;
    const goles = partidos.partidos.reduce((s, p) => s + (p.goles_encajados || 0), 0);
    document.getElementById("rc-goles").textContent = goles;
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
    data: { labels, datasets: [{ label: "Batería corporal (%)", data: battery, borderColor: "#4fa3ff", tension: 0.3 }] },
    options: {
      maintainAspectRatio: false,
      plugins: { title: { display: true, text: "Batería corporal" } },
      scales: { y: { min: 0, max: 100 } },
    },
  });

  if (chartSleep) chartSleep.destroy();
  chartSleep = new Chart(document.getElementById("chart-sleep"), {
    type: "bar",
    data: { labels, datasets: [{ label: "Horas de sueño", data: sleep, backgroundColor: "#7c6bff" }] },
    options: {
      maintainAspectRatio: false,
      plugins: { title: { display: true, text: "Sueño" } },
    },
  });
}

document.getElementById("wellness-reload").addEventListener("click", loadWellness);

// ---------- Garmin actividades ----------
const ACT_TIPO_LABELS = {
  running: "Running",
  fuerza: "Entreno de fuerza",
  otro: "Actividad",
};
function actTipoLabel(act) {
  return ACT_TIPO_LABELS[act.tipo] || act.tipo_garmin || "Actividad";
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
  } else if (act.tipo === "fuerza") {
    ejerciciosHtml = `<p class="hint">No hay detalle de series/repeticiones para este entreno.</p>`;
  }

  return `<div class="activity-stats-grid">${statsHtml}</div>${ejerciciosHtml}`;
}

async function loadGarmin() {
  const tipo = document.getElementById("garmin-tipo").value;
  const data = await apiGet(`/api/garmin?tipo=${tipo}&limit=30`);
  const list = document.getElementById("garmin-list");
  list.innerHTML = "";
  const activities = data.activities || [];
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
document.getElementById("garmin-tipo").addEventListener("change", loadGarmin);

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

  document.getElementById("pc-num").textContent = partidos.length;
  const minutos = partidos.reduce((s, p) => s + (p.minutos_jugados || 0), 0);
  const goles = partidos.reduce((s, p) => s + (p.goles_encajados || 0), 0);
  document.getElementById("pc-min").textContent = minutos;
  document.getElementById("pc-goles").textContent = goles;
  document.getElementById("pc-ratio").textContent = minutos ? ((goles / minutos) * 40).toFixed(2) : "—";

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
        datasets: [{ label: "Goles", data: motivos.map((m) => motivoCount[m]), backgroundColor: "#e2544d" }],
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

// ---------- Carga inicial ----------
loadResumen();
