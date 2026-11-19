const path = require('path');
// Aponta explicitamente para o .env na raiz do projeto (um nível acima de backend/),
// porque por padrão o dotenv só olha a pasta de onde o comando foi rodado.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const express = require('express');
const { engine } = require('express-handlebars');
const jwt = require('jsonwebtoken');
const { spawn } = require('child_process');
const { Pool } = require('pg');

const app = express();
app.set('trust proxy', 1); // Render: usa o IP real do cliente no limitador

// Conexão com o Postgres (Neon). A DATABASE_URL vem do .env local
// ou das variáveis de ambiente configuradas no Render.
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // a Neon exige conexão SSL
});

// Rota só pra testar se a conexão com o banco está funcionando
app.get('/api/health-db', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW() AS agora');
        res.json({ status: 'ok', conectado_em: result.rows[0].agora });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Necessário para ler JSON no corpo das requisições (faltava no original)
app.use(express.json());

// Configuração Handlebars (View Engine)
app.engine('handlebars', engine());
app.set('view engine', 'handlebars');

// Serve o front-end estático (pasta /frontend) na raiz do servidor
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Middleware de Autenticação JWT
const authenticateJWT = (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.sendStatus(401);
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Autorização: libera a rota só para os perfis informados
const autorizar = (...perfis) => (req, res, next) => {
    if (!req.user || !perfis.includes(req.user.perfil)) {
        return res.status(403).json({ message: 'Sem permissão para esta ação.' });
    }
    next();
};

// Roda o leontief_calc.py e devolve o JSON de saída
const rodarPython = (entrada) => new Promise((resolve, reject) => {
    const proc = spawn(process.env.PYTHON_BIN || 'python3', [path.join(__dirname, 'leontief_calc.py')]);
    let out = '';
    proc.stdout.on('data', (d) => { out += d.toString(); });
    proc.stderr.on('data', (d) => console.error('leontief_calc.py:', d.toString()));
    proc.on('error', reject);
    proc.stdin.on('error', () => {});
    let stderr = '';

    proc.stderr.on('data', (d) => {
    stderr += d.toString();
    console.error('leontief_calc.py:', d.toString());
    });

    proc.on('close', (codigo) => {
    if (codigo !== 0) {
        return reject(
        new Error(
            `leontief_calc.py terminou com código ${codigo}: ${stderr.slice(0, 300)}`
        )
        );
    }

    try {
        resolve(JSON.parse(out));
    } catch {
        reject(
        new Error('Saída inválida do leontief_calc.py')
        );
    }
    });
    proc.stdin.write(JSON.stringify(entrada));
    proc.stdin.end();
});





// Cálculo de Leontief: monta a matriz do banco, grava simulação + log com hash
app.post('/api/calculate-equilibrium', authenticateJWT, autorizar('ANALISTA'), async (req, res) => {
    const { ano, demanda } = req.body;
    if (!idValido(ano)) return res.status(400).json({ message: 'ano deve ser um inteiro positivo.' });
    if (!demanda || typeof demanda !== 'object' || Array.isArray(demanda))
        return res.status(400).json({ message: 'demanda deve ser um objeto {"id_setor": valor}.' });

    let client;
    try {
        const { rows: setores } = await pool.query('SELECT id_setor FROM setores ORDER BY id_setor');
        const ids = setores.map((s) => s.id_setor);
        const pos = new Map(ids.map((id, i) => [id, i]));

        for (const [k, v] of Object.entries(demanda)) {
            if (!pos.has(Number(k))) return res.status(400).json({ message: `Setor ${k} não existe.` });
            if (typeof v !== 'number' || !Number.isFinite(v) || v < 0)
                return res.status(400).json({ message: `Demanda do setor ${k} deve ser um número >= 0.` });
        }
        const d = ids.map((id) => Number(demanda[id] ?? 0));

        const { rows: coefs } = await pool.query(
            'SELECT id_setor_origem, id_setor_destino, coeficiente_tecnico FROM coeficientes_tecnicos WHERE ano_referencia = $1',
            [ano]);
        if (coefs.length === 0)
            return res.status(404).json({ message: 'Não há coeficientes cadastrados para este ano.' });

        // origem = linha, destino = coluna; NUMERIC do Postgres vem como texto, por isso Number()
        const n = ids.length;
        const A = Array.from({ length: n }, () => Array(n).fill(0));
        const coeficientesUsados = {};
        for (const c of coefs) {
            const valor = Number(c.coeficiente_tecnico);
            A[pos.get(c.id_setor_origem)][pos.get(c.id_setor_destino)] = valor;
            if (!coeficientesUsados[c.id_setor_origem]) coeficientesUsados[c.id_setor_origem] = {};
            coeficientesUsados[c.id_setor_origem][c.id_setor_destino] = valor;
        }

        const result = await rodarPython({ matriz: A, demanda: d });
        if (result.status !== 'success')
            return res.status(422).json({ status: 'error', message: result.message });

        const demandaFinal = {}, producaoTotal = {};
        ids.forEach((id, i) => { demandaFinal[id] = d[i]; producaoTotal[id] = result.producao_total[i]; });

        client = await pool.connect();
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(1)');

        const { rows: [sim] } = await client.query(
            `INSERT INTO simulacoes_leontief
               (id_usuario, ano_referencia, coeficientes_usados, demanda_final, producao_total)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [req.user.id, ano, coeficientesUsados, demandaFinal, producaoTotal]);

        const { rows: ultimo } = await client.query(
            'SELECT hash_atual FROM logs_transacoes_blockchain ORDER BY id_log DESC LIMIT 1');
        const hashAnterior = ultimo.length ? ultimo[0].hash_atual : null;

        const hashAtual = crypto.createHash('sha256').update(JSON.stringify({
            hash_anterior: hashAnterior,
            id_simulacao: sim.id_simulacao,
            id_usuario: sim.id_usuario,
            ano_referencia: sim.ano_referencia,
            coeficientes_usados: sim.coeficientes_usados,
            demanda_final: sim.demanda_final,
            producao_total: sim.producao_total
        })).digest('hex');

        const { rows: [log] } = await client.query(
            'INSERT INTO logs_transacoes_blockchain (id_simulacao, hash_anterior, hash_atual) VALUES ($1, $2, $3) RETURNING id_log',
            [sim.id_simulacao, hashAnterior, hashAtual]);

        await client.query('COMMIT');
        res.status(201).json({
            id_simulacao: sim.id_simulacao,
            id_log: log.id_log,
            hash_atual: hashAtual,
            producao_total: sim.producao_total,
            raio_espectral: result.raio_espectral
        });
    } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        console.error(err);
        res.status(500).json({ status: 'error', message: 'Erro ao calcular equilíbrio.' });
    } finally {
        if (client) client.release();
    }
});
// ---------------------- CRUD ------------------------// 

// ---------- CRUD de setores ----------
const idValido = (v) => Number.isInteger(Number(v)) && Number(v) > 0;

app.get('/api/setores', authenticateJWT, async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT id_setor, nome_setor, descricao FROM setores ORDER BY id_setor');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: 'Erro ao listar setores.' });
    }
});

app.get('/api/setores/:id', authenticateJWT, async (req, res) => {
    if (!idValido(req.params.id)) return res.status(400).json({ message: 'ID inválido.' });
    try {
        const { rows } = await pool.query(
            'SELECT id_setor, nome_setor, descricao FROM setores WHERE id_setor = $1',
            [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Setor não encontrado.' });
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: 'Erro ao buscar setor.' });
    }
});

// Prévia de Leontief:
// usa a matriz e a demanda enviadas pelo dashboard,
// mas não grava simulação nem cria log de auditoria.
app.post(
  '/api/calculate-preview',
  authenticateJWT,
  autorizar('ANALISTA'),
  async (req, res) => {
    const { matriz, demanda } = req.body || {};

    if (!Array.isArray(matriz) || matriz.length === 0) {
      return res.status(400).json({
        message: 'matriz deve ser uma matriz quadrada não vazia.'
      });
    }

    const n = matriz.length;

    if (n > 50) {
      return res.status(400).json({
        message: 'A matriz deve ter no máximo 50 setores.'
      });
    }

    if (!matriz.every(
      linha => Array.isArray(linha) && linha.length === n
    )) {
      return res.status(400).json({
        message: 'matriz deve ser quadrada.'
      });
    }

    if (!Array.isArray(demanda) || demanda.length !== n) {
      return res.status(400).json({
        message: 'demanda deve ter um valor por setor.'
      });
    }

    // Valida os coeficientes antes de abrir o processo Python.
    const todosCoeficientesValidos = matriz.every(linha =>
      linha.every(valor =>
        typeof valor === 'number' &&
        Number.isFinite(valor) &&
        valor >= 0
      )
    );

    if (!todosCoeficientesValidos) {
      return res.status(400).json({
        message:
          'Todos os coeficientes devem ser números finitos maiores ou iguais a zero.'
      });
    }

    // Valida o vetor de demanda antes de abrir o processo Python.
    const demandaValida = demanda.every(valor =>
      typeof valor === 'number' &&
      Number.isFinite(valor) &&
      valor >= 0
    );

    if (!demandaValida) {
      return res.status(400).json({
        message:
          'A demanda deve conter apenas números finitos maiores ou iguais a zero.'
      });
    }

    // Exige ao menos uma demanda positiva.
    if (!demanda.some(valor => valor > 0)) {
      return res.status(400).json({
        message:
          'Informe uma demanda maior que zero em pelo menos um setor.'
      });
    }

    try {
      const resultado = await rodarPython({
        matriz,
        demanda
      });

      if (resultado.status !== 'success') {
        return res.status(422).json({
          status: 'error',
          message: resultado.message
        });
      }

      return res.json({
        status: 'success',
        producao_total: resultado.producao_total,
        raio_espectral: resultado.raio_espectral
      });
    } catch (err) {
      console.error('Erro na prévia de Leontief:', err);

      return res.status(500).json({
        status: 'error',
        message: 'Erro ao executar a prévia de Leontief.'
      });
    }
  }
);

app.post('/api/setores', authenticateJWT, autorizar('ANALISTA'), async (req, res) => {
    const { nome_setor, descricao } = req.body;
    if (!nome_setor) return res.status(400).json({ message: 'nome_setor é obrigatório.' });
    try {
        const { rows } = await pool.query(
            'INSERT INTO setores (nome_setor, descricao) VALUES ($1, $2) RETURNING *',
            [nome_setor, descricao || null]);
        res.status(201).json(rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ message: 'Já existe um setor com esse nome.' });
        console.error(err);
        res.status(500).json({ status: 'error', message: 'Erro ao criar setor.' });
    }
});

app.put('/api/setores/:id', authenticateJWT, autorizar('ANALISTA'), async (req, res) => {
    const { nome_setor, descricao } = req.body;
    if (!idValido(req.params.id)) return res.status(400).json({ message: 'ID inválido.' });
    if (!nome_setor) return res.status(400).json({ message: 'nome_setor é obrigatório.' });
    try {
        const { rows } = await pool.query(
            'UPDATE setores SET nome_setor = $1, descricao = $2 WHERE id_setor = $3 RETURNING *',
            [nome_setor, descricao || null, req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Setor não encontrado.' });
        res.json(rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ message: 'Já existe um setor com esse nome.' });
        console.error(err);
        res.status(500).json({ status: 'error', message: 'Erro ao atualizar setor.' });
    }
});

app.delete('/api/setores/:id', authenticateJWT, autorizar('ANALISTA'), async (req, res) => {
    if (!idValido(req.params.id)) return res.status(400).json({ message: 'ID inválido.' });
    try {
        const { rows } = await pool.query(
            'DELETE FROM setores WHERE id_setor = $1 RETURNING id_setor', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Setor não encontrado.' });
        res.status(204).end();
    } catch (err) {
        if (err.code === '23503') return res.status(409).json({ message: 'Setor em uso por outros registros.' });
        console.error(err);
        res.status(500).json({ status: 'error', message: 'Erro ao excluir setor.' });
    }
});

// ---------- CRUD de coeficientes técnicos ----------
app.get('/api/coeficientes', authenticateJWT, async (req, res) => {
    const { ano } = req.query;
    if (ano !== undefined && !idValido(ano)) return res.status(400).json({ message: 'ano inválido.' });
    try {
        const { rows } = ano
            ? await pool.query(
                'SELECT * FROM coeficientes_tecnicos WHERE ano_referencia = $1 ORDER BY id_setor_origem, id_setor_destino', [ano])
            : await pool.query(
                'SELECT * FROM coeficientes_tecnicos ORDER BY ano_referencia, id_setor_origem, id_setor_destino');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: 'Erro ao listar coeficientes.' });
    }
});

app.get('/api/coeficientes/:id', authenticateJWT, async (req, res) => {
    if (!idValido(req.params.id)) return res.status(400).json({ message: 'ID inválido.' });
    try {
        const { rows } = await pool.query(
            'SELECT * FROM coeficientes_tecnicos WHERE id_coeficiente = $1', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Coeficiente não encontrado.' });
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: 'Erro ao buscar coeficiente.' });
    }
});


const coefValido = (v) => v !== null && v !== '' && Number.isFinite(Number(v)) && Number(v) >= 0;

app.post('/api/coeficientes', authenticateJWT, autorizar('ANALISTA'), async (req, res) => {
    const { id_setor_origem, id_setor_destino, coeficiente_tecnico, unidade_medida, ano_referencia } = req.body;
    if (!idValido(id_setor_origem) || !idValido(id_setor_destino))
        return res.status(400).json({ message: 'id_setor_origem e id_setor_destino devem ser ids válidos.' });
    if (!coefValido(coeficiente_tecnico))
        return res.status(400).json({ message: 'coeficiente_tecnico deve ser um número >= 0.' });
    if (!idValido(ano_referencia))
        return res.status(400).json({ message: 'ano_referencia deve ser um inteiro positivo.' });
    try {
        const { rows } = await pool.query(
            `INSERT INTO coeficientes_tecnicos
               (id_setor_origem, id_setor_destino, coeficiente_tecnico, unidade_medida, ano_referencia)
             VALUES ($1, $2, $3, COALESCE($4, 'unidade_valor'), $5) RETURNING *`,
            [id_setor_origem, id_setor_destino, coeficiente_tecnico, unidade_medida || null, ano_referencia]);
        res.status(201).json(rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ message: 'Já existe esse par origem/destino para este ano.' });
        if (err.code === '23503') return res.status(400).json({ message: 'Setor de origem ou destino não existe.' });
        console.error(err);
        res.status(500).json({ status: 'error', message: 'Erro ao criar coeficiente.' });
    }
});

app.put('/api/coeficientes/:id', authenticateJWT, autorizar('ANALISTA'), async (req, res) => {
    const { id_setor_origem, id_setor_destino, coeficiente_tecnico, unidade_medida, ano_referencia } = req.body;
    if (!idValido(req.params.id)) return res.status(400).json({ message: 'ID inválido.' });
    if (!idValido(id_setor_origem) || !idValido(id_setor_destino))
        return res.status(400).json({ message: 'id_setor_origem e id_setor_destino devem ser ids válidos.' });
    if (!coefValido(coeficiente_tecnico))
        return res.status(400).json({ message: 'coeficiente_tecnico deve ser um número >= 0.' });
    if (!idValido(ano_referencia))
        return res.status(400).json({ message: 'ano_referencia deve ser um inteiro positivo.' });
    try {
        const { rows } = await pool.query(
            `UPDATE coeficientes_tecnicos
                SET id_setor_origem = $1, id_setor_destino = $2, coeficiente_tecnico = $3,
                    unidade_medida = COALESCE($4, 'unidade_valor'), ano_referencia = $5
              WHERE id_coeficiente = $6 RETURNING *`,
            [id_setor_origem, id_setor_destino, coeficiente_tecnico, unidade_medida || null, ano_referencia, req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Coeficiente não encontrado.' });
        res.json(rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ message: 'Já existe esse par origem/destino para este ano.' });
        if (err.code === '23503') return res.status(400).json({ message: 'Setor de origem ou destino não existe.' });
        console.error(err);
        res.status(500).json({ status: 'error', message: 'Erro ao atualizar coeficiente.' });
    }
});

app.delete('/api/coeficientes/:id', authenticateJWT, autorizar('ANALISTA'), async (req, res) => {
    if (!idValido(req.params.id)) return res.status(400).json({ message: 'ID inválido.' });
    try {
        const { rows } = await pool.query(
            'DELETE FROM coeficientes_tecnicos WHERE id_coeficiente = $1 RETURNING id_coeficiente', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Coeficiente não encontrado.' });
        res.status(204).end();
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: 'Erro ao excluir coeficiente.' });
    }
});

// ---------- Logs de auditoria (sem DELETE, sem PUT genérico) ----------
const STATUS_DECISAO = ['APROVADO', 'REJEITADO'];

app.get('/api/logs', authenticateJWT, async (req, res) => {
    const { status } = req.query;
    if (status !== undefined && ![...STATUS_DECISAO, 'PENDENTE'].includes(status))
        return res.status(400).json({ message: 'status inválido.' });
    try {
        const { rows } = status
            ? await pool.query('SELECT * FROM logs_transacoes_blockchain WHERE status_auditoria = $1 ORDER BY id_log', [status])
            : await pool.query('SELECT * FROM logs_transacoes_blockchain ORDER BY id_log');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: 'Erro ao listar logs.' });
    }
});

app.get('/api/logs/verificar', authenticateJWT, autorizar('AUDITOR', 'ANALISTA'), async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT l.id_log, l.hash_anterior, l.hash_atual, s.id_simulacao, s.id_usuario,
                    s.ano_referencia, s.coeficientes_usados, s.demanda_final, s.producao_total
               FROM logs_transacoes_blockchain l
               JOIN simulacoes_leontief s ON s.id_simulacao = l.id_simulacao
              ORDER BY l.id_log`);
        let anterior = null;
        for (const r of rows) {
            if ((r.hash_anterior || null) !== anterior)
                return res.json({ ok: false, id_log_quebrado: r.id_log, motivo: 'hash_anterior não bate com o log anterior.' });
            const recalculado = crypto.createHash('sha256').update(JSON.stringify({
                hash_anterior: anterior,
                id_simulacao: r.id_simulacao,
                id_usuario: r.id_usuario,
                ano_referencia: r.ano_referencia,
                coeficientes_usados: r.coeficientes_usados,
                demanda_final: r.demanda_final,
                producao_total: r.producao_total
            })).digest('hex');
            if (recalculado !== r.hash_atual)
                return res.json({ ok: false, id_log_quebrado: r.id_log, motivo: 'conteúdo da simulação não bate com o hash.' });
            anterior = r.hash_atual;
        }
        res.json({ ok: true, logs_verificados: rows.length });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: 'Erro ao verificar cadeia.' });
    }
});

