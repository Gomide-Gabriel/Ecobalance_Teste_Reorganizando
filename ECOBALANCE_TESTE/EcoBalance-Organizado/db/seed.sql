USE ecobalance_ledger;

-- 1. Inserção de Setores Estratégicos
INSERT INTO setores (nome_setor, codigo_iso, responsavel_esg, meta_emissao_anual) VALUES
('Automobilístico', 'ISO-14001', 'Ricardo Dutra', 50000.00),
('Aço', 'ISO-14001', 'Carlos Alberto Jr', 85000.00),
('Eletrônicos (TI)', 'ISO-50001', 'Adriano Rodrigues', 15000.00),
('Papel e Celulose', 'ISO-14064', 'Rossana Lott', 30000.00),
('Gestão de Resíduos/TI Verde', 'ISO-27001', 'Sapiens Al Team', 5000.00);

-- 2. Inserção de Coeficientes Técnicos (Matriz A para Leontief)
-- Coeficientes baseados no exemplo do PDF da USP: Consumo Interno do Sistema
INSERT INTO insumos (id_setor_origem, id_setor_destino, coeficiente_tecnico, ano_referencia) VALUES
-- Setor Automobilístico consome:
(1, 1, 0.1500, 2025), -- Dele mesmo
(2, 1, 0.4000, 2025), -- Aço
(3, 1, 0.1000, 2025), -- Eletrônicos
-- Setor de Aço consome:
(1, 2, 0.1000, 2025), -- Auto
(2, 2, 0.2000, 2025), -- Dele mesmo
(3, 2, 0.2500, 2025), -- Eletrônicos
-- Setor de Eletrônicos (TI) consome:
(3, 3, 0.2000, 2025), -- Dele mesmo
(5, 3, 0.0500, 2025), -- TI Verde (Reciclagem)
-- Setor de TI Verde consome:
(3, 5, 0.1000, 2025), -- Eletrônicos para processar
(5, 5, 0.0200, 2025); -- Dele mesmo

-- 3. Simulação de Transações Blockchain (TI Verde e Sustentabilidade)
-- Dados para alimentar o Leaflet e o histórico de governança
INSERT INTO transacoes_blockchain (id_setor, hash_transacao, tipo_ativo, quantidade, status_verificacao) VALUES
(3, '0x8f2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e', 'RESIDUO_ELETRONICO', 150.50, TRUE),
(5, '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d', 'CREDITO_CARBONO', 1200.00, TRUE),
(1, '0x9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b', 'ENERGIA_RENOVAVEL', 450.75, TRUE);

-- 4. Resultados Iniciais de Equilíbrio (Dashboard Chart.js)
-- d = Demanda Final | X = Produção Total Estimada
INSERT INTO resultados_leontief (id_setor, demanda_final_d, producao_total_x, roi_estimado, data_calculo) VALUES
(1, 2000000.00, 2800000.00, 15.50, '2025-12-31 08:00:00'),
(2, 1000000.00, 1850000.00, 12.20, '2025-12-31 08:00:00'),
(3, 500000.00, 950000.00, 22.10, '2025-12-31 08:00:00');


-- Adicionando dados de 2015 para comparação (Exemplo de maior consumo/menor eficiência)
INSERT INTO insumos (id_setor_origem, id_setor_destino, coeficiente_tecnico, ano_referencia) VALUES
(3, 3, 0.3500, 2015), -- Eletrônicos em 2015 era menos eficiente (0.35) que em 2025 (0.20)
(2, 1, 0.5500, 2015); -- Automobilístico consumia mais aço em 2015