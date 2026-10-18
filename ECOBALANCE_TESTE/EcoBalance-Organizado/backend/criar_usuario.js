const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const [nome, email, senha, perfil] = process.argv.slice(2);
const PERFIS = ['STAKEHOLDER', 'ANALISTA', 'AUDITOR'];
if (!nome || !email || !senha || !PERFIS.includes(perfil)) {
    console.log('Uso: node criar_usuario.js "Nome" email senha PERFIL');
    console.log('PERFIL: STAKEHOLDER | ANALISTA | AUDITOR');
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        const hash = await bcrypt.hash(senha, 10);
        const { rows } = await pool.query(
            'INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES ($1,$2,$3,$4) RETURNING id_usuario, email, perfil',
            [nome, email, hash, perfil]);
        console.log('Criado:', rows[0]);
    } catch (err) {
        console.error('Erro:', err.message);
    } finally {
        await pool.end();
    }
})();