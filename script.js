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

    historyStatus.textContent =
      `Histórico carregado: ${data.count || 0} item(ns) nesta página, total ${data.total || 0}.`;
  } catch (err) {
    console.error(err);
    historyStatus.textContent = "Erro ao carregar histórico.";
    historyTableBody.innerHTML = "";
    paginationInfo.textContent = "Página 0 de 0";
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

  paginationInfo.textContent = `Página ${page} de ${totalPages}`;

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

document.addEventListener("DOMContentLoaded", async () => {
  setDefaultDateTime();
  await loadSensorsForSelect();
  await loadOverview();
});