app.patch('/api/logs/:id/status', authenticateJWT, autorizar('AUDITOR'), async (req, res) => {
    const { status_auditoria } = req.body;
    if (!idValido(req.params.id)) return res.status(400).json({ message: 'ID inválido.' });
    if (!STATUS_DECISAO.includes(status_auditoria))
        return res.status(400).json({ message: 'status_auditoria deve ser APROVADO ou REJEITADO.' });
    try {
        const { rows } = await pool.query(
            `UPDATE logs_transacoes_blockchain SET status_auditoria = $1
              WHERE id_log = $2 AND status_auditoria = 'PENDENTE' RETURNING *`,
            [status_auditoria, req.params.id]);
        if (rows.length === 0) {
            const { rows: existe } = await pool.query(
                'SELECT status_auditoria FROM logs_transacoes_blockchain WHERE id_log = $1', [req.params.id]);
            if (existe.length === 0) return res.status(404).json({ message: 'Log não encontrado.' });
            return res.status(409).json({ message: `Log já decidido (${existe[0].status_auditoria}).` });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: 'Erro ao atualizar status.' });
    }
});


// ------------------------- CRUD Usuário ------------------------------//

// Cadastro público: a conta nasce com email_verificado = false e só entra depois de
// confirmar o e-mail (ver "Verificação de e-mail no cadastro" mais abaixo).

