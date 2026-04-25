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
const thresholdWarning = document.getElementById("thresholdWarning");

let currentPage = 1;
let lastHistoryItems = [];
let lastHistoryMeta = null;

const activeCharts = {
  timeSeries: null,
  safety: null,
  correlation: null
};

let isRendering = false;
let pendingData = null; // Fila de renderização para evitar perda de eventos
let renderDebounceTimeout = null;

// Configurações Globais do Chart.js para Estética SCADA
if (window.Chart) {
  Chart.defaults.color = "#94a3b8";
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.font.size = 11;
  Chart.defaults.borderColor = "rgba(148, 163, 184, 0.05)"; // Gridlines mais sutis
}

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
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function checkThresholdConsistency(items) {
  if (!items || items.length <= 1) return true;
  const first = JSON.stringify(items[0].thresholds);
  return items.every(item => JSON.stringify(item.thresholds) === first);
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

    thresholdWarning.style.display = checkThresholdConsistency(lastHistoryItems) ? "none" : "flex";

    renderHistoryTable(lastHistoryItems);
    updatePagination(data);
    scheduleChartsUpdate(lastHistoryItems);

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
        <td colspan="9">Nenhuma leitura encontrada para o período selecionado.</td>
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
      <td>${item?.leitura?.flame_detected ? "🔥 SIM" : "NÃO"}</td>
      <td>${item.buzzer ? "🔔 ATIVO" : "OFF"}</td>
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
    "presenca",
    "flame",
    "buzzer",
    "co_level",
    "gas_level",
    "safety_status",
    "threshold_co_alerta",
    "threshold_co_perigo"
  ];

  const rows = lastHistoryItems.map(item => {
    const co = item?.leitura?.co_ppm ?? 0;
    const gas = item?.leitura?.metano_ppm ?? 0;
    const th = item.thresholds || {};
    
    let coLevel = "SAFE";
    if (co >= (th.co_perigo || 15)) coLevel = "DANGER";
    else if (co >= (th.co_alerta || 5)) coLevel = "ALERT";

    let gasLevel = "SAFE";
    if (gas >= (th.gas_perigo || 10)) gasLevel = "DANGER";
    else if (gas >= (th.gas_alerta || 5)) gasLevel = "ALERT";

    return [
      item.received_at || "",
      item.status || "",
      co,
      gas,
      item.temp_c ?? "",
      item.umid_pct ?? "",
      item.presenca ? "SIM" : "NAO",
      (item?.leitura?.flame_detected ?? false) ? "SIM" : "NAO",
      item.buzzer ? "SIM" : "NAO",
      coLevel,
      gasLevel,
      item.safety_alert_active ? "CRITICAL" : "SAFE",
      th.co_alerta ?? "",
      th.co_perigo ?? ""
    ];
  });

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
      acc.flameSum += (item?.leitura?.flame_detected ?? false) ? 1 : 0;
      acc.buzzerSum += item.buzzer ? 1 : 0;
      return acc;
    }, { tempSum: 0, umidSum: 0, coMax: -Infinity, gasMax: -Infinity, presenceSum: 0, flameSum: 0, buzzerSum: 0 });

    const size = bucket.length;
    
    const safety_alert_active = stats.flameSum > 0 || stats.coMax >= (bucket[bucket.length - 1].thresholds?.co_perigo || 15);
    
    result.push({
      received_at: bucket[0].received_at,
      temp_c: stats.tempSum / size,
      umid_pct: stats.umidSum / size,
      leitura: {
        co_ppm: stats.coMax,
        metano_ppm: stats.gasMax,
        flame_detected: stats.flameSum > 0
      },
      presenca: stats.presenceSum > 0,
      buzzer: stats.buzzerSum > 0,
      safety_alert_active,
      thresholds: bucket[bucket.length - 1].thresholds
    });
  }

  return result;
}

/**
 * Motor de Renderização Incremental Determinístico
 * Implementa Fila de Eventos (FIFO), Lock de Concorrência e Performance Monitoring.
 */
function scheduleChartsUpdate(items) {
  clearTimeout(renderDebounceTimeout);
  renderDebounceTimeout = setTimeout(() => {
    updateChartsSafe(items);
  }, 150);
}

