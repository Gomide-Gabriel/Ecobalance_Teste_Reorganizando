// Dados extraídos do artigo científico (ABNT 2020) — EcoBalance Ledger 2015–2026
// Autores: Adriano Rodrigues de Araujo, Gabriel Gomide, Pedro Henrique da Silva
// Fatec Zona Leste — Centro Paula Souza

// Matriz de coeficientes técnicos C (setores x insumos), conforme dashboard web
export const MATRIX_COLS = ["Hardware", "Cloud", "Auto", "Papel", "TI Verde"];

export const DEFAULT_MATRIX = [
  { nome: "Hardware",       icon: "hardware-chip",  demanda: 2.0, valores: [0.15, 0.10, 0.20, 0.05, 0.10] },
  { nome: "Cloud/Data",     icon: "cloud",          demanda: 1.5, valores: [0.10, 0.40, 0.15, 0.08, 0.12] },
  { nome: "Automação",      icon: "cog",            demanda: 0.8, valores: [0.05, 0.15, 0.20, 0.03, 0.15] },
  { nome: "Papel/Celulose", icon: "leaf",           demanda: 1.2, valores: [0.02, 0.05, 0.03, 0.30, 0.08] },
  { nome: "TI Verde",       icon: "flower",         demanda: 0.5, valores: [0.08, 0.12, 0.10, 0.04, 0.05] },
];

// Tabela 1 do artigo — Evolução Decenal (2015–2026)
export const EVOLUCAO_DECENAL = [
  { ano: 2015,    pue: 0.65, co2: 1200, roi: 4.2,  conformidade: "Não Conforme",      blockchain: "Ausente" },
  { ano: 2018,    pue: 0.69, co2: 1120, roi: 6.1,  conformidade: "Parcial",           blockchain: "Simulação Inicial" },
  { ano: 2021,    pue: 0.74, co2: 980,  roi: 9.8,  conformidade: "Parcial",           blockchain: "Verificado" },
  { ano: 2024,    pue: 0.79, co2: 860,  roi: 12.5, conformidade: "Conforme",          blockchain: "Verificado" },
  { ano: "2025/26", pue: 0.81, co2: 820, roi: 14.2, conformidade: "Conforme (Pleno)", blockchain: "Ledger Ativo (SHA-256)" },
];

// Tabela 2 do artigo — Intensidade de Insumos (2015 vs 2026)
export const INTENSIDADE_SETORES = [
  { setor: "Tecnologia da Informação (TI)", c2015: 0.350, c2026: 0.210, impacto: "Redução drástica de emissões indiretas por virtualização e cloud" },
  { setor: "Energia Elétrica",              c2015: 0.280, c2026: 0.240, impacto: "Migração para matrizes limpas e fontes renováveis (Solar/Eólica)" },
  { setor: "Indústria / Manufatura",        c2015: 0.450, c2026: 0.410, impacto: "Otimização do descarte de resíduos e economia circular" },
  { setor: "Transportes / Logística",       c2015: 0.150, c2026: 0.120, impacto: "Roteamento inteligente e ganho de eficiência na frota" },
];

// Série 2015–2025 para gráficos (extrapolada da Tabela 1)
export const SERIE_ANUAL = {
  anos: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
  co2:  [200, 180, 160, 150, 140, 130, 125, 120, 125, 124, 120],   // tCO2e (dashboard web)
  roi:  [4.2, 4.8, 5.5, 6.1, 7.2, 8.1, 9.8, 10.6, 11.4, 12.5, 14.2], // % (Tabela 1)
};

export const RADAR_2015 = [65, 55, 70, 60, 50, 75];
export const RADAR_2025 = [82, 75, 88, 78, 85, 94];
export const RADAR_LABELS = ["Ambiental", "Social", "Governança", "Econômico", "Inovação", "Compliance"];

// Transações do ledger (simulação SHA-256)
export const TRANSACTIONS = [
  { tipo: "Crédito de Carbono", icon: "leaf",          data: "2025-01-15 14:32", valor: 150.5,  unidade: "tCO2e", hash: "0x8f2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e", norma: "ISO 14064", setor: "Cloud/Data" },
  { tipo: "Resíduo Eletrônico", icon: "laptop",        data: "2025-01-15 12:18", valor: -45.2,  unidade: "kg",    hash: "0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d", norma: "GRI 306", setor: "Hardware" },
  { tipo: "Energia Renovável",  icon: "sunny",         data: "2025-01-15 10:45", valor: 1200.0, unidade: "kWh",   hash: "0x9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b", norma: "ISO 50001", setor: "TI Verde" },
  { tipo: "Economia Circular",  icon: "refresh",       data: "2025-01-14 16:22", valor: 89.3,   unidade: "kg",    hash: "0x7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c", norma: "GRI 301", setor: "Papel/Celulose" },
  { tipo: "Automação Verde",    icon: "build",         data: "2025-01-14 09:15", valor: 234.7,  unidade: "kWh",   hash: "0x6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d", norma: "IFRS S2", setor: "Automação" },
];

export const CERTIFICACOES = ["ISO 14001:2015", "GRI 305 - Emissões", "IFRS S2 - Clima", "ISO 50001 - Energia"];

// Cenários de resiliência climática IFRS S2 (2030)
export const CENARIOS_2030 = [
  { nome: "Cenário Otimista", valor: 92, cor: "#10b981", desc: "Conformidade ESG projetada" },
  { nome: "Cenário Base",     valor: 78, cor: "#0ea5e9", desc: "Manutenção de tendências atuais" },
  { nome: "Cenário de Risco", valor: 65, cor: "#f59e0b", desc: "Sem investimentos adicionais" },
];

// KPIs do dashboard
export const KPIS = [
  { valor: "820 t",   label: "Emissões CO₂ Escopo 2 (2025/26)", cor: "#10b981", tendencia: -32 },
  { valor: "14,2%",   label: "ROI Sustentável",                   cor: "#0ea5e9", tendencia: 238 },
  { valor: "0,81",    label: "Eficiência Energética (índice PUE)",cor: "#f59e0b", tendencia: 25 },
  { valor: "100%",    label: "Dados Auditáveis (SHA-256)",        cor: "#8b5cf6", tendencia: 100 },
];

// Localizações IoT (mesmas do mapa web)
export const LOCATIONS = [
  { lat: -23.5505, lng: -46.6333, title: "São Paulo - Data Center Principal", cor: "#10b981" },
  { lat: -23.1791, lng: -45.8872, title: "São José dos Campos - Unidade Industrial", cor: "#0ea5e9" },
  { lat: -22.9068, lng: -43.1729, title: "Rio de Janeiro - Escritório Regional", cor: "#0ea5e9" },
  { lat: -19.9167, lng: -43.9333, title: "Belo Horizonte - Centro de Pesquisa", cor: "#f59e0b" },
  { lat: -25.4284, lng: -49.2733, title: "Curitiba - Ponto de Reciclagem", cor: "#f59e0b" },
  { lat: -30.0346, lng: -51.2177, title: "Porto Alegre - Unidade Logística", cor: "#8b5cf6" },
];

export const CONTATO = {
  email: "adriano.rodrigues365@outlook.com",
  telefone: "(11) 97108-0431",
  cidade: "São Paulo, SP - Brasil",
  repositorio: "github.com/ecobalance/ledger",
  versao: "v2.0.26",
};

export const STACK = ["Python 3.10 + NumPy", "Node.js (REST + child_process)", "MySQL 8.0 (particionamento temporal 2015–2026)", "SHA-256 Ledger", "React / React Native", "Docker & Docker Compose", "Twilio API (alertas SMS)"];