// Cadastro público do protótipo:
// o usuário escolhe livremente o perfil para permitir a demonstração dos três fluxos.
// Em produção, ANALISTA e AUDITOR deverão depender de uma regra de autorização.
const PERFIS_VALIDOS = ['STAKEHOLDER', 'ANALISTA', 'AUDITOR'];

const emailOk = (e) =>
  typeof e === 'string' &&
  e.length <= 255 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

const normEmail = (e) =>
  String(e || '').trim().toLowerCase();

const tentativas = new Map(); // limite simples por IP e rota (em memória)
function limitar(max, janelaMs) {
    return (req, res, next) => {
        const k = req.ip + '|' + req.path, agora = Date.now();
        let r = tentativas.get(k);
        if (!r || r.ate < agora) r = { n: 0, ate: agora + janelaMs };
        r.n++; tentativas.set(k, r);
        if (r.n > max) return res.status(429).json({ message: 'Muitas tentativas. Tente de novo mais tarde.' });
        next();
    };
}

// trecho que não está retornando resposta
app.post('/api/usuario', limitar(20, 15 * 60 * 1000), async (req, res) => {

    try {
        let { nome, email, senha, perfil } = req.body;

        nome = nome?.trim();
        email = email?.trim().toLowerCase();
        perfil = perfil?.trim().toUpperCase();

        if (!nome || !email || !senha || !perfil) {
            return res.status(400).json({
                error: 'Todos os campos são obrigatórios'
            });
        }

        if (!PERFIS_VALIDOS.includes(perfil)) {
            return res.status(400).json({
                error: 'Perfil inválido'
            });
        }

        if (senha.length < 8) {
            return res.status(400).json({
                error: 'A senha deve ter pelo menos 8 caracteres'
            });
        }

        const senha_hash = await bcrypt.hash(senha, 10);

        const resultado = await pool.query(
            `
            INSERT INTO usuarios
            (nome, email, senha_hash, perfil)
            VALUES ($1, $2, $3, $4)
            RETURNING id_usuario, nome, email, perfil
            `,
            [nome, email, senha_hash, perfil]
        );

        const u = resultado.rows[0];

        // a conta nasce não verificada: gera o link e envia o e-mail de confirmação
        let enviado = false;
        let link;
        try {
            const tokenVerif = await novaVerificacao(u.id_usuario);
            if (emailConfigurado()) {
                enviado = await enviarVerificacao(u.email, tokenVerif);
            } else if (process.env.DEMO_RESET === 'true') {
                // MODO DEMONSTRAÇÃO (sem provedor de e-mail): devolve o link na resposta.
                // Não use em produção: entrega o link a quem criou a conta, sem provar que o e-mail é dele.
                link = linkVerificacao(process.env.APP_URL || `${req.protocol}://${req.get('host')}`, tokenVerif);
            }
        } catch (e) {
            console.error('Erro ao gerar verificação de e-mail:', e.message);
        }

        const mensagem = enviado
            ? `Conta criada. Enviamos um e-mail de confirmação para ${u.email}. Abra o link para ativar o acesso.`
            : link
                ? 'Conta criada. Modo demonstração: use o link abaixo para confirmar o e-mail.'
                : 'Conta criada, mas não foi possível enviar o e-mail de confirmação agora. Tente reenviar em instantes ou fale com o administrador.';

        return res.status(201).json({
            message: mensagem,
            usuario: u,
            verificacao_pendente: true,
            email_enviado: enviado,
            ...(link ? { link } : {})
        });

    } catch (error) {

        if (error.code === '23505') {
            return res.status(409).json({
                error: 'E-mail já cadastrado'
            });
        }

        console.error('Erro ao criar usuário:', error);
        console.error(error.message);
        console.error(error.code);

        return res.status(500).json({
            error: 'Erro interno do servidor'
        });
    }
});


