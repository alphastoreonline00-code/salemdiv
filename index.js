const { default: makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const chalk = require("chalk");
const fs = require("fs-extra");
const readline = require("readline");
const { Boom } = require("@hapi/boom");
const TelegramBot = require('node-telegram-bot-api');

// ═══════════════ CONFIGURAÇÃO ═══════════════
// Toda configuração fica em config.json — NÃO edite as linhas abaixo.
let CONFIG;
try {
    CONFIG = require('./config.json');
} catch (e) {
    console.error('\n❌ ERRO: arquivo config.json não encontrado ou inválido!');
    console.error('   Verifique se o arquivo existe e o JSON está correto.\n');
    process.exit(1);
}

const TELEGRAM_TOKEN = CONFIG.telegram?.token;
const TELEGRAM_ADMIN_ID = CONFIG.telegram?.admin_id;
const DONO_NUMERO = `${String(CONFIG.whatsapp?.dono_numero || '').replace(/\D/g, '')}@s.whatsapp.net`;
const NOME_BOT = CONFIG.nome_bot || 'SRR 330 SYSTEM';
const DESENVOLVEDOR = CONFIG.desenvolvedor || 'SR330';
const MAX_CONEXOES = CONFIG.whatsapp?.max_conexoes || 10;
const DELAY_DIVULGACAO = CONFIG.delays?.entre_divulgacoes_ms ?? 60000;
const DELAY_ENTRADA = CONFIG.delays?.entre_entradas_ms ?? 60000;
const DELAY_PULADOS = CONFIG.delays?.entre_pulados_ms ?? 3000;
const DELAY_DIGITANDO = CONFIG.delays?.digitando_segundos ?? 5;
const BROWSER = [CONFIG.navegador?.nome || 'Ubuntu', CONFIG.navegador?.browser || 'Chrome', CONFIG.navegador?.versao || '20.0.04'];

if (!TELEGRAM_TOKEN || !TELEGRAM_ADMIN_ID || !CONFIG.whatsapp?.dono_numero) {
    console.error('\n❌ ERRO: edite o config.json com seu token, admin_id e dono_numero.\n');
    process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (t) => new Promise(res => rl.question(t, res));

let connections = {};
let logs = [];
let colheitaAtiva = CONFIG.configuracoes?.colheita_ativa ?? true;
let antipv = CONFIG.configuracoes?.antipv ?? false;
let furacaoAtivo = CONFIG.configuracoes?.furacao_ativo ?? false;
let aguardandoPost = false;
let aguardandoLinks = false;
let aguardandoStatus = false;
let emDivulgacao = false;
let emEntrada = false;
let monitorAtivo = false;
let midiaAtiva = CONFIG.configuracoes?.midia_ativa ?? true;

const dbLinks = './banco.json';
const ckPath = './checkpoint.json';
const statsPath = './stats.json';
const connectionsPath = './connections.json';

if (!fs.existsSync(dbLinks)) fs.writeJsonSync(dbLinks, []);
if (!fs.existsSync(ckPath)) fs.writeJsonSync(ckPath, { divulgaIdx: 0, entradaIdx: 0 });
if (!fs.existsSync(statsPath)) fs.writeJsonSync(statsPath, { divulgou: 0, grupos: 0, entradas: 0, abertos: 0, fechados: 0, comunidades: 0, linksColhidos: 0 });
if (!fs.existsSync('Post.txt')) fs.writeFileSync('Post.txt', `🚀 ${NOME_BOT}`);
if (!fs.existsSync(connectionsPath)) fs.writeJsonSync(connectionsPath, []);

const origErr = console.error;
console.error = (...a) => { const m = a.join(' '); if (m.includes('Bad MAC') || m.includes('Session') || m.includes('decrypt') || m.includes('libsignal') || m.includes('cipher') || m.includes('2000') || m.includes('failed') || m.includes('ETELEGRAM') || m.includes('polling_error')) return; origErr.apply(console, a); };
console.warn = () => {};
process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

const BANNER = `
    ███████╗██████╗ ██████╗     ██████╗ ██████╗  ██████╗
    ██╔════╝██╔══██╗██╔══██╗    ╚════██╗╚════██╗██╔═████╗
    ███████╗██████╔╝██████╔╝     █████╔╝ █████╔╝██║██╔██║
    ╚════██║██╔══██╗██╔══██╗     ╚═══██╗ ╚═══██╗████╔╝██║
    ███████║██║  ██║██║  ██║    ██████╔╝██████╔╝╚██████╔╝
    ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝    ╚═════╝ ╚═════╝  ╚═════╝
`;

function erroMsg(e) { if (!e) return 'Erro'; const m = e?.message || String(e) || 'Erro'; return m.substring(0, 50); }
function getHora() { return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
function getDataHora() { return new Date().toLocaleString('pt-BR'); }
function getSaudacao() { const h = new Date().getHours(); if (h < 6) return "🌙 *Boa madrugada!*"; if (h < 12) return "☀️ *Bom dia!*"; if (h < 18) return "🌤️ *Boa tarde!*"; return "🌆 *Boa noite!*"; }
async function simularDigitacao(jid, sock, t = 5) { try { await sock.sendPresenceUpdate('composing', jid); await delay(t * 1000); await sock.sendPresenceUpdate('paused', jid); } catch {} }
function getMidiaPath() { if (fs.existsSync('./Post.mp4')) return './Post.mp4'; if (fs.existsSync('./Post.jpg')) return './Post.jpg'; if (fs.existsSync('./Post.png')) return './Post.png'; return null; }
function getStats() { try { return fs.readJsonSync(statsPath); } catch { return { divulgou: 0, grupos: 0, entradas: 0, abertos: 0, fechados: 0, comunidades: 0, linksColhidos: 0 }; } }
function getCheckpoint() { try { return fs.readJsonSync(ckPath); } catch { return { divulgaIdx: 0, entradaIdx: 0 }; } }
function saveCheckpoint(ck) { try { fs.writeJsonSync(ckPath, ck); } catch {} }
function addLog(msg) { const c = (msg || '').replace(/\u001b\[.*?m/g, ''); logs.push(`[${getHora()}] ${c}`); if (logs.length > 50) logs = logs.slice(-50); if (!monitorAtivo) console.log(`[${getHora()}] ${msg}`); }
function updateStat(k, v) { try { let s = getStats(); if (v === "++") s[k] = (s[k] || 0) + 1; else s[k] = v; fs.writeJsonSync(statsPath, s); } catch {} }
function salvarConexoes() { try { fs.writeJsonSync(connectionsPath, Object.keys(connections)); } catch {} }
function carregarConexoesSalvas() { try { return fs.readJsonSync(connectionsPath); } catch { return []; } }
function getSocketAtivo() { for (const c of Object.values(connections)) { if (c.sock?.user) return c.sock; } return null; }
function getSocksAtivos() { return Object.values(connections).filter(c => c.sock?.user).map(c => c.sock); }

function salvarLink(link) {
    let db = []; try { db = fs.readJsonSync(dbLinks); } catch { db = []; }
    if (db.includes(link)) return false;
    db.push(link); fs.writeJsonSync(dbLinks, db);
    updateStat('linksColhidos', '++'); return true;
}

function extrairCodigo(link) {
    if (!link) return null;
    const match = link.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/);
    if (!match || !match[1]) return null;
    const codigo = match[1];
    if (codigo.length < 18 || codigo.length > 30) return null;
    return codigo;
}

async function buscarNomeGrupo(sock, codigo) {
    try { const info = await sock.groupGetInviteInfo(codigo); return { nome: info?.subject || "Grupo", jid: info?.id || null }; }
    catch { return { nome: "Grupo", jid: null }; }
}

async function enviarSolicitacao(sock, codigo, jid) {
    try { if (jid) { await sock.groupRequestParticipantUpdate(jid, [sock.user.id], 'approve'); return true; } } catch {}
    try { const info = await sock.groupGetInviteInfo(codigo); if (info?.id) { await sock.groupRequestParticipantUpdate(info.id, [sock.user.id], 'approve'); return true; } } catch {}
    return false;
}

async function tentarEntrarGrupo(sock, codigo) {
    const { nome, jid } = await buscarNomeGrupo(sock, codigo);
    try {
        const result = await sock.groupAcceptInvite(codigo);
        await delay(2000);
        let nomeReal = nome; try { nomeReal = (await sock.groupMetadata(result)).subject || nome; } catch {}
        return { status: 'entrou', nome: nomeReal };
    } catch (e) {
        const err = erroMsg(e);
        if (err.includes('already') || err.includes('participant') || err.includes('member') || err.includes('conflict')) return { status: 'membro', nome };
        if (err.includes('not-authorized') || err.includes('forbidden') || err.includes('403')) { const ok = await enviarSolicitacao(sock, codigo, jid); return ok ? { status: 'solicitacao', nome } : { status: 'solicitacao_falha', nome }; }
        if (err.includes('bad-request') || err.includes('400')) { const ok = await enviarSolicitacao(sock, codigo, jid); return ok ? { status: 'solicitacao', nome } : { status: 'expirado', nome }; }
        if (err.includes('gone') || err.includes('not-found') || err.includes('410') || err.includes('404')) return { status: 'expirado', nome };
        if (err.includes('Connection') || err.includes('closed')) return { status: 'conexao', nome };
        const ok = await enviarSolicitacao(sock, codigo, jid);
        return ok ? { status: 'solicitacao', nome } : { status: 'erro', nome, msg: err };
    }
}

async function postarStatus(sock, conteudo) {
    let contatos = [];
    try {
        const grupos = await sock.groupFetchAllParticipating();
        const participantes = new Set();
        for (const g of Object.values(grupos)) {
            if (g.participants) g.participants.forEach(p => participantes.add(p.id));
        }
        contatos = [...participantes];
    } catch {}
    const opcoes = {};
    if (contatos.length > 0) opcoes.statusJidList = contatos;
    await sock.sendMessage('status@broadcast', conteudo, opcoes);
}

async function entradaAutomatica(texto, chatId) {
    const sock = getSocketAtivo();
    if (!sock) { bot.sendMessage(chatId, '❌ Sem conexão!'); return; }
    const matches = texto.match(/chat\.whatsapp\.com\/([A-Za-z0-9]{18,30})/g);
    if (!matches || matches.length === 0) { bot.sendMessage(chatId, '❌ Nenhum link!'); return; }
    bot.sendMessage(chatId, `🔗 *${matches.length} link(s)*\nIniciando...`, { parse_mode: 'Markdown' });
    let sucessos = 0, falhas = 0, solicitacoes = 0, pulados = 0;
    for (let i = 0; i < matches.length; i++) {
        const linkLimpo = matches[i].replace('https://', '').replace('http://', '');
        const codigo = extrairCodigo(linkLimpo);
        if (!codigo) { falhas++; continue; }
        salvarLink(linkLimpo);
        const p = `${i + 1}/${matches.length}`;
        addLog(`[${p}] 🔗 Entrando...`);
        const resultado = await tentarEntrarGrupo(sock, codigo);
        switch (resultado.status) {
            case 'entrou': updateStat('entradas', '++'); sucessos++; addLog(`[${p}] Entrou + ${resultado.nome}`); break;
            case 'membro': pulados++; addLog(`[${p}] Pulou ( membro ) + ${resultado.nome}`); break;
            case 'solicitacao': solicitacoes++; addLog(`[${p}] Solicitação enviada + ${resultado.nome}`); break;
            case 'solicitacao_falha': solicitacoes++; addLog(`[${p}] Solicitação tentada + ${resultado.nome}`); break;
            case 'expirado': pulados++; addLog(`[${p}] Pulou ( expirado ) + ${resultado.nome}`); break;
            default: falhas++; addLog(`[${p}] ❌ ${resultado.nome}: ${resultado.msg || 'Erro'}`);
        }
        if (i < matches.length - 1) await delay(DELAY_DIVULGACAO);
    }
    bot.sendMessage(chatId, `✅ *Concluído*\n\n✅ Entrou: *${sucessos}*\n📩 Solicitações: *${solicitacoes}*\n⏭️ Pulados: *${pulados}*\n❌ Falhas: *${falhas}*`, { parse_mode: 'Markdown', reply_markup: getMainKeyboard() });
}

function limparTela() { process.stdout.write('\x1B[2J\x1B[H'); }
function renderMonitor() {
    if (!monitorAtivo) return;
    const stats = getStats(), ck = getCheckpoint(), ca = getSocksAtivos().length;
    let lt = 0; try { lt = fs.readJsonSync(dbLinks).length; } catch {}
    limparTela();
    console.log(chalk.cyan(BANNER));
    console.log(chalk.gray(`            🚀 Desenvolvido por ${DESENVOLVEDOR} 🚀\n`));
    console.log(chalk.gray('═'.repeat(65)));
    let st = '';
    if (emDivulgacao) st += chalk.green(' 🚀 DIVULGANDO');
    if (emEntrada) st += chalk.blue(' 🔗 ENTRANDO');
    if (colheitaAtiva) st += chalk.magenta(' 📍 COLHENDO');
    if (furacaoAtivo) st += chalk.cyan(' 🌪️ FURACÃO');
    if (!emDivulgacao && !emEntrada && !colheitaAtiva && !furacaoAtivo) st = chalk.gray(' ⚪ OCIOSO');
    console.log(chalk.white.bold(`  📊 STATUS:${st}`));
    console.log(chalk.gray('─'.repeat(65)));
    console.log(`  📱 ${ca > 0 ? chalk.green(ca) : chalk.red('0')}  │  📍 ${colheitaAtiva ? chalk.green('ON') : chalk.red('OFF')}  │  🌪️ ${furacaoAtivo ? chalk.cyan('ON') : chalk.red('OFF')}  │  📸 ${midiaAtiva ? chalk.green('ON') : chalk.red('OFF')}`);
    console.log(chalk.gray('─'.repeat(65)));
    console.log(`  🎯 Div: ${chalk.green(stats.divulgou || 0)}  │  📥 Ent: ${chalk.blue(stats.entradas || 0)}  │  🔗 Col: ${chalk.magenta(stats.linksColhidos || 0)}  │  📂 ${chalk.cyan(lt)}`);
    console.log(`  👥 ${chalk.yellow(stats.grupos || 0)}  │  ✅ ${chalk.green(stats.abertos || 0)}  │  🔒 ${chalk.red(stats.fechados || 0)}  │  🏛️ ${chalk.red(stats.comunidades || 0)}`);
    if (ck.divulgaIdx > 0 || ck.entradaIdx > 0) { console.log(chalk.gray('─'.repeat(65))); let x = '  📍'; if (ck.divulgaIdx > 0) x += chalk.yellow(` Div: ${ck.divulgaIdx}`); if (ck.entradaIdx > 0) x += chalk.yellow(` Ent: ${ck.entradaIdx}`); console.log(x); }
    console.log(chalk.gray('═'.repeat(65)));
    console.log(chalk.white.bold('  📋 LOGS'));
    console.log(chalk.gray('─'.repeat(65)));
    logs.slice(-15).forEach(l => {
        let c = chalk.white;
        if (l.includes('Divulgou') || l.includes('Entrou') || l.includes('ONLINE')) c = chalk.green;
        else if (l.includes('comunidade')) c = chalk.red;
        else if (l.includes('fechado') || l.includes('membro') || l.includes('expirado')) c = chalk.yellow;
        else if (l.includes('❌')) c = chalk.red;
        else if (l.includes('colhido') || l.includes('📍')) c = chalk.magenta;
        else if (l.includes('🌪️') || l.includes('Solicitação') || l.includes('solicitação')) c = chalk.cyan;
        else if (l.includes('⏳') || l.includes('Digitando')) c = chalk.gray;
        else if (l.includes('aguardando') || l.includes('⏸️')) c = chalk.yellow;
        else if (l.includes('📡') || l.includes('Status')) c = chalk.blue;
        console.log(`  ${c(l)}`);
    });
    for (let i = logs.slice(-15).length; i < 15; i++) console.log('');
    console.log(chalk.gray('═'.repeat(65)));
    console.log(chalk.gray(`  💡 Telegram: /start  │  ${getHora()}`));
}
setInterval(() => { if (monitorAtivo) renderMonitor(); }, 1000);

async function mapearGrupos() {
    addLog(`📂 Mapeando...`);
    const socks = getSocksAtivos();
    if (socks.length === 0) { addLog(`❌ Sem conexão`); return null; }
    let total = 0, abertos = 0, fechados = 0, comunidades = 0, lista = [];
    const idsVistos = new Set();
    for (const sock of socks) {
        try {
            const chats = await sock.groupFetchAllParticipating();
            for (const [id, g] of Object.entries(chats)) {
                if (idsVistos.has(id)) continue; idsVistos.add(id);
                const nome = g?.subject || "Sem nome", mb = g?.participants?.length || 0;
                total++;
                if (g?.isCommunity || id.includes("newsletter")) { comunidades++; lista.push({ nome, tipo: '🏛️ Comunidade', mb }); }
                else if (g?.announce === true || g?.announce === 'true') { fechados++; lista.push({ nome, tipo: '🔒 Fechado', mb }); }
                else { abertos++; lista.push({ nome, tipo: '✅ Aberto', mb }); }
            }
        } catch (e) { addLog(`❌ ${erroMsg(e)}`); }
    }
    try { const s = getStats(); s.grupos = total; s.abertos = abertos; s.fechados = fechados; s.comunidades = comunidades; fs.writeJsonSync(statsPath, s); } catch {}
    addLog(`✅ Total: ${total} | ✅ ${abertos} | 🔒 ${fechados} | 🏛️ ${comunidades}`);
    return { total, abertos, fechados, comunidades, lista };
}

async function enviarRelatorio(tipo, dados) {
    const { total, sucesso, falhas, pulados, solicitacoes, tempo } = dados; const s = getStats();
    const r = `📊 *RELATÓRIO - ${tipo}*\n═══════════════════\n✅ Sucesso: *${sucesso}*\n📩 Solicitações: *${solicitacoes || 0}*\n⏭️ Pulados: *${pulados || 0}*\n❌ Falhas: *${falhas}*\n📁 Total: *${total}*\n⏱️ Tempo: *${tempo}*\n\n📈 Div: *${s.divulgou}* | Ent: *${s.entradas}* | Col: *${s.linksColhidos}*\n🕐 ${getDataHora()}\nDesenvolvido por ${DESENVOLVEDOR}`;
    try { await bot.sendMessage(TELEGRAM_ADMIN_ID, r, { parse_mode: 'Markdown' }); } catch {}
    const sock = getSocketAtivo(); if (sock) try { await sock.sendMessage(DONO_NUMERO, { text: r.replace(/[*]/g, '') }); } catch {}
    addLog(`📊 Relatório enviado`);
}

async function enviarLinksWhatsApp() {
    const sock = getSocketAtivo(); if (!sock) return;
    try {
        const links = fs.readJsonSync(dbLinks); if (links.length === 0) return;
        let txt = '🔗 BANCO DE LINKS\n' + '═'.repeat(40) + '\n\n';
        links.forEach((l, i) => { txt += `LINK ${i + 1}\nhttps://${l}\n\n`; });
        txt += '═'.repeat(40) + `\nTotal: ${links.length}\n${getDataHora()}\nSR330`;
        const f = './links_banco.txt'; fs.writeFileSync(f, txt);
        await sock.sendMessage(DONO_NUMERO, { document: fs.readFileSync(f), fileName: `links_${Date.now()}.txt`, mimetype: 'text/plain', caption: `📋 ${links.length} links` });
        try { fs.unlinkSync(f); } catch {}
    } catch {}
}

function getMainKeyboard() { const ck = getCheckpoint(); return { inline_keyboard: [
    [{ text: '📊 Status', callback_data: 'status' }, { text: '📱 Conexões', callback_data: 'conexoes' }],
    [{ text: '📂 Mapear', callback_data: 'mapear' }, { text: ck.divulgaIdx > 0 ? '▶️ Continuar Div' : '🚀 Divulgar', callback_data: 'divulgar' }],
    [{ text: '⏸️ Pausar', callback_data: 'pausar' }, { text: ck.entradaIdx > 0 ? '▶️ Continuar Ent' : '🔗 Entrar Banco', callback_data: 'entrar_banco' }],
    [{ text: '📩 Entrada Auto', callback_data: 'entrada_auto' }, { text: '📡 Postar Status', callback_data: 'postar_status' }],
    [{ text: `📍 Colheita: ${colheitaAtiva ? '✅' : '❌'}`, callback_data: 'toggle_colheita' }, { text: `🌪️ Furacão: ${furacaoAtivo ? '✅' : ' ❌'}`, callback_data: 'toggle_furacao' }],
    [{ text: `🛡️ Anti-PV: ${antipv ? '✅' : '❌'}`, callback_data: 'toggle_antipv' }, { text: `📸 Mídia: ${midiaAtiva ? '✅' : '❌'}`, callback_data: 'toggle_midia' }],
    [{ text: '📥 Ver Links', callback_data: 'ver_links' }, { text: '🗑️ Limpar Banco', callback_data: 'limpar_banco' }],
    [{ text: '📝 Ver Post', callback_data: 'ver_post' }, { text: '✏️ Editar Post', callback_data: 'editar_post' }],
    [{ text: '🔄 Reset', callback_data: 'reset' }, { text: '📋 Logs', callback_data: 'logs' }]
]}; }
function getConexoesKeyboard() { const b = []; Object.keys(connections).forEach(id => { b.push([{ text: `${connections[id]?.sock?.user ? '🟢' : '🔴'} ${id}`, callback_data: `conn_${id}` }, { text: '🗑️', callback_data: `remove_${id}` }]); }); if (b.length === 0) b.push([{ text: '📭', callback_data: 'nada' }]); b.push([{ text: '🔙 Voltar', callback_data: 'voltar_menu' }]); return { inline_keyboard: b }; }

async function enviarDivulgacao(id, texto, membros, sock) {
    await simularDigitacao(id, sock, DELAY_DIGITANDO); await delay(DELAY_PULADOS);
    if (midiaAtiva) {
        if (fs.existsSync('./Post.mp4')) return await sock.sendMessage(id, { video: fs.readFileSync('./Post.mp4'), caption: texto, mentions: membros });
        if (fs.existsSync('./Post.jpg')) return await sock.sendMessage(id, { image: fs.readFileSync('./Post.jpg'), caption: texto, mentions: membros });
        if (fs.existsSync('./Post.png')) return await sock.sendMessage(id, { image: fs.readFileSync('./Post.png'), caption: texto, mentions: membros });
    }
    return await sock.sendMessage(id, { text: texto, mentions: membros, linkPreview: true });
}

async function divulgarGhost() {
    if (emDivulgacao) return; emDivulgacao = true;
    const inicio = Date.now(); let sucessos = 0, falhas = 0, pulados = 0;
    const post = fs.readFileSync('Post.txt', 'utf-8');
    const msgTexto = `${getSaudacao()}\n\n${post}`;
    const sock = getSocketAtivo();
    if (!sock) { addLog(`❌ Sem conexão`); emDivulgacao = false; return; }
    let grupos = [];
    try { const chats = await sock.groupFetchAllParticipating(); grupos = Object.entries(chats).map(([id, d]) => ({ id, nome: d?.subject || "Grupo", d })); } catch (e) { addLog(`❌ ${erroMsg(e)}`); emDivulgacao = false; return; }
    const total = grupos.length;
    if (total === 0) { addLog(`❌ Sem grupos`); emDivulgacao = false; return; }
    let ck = getCheckpoint();
    if (ck.divulgaIdx >= total) { ck.divulgaIdx = 0; saveCheckpoint(ck); }
    addLog(`📢 Divulgação: ${ck.divulgaIdx + 1}/${total}`);
    for (let i = ck.divulgaIdx; i < total; i++) {
        if (!emDivulgacao) { addLog(`⏸️ Pausado ${i}/${total}`); break; }
        const g = grupos[i], p = `${i + 1}/${total}`;
        let sockAtual = getSocketAtivo();
        if (!sockAtual) { addLog(`⏸️ Conexão caiu, aguardando...`); let ok = false; for (let t = 0; t < 12; t++) { await delay(5000); sockAtual = getSocketAtivo(); if (sockAtual) { ok = true; break; } addLog(`⏳ Aguardando... ${(t+1)*5}s`); } if (!ok) { addLog(`❌ 60s sem conexão.`); break; } addLog(`✅ Reconectado!`); }
        try {
            const meta = await sockAtual.groupMetadata(g.id).catch(() => null);
            if (!meta) { falhas++; ck.divulgaIdx = i + 1; saveCheckpoint(ck); await delay(DELAY_PULADOS); continue; }
            const nome = meta.subject || g.nome;
            if (meta.isCommunity || g.id.includes("newsletter")) { addLog(`[${p}] Pulou ( comunidade ) + ${nome}`); pulados++; ck.divulgaIdx = i + 1; saveCheckpoint(ck); await delay(DELAY_PULADOS); continue; }
            if (meta.announce === true || meta.announce === 'true') { addLog(`[${p}] Pulou ( fechado ) + ${nome}`); pulados++; ck.divulgaIdx = i + 1; saveCheckpoint(ck); await delay(DELAY_PULADOS); continue; }
            const membros = meta.participants?.map(x => x.id) || [];
            addLog(`[${p}] ⏳ Digitando + ${nome}`);
            await enviarDivulgacao(g.id, msgTexto, membros, sockAtual);
            updateStat('divulgou', '++'); sucessos++;
            addLog(`[${p}] Divulgou + ${nome} + ${membros.length} marcados`);
            ck.divulgaIdx = i + 1; saveCheckpoint(ck); await delay(DELAY_DIVULGACAO);
        } catch (e) {
            const err = erroMsg(e); falhas++;
            if (err.includes('Connection') || err.includes('closed')) { addLog(`[${p}] ⏸️ Conexão caiu...`); let ok = false; for (let t = 0; t < 12; t++) { await delay(5000); if (getSocketAtivo()) { ok = true; break; } } if (!ok) { addLog(`❌ Pausando.`); break; } addLog(`✅ Reconectado!`); i--; falhas--; continue; }
            addLog(`[${p}] ❌ ${g.nome}: ${err}`); ck.divulgaIdx = i + 1; saveCheckpoint(ck); await delay(5000);
        }
    }
    const t = Math.floor((Date.now() - inicio) / 1000);
    const tf = Math.floor(t/3600) > 0 ? `${Math.floor(t/3600)}h ${Math.floor((t%3600)/60)}m` : `${Math.floor(t/60)}m ${t%60}s`;
    if (emDivulgacao) { ck.divulgaIdx = 0; saveCheckpoint(ck); addLog(`🏁 Finalizado!`); await enviarRelatorio('DIVULGAÇÃO', { total, sucesso: sucessos, falhas, pulados, solicitacoes: 0, tempo: tf }); }
    emDivulgacao = false;
}

async function entrarLinksBanco() {
    if (emEntrada) return; emEntrada = true;
    const inicio = Date.now(); let sucessos = 0, falhas = 0, pulados = 0, solicitacoes = 0;
    let db = []; try { db = fs.readJsonSync(dbLinks); } catch {}
    if (db.length === 0) { addLog(`📭 Banco vazio`); emEntrada = false; return; }
    let sock = getSocketAtivo();
    if (!sock) { addLog(`❌ Sem conexão`); emEntrada = false; return; }
    let ck = getCheckpoint(); const total = db.length;
    if (ck.entradaIdx >= total) { ck.entradaIdx = 0; saveCheckpoint(ck); }
    addLog(`🔗 Entrada: ${ck.entradaIdx + 1}/${total}`);
    for (let i = ck.entradaIdx; i < total; i++) {
        if (!emEntrada) { addLog(`⏸️ Pausado ${i}/${total}`); break; }
        sock = getSocketAtivo();
        if (!sock) { addLog(`⏸️ Conexão caiu...`); let ok = false; for (let t = 0; t < 12; t++) { await delay(5000); sock = getSocketAtivo(); if (sock) { ok = true; break; } } if (!ok) { addLog(`❌ Pausando.`); break; } addLog(`✅ Reconectado!`); }
        const p = `${i + 1}/${total}`;
        const codigo = extrairCodigo(db[i]);
        if (!codigo) { falhas++; addLog(`[${p}] ❌ Link inválido`); ck.entradaIdx = i + 1; saveCheckpoint(ck); continue; }
        const resultado = await tentarEntrarGrupo(sock, codigo);
        switch (resultado.status) {
            case 'entrou': updateStat('entradas', '++'); sucessos++; addLog(`[${p}] Entrou + ${resultado.nome}`); await delay(DELAY_ENTRADA); break;
            case 'membro': pulados++; addLog(`[${p}] Pulou ( membro ) + ${resultado.nome}`); await delay(DELAY_PULADOS); break;
            case 'solicitacao': solicitacoes++; addLog(`[${p}] Solicitação enviada + ${resultado.nome}`); await delay(DELAY_ENTRADA); break;
            case 'solicitacao_falha': solicitacoes++; addLog(`[${p}] Solicitação tentada + ${resultado.nome}`); await delay(5000); break;
            case 'expirado': pulados++; addLog(`[${p}] Pulou ( expirado ) + ${resultado.nome}`); await delay(DELAY_PULADOS); break;
            case 'conexao': addLog(`[${p}] ⏸️ Conexão caiu...`); let ok = false; for (let t = 0; t < 12; t++) { await delay(5000); if (getSocketAtivo()) { ok = true; break; } } if (!ok) { addLog(`❌ Pausando.`); emEntrada = false; } else { addLog(`✅ Reconectado!`); i--; continue; } break;
            default: falhas++; addLog(`[${p}] ❌ ${resultado.nome}: ${resultado.msg || 'Erro'}`); await delay(5000);
        }
        ck.entradaIdx = i + 1; saveCheckpoint(ck);
    }
    const t = Math.floor((Date.now() - inicio) / 1000);
    const tf = Math.floor(t/3600) > 0 ? `${Math.floor(t/3600)}h ${Math.floor((t%3600)/60)}m` : `${Math.floor(t/60)}m ${t%60}s`;
    if (emEntrada) { ck.entradaIdx = 0; saveCheckpoint(ck); addLog(`🏁 Entrada finalizada`); await enviarRelatorio('ENTRADA', { total, sucesso: sucessos, falhas, pulados, solicitacoes, tempo: tf }); }
    emEntrada = false;
}

bot.onText(/\/start/, (msg) => {
    if (msg.from.id !== TELEGRAM_ADMIN_ID) return;
    const ck = getCheckpoint(); let info = '';
    if (ck.divulgaIdx > 0) info += `\n📍 Div: ${ck.divulgaIdx}`;
    if (ck.entradaIdx > 0) info += `\n📍 Ent: ${ck.entradaIdx}`;
    bot.sendMessage(msg.chat.id, `🤖 *${NOME_BOT}*\n\n📍 Colheita: ${colheitaAtiva ? '✅' : '❌'}\n🌪️ Furacão: ${furacaoAtivo ? '✅' : '❌'}\n📸 Mídia: ${midiaAtiva ? '✅' : '❌'}${info}\n\nDesenvolvido por ${DESENVOLVEDOR}`, { parse_mode: 'Markdown', reply_markup: getMainKeyboard() });
});

bot.on('message', async (msg) => {
    if (msg.from.id !== TELEGRAM_ADMIN_ID || !msg.text || msg.text.startsWith('/')) return;

    if (aguardandoPost) {
        fs.writeFileSync('Post.txt', msg.text); aguardandoPost = false;
        bot.sendMessage(msg.chat.id, `✅ *Post atualizado!*\n\n${getSaudacao()}\n\n${msg.text}`, { parse_mode: 'Markdown', reply_markup: getMainKeyboard() });
        return;
    }

    if (aguardandoLinks) {
        aguardandoLinks = false;
        entradaAutomatica(msg.text, msg.chat.id);
        return;
    }

    if (aguardandoStatus) {
        aguardandoStatus = false;
        const sock = getSocketAtivo();
        if (!sock) { bot.sendMessage(msg.chat.id, '❌ Sem conexão!'); return; }
        try {
            await postarStatus(sock, { text: msg.text, font: 0, backgroundColor: '#000000', textArgb: 0xFFFFFFFF });
            bot.sendMessage(msg.chat.id, `✅ *Status postado!*\n\n${msg.text}`, { parse_mode: 'Markdown', reply_markup: getMainKeyboard() });
            addLog(`📡 Status postado: texto`);
        } catch (e) {
            bot.sendMessage(msg.chat.id, `❌ Erro: ${erroMsg(e)}`, { reply_markup: getMainKeyboard() });
        }
        return;
    }
});

bot.on('callback_query', async (query) => {
    if (query.from.id !== TELEGRAM_ADMIN_ID) return bot.answerCallbackQuery(query.id, { text: '❌' });
    const cid = query.message.chat.id, mid = query.message.message_id, d = query.data;

    if (d.startsWith('remove_')) {
        const n = d.replace('remove_', '');
        if (connections[n]) { try { connections[n].sock?.end(); } catch {} delete connections[n]; salvarConexoes(); try { fs.removeSync(`auth_${n}`); } catch {} bot.answerCallbackQuery(query.id, { text: '🗑️' }); bot.editMessageText(`📱 *CONEXÕES*`, { chat_id: cid, message_id: mid, parse_mode: 'Markdown', reply_markup: getConexoesKeyboard() }); }
        return;
    }

    switch(d) {
        case 'status':
            const s = getStats(); let lt = 0; try { lt = fs.readJsonSync(dbLinks).length; } catch {}
            bot.editMessageText(`📊 *STATUS*\n\n📱 ${getSocksAtivos().length}\n🎯 Div: *${s.divulgou||0}* | 📥 Ent: *${s.entradas||0}*\n🔗 Col: *${s.linksColhidos||0}* | 📂 *${lt}*\n\n👥 *${s.grupos||0}* | ✅ *${s.abertos||0}* | 🔒 *${s.fechados||0}* | 🏛️ *${s.comunidades||0}*\n\n📸 ${midiaAtiva?'✅':'❌'} | ⚙️ ${emDivulgacao?'🚀':''} ${emEntrada?'🔗':''} ${!emDivulgacao&&!emEntrada?'⚪':''}`, { chat_id: cid, message_id: mid, parse_mode: 'Markdown', reply_markup: getMainKeyboard() });
            break;
        case 'conexoes': bot.editMessageText(`📱 *CONEXÕES*`, { chat_id: cid, message_id: mid, parse_mode: 'Markdown', reply_markup: getConexoesKeyboard() }); break;
        case 'voltar_menu': bot.editMessageText(`🤖 *${NOME_BOT}*`, { chat_id: cid, message_id: mid, parse_mode: 'Markdown', reply_markup: getMainKeyboard() }); break;
        case 'mapear':
            bot.answerCallbackQuery(query.id, { text: '📂' });
            const res = await mapearGrupos();
            if (res) { let txt = '📂 GRUPOS\n'+'═'.repeat(50)+'\n\n'; res.lista.forEach((g,i)=>{txt+=`${i+1}. ${g.tipo} ${g.nome} (${g.mb})\n`;}); txt+='\n'+'═'.repeat(50)+`\n${getDataHora()}\nSR330`; const f='./grupos.txt'; fs.writeFileSync(f,txt); await bot.sendDocument(cid,f,{caption:`📂 *${res.total}* | ✅ ${res.abertos} | 🔒 ${res.fechados} | 🏛️ ${res.comunidades}`,parse_mode:'Markdown'}); try{fs.unlinkSync(f);}catch{} }
            bot.sendMessage(cid,'✅',{reply_markup:getMainKeyboard()}); break;
        case 'divulgar': if(emDivulgacao) bot.answerCallbackQuery(query.id,{text:'⚠️'}); else{bot.answerCallbackQuery(query.id,{text:'🚀'}); divulgarGhost();} break;
        case 'pausar': emDivulgacao=false; emEntrada=false; bot.answerCallbackQuery(query.id,{text:'⏸️'}); break;
        case 'toggle_colheita': colheitaAtiva=!colheitaAtiva; bot.answerCallbackQuery(query.id,{text:`📍 ${colheitaAtiva?'ON':'OFF'}`}); bot.editMessageReplyMarkup(getMainKeyboard(),{chat_id:cid,message_id:mid}); addLog(`📍 Colheita: ${colheitaAtiva?'ON':'OFF'}`); break;
        case 'toggle_furacao': furacaoAtivo=!furacaoAtivo; bot.answerCallbackQuery(query.id,{text:`🌪️ ${furacaoAtivo?'ON':'OFF'}`}); bot.editMessageReplyMarkup(getMainKeyboard(),{chat_id:cid,message_id:mid}); addLog(`🌪️ Furacão: ${furacaoAtivo?'ON':'OFF'}`); break;
        case 'toggle_antipv': antipv=!antipv; bot.answerCallbackQuery(query.id,{text:`🛡️ ${antipv?'ON':'OFF'}`}); bot.editMessageReplyMarkup(getMainKeyboard(),{chat_id:cid,message_id:mid}); break;
        case 'toggle_midia': midiaAtiva=!midiaAtiva; bot.answerCallbackQuery(query.id,{text:`📸 ${midiaAtiva?'ON':'OFF'}`}); bot.editMessageReplyMarkup(getMainKeyboard(),{chat_id:cid,message_id:mid}); addLog(`📸 Mídia: ${midiaAtiva?'ON':'OFF'}`); break;
        case 'entrar_banco': if(emEntrada) bot.answerCallbackQuery(query.id,{text:'⚠️'}); else{bot.answerCallbackQuery(query.id,{text:'🔗'}); entrarLinksBanco();} break;
        case 'entrada_auto': aguardandoLinks=true; bot.answerCallbackQuery(query.id,{text:'📩'}); bot.sendMessage(cid,`📩 *ENTRADA AUTOMÁTICA*\n\nCole os links aqui.\nPode mandar vários de uma vez.\n\nAguardando links...`,{parse_mode:'Markdown'}); break;
        case 'postar_status': aguardandoStatus=true; bot.answerCallbackQuery(query.id,{text:'📡'}); bot.sendMessage(cid,`📡 *POSTAR STATUS*\n\nEnvie texto, foto ou vídeo.\nFoto/vídeo com legenda também funciona.\n\nAguardando...`,{parse_mode:'Markdown'}); break;
        case 'ver_links':
            try{const links=fs.readJsonSync(dbLinks); if(links.length===0){bot.sendMessage(cid,'📭',{reply_markup:getMainKeyboard()});}else{let txt='🔗 LINKS\n'+'═'.repeat(50)+'\n\n'; links.forEach((l,i)=>{txt+=`LINK ${i+1}\nhttps://${l}\n\n`;}); txt+='═'.repeat(50)+`\nTotal: ${links.length}\n${getDataHora()}\nSR330`; const f='./links_banco.txt'; fs.writeFileSync(f,txt); await bot.sendDocument(cid,f,{caption:`📋 *${links.length}*`,parse_mode:'Markdown'}); await enviarLinksWhatsApp(); try{fs.unlinkSync(f);}catch{} bot.sendMessage(cid,'✅ WhatsApp!',{reply_markup:getMainKeyboard()});}}catch{bot.sendMessage(cid,'❌');}
            break;
        case 'limpar_banco': fs.writeJsonSync(dbLinks,[]); bot.answerCallbackQuery(query.id,{text:'🗑️'}); break;
        case 'ver_post':
            const pt=fs.readFileSync('Post.txt','utf-8'), pv=`${getSaudacao()}\n\n${pt}`, mP=getMidiaPath();
            if(midiaAtiva&&mP){ if(mP.endsWith('.mp4')) await bot.sendVideo(cid,mP,{caption:`📸 *Mídia ON*\n\n${pv}`,parse_mode:'Markdown'}); else await bot.sendPhoto(cid,mP,{caption:`📸 *Mídia ON*\n\n${pv}`,parse_mode:'Markdown'}); }
            else bot.sendMessage(cid,`📸 *${midiaAtiva?'SEM ARQUIVO':'Mídia OFF'}*\n\n${pv}`,{parse_mode:'Markdown'});
            bot.sendMessage(cid,'💡 Envie foto/vídeo para mudar mídia\n🌙0-6|☀️6-12|🌤️12-18|🌆18-0',{reply_markup:getMainKeyboard()}); break;
        case 'editar_post': aguardandoPost=true; bot.answerCallbackQuery(query.id,{text:'✏️'}); bot.sendMessage(cid,'✏️ Envie o novo post completo:'); break;
        case 'reset': saveCheckpoint({divulgaIdx:0,entradaIdx:0}); fs.writeJsonSync(statsPath,{divulgou:0,grupos:0,entradas:0,abertos:0,fechados:0,comunidades:0,linksColhidos:0}); bot.answerCallbackQuery(query.id,{text:'🔄'}); break;
        case 'logs': bot.sendMessage(cid,`📋 *LOGS*\n\n\`\`\`\n${logs.slice(-50).join('\n')||'Vazio'}\n\`\`\``,{parse_mode:'Markdown',reply_markup:getMainKeyboard()}); break;
    }
});

bot.on('photo', async (msg) => {
    if (msg.from.id !== TELEGRAM_ADMIN_ID) return;
    try {
        const file = await bot.getFile(msg.photo[msg.photo.length - 1].file_id);
        const legenda = msg.caption || '';

        if (aguardandoStatus) {
            aguardandoStatus = false;
            const tempFile = './temp_status.jpg';
            const w = require('fs').createWriteStream(tempFile);
            require('https').get(`https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${file.file_path}`, r => {
                r.pipe(w); w.on('finish', async () => { w.close();
                    const sock = getSocketAtivo();
                    if (!sock) { bot.sendMessage(msg.chat.id, '❌ Sem conexão!'); return; }
                    try {
                        await postarStatus(sock, { image: fs.readFileSync(tempFile), caption: legenda });
                        bot.sendMessage(msg.chat.id, `✅ *Status postado com imagem!*`, { parse_mode: 'Markdown', reply_markup: getMainKeyboard() });
                        addLog(`📡 Status postado: imagem`);
                    } catch (e) { bot.sendMessage(msg.chat.id, `❌ ${erroMsg(e)}`, { reply_markup: getMainKeyboard() }); }
                    try { fs.unlinkSync(tempFile); } catch {}
                });
            });
            return;
        }

        require('https').get(`https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${file.file_path}`, r => {
            const w = require('fs').createWriteStream('./Post.jpg');
            r.pipe(w); w.on('finish', () => { w.close();
                try { fs.unlinkSync('./Post.png'); } catch {} try { fs.unlinkSync('./Post.mp4'); } catch {}
                midiaAtiva = true;
                const post = fs.readFileSync('Post.txt', 'utf-8');
                bot.sendPhoto(msg.chat.id, './Post.jpg', { caption: `✅ *Imagem salva! Mídia ON*\n\n📝 Preview:\n\n${getSaudacao()}\n\n${post}`, parse_mode: 'Markdown' });
                bot.sendMessage(msg.chat.id, '💡 É assim que ficará nos grupos!', { reply_markup: getMainKeyboard() });
            });
        });
    } catch {}
});

bot.on('video', async (msg) => {
    if (msg.from.id !== TELEGRAM_ADMIN_ID) return;
    try {
        const file = await bot.getFile(msg.video.file_id);
        const legenda = msg.caption || '';

        if (aguardandoStatus) {
            aguardandoStatus = false;
            const tempFile = './temp_status.mp4';
            const w = require('fs').createWriteStream(tempFile);
            require('https').get(`https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${file.file_path}`, r => {
                r.pipe(w); w.on('finish', async () => { w.close();
                    const sock = getSocketAtivo();
                    if (!sock) { bot.sendMessage(msg.chat.id, '❌ Sem conexão!'); return; }
                    try {
                        await postarStatus(sock, { video: fs.readFileSync(tempFile), caption: legenda });
                        bot.sendMessage(msg.chat.id, `✅ *Status postado com vídeo!*`, { parse_mode: 'Markdown', reply_markup: getMainKeyboard() });
                        addLog(`📡 Status postado: vídeo`);
                    } catch (e) { bot.sendMessage(msg.chat.id, `❌ ${erroMsg(e)}`, { reply_markup: getMainKeyboard() }); }
                    try { fs.unlinkSync(tempFile); } catch {}
                });
            });
            return;
        }

        require('https').get(`https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${file.file_path}`, r => {
            const w = require('fs').createWriteStream('./Post.mp4');
            r.pipe(w); w.on('finish', () => { w.close();
                try { fs.unlinkSync('./Post.jpg'); } catch {} try { fs.unlinkSync('./Post.png'); } catch {}
                midiaAtiva = true;
                const post = fs.readFileSync('Post.txt', 'utf-8');
                bot.sendVideo(msg.chat.id, './Post.mp4', { caption: `✅ *Vídeo salvo! Mídia ON*\n\n📝 Preview:\n\n${getSaudacao()}\n\n${post}`, parse_mode: 'Markdown' });
                bot.sendMessage(msg.chat.id, '💡 É assim que ficará nos grupos!', { reply_markup: getMainKeyboard() });
            });
        });
    } catch {}
});

async function iniciarConexao(numero, isReconnect = false) {
    const authFolder = `auth_${numero}`;
    try {
        const { state, saveCreds } = await useMultiFileAuthState(authFolder);
        const { version } = await fetchLatestBaileysVersion();
        const sock = makeWASocket({ version, auth: state, logger: pino({ level: "silent" }), browser: BROWSER });
        connections[numero] = { sock, authFolder };

        if (!isReconnect && !sock.authState.creds.registered) {
            await new Promise(r => { sock.ev.on('connection.update', u => { if (u.connection === 'connecting') r(); }); });
            await delay(2000);
            const code = await sock.requestPairingCode(numero);
            monitorAtivo = false;
            console.log(chalk.black.bgWhite.bold(`\n  ✅ CÓDIGO: ${code}  \n`));
        }

        sock.ev.on('creds.update', saveCreds);
        sock.ev.on('connection.update', async u => {
            if (u.connection === 'open') { addLog(`✅ ${numero} ONLINE`); salvarConexoes(); }
            if (u.connection === 'close') {
                if (new Boom(u.lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut) { addLog(`⚠️ ${numero} reconectando...`); await delay(5000); iniciarConexao(numero, true); }
                else { addLog(`❌ ${numero} deslogado`); delete connections[numero]; salvarConexoes(); }
            }
        });

        sock.ev.on('messages.upsert', async m => {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;
            const from = msg.key.remoteJid;
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || "";
            if (antipv && !from.endsWith('@g.us') && from !== DONO_NUMERO) return;
            if (!text.includes("chat.whatsapp.com/")) return;
            if (!colheitaAtiva && !furacaoAtivo) return;

            let matches = text.match(/chat\.whatsapp\.com\/([A-Za-z0-9]{18,30})/g);
            if (!matches) return;

            let grupoNome = "PV";
            if (from.endsWith('@g.us')) { try { grupoNome = (await sock.groupMetadata(from)).subject || "Grupo"; } catch { grupoNome = "Grupo"; } }

            for (const match of matches) {
                const linkLimpo = match.replace('https://', '').replace('http://', '');
                const codigo = extrairCodigo(linkLimpo);
                if (!codigo) continue;
                const salvo = salvarLink(linkLimpo);
                if (!salvo) continue;
                addLog(`📍 Link colhido em: ${grupoNome}`);

                if (furacaoAtivo) {
                    addLog(`🌪️ Furacão tentando...`);
                    const resultado = await tentarEntrarGrupo(sock, codigo);
                    switch (resultado.status) {
                        case 'entrou': updateStat('entradas', '++'); addLog(`🌪️ Entrou + ${resultado.nome}`); await delay(DELAY_ENTRADA); break;
                        case 'membro': addLog(`🌪️ Pulou ( membro ) + ${resultado.nome}`); await delay(DELAY_PULADOS); break;
                        case 'solicitacao': addLog(`🌪️ Solicitação enviada + ${resultado.nome}`); await delay(DELAY_ENTRADA); break;
                        case 'solicitacao_falha': addLog(`🌪️ Solicitação tentada + ${resultado.nome}`); await delay(5000); break;
                        case 'expirado': addLog(`🌪️ Pulou ( expirado ) + ${resultado.nome}`); await delay(DELAY_PULADOS); break;
                        default: addLog(`🌪️ Falhou + ${resultado.nome}: ${resultado.msg || 'Erro'}`); await delay(5000);
                    }
                }
            }
        });

        return true;
    } catch (e) { addLog(`❌ ${numero}: ${erroMsg(e)}`); delete connections[numero]; return false; }
}

async function carregarConexoesExistentes() {
    const nums = carregarConexoesSalvas();
    if (nums.length === 0) return;
    console.log(chalk.cyan(`  📱 Carregando ${nums.length}...\n`));
    for (const n of nums) { if (fs.existsSync(`auth_${n}`)) { console.log(chalk.yellow(`  ⏳ ${n}...`)); await iniciarConexao(n, true); await delay(2000); } }
}

async function menuConexao() {
    monitorAtivo = false; limparTela();
    console.log(chalk.cyan('\n═══════════════════════════════════════'));
    console.log(chalk.cyan('       GERENCIADOR DE CONEXÕES'));
    console.log(chalk.cyan('═══════════════════════════════════════\n'));
    console.log(chalk.white(`  📱 ${chalk.green(Object.keys(connections).length)}/10\n`));
    if (Object.keys(connections).length >= MAX_CONEXOES) return;
    const n = (await question(chalk.green('  Número: '))).replace(/[^0-9]/g, '');
    if (n.length < 10) { console.log(chalk.red('  ❌')); return menuConexao(); }
    if (connections[n]) { console.log(chalk.yellow('  ⚠️ Já!')); return menuConexao(); }
    console.log(chalk.yellow(`\n  ⏳ Conectando...\n`));
    if (await iniciarConexao(n, false)) salvarConexoes();
    if ((await question(chalk.cyan('\n  Outro? (s/n): '))).toLowerCase() === 's') await menuConexao();
}

async function iniciar() {
    limparTela();
    console.log(chalk.cyan(BANNER));
    console.log(chalk.gray(`            🚀 Desenvolvido por ${DESENVOLVEDOR} 🚀\n`));
    console.log(chalk.green('  ✅ Iniciado!\n'));
    const ck = getCheckpoint();
    if (ck.divulgaIdx > 0 || ck.entradaIdx > 0) { console.log(chalk.yellow('  📍 CHECKPOINTS:')); if (ck.divulgaIdx > 0) console.log(chalk.yellow(`     Div: ${ck.divulgaIdx}`)); if (ck.entradaIdx > 0) console.log(chalk.yellow(`     Ent: ${ck.entradaIdx}`)); console.log(''); }
    await carregarConexoesExistentes();
    if (Object.keys(connections).length > 0) console.log(chalk.green(`\n  ✅ ${Object.keys(connections).length} conexão(ões)!\n`));
    if ((await question(chalk.yellow('  Nova conexão? (s/n): '))).toLowerCase() === 's') await menuConexao();
    console.log(chalk.cyan('\n  📺 Monitor em 3s...\n'));
    await delay(3000);
    monitorAtivo = true;
    addLog(`🚀 Sistema pronto!`);
    addLog(`📍 Colheita: ${colheitaAtiva ? 'ON' : 'OFF'}`);
    addLog(`🌪️ Furacão: ${furacaoAtivo ? 'ON' : 'OFF'}`);
}

iniciar();
