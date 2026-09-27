-- Criação do Banco de Dados EcoBalance
CREATE DATABASE IF NOT EXISTS ecobalance_ledger;
USE ecobalance_ledger;

-- 1. Tabela de Setores (Estrutura para Matriz de Leontief)
-- Define os centros de custo e ramos de atividade (ex: Hardware, Cloud, Automação)
CREATE TABLE setores (
    id_setor INT AUTO_INCREMENT PRIMARY KEY,
    nome_setor VARCHAR(100) NOT NULL,
    codigo_iso VARCHAR(20), -- Referência a normas ISO de Sustentabilidade
    responsavel_esg VARCHAR(100),
    meta_emissao_anual DECIMAL(15,2), -- Em toneladas de CO2
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Tabela de Insumos (Coeficientes Técnicos)
-- Armazena o quanto um setor consome de outro para produzir valor (Insumo-Produto)
CREATE TABLE insumos (
    id_insumo INT AUTO_INCREMENT PRIMARY KEY,
    id_setor_origem INT,
    id_setor_destino INT,
    coeficiente_tecnico DECIMAL(10,6) NOT NULL, -- Valor 'a_ij' da matriz de Leontief
    unidade_medida VARCHAR(20) DEFAULT 'unidade_valor',
    ano_referencia INT NOT NULL, -- Essencial para análise histórica 2015-2025
    FOREIGN KEY (id_setor_origem) REFERENCES setores(id_setor),
    FOREIGN KEY (id_setor_destino) REFERENCES setores(id_setor)
) ENGINE=InnoDB;

-- 3. Tabela de Transações Blockchain (Rastreabilidade e Governança)
-- Garante a imutabilidade dos dados de descarte de resíduos e créditos de carbono
CREATE TABLE transacoes_blockchain (
    id_blockchain INT AUTO_INCREMENT PRIMARY KEY,
    id_setor INT,
    hash_transacao VARCHAR(255) UNIQUE NOT NULL, -- Hash gerado no ledger
    tipo_ativo ENUM('RESIDUO_ELETRONICO', 'CREDITO_CARBONO', 'ENERGIA_RENOVAVEL'),
    quantidade DECIMAL(15,4) NOT NULL,
    bloco_referencia INT,
    status_verificacao BOOLEAN DEFAULT FALSE,
    data_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_setor) REFERENCES setores(id_setor)
) ENGINE=InnoDB;

-- 4. Tabela de Demanda e Produção (Output do Modelo Python)
-- Armazena os resultados dos cálculos X = (I-A)^-1 * d
CREATE TABLE resultados_leontief (
    id_resultado INT AUTO_INCREMENT PRIMARY KEY,
    id_setor INT,
    demanda_final_d DECIMAL(15,2),
    producao_total_x DECIMAL(15,2),
    roi_estimado DECIMAL(5,2),
    data_calculo DATETIME,
    FOREIGN KEY (id_setor) REFERENCES setores(id_setor)
) ENGINE=InnoDB;

-- Índices para otimização de consultas de governança
CREATE INDEX idx_blockchain_hash ON transacoes_blockchain(hash_transacao);
CREATE INDEX idx_setor_ano ON insumos(id_setor_destino, ano_referencia);