// ------------------- Recuperação de senha ------------------------//
// Fluxo: esqueci-senha registra o pedido -> um link com token é gerado
// (DEMO_RESET=true devolve na resposta; ou use gerar_link_redefinicao.js)
// -> redefinir-senha troca a senha. O token nunca é guardado em texto puro,
// só o hash SHA-256; vale 30 min e só pode ser usado uma vez.
const sha256 = (t) => crypto.createHash('sha256').update(t).digest('hex');

// ---- Envio de e-mail por API HTTPS (Brevo) ----
// O plano gratuito do Render bloqueia SMTP (portas 25/465/587); a API usa HTTPS e funciona.
// Variáveis: BREVO_API_KEY, MAIL_FROM (remetente verificado no Brevo), MAIL_FROM_NAME, APP_URL
const BREVO_URL = process.env.BREVO_API_URL || 'https://api.brevo.com/v3/smtp/email';
const emailConfigurado = () => Boolean(process.env.BREVO_API_KEY && process.env.MAIL_FROM && process.env.APP_URL);

async function enviarEmail({ para, assunto, html, texto }) {
    const resp = await fetch(BREVO_URL, {
        method: 'POST',
        headers: {
            'api-key': process.env.BREVO_API_KEY,
            'content-type': 'application/json',
            accept: 'application/json'
        },
        body: JSON.stringify({
            sender: { name: process.env.MAIL_FROM_NAME || 'EcoBalance Ledger', email: process.env.MAIL_FROM },
            to: [{ email: para }],
            subject: assunto,
            htmlContent: html,
            textContent: texto
        }),
        signal: AbortSignal.timeout(10000)
    });
    if (!resp.ok) {
        const corpo = await resp.text().catch(() => '');
        throw new Error(`Brevo respondeu ${resp.status}: ${corpo.slice(0, 200)}`);
    }
}

