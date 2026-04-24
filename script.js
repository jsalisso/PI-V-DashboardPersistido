const apiBase = CONFIG.API_BASE_URL.replace(/\/+$/, "");

const statusOverview = document.getElementById("statusOverview");
const overviewCards = document.getElementById("overviewCards");

const sensorSelect = document.getElementById("sensorSelect");
const startDateInput = document.getElementById("startDateInput");
const startTimeInput = document.getElementById("startTimeInput");
const endDateInput = document.getElementById("endDateInput");
const endTimeInput = document.getElementById("endTimeInput");
const limitInput = document.getElementById("limitInput");

const loadHistoryBtn = document.getElementById("loadHistoryBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");

const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const paginationInfo = document.getElementById("paginationInfo");

const historyStatus = document.getElementById("historyStatus");
const historyTableBody = document.getElementById("historyTableBody");

let currentPage = 1;
let lastHistoryItems = [];
let lastHistoryMeta = null;

// Instâncias dos gráficos
let timeSeriesChart = null;
let presenceChart = null;
let correlationChart = null;

function formatNumber(value, decimals = 2) {
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(decimals) : "--";
}

function formatDate(value) {
  if (!value) return "--";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium"
  }).format(new Date(value));
}

function getStatusClass(status) {
  const s = String(status || "").toUpperCase();
  if (s === "PERIGO") return "status-perigo";
  if (s === "ALERTA") return "status-alerta";
  return "status-limpo";
}

