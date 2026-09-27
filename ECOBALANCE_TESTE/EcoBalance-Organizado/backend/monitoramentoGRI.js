// monitoramentoGRI.js (Lógica de Alerta)
const twilio = require('twilio');
const client = new twilio('SEU_ACCOUNT_SID', 'SEU_AUTH_TOKEN');

async function verificarMetasGRI(dadosCalculados, metasBanco) {
    // Comparação entre o Output de Leontief e a meta de emissão do setor
    for (let setor of dadosCalculados) {
        const meta = metasBanco.find(m => m.id_setor === setor.id_setor);
        
        if (setor.emissao_estimada > meta.meta_emissao_anual) {
            enviarAlertaTwilio(setor.nome_setor, setor.emissao_estimada, meta.meta_emissao_anual);
        }
    }
}

function enviarAlertaTwilio(setor, valorAtual, meta) {
    client.messages.create({
        body: `🚨 Alerta ESG EcoBalance: O setor ${setor} ultrapassou a meta GRI 305! Atual: ${valorAtual} tCO2e (Meta: ${meta}). Auditoria Blockchain solicitada.`,
        from: '+1234567890', // Seu número Twilio
        to: '+5511999999999'  // Número do Gestor de TI Verde
    }).then(message => console.log(`Notificação enviada: ${message.sid}`));
}