const emailRedefinicao = (link) => ({
    assunto: 'EcoBalance Ledger - redefinição de senha',
    texto:
`Recebemos um pedido para redefinir a senha da sua conta no EcoBalance Ledger.

Abra o link abaixo para criar uma nova senha (vale por 30 minutos e só pode ser usado uma vez):

${link}

Se você não fez esse pedido, ignore esta mensagem: sua senha continua a mesma.`,
    html:
`<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#111">
  <h2 style="color:#059669">EcoBalance Ledger</h2>
  <p>Recebemos um pedido para redefinir a senha da sua conta.</p>
  <p><a href="${link}" style="display:inline-block;background:#059669;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none">Criar nova senha</a></p>
  <p style="font-size:13px;color:#555">O link vale por 30 minutos e só pode ser usado uma vez.<br>
  Se você não fez esse pedido, ignore esta mensagem: sua senha continua a mesma.</p>
</div>`
});

const emailSenhaAlterada = () => ({
    assunto: 'EcoBalance Ledger - sua senha foi alterada',
    texto: 'A senha da sua conta no EcoBalance Ledger acabou de ser alterada. Se não foi você, entre em contato com o administrador imediatamente.',
    html: '<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#111"><h2 style="color:#059669">EcoBalance Ledger</h2><p>A senha da sua conta acabou de ser alterada.</p><p style="font-size:13px;color:#555">Se não foi você, entre em contato com o administrador imediatamente.</p></div>'
});

// ------------------- Verificação de e-mail no cadastro ------------------------//
// Conta nova nasce com email_verificado = false e só consegue entrar depois de abrir o link
// enviado por e-mail. O token tem 32 bytes aleatórios; no banco fica só o hash SHA-256;
// vale 24 horas e só pode ser usado uma vez (mesmo padrão da redefinição de senha).
const INTERVALO_REENVIO_S = 60; // mínimo entre dois e-mails de confirmação para a mesma conta

const linkVerificacao = (base, token) => `${String(base).replace(/\/$/, '')}/login.html?verificar=${token}`;

const emailVerificacao = (link) => ({
    assunto: 'EcoBalance Ledger - confirme seu e-mail',
    texto:
`Recebemos um cadastro no EcoBalance Ledger com este e-mail.

Abra o link abaixo para confirmar o e-mail e ativar a conta (vale por 24 horas e só pode ser usado uma vez):

${link}

Se você não criou essa conta, ignore esta mensagem: nada será ativado.`,
    html:
`<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#111">
  <h2 style="color:#059669">EcoBalance Ledger</h2>
  <p>Recebemos um cadastro com este e-mail. Confirme para ativar a conta.</p>
  <p><a href="${link}" style="display:inline-block;background:#059669;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none">Confirmar e-mail</a></p>
  <p style="font-size:13px;color:#555">O link vale por 24 horas e só pode ser usado uma vez.<br>
  Se você não criou essa conta, ignore esta mensagem: nada será ativado.</p>
</div>`
});

// Invalida links anteriores ainda abertos e cria um novo. Devolve o token em texto puro
// (ele só existe aqui e no e-mail; no banco vai apenas o hash).
async function novaVerificacao(idUsuario) {
    await pool.query(
        `UPDATE verificacoes_email SET expira_em = now()
          WHERE id_usuario = $1 AND usado_em IS NULL AND expira_em > now()`, [idUsuario]);
    const token = crypto.randomBytes(32).toString('hex');
    await pool.query(
        `INSERT INTO verificacoes_email (id_usuario, token_hash, expira_em)
         VALUES ($1, $2, now() + interval '24 hours')`, [idUsuario, sha256(token)]);
    return token;
}

// Nunca lança: devolve true/false. Se o envio falhar, invalida o token para não sobrar
// um link válido que ninguém recebeu.
async function enviarVerificacao(email, token) {
    const m = emailVerificacao(linkVerificacao(process.env.APP_URL, token));
    try {
        await enviarEmail({ para: email, assunto: m.assunto, html: m.html, texto: m.texto });
        return true;
    } catch (e) {
        console.error('Falha ao enviar e-mail de verificação:', e.message);
        await pool.query('UPDATE verificacoes_email SET expira_em = now() WHERE token_hash = $1', [sha256(token)]).catch(() => {});
        return false;
    }
}

