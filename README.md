# SALEMDIV SYSTEM

Bot WhatsApp + Telegram para divulgação, entrada em grupos, coleta de links e automação.

## 📦 Repositório Oficial

https://github.com/alphastoreonline00-code/salemdiv

## ⚡ Instalação rápida na VPS (Ubuntu/Debian)

```bash
git clone https://github.com/alphastoreonline00-code/salemdiv.git
cd salemdiv
chmod +x INSTALAR.sh
./INSTALAR.sh
```

## ⚙️ Antes de rodar — EDITE o `config.json`

Abra o arquivo `config.json` e altere:

```json
{
  "nome_bot": "SALEMDIV",
  "desenvolvedor": "EreDarkOfc",
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

- Token: solicite no @BotFather
- Seu ID: obtenha no @userinfobot
- Nunca é necessário editar o `index.js`. Apenas o `config.json`.
- Após editar, reinicie:

```bash
pm2 restart srr330
```

## ▶️ Rodar o Sistema

### Modo teste (terminal)

```bash
node index.js
```

### Modo produção (24 horas, reinício automático)

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

> Execute também o comando exibido após `pm2 startup`.

### Comandos úteis

```bash
pm2 logs srr330
pm2 restart srr330
pm2 stop srr330
pm2 monit
```

## 📱 Conectar WhatsApp

Ao iniciar, o sistema solicitará o número com DDI (exemplo: `5513997967209`) e exibirá um código de pareamento de 8 dígitos.

No celular:

1. Abra o WhatsApp
2. Toque em **Aparelhos conectados**
3. Selecione **Conectar aparelho**
4. Escolha **Conectar com número de telefone**
5. Digite o código gerado

## 🤖 Usar pelo Telegram

Abra seu bot e envie:

```text
/start
```

## 🖼️ Mídia do Post (Opcional)

Coloque na pasta do projeto:

- `Post.jpg`
- `Post.png`
- `Post.mp4`

Ou envie a mídia diretamente pelo Telegram; o sistema salvará automaticamente.

## 📂 Estrutura de Arquivos

| Arquivo | Função |
|--------|--------|
| `index.js` | Código principal |
| `Post.txt` | Texto do post |
| `banco.json` | Links coletados |
| `checkpoint.json` | Ponto de continuidade |
| `stats.json` | Estatísticas |
| `connections.json` | Números conectados |
| `auth_<numero>/` | Sessão do WhatsApp (não apagar) |

## ⚠️ Avisos Importantes

- Automação no WhatsApp pode violar os Termos de Uso.
- Utilize um número secundário ou descartável.
- Nunca compartilhe a pasta `auth_<numero>/`.
- Troque o token do Telegram antes de usar.

## 👨‍💻 Desenvolvedor

**EreDarkOfc**

## 🔥 Projeto

**SALEMDIV SYSTEM**



# SALEMDIV SYSTEM

Bot WhatsApp + Telegram para divulgação, entrada em grupos, coleta de links e automação.

## 📦 Repositório Oficial

https://github.com/alphastoreonline00-code/salemdiv

## ⚡ Instalação rápida na VPS (Ubuntu/Debian)

```bash
git clone https://github.com/alphastoreonline00-code/salemdiv.git
cd salemdiv
chmod +x INSTALAR.sh
./INSTALAR.sh
```

## ⚙️ Antes de rodar — EDITE o `config.json`

Abra o arquivo `config.json` e altere:

```json
{
  "nome_bot": "SALEMDIV",
  "desenvolvedor": "EreDarkOfc",
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

- Token: solicite no @BotFather
- Seu ID: obtenha no @userinfobot
- Nunca é necessário editar o `index.js`. Apenas o `config.json`.
- Após editar, reinicie:

```bash
pm2 restart srr330
```

## ▶️ Rodar o Sistema

### Modo teste (terminal)

```bash
node index.js
```

### Modo produção (24 horas, reinício automático)

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

> Execute também o comando exibido após `pm2 startup`.

### Comandos úteis

```bash
pm2 logs srr330
pm2 restart srr330
pm2 stop srr330
pm2 monit
```

## 📱 Conectar WhatsApp

Ao iniciar, o sistema solicitará o número com DDI (exemplo: `5513997967209`) e exibirá um código de pareamento de 8 dígitos.

No celular:

1. Abra o WhatsApp
2. Toque em **Aparelhos conectados**
3. Selecione **Conectar aparelho**
4. Escolha **Conectar com número de telefone**
5. Digite o código gerado

## 🤖 Usar pelo Telegram

Abra seu bot e envie:

```text
/start
```

## 🖼️ Mídia do Post (Opcional)

Coloque na pasta do projeto:

- `Post.jpg`
- `Post.png`
- `Post.mp4`

Ou envie a mídia diretamente pelo Telegram; o sistema salvará automaticamente.

## 📂 Estrutura de Arquivos

| Arquivo | Função |
|--------|--------|
| `index.js` | Código principal |
| `Post.txt` | Texto do post |
| `banco.json` | Links coletados |
| `checkpoint.json` | Ponto de continuidade |
| `stats.json` | Estatísticas |
| `connections.json` | Números conectados |
| `auth_<numero>/` | Sessão do WhatsApp (não apagar) |

## ⚠️ Avisos Importantes

- Automação no WhatsApp pode violar os Termos de Uso.
- Utilize um número secundário ou descartável.
- Nunca compartilhe a pasta `auth_<numero>/`.
- Troque o token do Telegram antes de usar.

## 👨‍💻 Desenvolvedor

**EreDarkOfc**

## 🔥 Projeto

**SALEMDIV SYSTEM**