function safe(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function fetchJson(url) {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Erro ${res.status} ao acessar ${url}`);
  }

  return res.json();
}

async function loadOverview() {
  statusOverview.textContent = "Carregando overview...";

  try {
    const data = await fetchJson(`${apiBase}/api/overview`);
    renderOverview(data.items || []);
    statusOverview.textContent = `Overview carregado com ${data.count || 0} sensor(es).`;
  } catch (err) {
    console.error(err);
    statusOverview.textContent = "Erro ao carregar overview.";
  }
}

function renderOverview(items) {
  if (!items.length) {
    overviewCards.innerHTML = "<p>Nenhum sensor encontrado.</p>";
    return;
  }

  overviewCards.innerHTML = items.map(item => `
    <div class="card">
      <div class="card-header">
        <div class="card-title">${safe(item.sensor_id)}</div>
        <div class="status-chip ${getStatusClass(item.status)}">${safe(item.status)}</div>
      </div>

      <div class="meta-grid">
        <div class="meta-item">
          <div class="label">Cliente</div>
          <div class="value">${safe(item.cliente)}</div>
        </div>
        <div class="meta-item">
          <div class="label">Perfil</div>
          <div class="value">${safe(item.profile)}</div>
        </div>
        <div class="meta-item">
          <div class="label">Unidade</div>
          <div class="value">${safe(item.unidade)}</div>
        </div>
        <div class="meta-item">
          <div class="label">Ambiente</div>
          <div class="value">${safe(item.ambiente)}</div>
        </div>
        <div class="meta-item">
          <div class="label">Última atualização</div>
          <div class="value">${formatDate(item.last_seen)}</div>
        </div>
        <div class="meta-item">
          <div class="label">Presença</div>
          <div class="value">${item.presenca ? "SIM" : "NÃO"}</div>
        </div>
        <div class="meta-item">
          <div class="label">CO</div>
          <div class="value">${formatNumber(item.co_ppm, 2)}</div>
        </div>
        <div class="meta-item">
          <div class="label">Gás</div>
          <div class="value">${formatNumber(item.metano_ppm, 2)}</div>
        </div>
        <div class="meta-item">
          <div class="label">Temperatura</div>
          <div class="value">${formatNumber(item.temp_c, 1)} °C</div>
        </div>
        <div class="meta-item">
          <div class="label">Umidade</div>
          <div class="value">${formatNumber(item.umid_pct, 1)} %</div>
        </div>
      </div>
    </div>
  `).join("");
}

async function loadSensorsForSelect() {
  try {
    const data = await fetchJson(`${apiBase}/api/sensors`);
    const items = data.items || [];

    sensorSelect.innerHTML = items.map(item => `
      <option value="${safe(item.sensor_id)}">${safe(item.sensor_id)} - ${safe(item.ambiente)}</option>
    `).join("");
  } catch (err) {
    console.error(err);
    sensorSelect.innerHTML = `<option value="">Erro ao carregar sensores</option>`;
  }
}

function buildDateTime(dateValue, timeValue) {
  if (!dateValue) return null;
  const time = timeValue || "00:00";
  return `${dateValue}T${time}:00`;
}

async function loadHistory(page = 1) {
  const sensorId = sensorSelect.value;
  const start = buildDateTime(startDateInput.value, startTimeInput.value);
  const end = buildDateTime(endDateInput.value, endTimeInput.value);
  const limit = limitInput.value || 50;

  if (!sensorId) {
    historyStatus.textContent = "Selecione um sensor.";
    return;
  }

  const url = new URL(`${apiBase}/api/history/${sensorId}`);
  url.searchParams.set("limit", limit);
  url.searchParams.set("page", page);

  if (start) url.searchParams.set("start", start);
  if (end) url.searchParams.set("end", end);

  historyStatus.textContent = "Carregando histórico...";

  try {
    const data = await fetchJson(url.toString());

    lastHistoryItems = data.items || [];
    lastHistoryMeta = data;
    currentPage = data.page || 1;

    renderHistoryTable(lastHistoryItems);
    updatePagination(data);
    updateCharts(lastHistoryItems);

    historyStatus.textContent =
      `Histórico carregado: ${data.count || 0} item(ns) nesta página, total ${data.total || 0}.`;
  } catch (err) {
    console.error(err);
    historyStatus.textContent = "Erro ao carregar histórico.";
    historyTableBody.innerHTML = "";
    paginationInfo.textContent = "Mostrando 0 de 0 registros (Página 0 de 0)";
  }
}

function renderHistoryTable(items) {
  if (!items.length) {
    historyTableBody.innerHTML = `
      <tr>
        <td colspan="7">Nenhuma leitura encontrada para o período selecionado.</td>
      </tr>
    `;
    return;
  }

  historyTableBody.innerHTML = items.map(item => `
    <tr>
      <td>${formatDate(item.received_at)}</td>
      <td>${safe(item.status)}</td>
      <td>${formatNumber(item?.leitura?.co_ppm, 2)}</td>
      <td>${formatNumber(item?.leitura?.metano_ppm, 2)}</td>
      <td>${formatNumber(item.temp_c, 1)} °C</td>
      <td>${formatNumber(item.umid_pct, 1)} %</td>
      <td>${item.presenca ? "SIM" : "NÃO"}</td>
    </tr>
  `).join("");
}

function updatePagination(data) {
  const totalPages = data.totalPages || 1;
  const page = data.page || 1;
  const count = data.count || 0;
  const total = data.total || 0;

  paginationInfo.textContent = `Mostrando ${count} de ${total} registros (Página ${page} de ${totalPages})`;

  prevPageBtn.disabled = page <= 1;
  nextPageBtn.disabled = page >= totalPages;
}

function exportHistoryToCsv() {
  if (!lastHistoryItems.length) {
    alert("Não há dados carregados para exportar.");
    return;
  }

  const headers = [
    "timestamp",
    "status",
    "co_ppm",
    "metano_ppm",
    "temp_c",
    "umid_pct",
    "presenca"
  ];

  const rows = lastHistoryItems.map(item => [
    item.received_at || "",
    item.status || "",
    item?.leitura?.co_ppm ?? "",
    item?.leitura?.metano_ppm ?? "",
    item.temp_c ?? "",
    item.umid_pct ?? "",
    item.presenca ? "SIM" : "NAO"
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map(row =>
      row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")
    )
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `airguard-history-${sensorSelect.value}-page-${currentPage}.csv`;
  a.click();

  URL.revokeObjectURL(url);
}

function setDefaultDateTime() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");

  const today = `${yyyy}-${mm}-${dd}`;

  startDateInput.value = today;
  endDateInput.value = today;
  startTimeInput.value = "00:00";
  endTimeInput.value = "23:59";
}

loadHistoryBtn.addEventListener("click", () => {
  currentPage = 1;
  loadHistory(1);
});

prevPageBtn.addEventListener("click", () => {
  if (currentPage > 1) {
    loadHistory(currentPage - 1);
  }
});

nextPageBtn.addEventListener("click", () => {
  if (lastHistoryMeta && currentPage < lastHistoryMeta.totalPages) {
    loadHistory(currentPage + 1);
  }
});

exportCsvBtn.addEventListener("click", exportHistoryToCsv);

/**
 * Data Engineering Layer: Agregação por Buckets
 * Preserva tendências (AVG) para sensores contínuos e picos (MAX) para segurança.
 */
function aggregateBuckets(data, maxPoints = 300) {
  if (data.length <= maxPoints) return data;
  
  const bucketSize = Math.ceil(data.length / maxPoints);
  const result = [];

  for (let i = 0; i < data.length; i += bucketSize) {
    const bucket = data.slice(i, i + bucketSize);
    
    // Agregação estatística multivariável
    const stats = bucket.reduce((acc, item) => {
      acc.tempSum += item.temp_c || 0;
      acc.umidSum += item.umid_pct || 0;
      acc.coMax = Math.max(acc.coMax, item?.leitura?.co_ppm || 0);
      acc.gasMax = Math.max(acc.gasMax, item?.leitura?.metano_ppm || 0);
      acc.presenceSum += item.presenca ? 1 : 0;
      return acc;
    }, { tempSum: 0, umidSum: 0, coMax: -Infinity, gasMax: -Infinity, presenceSum: 0 });

    const size = bucket.length;
    
    result.push({
      received_at: bucket[0].received_at,
      temp_c: stats.tempSum / size, // Média para estabilidade térmica
      umid_pct: stats.umidSum / size,
      leitura: {
        co_ppm: stats.coMax, // MAX para segurança (não ocultar picos de CO)
        metano_ppm: stats.gasMax // MAX para segurança
      },
      presenca: (stats.presenceSum / size) > 0.5 // Presença majoritária
    });
  }

  return result;
}

function updateCharts(items) {
  if (!items || items.length === 0) return;

  // 1. Data Engineering Layer
  const sortedItems = [...items].sort((a, b) => new Date(a.received_at) - new Date(b.received_at));
  const displayItems = aggregateBuckets(sortedItems, 300);

  const labels = displayItems.map(item => formatDate(item.received_at));
  const tempC = displayItems.map(item => item.temp_c);
  const umidPct = displayItems.map(item => item.umid_pct);
  const coPpm = displayItems.map(item => item?.leitura?.co_ppm || 0);
  const gasPpm = displayItems.map(item => item?.leitura?.metano_ppm || 0);
  const presence = displayItems.map(item => item.presenca ? 1 : 0);
  
  // Cálculo de ΔTemp com Threshold de Ruído (0.1°C)
  const NOISE_THRESHOLD = 0.1;
  const deltaTemp = displayItems.map((item, i) => {
    if (i === 0) return 0;
    const diff = item.temp_c - displayItems[i - 1].temp_c;
    return Math.abs(diff) < NOISE_THRESHOLD ? 0 : diff;
  });

  const colors = {
    temp: "#f87171",
    umid: "#60a5fa",
    co: "#fbbf24",
    gas: "#34d399",
    presence: "#818cf8",
    presenceOff: "rgba(148, 163, 184, 0.3)"
  };

  // 2. Gráfico de Monitoramento Temporal
  if (timeSeriesChart) timeSeriesChart.destroy();
  const tsCtx = document.getElementById("timeSeriesChart").getContext("2d");
  timeSeriesChart = new Chart(tsCtx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        { label: "Temp (Avg °C)", data: tempC, borderColor: colors.temp, tension: 0.3, yAxisID: "y-temp" },
        { label: "Umid (Avg %)", data: umidPct, borderColor: colors.umid, tension: 0.3, yAxisID: "y-temp" },
        { label: "CO (Max ppm)", data: coPpm, borderColor: colors.co, tension: 0.3, yAxisID: "y-gas" },
        { label: "Gás (Max ppm)", data: gasPpm, borderColor: colors.gas, tension: 0.3, yAxisID: "y-gas" }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
        legend: { labels: { color: "#cbd5e1" } },
        tooltip: { mode: 'index', intersect: false }
      },
      scales: {
        x: { ticks: { color: "#94a3b8", maxRotation: 45, minRotation: 45 }, grid: { color: "#1e293b" } },
        "y-temp": { position: "left", ticks: { color: "#94a3b8" }, grid: { color: "#1e293b" } },
        "y-gas": { position: "right", ticks: { color: "#94a3b8" }, grid: { display: false } }
      }
    }
  });

  // 3. Gráfico de Presença (Digital Signal)
  if (presenceChart) presenceChart.destroy();
  const pCtx = document.getElementById("presenceChart").getContext("2d");
  presenceChart = new Chart(pCtx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        label: "Detecção",
        data: presence,
        borderColor: colors.presence,
        backgroundColor: "rgba(129, 140, 248, 0.1)",
        fill: true,
        stepped: true,
        tension: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { display: false }, grid: { color: "#1e293b" } },
        y: { min: -0.1, max: 1.1, ticks: { stepSize: 1, color: "#94a3b8", callback: v => v === 1 ? "SIM" : "NÃO" }, grid: { color: "#1e293b" } }
      }
    }
  });

  // 4. Análise de Correlação (Signal Bias Detection)
  if (correlationChart) correlationChart.destroy();
  const cCtx = document.getElementById("correlationChart").getContext("2d");
  
  const scatterData = displayItems.map((item, i) => ({
    x: deltaTemp[i],
    y: item.presenca ? 1 : 0
  }));

  correlationChart = new Chart(cCtx, {
    type: "scatter",
    data: {
      datasets: [{
        label: "Detecção vs Variação Térmica",
        data: scatterData,
        backgroundColor: (ctx) => {
          const raw = ctx.raw;
          return raw && raw.y === 1 ? colors.presence : colors.presenceOff;
        },
        pointRadius: (ctx) => {
          const raw = ctx.raw;
          return raw && raw.y === 1 ? 8 : 4;
        },
        pointHoverRadius: 10
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `ΔTemp: ${ctx.raw.x.toFixed(2)}°C | Presença: ${ctx.raw.y === 1 ? "SIM" : "NÃO"}`
          }
        }
      },
      scales: {
        x: { title: { display: true, text: "Variação de Temperatura (Δ°C)", color: "#cbd5e1" }, ticks: { color: "#94a3b8" }, grid: { color: "#1e293b" } },
        y: { title: { display: true, text: "Status de Presença", color: "#cbd5e1" }, min: -0.2, max: 1.2, ticks: { stepSize: 1, color: "#94a3b8", callback: v => v === 1 ? "SIM" : "NÃO" }, grid: { color: "#1e293b" } }
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  setDefaultDateTime();
  await loadSensorsForSelect();
  await loadOverview();
});