// O front chama esta rota (POST) quando abre login.html?verificar=TOKEN.
// POST e não GET para que pré-visualizadores de e-mail não consumam o link.
app.post('/api/auth/verificar-email', limitar(20, 15 * 60 * 1000), async (req, res) => {
    const { token } = req.body || {};
    const invalido = { message: 'Link inválido ou expirado.' };
    if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) return res.status(400).json(invalido);

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        // trava o pedido para que o mesmo link não seja usado duas vezes ao mesmo tempo
        const { rows } = await client.query(
            `SELECT id_verificacao, id_usuario FROM verificacoes_email
              WHERE token_hash = $1 AND usado_em IS NULL AND expira_em > now()
              FOR UPDATE`, [sha256(token)]);

        if (!rows.length) {
            await client.query('ROLLBACK');
            // link já usado por uma conta confirmada (clique duplo, pré-visualização): não é erro
            const ja = await pool.query(
                `SELECT 1 FROM verificacoes_email v
                   JOIN usuarios u ON u.id_usuario = v.id_usuario
                  WHERE v.token_hash = $1 AND v.usado_em IS NOT NULL AND u.email_verificado`, [sha256(token)]);
            if (ja.rows.length) return res.json({ message: 'E-mail já confirmado. Você já pode entrar.', ja_confirmado: true });
            return res.status(400).json(invalido);
        }

        await client.query('UPDATE usuarios SET email_verificado = true WHERE id_usuario = $1', [rows[0].id_usuario]);
        await client.query('UPDATE verificacoes_email SET usado_em = now() WHERE id_verificacao = $1', [rows[0].id_verificacao]);
        await client.query('COMMIT');
        return res.json({ message: 'E-mail confirmado. Você já pode entrar.' });
    } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        console.error('Erro em verificar-email:', err.message);
        return res.status(500).json({ message: 'Erro ao confirmar o e-mail.' });
    } finally {
        if (client) client.release();
    }
});

// Novo link para quem não recebeu ou deixou expirar. A resposta é sempre a mesma, exista a
// conta ou não, e o e-mail sai sem esperar (mesma velocidade nos dois casos).
app.post('/api/auth/reenviar-verificacao', limitar(5, 60 * 60 * 1000), async (req, res) => {
    const email = normEmail(req.body?.email);
    const resposta = { message: 'Se o e-mail estiver cadastrado e ainda não confirmado, enviaremos um novo link.' };
    if (!emailOk(email)) return res.json(resposta);

    try {
        const { rows } = await pool.query(
            'SELECT id_usuario, email FROM usuarios WHERE lower(email) = $1 AND email_verificado = false', [email]);
        if (rows.length) {
            // evita encher a caixa de entrada de alguém: no máximo um e-mail por minuto por conta
            const recente = await pool.query(
                `SELECT 1 FROM verificacoes_email
                  WHERE id_usuario = $1 AND criado_em > now() - make_interval(secs => $2)`,
                [rows[0].id_usuario, INTERVALO_REENVIO_S]);
            if (!recente.rows.length) {
                const token = await novaVerificacao(rows[0].id_usuario);
                if (emailConfigurado()) {
                    enviarVerificacao(rows[0].email, token); // sem await; nunca lança
                } else if (process.env.DEMO_RESET === 'true') {
                    resposta.link = linkVerificacao(process.env.APP_URL || `${req.protocol}://${req.get('host')}`, token);
                }
            }
        }
    } catch (err) {
        console.error('Erro em reenviar-verificacao:', err.message);
    }
    return res.json(resposta);
});

app.post('/api/auth/esqueci-senha', limitar(5, 60 * 60 * 1000), async (req, res) => {
    const email = normEmail(req.body?.email);

    // Mesma resposta exista o e-mail ou não (não revela quem está cadastrado)
    const resposta = { message: 'Se o e-mail estiver cadastrado, enviaremos as instruções de redefinição.' };

    if (!emailOk(email)) return res.json(resposta);

    try {
        const usuario = await pool.query('SELECT 1 FROM usuarios WHERE lower(email) = $1', [email]);
        if (usuario.rows.length) {
            // invalida links anteriores ainda abertos
            await pool.query(
                `UPDATE pedidos_redefinicao SET expira_em = now()
                 WHERE lower(email) = $1 AND usado_em IS NULL AND token_hash IS NOT NULL`, [email]);

            const enviar = emailConfigurado();
            if (enviar || process.env.DEMO_RESET === 'true') {
                const token = crypto.randomBytes(32).toString('hex');
                await pool.query(
                    `INSERT INTO pedidos_redefinicao (email, token_hash, expira_em)
                     VALUES ($1, $2, now() + interval '30 minutes')`, [email, sha256(token)]);

                if (enviar) {
                    // E-mail real. O link usa APP_URL (nunca o cabeçalho Host, que o cliente controla).
                    const link = `${process.env.APP_URL.replace(/\/$/, '')}/login.html?token=${token}`;
                    const m = emailRedefinicao(link);
                    // Sem await: a resposta sai na mesma velocidade com e-mail existente ou não.
                    enviarEmail({ para: email, assunto: m.assunto, html: m.html, texto: m.texto })
                        .catch(async (e) => {
                            console.error('Falha ao enviar e-mail de redefinição:', e.message);
                            // se não saiu, invalida o token para não ficar um link "órfão" válido
                            await pool.query('UPDATE pedidos_redefinicao SET expira_em = now() WHERE token_hash = $1', [sha256(token)]).catch(() => {});
                        });
                } else {
                    // MODO DEMONSTRAÇÃO (sem provedor de e-mail): devolve o link na resposta.
                    // Não use em produção: revela que o e-mail existe e entrega o link a quem pediu.
                    const base = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
                    resposta.link = `${base}/login.html?token=${token}`;
                }
            } else {
                // Sem e-mail nem demo: só registra o pedido; o link sai por gerar_link_redefinicao.js
                await pool.query('INSERT INTO pedidos_redefinicao (email) VALUES ($1)', [email]);
            }
        }
    } catch (err) {
        console.error('Erro em esqueci-senha:', err.message);
    }

    return res.json(resposta);
});

