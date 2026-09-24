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

let chartBattery, chartSleep, chartGoles;

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
    options: { plugins: { title: { display: true, text: "Batería corporal" } }, scales: { y: { min: 0, max: 100 } } },
  });

  if (chartSleep) chartSleep.destroy();
  chartSleep = new Chart(document.getElementById("chart-sleep"), {
    type: "bar",
    data: { labels, datasets: [{ label: "Horas de sueño", data: sleep, backgroundColor: "#7c6bff" }] },
    options: { plugins: { title: { display: true, text: "Sueño" } } },
  });
}

document.getElementById("wellness-reload").addEventListener("click", loadWellness);

// ---------- Garmin actividades ----------
async function loadGarmin() {
  const tipo = document.getElementById("garmin-tipo").value;
  const data = await apiGet(`/api/garmin?tipo=${tipo}&limit=30`);
  const tbody = document.querySelector("#garmin-table tbody");
  tbody.innerHTML = "";
  const activities = data.activities || [];
  document.getElementById("garmin-empty").style.display = activities.length ? "none" : "block";

  for (const act of activities) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${act.fecha ?? "—"}</td>
      <td>${act.tipo ?? "—"}</td>
      <td>${fmtMinSec(act.duracion_min)}</td>
      <td>${act.distancia_km != null ? act.distancia_km + " km" : "—"}</td>
      <td>${act.fc_media ?? "—"}</td>
      <td>${act.calorias ?? "—"}</td>
    `;
    tbody.appendChild(tr);
  }
}

document.getElementById("garmin-reload").addEventListener("click", loadGarmin);
document.getElementById("garmin-tipo").addEventListener("change", loadGarmin);

// ---------- Partidos ----------
async function loadPartidos() {
  const temporada = document.getElementById("partidos-temporada").value;
  const data = await apiGet(`/api/partidos?temporada=${temporada}`);
  const partidos = data.partidos || [];

  document.getElementById("pc-num").textContent = partidos.length;
  const minutos = partidos.reduce((s, p) => s + (p.minutos_jugados || 0), 0);
  const goles = partidos.reduce((s, p) => s + (p.goles_encajados || 0), 0);
  document.getElementById("pc-min").textContent = minutos;
  document.getElementById("pc-goles").textContent = goles;
  document.getElementById("pc-ratio").textContent = minutos ? ((goles / minutos) * 60).toFixed(2) : "—";

  const tipoCount = {};
  for (const p of partidos) {
    for (const g of p.goles_detalle || []) {
      tipoCount[g.tipo] = (tipoCount[g.tipo] || 0) + 1;
    }
  }
  if (chartGoles) chartGoles.destroy();
  chartGoles = new Chart(document.getElementById("chart-tipos-gol"), {
    type: "doughnut",
    data: {
      labels: Object.keys(tipoCount),
      datasets: [{ data: Object.values(tipoCount), backgroundColor: ["#e2544d", "#4fa3ff", "#f4b942"] }],
    },
    options: { plugins: { title: { display: true, text: "Tipos de gol encajado" } } },
  });

  const tbody = document.querySelector("#partidos-table tbody");
  tbody.innerHTML = "";
  for (const p of partidos) {
    const tr = document.createElement("tr");
    const tipos = (p.goles_detalle || []).map((g) => g.tipo).join(", ") || "—";
    tr.innerHTML = `
      <td>${p.competicion}${p.jornada ? " J" + p.jornada : ""}</td>
      <td>${p.rival}</td>
      <td>${p.minutos_jugados}</td>
      <td>${p.goles_encajados}</td>
      <td>${tipos}</td>
      <td>${p.estimado ? "sí" : "no"}</td>
    `;
    tbody.appendChild(tr);
  }
}

document.getElementById("partidos-reload").addEventListener("click", loadPartidos);
document.getElementById("partidos-temporada").addEventListener("change", loadPartidos);

// ---------- Login modal ----------
const modalLogin = document.getElementById("modal-login");
const modalPartido = document.getElementById("modal-partido");
let pendingAfterLogin = null;

document.getElementById("partidos-nuevo-btn").addEventListener("click", () => {
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
