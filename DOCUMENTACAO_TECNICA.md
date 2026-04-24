# Documentação Técnica: AirGuard Dashboard (Industrial Grade)

Esta documentação detalha a evolução, arquitetura e decisões de engenharia que transformaram o AirGuard Dashboard de um protótipo acadêmico em um sistema de observabilidade ambiental de nível industrial.

---

## 📖 Narrativa Técnica: Da Visualização à Observabilidade

A narrativa do projeto mudou de "mostrar dados" para "interpretar sinais de segurança". O sistema evoluiu para uma arquitetura de **Sistema Ciber-Físico**, integrando não apenas sensores passivos (Temp, Umidade), mas também sensores críticos (**Chama**), de contexto (**Presença**) e atuadores (**Buzzer**). Implementamos uma camada de **Data Engineering no Frontend** que preserva a integridade de sinais booleanos (OR aggregation) e classifica o estado do ambiente em tempo real.

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

### ADR-004: Timeline de Eventos com Offset Vertical
*   **Contexto**: A visualização de múltiplos sinais binários (0/1) no mesmo eixo Y causa sobreposição total das linhas, impossibilitando a leitura de eventos simultâneos.
*   **Decisão**: Implementar "Lanes" verticais para sinais digitais (Presence: 0-1, Flame: 2-3, Buzzer: 4-5).
*   **Motivo**: Garante que o operador veja instantaneamente se a detecção de chama ativou corretamente o buzzer, mesmo que ambos ocorram no mesmo timestamp.

### ADR-005: Preservação de Sinais Críticos (Boolean OR)
*   **Contexto**: Ao agregar dados em janelas de tempo, sinais booleanos curtos (ex: chama detectada por 1 segundo) podem ser "apagados" se usada a média aritmética.
*   **Decisão**: Utilizar lógica **ANY (Boolean OR)** para agregação de sinais de segurança.
*   **Motivo**: Em sistemas críticos, se um perigo ocorreu em qualquer momento da janela, o estado da janela deve ser "Detectado".

---

## ⚖️ Trade-offs e Análise de Decisões

| Decisão | Prós | Contras |
| :--- | :--- | :--- |
| **Processamento no Client** | Agilidade no desenvolvimento, redução de carga no servidor, feedback instantâneo ao trocar de página. | Consumo de CPU/RAM do usuário; limitado pelo hardware do cliente para datasets massivos. |
| **Agregação por Buckets** | Performance estável de 60FPS; preservação de tendências e picos. | Perda da granularidade exata de segundos em janelas muito grandes. |
| **Offset Vertical (Digital)** | Claridade total em eventos simultâneos; semântica visual de "canais". | Exige tooltips customizados para traduzir os valores de offset para o usuário. |
| **Thresholds no Gráfico** | Identificação imediata de violação de limites; UX industrial. | Exige validação de consistência caso os limites mudem no histórico. |

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