app.post('/api/auth/redefinir-senha', limitar(10, 15 * 60 * 1000), async (req, res) => {
    const { token, novaSenha } = req.body || {};

    if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) {
        return res.status(400).json({ message: 'Link inválido ou expirado.' });
    }
    if (typeof novaSenha !== 'string' || novaSenha.length < 8) {
        return res.status(400).json({ message: 'A senha deve ter pelo menos 8 caracteres.' });
    }
    if (Buffer.byteLength(novaSenha, 'utf8') > 72) { // limite do bcrypt
        return res.status(400).json({ message: 'A senha deve ter no máximo 72 caracteres.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // trava o pedido para que o mesmo link não seja usado duas vezes ao mesmo tempo
        const { rows } = await client.query(
            `SELECT id_pedido, email FROM pedidos_redefinicao
              WHERE token_hash = $1 AND usado_em IS NULL AND expira_em > now()
              FOR UPDATE`, [sha256(token)]);
        if (!rows.length) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Link inválido ou expirado.' });
        }

        const senha_hash = await bcrypt.hash(novaSenha, 10);
        const upd = await client.query(
            'UPDATE usuarios SET senha_hash = $1 WHERE lower(email) = lower($2)',
            [senha_hash, rows[0].email]);
        if (!upd.rowCount) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Link inválido ou expirado.' });
        }

        await client.query(
            'UPDATE pedidos_redefinicao SET usado_em = now(), atendido_em = now() WHERE id_pedido = $1',
            [rows[0].id_pedido]);
        await client.query('COMMIT');

        if (emailConfigurado()) {
            const m = emailSenhaAlterada();
            enviarEmail({ para: rows[0].email, assunto: m.assunto, html: m.html, texto: m.texto })
                .catch((e) => console.error('Falha ao enviar aviso de senha alterada:', e.message));
        }

        return res.json({ message: 'Senha redefinida com sucesso. Faça login com a nova senha.' });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Erro em redefinir-senha:', err.message);
        return res.status(500).json({ message: 'Erro ao redefinir a senha.' });
    } finally {
        client.release();
    }
});


// ------------------------- Login ------------------------------//

app.post('/api/auth/login', limitar(20, 15 * 60 * 1000), async (req, res) => {
    const { email, senha } = req.body;
    if (!email || !senha) return res.status(400).json({ message: 'email e senha são obrigatórios.' });
    try {
        const { rows } = await pool.query(
            'SELECT id_usuario, email, senha_hash, perfil, email_verificado FROM usuarios WHERE lower(email) = lower($1)', [email]);
        const usuario = rows[0];
        const ok = usuario && await bcrypt.compare(senha, usuario.senha_hash);
        if (!ok) return res.status(401).json({ message: 'Email ou senha inválidos.' });
        // só depois de acertar a senha: quem não sabe a senha não descobre o estado da conta
        if (!usuario.email_verificado) {
            return res.status(403).json({
                codigo: 'EMAIL_NAO_VERIFICADO',
                message: 'Confirme seu e-mail antes de entrar. Abra o link enviado na confirmação ou peça um novo.'
            });
        }
        const token = jwt.sign(
            { id: usuario.id_usuario, perfil: usuario.perfil },
            process.env.JWT_SECRET, { expiresIn: '2h' });
        res.json({ token, perfil: usuario.perfil });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao fazer login.' });
    }
});


// ------------------- Minha conta (cada usuário cuida só dos próprios dados) ------------------------//
// Todas as rotas usam o id que vem do token (req.user.id): ninguém altera a conta de outra pessoa.
// Ações sensíveis pedem a senha atual de novo. Senha errada responde 403 (e não 401, que desloga no front).
const limiteConta = limitar(10, 15 * 60 * 1000); // quem tiver um token roubado não consegue chutar a senha à vontade

async function confereSenha(idUsuario, senha) {
    if (typeof senha !== 'string' || !senha) return null;
    const { rows } = await pool.query('SELECT id_usuario, nome, email, senha_hash FROM usuarios WHERE id_usuario = $1', [idUsuario]);
    if (!rows.length) return null;
    return (await bcrypt.compare(senha, rows[0].senha_hash)) ? rows[0] : null;
}

app.get('/api/me', authenticateJWT, async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT id_usuario, nome, email, perfil FROM usuarios WHERE id_usuario = $1', [req.user.id]);
        if (!rows.length) return res.sendStatus(401);
        const pend = await pool.query(
            `SELECT novo_email FROM verificacoes_email
              WHERE id_usuario = $1 AND novo_email IS NOT NULL AND usado_em IS NULL AND expira_em > now()
              ORDER BY id_verificacao DESC LIMIT 1`, [req.user.id]);
        res.json({ ...rows[0], email_pendente: pend.rows[0] ? pend.rows[0].novo_email : null });
    } catch (err) {
        console.error('Erro em GET /api/me:', err.message);
        res.status(500).json({ message: 'Erro ao carregar a conta.' });
    }
});

app.put('/api/me', authenticateJWT, async (req, res) => {
    const nome = String((req.body && req.body.nome) || '').trim();
    if (nome.length < 2 || nome.length > 100) return res.status(400).json({ message: 'Informe um nome com 2 a 100 caracteres.' });
    try {
        const { rows } = await pool.query(
            'UPDATE usuarios SET nome = $1 WHERE id_usuario = $2 RETURNING id_usuario, nome, email, perfil', [nome, req.user.id]);
        res.json({ message: 'Nome atualizado.', usuario: rows[0] });
    } catch (err) {
        console.error('Erro em PUT /api/me:', err.message);
        res.status(500).json({ message: 'Erro ao atualizar o nome.' });
    }
});

