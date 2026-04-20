const apiBase = CONFIG.API_BASE_URL.replace(/\/+$/, "");

const statusOverview = document.getElementById("statusOverview");
const overviewCards = document.getElementById("overviewCards");

const sensorSelect = document.getElementById("sensorSelect");
const dateInput = document.getElementById("dateInput");
const startTimeInput = document.getElementById("startTimeInput");
const endTimeInput = document.getElementById("endTimeInput");
const limitInput = document.getElementById("limitInput");
const loadHistoryBtn = document.getElementById("loadHistoryBtn");
const historyStatus = document.getElementById("historyStatus");
const historyTableBody = document.getElementById("historyTableBody");

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
  if (!dateValue || !timeValue) return null;
  return `${dateValue}T${timeValue}:00`;
}

async function loadHistory() {
  const sensorId = sensorSelect.value;
  const date = dateInput.value;
  const startTime = startTimeInput.value;
  const endTime = endTimeInput.value;
  const limit = limitInput.value || 100;

  if (!sensorId) {
    historyStatus.textContent = "Selecione um sensor.";
    return;
  }

  const start = buildDateTime(date, startTime);
  const end = buildDateTime(date, endTime);

  const url = new URL(`${apiBase}/api/history/${sensorId}`);
  url.searchParams.set("limit", limit);

  if (start) url.searchParams.set("start", start);
  if (end) url.searchParams.set("end", end);

  historyStatus.textContent = "Carregando histórico...";

  try {
    const data = await fetchJson(url.toString());
    renderHistoryTable(data.items || []);
    historyStatus.textContent = `Histórico carregado: ${data.count || 0} leitura(s).`;
  } catch (err) {
    console.error(err);
    historyStatus.textContent = "Erro ao carregar histórico.";
    historyTableBody.innerHTML = "";
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

function setDefaultDateTime() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");

  dateInput.value = `${yyyy}-${mm}-${dd}`;
  startTimeInput.value = "00:00";
  endTimeInput.value = "23:59";
}

loadHistoryBtn.addEventListener("click", loadHistory);

document.addEventListener("DOMContentLoaded", async () => {
  setDefaultDateTime();
  await loadSensorsForSelect();
  await loadOverview();
});