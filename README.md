# 🌐 AirGuard Dashboard PI v2.0

Dashboard web desenvolvido em **HTML + CSS + JavaScript puro**, responsável por visualizar dados de sensores IoT do projeto **AirGuard**.

Este dashboard consome dados de um backend (Node.js + MongoDB + MQTT) e permite:

- Visualização em tempo real dos sensores
- Consulta de histórico por período
- Paginação de resultados
- Exportação de dados em CSV

---

## 🚀 Funcionalidades

### 🔎 Visão Geral (Overview)
- Exibe o estado atual de todos os sensores ativos
- Um card por sensor
- Informações exibidas:
  - Sensor ID
  - Cliente
  - Ambiente
  - Status (LIMPO / ALERTA / PERIGO)
  - CO (ppm)
  - Gás (ppm)
  - Temperatura
  - Umidade
  - Presença

---

### 📊 Consulta de Histórico

Permite consultar dados históricos com filtros:

- Sensor
- Data inicial
- Hora inicial
- Data final
- Hora final
- Quantidade de itens por página

---

### 📄 Paginação

- Navegação entre páginas de resultados
- Controle de volume de dados exibidos
- Evita sobrecarga do navegador

---

### 📥 Exportação CSV

- Exporta os dados exibidos na tabela
- Arquivo gerado automaticamente
- Nome do arquivo inclui sensor e página

---

## 🧱 Estrutura do Projeto
dashboard-pi/
├── index.html
├── styles.css
├── script.js
└── config.js


---

## ⚙️ Configuração

### 1. Backend

Certifique-se de que o backend está rodando e acessível.

### 2. Arquivo `config.js`

Configure a URL da API:

```javascript
const CONFIG = {
  API_BASE_URL: "https://SEU-BACKEND.onrender.com"
};
```

| Endpoint                 | Descrição                         |
| ------------------------ | --------------------------------- |
| `/api/overview`          | Retorna estado atual dos sensores |
| `/api/sensors`           | Lista sensores disponíveis        |
| `/api/history/:sensorId` | Retorna histórico com filtros     |

📡 Parâmetros do Histórico

Exemplo de uso:
``` API
GET /api/history/SN-CO-001?start=2026-04-19T08:00:00&end=2026-04-19T18:00:00&page=1&limit=50
```

| Parâmetro | Descrição               |
| --------- | ----------------------- |
| `start`   | Data/hora inicial (ISO) |
| `end`     | Data/hora final (ISO)   |
| `page`    | Página atual            |
| `limit`   | Quantidade de registros |

▶️ Como Executar
Abra o arquivo:
index.html
O dashboard irá:
carregar automaticamente os sensores
buscar o overview
aguardar consulta de histórico

🧠 Arquitetura (Resumo)
ESP32 + Sensores
        ↓ MQTT
     HiveMQ Cloud
        ↓
   Backend (Node.js)
        ↓
   MongoDB Atlas
        ↓
 Dashboard (este projeto)

 📌 Observações
O dashboard não depende de frameworks
Totalmente client-side
Backend deve estar com CORS habilitado
Ideal para ambientes acadêmicos e prototipação