const path = require('path');
// Aponta explicitamente para o .env na raiz do projeto (um nível acima de backend/),
// porque por padrão o dotenv só olha a pasta de onde o comando foi rodado.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const { engine } = require('express-handlebars');
const jwt = require('jsonwebtoken');
const { spawn } = require('child_process');
const { Pool } = require('pg');
const twilio = require('twilio');

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
    const token = req.headers.authorization;
    if (token) {
        jwt.verify(token, 'SECRET_KEY_ECO_LEDGER', (err, user) => {
            if (err) return res.sendStatus(403);
            req.user = user;
            next();
        });
    } else { res.sendStatus(401); }
};

// Rota de Processamento Leontief (Integração Python)
app.post('/api/calculate-equilibrium', authenticateJWT, async (req, res) => {
    const { matriz, demanda } = req.body;
    
    // "python3" é o binário que existe na imagem Docker (node:18-slim), "python" não existe
    const pythonProcess = spawn('python3', [path.join(__dirname, 'leontief_calc.py')]);
    pythonProcess.stdin.write(JSON.stringify({ matriz, demanda }));
    pythonProcess.stdin.end();

    let output = '';
    pythonProcess.stdout.on('data', (data) => { output += data.toString(); });
    pythonProcess.stderr.on('data', (data) => console.error('Erro no leontief_calc.py:', data.toString()));

    pythonProcess.on('close', () => {
        let result;
        try {
            result = JSON.parse(output);
        } catch (e) {
            return res.status(500).json({ status: 'error', message: 'Falha ao interpretar resultado do cálculo.' });
        }

        // Notificação Twilio se a produção exceder limite de carbono
        // Só dispara se as credenciais estiverem configuradas no .env
        if (result.status === 'success' && result.producao_total[0] > 1000
            && process.env.TWILIO_SID && process.env.TWILIO_TOKEN) {
            const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
            client.messages.create({
                body: 'Alerta TI Verde: Produção excedeu limite sustentável!',
                from: '+123456789', to: '+551199999999'
            }).catch(err => console.error('Falha ao enviar Twilio:', err.message));
        }
        res.json(result);
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`EcoBalance Ledger rodando na porta ${PORT}`));