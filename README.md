# SRR 330 SYSTEM

Bot WhatsApp + Telegram para divulgação, entrada em grupos, colheita de links e furacão.

## ⚡ Instalação rápida na VPS (Ubuntu/Debian)

```bash
unzip srr330-bot.zip
cd srr330-bot
chmod +x INSTALAR.sh
./INSTALAR.sh
```

## ⚙️ Antes de rodar — EDITE o `config.json`

Abra o `config.json` e altere:

```json
{
  "nome_bot": "SEU NOME",
  "desenvolvedor": "SEU NICK",
  "telegram": {
    "token": "TOKEN_DO_BOTFATHER",
    "admin_id": 123456789
  },
  "whatsapp": {
    "dono_numero": "55SEUNUMERO",
    "max_conexoes": 10
  },
  "configuracoes": {
    "colheita_ativa": true,
    "furacao_ativo": false,
    "antipv": false,
    "midia_ativa": true
  },
  "delays": {
    "entre_divulgacoes_ms": 60000,
    "entre_entradas_ms": 60000,
    "entre_pulados_ms": 3000,
    "digitando_segundos": 5
  }
}
```

- Token: peça no [@BotFather](https://t.me/BotFather)
- Seu ID: peça no [@userinfobot](https://t.me/userinfobot)
- **Não precisa mexer no `index.js` nunca.** Só no `config.json`.
- Após editar o config, reinicie: `pm2 restart srr330`

## ▶️ Rodar

### Modo teste (terminal)
```bash
node index.js
```

### Modo produção (24h, reinicia sozinho)
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup        # cole o comando que aparecer
```

Comandos úteis:
```bash
pm2 logs srr330        # ver logs ao vivo
pm2 restart srr330     # reiniciar
pm2 stop srr330        # parar
pm2 monit              # painel ao vivo
```

## 📱 Conectar WhatsApp

Ao iniciar, ele pede o número (com DDI, ex: `5513997967209`) e mostra um
**código de pareamento de 8 dígitos**.

No celular: **WhatsApp → Aparelhos conectados → Conectar aparelho →
Conectar com número de telefone** → digite o código.

## 🤖 Usar pelo Telegram

Abra seu bot e mande `/start`.

## 🖼️ Mídia do post (opcional)

Coloque na pasta:
- `Post.jpg` / `Post.png` (imagem) **ou**
- `Post.mp4` (vídeo)

Ou envie a mídia diretamente pelo Telegram — ele salva sozinho.

## 📂 Arquivos

| Arquivo | Função |
|---|---|
| `index.js` | Código principal |
| `Post.txt` | Texto do post |
| `banco.json` | Links colhidos |
| `checkpoint.json` | Onde parou divulgação/entrada |
| `stats.json` | Estatísticas |
| `connections.json` | Números conectados |
| `auth_<numero>/` | Sessão do WhatsApp (NÃO apague) |

## ⚠️ Avisos

- Esse tipo de automação **viola os Termos do WhatsApp** — use número descartável.
- Nunca compartilhe a pasta `auth_<numero>/` (é sua sessão).
- Troque o token do Telegram do exemplo — ele é público.