function updateChartsSafe(data) {
  if (isRendering) {
    console.warn("⏳ [DEBUG] Renderização em curso. Enfileirando novo estado.");
    pendingData = data;
    return;
  }

  isRendering = true;
  toggleChartsLoading(true);

  const start = performance.now();
  
  try {
    renderCharts(data);
  } catch (err) {
    console.error("❌ [DEBUG] Erro crítico no pipeline de renderização:", err);
  } finally {
    const end = performance.now();
    console.log(`⏱️ [PERF] Render cycle: ${(end - start).toFixed(2)}ms`);
    
    isRendering = false;
    toggleChartsLoading(false);

    // Processa estado pendente (mais recente) se houver
    if (pendingData) {
      console.log("🔄 [DEBUG] Processando estado enfileirado...");
      const next = pendingData;
      pendingData = null;
      updateChartsSafe(next);
    }
  }
}

function toggleChartsLoading(loading) {
  const containers = document.querySelectorAll(".chart-container");
  containers.forEach(c => c.classList.toggle("loading", loading));
}

function renderCharts(items) {
  // 1. Data Engineering Layer
  const sortedItems = [...items].sort((a, b) => new Date(a.received_at) - new Date(b.received_at));
  const displayItems = aggregateBuckets(sortedItems, 300);

  const labels = displayItems.map(item => formatDate(item.received_at));
  const tempC = displayItems.map(item => item.temp_c);
  const umidPct = displayItems.map(item => item.umid_pct);
  const coPpm = displayItems.map(item => item?.leitura?.co_ppm || 0);
  const gasPpm = displayItems.map(item => item?.leitura?.metano_ppm || 0);
  
  const presence = displayItems.map(item => item.presenca ? 1 : 0);
  const flame = displayItems.map(item => (item?.leitura?.flame_detected ?? false) ? 3 : 2); 
  const buzzer = displayItems.map(item => item.buzzer ? 5 : 4); 
  
  const NOISE_THRESHOLD = 0.1;
  const deltaTemp = displayItems.map((item, i) => {
    if (i === 0) return 0;
    const diff = item.temp_c - displayItems[i - 1].temp_c;
    return Math.abs(diff) < NOISE_THRESHOLD ? 0 : diff;
  });
  
  const th = displayItems[displayItems.length - 1].thresholds || { co_alerta: 5, co_perigo: 15, gas_alerta: 5, gas_perigo: 10 };

  const colors = {
    temp: "#f87171",
    umid: "#60a5fa",
    co: "#fbbf24",
    gas: "#22c55e",
    presence: "#818cf8",
    flame: "#ef4444",
    buzzer: "#f97316",
    grid: "rgba(148, 163, 184, 0.05)",
    text: "#94a3b8"
  };

  // 2. Gráfico de Monitoramento Temporal (Incremental Update)
  if (activeCharts.timeSeries) {
    const chart = activeCharts.timeSeries;
    chart.data.labels = labels;
    chart.data.datasets[0].data = tempC;
    chart.data.datasets[1].data = umidPct;
    chart.data.datasets[2].data = coPpm;
    chart.data.datasets[3].data = gasPpm;
    
    // Atualiza anotações (thresholds dinâmicos)
    if (chart.options.plugins.annotation) {
      const ann = chart.options.plugins.annotation.annotations;
      ann.coAlert.yMin = ann.coAlert.yMax = th.co_alerta;
      ann.coDanger.yMin = ann.coDanger.yMax = th.co_perigo;
    }
    
    chart.update('none'); // Update sem animação para performance SCADA
  } else {
    const tsCtx = document.getElementById("timeSeriesChart").getContext("2d");
    activeCharts.timeSeries = new Chart(tsCtx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          { label: "Temp (°C)", data: tempC, borderColor: colors.temp, backgroundColor: "transparent", borderWidth: 2, tension: 0.2, yAxisID: "y-temp", pointRadius: 0 },
          { label: "Umid (%)", data: umidPct, borderColor: colors.umid, backgroundColor: "transparent", borderWidth: 2, tension: 0.2, yAxisID: "y-temp", pointRadius: 0 },
          { label: "CO (ppm)", data: coPpm, borderColor: colors.co, backgroundColor: "rgba(251, 191, 36, 0.05)", borderWidth: 2, tension: 0, yAxisID: "y-gas", pointRadius: 1, fill: true },
          { label: "Gás (ppm)", data: gasPpm, borderColor: colors.gas, backgroundColor: "rgba(34, 197, 94, 0.05)", borderWidth: 2, tension: 0, yAxisID: "y-gas", pointRadius: 1, fill: true }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { 
          legend: { position: 'top', align: 'end', labels: { boxWidth: 12, usePointStyle: true, color: colors.text } },
          tooltip: { backgroundColor: "#1e293b", titleColor: "#f8fafc", bodyColor: "#cbd5e1", borderColor: "#334155", borderWidth: 1 },
          annotation: {
            annotations: {
              coAlert: { type: 'line', yMin: th.co_alerta, yMax: th.co_alerta, borderColor: 'rgba(251, 191, 36, 0.3)', borderWidth: 1, borderDash: [4, 4], label: { display: true, content: 'ALERTA CO', backgroundColor: 'rgba(251, 191, 36, 0.6)', font: { size: 9, weight: 'bold' } }, yScaleID: 'y-gas' },
              coDanger: { type: 'line', yMin: th.co_perigo, yMax: th.co_perigo, borderColor: 'rgba(239, 68, 68, 0.3)', borderWidth: 1, borderDash: [4, 4], label: { display: true, content: 'PERIGO CO', backgroundColor: 'rgba(239, 68, 68, 0.6)', font: { size: 9, weight: 'bold' } }, yScaleID: 'y-gas' }
            }
          }
        },
        scales: {
          x: { ticks: { color: colors.text, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }, grid: { color: colors.grid } },
          "y-temp": { position: "left", title: { display: true, text: "Temp/Umid", color: colors.text }, ticks: { color: colors.text }, grid: { color: colors.grid } },
          "y-gas": { position: "right", title: { display: true, text: "Gases (ppm)", color: colors.text }, ticks: { color: colors.text }, grid: { display: false }, min: 0 }
        }
      }
    });
  }

  // 3. Linha do Tempo de Segurança (Incremental Update)
  if (activeCharts.safety) {
    const chart = activeCharts.safety;
    chart.data.labels = labels;
    chart.data.datasets[0].data = presence;
    chart.data.datasets[1].data = flame;
    chart.data.datasets[2].data = buzzer;
    chart.update('none');
  } else {
    const sCtx = document.getElementById("safetyEventsChart").getContext("2d");
    activeCharts.safety = new Chart(sCtx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          { label: "Presença", data: presence, borderColor: colors.presence, backgroundColor: "rgba(129, 140, 248, 0.05)", stepped: true, fill: true, pointRadius: 0 },
          { label: "Chama", data: flame, borderColor: colors.flame, stepped: true, borderWidth: 3, pointRadius: 0 },
          { label: "Buzzer", data: buzzer, borderColor: colors.buzzer, stepped: true, pointRadius: 0 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { 
          legend: { position: 'top', align: 'end', labels: { boxWidth: 12, usePointStyle: true, color: colors.text } }
        },
        scales: {
          x: { ticks: { display: false }, grid: { color: colors.grid } },
          y: { 
            min: -0.5, 
            max: 5.5, 
            ticks: { 
              stepSize: 1, 
              color: colors.text,
              callback: v => {
                if (v === 1) return "PRESENÇA";
                if (v === 3) return "CHAMA";
                if (v === 5) return "BUZZER";
                return "";
              } 
            }, 
            grid: { color: colors.grid } 
          }
        }
      }
    });
  }

  // 4. Análise de Correlação (Incremental Update)
  const scatterData = displayItems.map((item, i) => ({ x: deltaTemp[i], y: item.presenca ? 1 : 0 }));
  
  if (activeCharts.correlation) {
    const chart = activeCharts.correlation;
    chart.data.datasets[0].data = scatterData;
    chart.update('none');
  } else {
    const cCtx = document.getElementById("correlationChart").getContext("2d");
    activeCharts.correlation = new Chart(cCtx, {
      type: "scatter",
      data: {
        datasets: [{
          label: "Detecção vs Variação Térmica",
          data: scatterData,
          backgroundColor: (ctx) => ctx.raw && ctx.raw.y === 1 ? colors.presence : "rgba(148, 163, 184, 0.1)",
          pointRadius: (ctx) => ctx.raw && ctx.raw.y === 1 ? 6 : 3,
          pointHoverRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { 
          legend: { display: false },
          tooltip: { backgroundColor: "#1e293b", titleColor: "#f8fafc" }
        },
        scales: {
          x: { title: { display: true, text: "Variação de Temperatura (Δ°C)", color: colors.text }, ticks: { color: colors.text }, grid: { color: colors.grid } },
          y: { title: { display: true, text: "Status de Presença", color: colors.text }, min: -0.2, max: 1.2, ticks: { stepSize: 1, color: colors.text, callback: v => v === 1 ? "SIM" : "NÃO" }, grid: { color: colors.grid } }
        }
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  setDefaultDateTime();
  await loadSensorsForSelect();
  await loadOverview();
});