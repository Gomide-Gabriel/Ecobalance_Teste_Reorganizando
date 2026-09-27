##README.md EcoBalance mobile
# EcoBalance Ledger — React Native (Multiplataforma)

Versão React Native do `index.html`, incorporando os dados e a metodologia do artigo científico
**"EcoBalance Ledger: Otimização da TI Verde, Governança ESG e Modelagem Insumo-Produto via
Criptografia e Arquitetura Multiplataforma (2015–2026)"** (ABNT 2020 — Fatec Zona Leste / Centro Paula Souza).

## O que foi portado do index.html

| Web (index.html) | React Native |
| --- | --- |
| Hero + badges ISO/IFRS/GRI | `HomeScreen` |
| Matriz editável de Leontief | `MatrixScreen` com **inversão matricial real** (Gauss-Jordan) |
| Fórmula x = (I−C)⁻¹·d | `src/utils/leontief.js` — equivalente ao `leontief_engine.py` (NumPy) |
| Validação Hawkins-Simons (det > 0) | `calcularLeontief()` retorna erro se Det(I−A) ≤ 0 |
| Blockchain Ledger (transações + hash) | `BlockchainScreen` com esquema MySQL do artigo |
| Simulador ROI com sliders | `SimulatorScreen` + validação ΔX via Leontief |
| Dashboard ESG 2015–2025 (Chart.js) | `DashboardScreen` com Victory Native (AreaChart) |
| Mapa Leaflet | `react-native-maps` (mesmas 6 localizações) |
| Relatórios jsPDF | `expo-print` + `expo-sharing` |

## Dados do artigo incorporados

- **Tabela 1** — evolução decenal: PUE 0.65→0.81; CO₂ 1.200→820 tCO₂e; ROI 4,2%→14,2%; conformidade IFRS S2/GRI 305
- **Tabela 2** — coeficientes setoriais 2015 vs 2026 (TI −40%, Energia −14,3%, Indústria −8,9%, Logística −20%)
- Cenários de resiliência climática 2030 (92% / 78% / 65%)
- Stack: Python 3.10 + NumPy, Node.js, MySQL 8.0, SHA-256, Docker, Twilio API

## Como rodar

```bash
npm install        # ou: npx expo install --fix
npx expo start     # escaneie o QR com Expo Go (iOS/Android)
```

## Estrutura

```javascript
App.js                    → navegação por abas (bottom tabs)
src/theme.js              → tokens de cor (espelham o Tailwind do index.html)
src/data.js               → dados do artigo (tabelas, séries, transações, cenários)
src/utils/leontief.js     → motor algébrico: inversa, determinante, Hawkins-Simons
src/components/UI.js      → Card, Badge, Metric, Formula, ProgressBar, etc.
src/screens/HomeScreen.js
src/screens/MatrixScreen.js
src/screens/BlockchainScreen.js
src/screens/SimulatorScreen.js
src/screens/DashboardScreen.js
```

## Multiplataforma (conforme objetivos do artigo)

- **Mobile/Tablet:** iOS e Android nativo via Expo
- **Desktop:** `react-native-web` (já incluído) ou wrapper Electron
- **Back-end:** o motor Node.js + MySQL 8.0 + ledger SHA-256 permanece o mesmo do artigo

## Autores

Adriano Rodrigues de Araujo • Gabriel Gomide • Pedro Henrique da Silva
Fatec Zona Leste — Centro Paula Souza • adriano.rodrigues365@outlook.com