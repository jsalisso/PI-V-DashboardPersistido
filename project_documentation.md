# Documentação Técnica: AirGuard Dashboard (Industrial Grade)

Esta documentação detalha a evolução, arquitetura e decisões de engenharia que transformaram o AirGuard Dashboard de um protótipo acadêmico em um sistema de observabilidade ambiental de nível industrial.

---

## 📖 Narrativa Técnica: Da Visualização à Observabilidade

O projeto nasceu com o objetivo de monitorar sensores de qualidade do ar e presença via IoT. Inicialmente focado na apresentação tabular de dados históricos, o sistema evoluiu ao identificar um desafio crítico no monitoramento físico: **o ruído e o viés dos sensores.**

A narrativa do projeto mudou de "mostrar dados" para "interpretar sinais". Implementamos uma camada de **Data Engineering no Frontend** capaz de lidar com grandes volumes de dados, preservando picos críticos de segurança (CO e Gás) e permitindo o diagnóstico de hardware através de análise diferencial (ΔTemp). Hoje, o sistema não apenas informa o estado atual, mas atua como uma ferramenta de auditoria de confiabilidade de sensores.

---

## 🏛️ Architecture Decision Records (ADR)

### ADR-001: Estratégia de Agregação por Buckets
*   **Contexto**: A renderização de milhares de pontos no frontend causava degradação de performance (baixo FPS) e poluição visual.
*   **Decisão**: Implementar `aggregateBuckets` em vez de downsampling simples (pular pontos).
*   **Motivo**: O downsampling simples pode ocultar picos. A agregação por buckets permite aplicar funções estatísticas (Média/Máximo) sobre cada janela de tempo, mantendo a integridade da tendência.

### ADR-002: Visualização Safety-First (Métricas de Segurança)
*   **Contexto**: O uso de médias em sensores de gás (CO/Metano) suaviza picos perigosos que ocorrem entre as amostras agregadas.
*   **Decisão**: Aplicar função **MAX()** para métricas de gás e **AVG()** para temperatura/umidade.
*   **Motivo**: Em engenharia de segurança, o valor de pico é mais crítico que a média. Se houve um vazamento de 10 segundos em um bucket de 1 minuto, o MAX() garante que esse evento seja visível.

### ADR-003: Análise Diferencial para Diagnóstico de Hardware
*   **Contexto**: Sensores de presença infravermelho (PIR) são sensíveis a variações térmicas bruscas, gerando falsos positivos.
*   **Decisão**: Implementar cálculo de **ΔTemp** (derivada da temperatura) e um Scatter Plot de correlação (ΔTemp vs Presença).
*   **Motivo**: Permitir que o operador identifique se detecções de presença estão ocorrendo devido a movimentos reais ou devido ao ligar/desligar de sistemas de ar-condicionado ou incidência solar.

---

## ⚖️ Trade-offs e Análise de Decisões

| Decisão | Prós | Contras |
| :--- | :--- | :--- |
| **Processamento no Client** | Agilidade no desenvolvimento, redução de carga no servidor, feedback instantâneo ao trocar de página. | Consumo de CPU/RAM do usuário; limitado pelo hardware do cliente para datasets massivos. |
| **Agregação por Buckets** | Performance estável de 60FPS; preservação de tendências e picos. | Perda da granularidade exata de segundos em janelas muito grandes. |
| **Interface de Eixo Duplo** | Permite comparar Temp (°C) e Gases (PPM) na mesma escala temporal. | Pode ser confuso para usuários leigos se não houver legendas claras. |

---

## 📈 Métricas de Qualidade

Para garantir o nível sênior da entrega, o sistema é avaliado sob quatro pilares:

1.  **Performance (FPS)**: O dashboard deve manter uma taxa de atualização estável mesmo ao carregar o limite máximo de registros por página (1000+), graças ao algoritmo de downsampling.
2.  **Integridade de Dados (Peak Integrity)**: 100% dos eventos de pico em sensores de gás devem ser refletidos no gráfico, independente do nível de agregação.
3.  **Confiabilidade de Sinal (Noise Floor)**: Uso de `NOISE_THRESHOLD` (0.1°C) para garantir que oscilações insignificantes de hardware não poluam a análise de correlação.
4.  **Interpretabilidade (UX Insight)**: O tempo para um usuário entender o diagnóstico de viés térmico deve ser minimizado através de tooltips informativos e color-coding no scatter plot.

---

## 🚀 Próximos Passos (Roadmap de Engenharia)

*   **Agregação no Backend**: Mover a lógica de buckets para o MongoDB/Aggregations para suportar consultas de "Última Semana" sem trafegar dados brutos.
*   **Detecção de Anomalias**: Implementar algoritmos de Z-score ou Isolation Forest para alertar automaticamente sobre comportamentos fora do padrão histórico.
*   **Arquitetura Event-Driven**: Integração via WebSockets para atualização dos gráficos em tempo real (Streaming Observability).
