// Uso: node gerar_link_redefinicao.js email@exemplo.com
// Gera um link de redefinição (válido por 30 min) para um pedido pendente
// e imprime no terminal. Substitui o envio de e-mail enquanto não há SMTP.
// Variável opcional: APP_URL (ex.: https://seu-app.onrender.com)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const crypto = require('crypto');
const { Pool } = require('pg');

const email = (process.argv[2] || '').trim().toLowerCase();
if (!email) {
    console.log('Uso: node gerar_link_redefinicao.js email@exemplo.com');
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        const u = await pool.query('SELECT 1 FROM usuarios WHERE lower(email) = $1', [email]);
        if (!u.rows.length) {
            console.log('Nenhum usuário com esse e-mail.');
            return;
        }

        // invalida links anteriores ainda abertos desse e-mail
        await pool.query(
            `UPDATE pedidos_redefinicao SET expira_em = now()
             WHERE lower(email) = $1 AND usado_em IS NULL AND token_hash IS NOT NULL`, [email]);

        const token = crypto.randomBytes(32).toString('hex');
        const hash = crypto.createHash('sha256').update(token).digest('hex');

        // aproveita o pedido pendente mais recente (sem token); se não houver, cria um
        const { rowCount } = await pool.query(
            `UPDATE pedidos_redefinicao
                SET token_hash = $2, expira_em = now() + interval '30 minutes'
              WHERE id_pedido = (
                    SELECT id_pedido FROM pedidos_redefinicao
                     WHERE lower(email) = $1 AND token_hash IS NULL AND atendido_em IS NULL
                     ORDER BY criado_em DESC LIMIT 1)`, [email, hash]);
        if (!rowCount) {
            await pool.query(
                `INSERT INTO pedidos_redefinicao (email, token_hash, expira_em)
                 VALUES ($1, $2, now() + interval '30 minutes')`, [email, hash]);
        }

        const base = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
        console.log('\nLink de redefinição (válido por 30 minutos, uso único):\n');
        console.log(`${base}/login.html?token=${token}\n`);
    } catch (err) {
        console.error('Erro:', err.message);
    } finally {
        await pool.end();
    }
})();