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
    proc.on('close', () => {
        try { resolve(JSON.parse(out)); }
        catch (e) { reject(new Error('Saída inválida do leontief_calc.py')); }
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

// Protegida pela variável de ambiente ADMIN_KEY. Se ela não existir, as rotas ficam desligadas.
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

    console.log('Entrou na rota');
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

        return res.status(201).json({
            message: 'Usuário criado com sucesso',
            usuario: resultado.rows[0]
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


// Esquecer a Senha
app.post('/api/auth/esqueci-senha', limitar(5, 60 * 60 * 1000), async (req, res) => {
    console.log('ROTA ESQUECI-SENHA EXECUTADA');

    const email = normEmail(req.body?.email);

    const resposta = {
        message:
            'Se o e-mail estiver cadastrado, o pedido foi registrado.'
        };

    if (!emailOk(email)) {
        return res.json(resposta);
    }
    try{
        const usuario = await pool.query('SELECT 1 FROM usuarios WHERE lower(email) = $1', [email]);
        console.log('Email recebido:', email);
        console.log('Usuario encontrado:', usuario.rows.length);

        if (usuario.rows.length) {
            console.log('Tentando gravar pedido...');

            await pool.query('INSERT INTO pedidos_redefinicao (email) VALUES ($1)', [email]);

            console.log('Pedido registrado');
         }

    } catch (err) {
        console.error(err);
    }

    return res.json(resposta);
});


// ------------------------- Login ------------------------------//

app.post('/api/auth/login', async (req, res) => {
    const { email, senha } = req.body;
    if (!email || !senha) return res.status(400).json({ message: 'email e senha são obrigatórios.' });
    try {
        const { rows } = await pool.query(
            'SELECT id_usuario, email, senha_hash, perfil FROM usuarios WHERE lower(email) = lower($1)', [email]);
        const usuario = rows[0];
        const ok = usuario && await bcrypt.compare(senha, usuario.senha_hash);
        if (!ok) return res.status(401).json({ message: 'Email ou senha inválidos.' });
        const token = jwt.sign(
            { id: usuario.id_usuario, perfil: usuario.perfil },
            process.env.JWT_SECRET, { expiresIn: '2h' });
        res.json({ token, perfil: usuario.perfil });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao fazer login.' });
    }
});



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`EcoBalance Ledger rodando na porta ${PORT}`));