// Troca de e-mail: o link de confirmação vai para o endereço NOVO e o e-mail só muda depois
// que ele for aberto. Até lá o login continua com o e-mail antigo.
app.post('/api/me/email', authenticateJWT, limiteConta, async (req, res) => {
    const novo = normEmail(req.body && req.body.novo_email);
    if (!emailOk(novo)) return res.status(400).json({ message: 'Informe um e-mail válido.' });
    try {
        const u = await confereSenha(req.user.id, req.body && req.body.senha);
        if (!u) return res.status(403).json({ message: 'Senha incorreta.' });
        if (novo === normEmail(u.email)) return res.status(400).json({ message: 'Esse já é o e-mail da sua conta.' });

        const dup = await pool.query('SELECT 1 FROM usuarios WHERE lower(email) = $1', [novo]);
        if (dup.rows.length) return res.status(409).json({ message: 'Esse e-mail já está em uso em outra conta.' });

        const recente = await pool.query(
            `SELECT 1 FROM verificacoes_email WHERE id_usuario = $1 AND criado_em > now() - make_interval(secs => $2)`,
            [u.id_usuario, INTERVALO_REENVIO_S]);
        if (recente.rows.length) return res.status(429).json({ message: 'Aguarde um minuto antes de pedir outro e-mail.' });

        if (!emailConfigurado() && process.env.DEMO_RESET !== 'true') {
            return res.status(503).json({ message: 'O envio de e-mail não está configurado neste servidor.' });
        }

        const token = await novaVerificacao(u.id_usuario, novo);
        if (!emailConfigurado()) {
            // MODO DEMONSTRAÇÃO (sem provedor de e-mail): devolve o link na resposta
            return res.json({
                message: 'Modo demonstração: use o link abaixo para confirmar o novo e-mail.',
                email_pendente: novo,
                link: linkVerificacao(process.env.APP_URL || `${req.protocol}://${req.get('host')}`, token)
            });
        }
        if (!(await enviarVerificacao(novo, token, emailMudancaEmail))) {
            return res.status(502).json({ message: 'Não foi possível enviar o e-mail de confirmação agora. Tente de novo em instantes.' });
        }
        // avisa o endereço antigo (sem esperar)
        const aviso = emailAvisoMudanca(novo);
        enviarEmail({ para: u.email, assunto: aviso.assunto, html: aviso.html, texto: aviso.texto })
            .catch((e) => console.error('Falha ao enviar aviso ao e-mail antigo:', e.message));
        res.json({
            message: `Enviamos um link de confirmação para ${novo}. O e-mail só muda depois que você abrir o link.`,
            email_pendente: novo
        });
    } catch (err) {
        console.error('Erro em POST /api/me/email:', err.message);
        res.status(500).json({ message: 'Erro ao pedir a troca de e-mail.' });
    }
});

app.put('/api/me/senha', authenticateJWT, limiteConta, async (req, res) => {
    const { senha_atual, nova_senha } = req.body || {};
    if (typeof nova_senha !== 'string' || nova_senha.length < 8) {
        return res.status(400).json({ message: 'A nova senha deve ter pelo menos 8 caracteres.' });
    }
    try {
        const u = await confereSenha(req.user.id, senha_atual);
        if (!u) return res.status(403).json({ message: 'Senha atual incorreta.' });
        if (nova_senha === senha_atual) return res.status(400).json({ message: 'A nova senha precisa ser diferente da atual.' });
        await pool.query('UPDATE usuarios SET senha_hash = $1 WHERE id_usuario = $2', [await bcrypt.hash(nova_senha, 10), u.id_usuario]);
        if (emailConfigurado()) {
            const m = emailSenhaAlterada();
            enviarEmail({ para: u.email, assunto: m.assunto, html: m.html, texto: m.texto })
                .catch((e) => console.error('Falha ao enviar aviso de senha alterada:', e.message));
        }
        res.json({ message: 'Senha alterada.' });
    } catch (err) {
        console.error('Erro em PUT /api/me/senha:', err.message);
        res.status(500).json({ message: 'Erro ao alterar a senha.' });
    }
});

// Exclusão da própria conta. Quem nunca fez simulação é apagado de verdade. Quem já fez é ANONIMIZADO
// (nome e e-mail apagados, login impossível), porque a simulação e o log com hash continuam
// existindo e a trilha de auditoria não pode perder o vínculo. O hash usa só o número id_usuario,
// então anonimizar não quebra a verificação da cadeia.
app.delete('/api/me', authenticateJWT, limiteConta, async (req, res) => {
    let client;
    try {
        const u = await confereSenha(req.user.id, req.body && req.body.senha);
        if (!u) return res.status(403).json({ message: 'Senha incorreta.' });

        client = await pool.connect();
        await client.query('BEGIN');
        const { rows: [c] } = await client.query('SELECT count(*)::int AS n FROM simulacoes_leontief WHERE id_usuario = $1', [u.id_usuario]);
        await client.query('DELETE FROM verificacoes_email WHERE id_usuario = $1', [u.id_usuario]);
        await client.query('DELETE FROM pedidos_redefinicao WHERE lower(email) = lower($1)', [u.email]);
        const anonimizada = c.n > 0;
        if (anonimizada) {
            await client.query(
                `UPDATE usuarios SET nome = 'Usuário removido', email = $2, senha_hash = $3, email_verificado = false
                  WHERE id_usuario = $1`,
                [u.id_usuario, `removido-${u.id_usuario}@removido.invalid`, await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10)]);
        } else {
            await client.query('DELETE FROM usuarios WHERE id_usuario = $1', [u.id_usuario]);
        }
        await client.query('COMMIT');
        res.json({
            message: anonimizada
                ? 'Conta encerrada. Seus dados pessoais foram removidos; as simulações que você registrou permanecem, sem identificação, para preservar a auditoria.'
                : 'Conta excluída.',
            anonimizada
        });
    } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        console.error('Erro em DELETE /api/me:', err.message);
        res.status(500).json({ message: 'Erro ao excluir a conta.' });
    } finally {
        if (client) client.release();
    }
});



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`EcoBalance Ledger rodando na porta ${PORT}`));