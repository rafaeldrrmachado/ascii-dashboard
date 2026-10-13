# PoupaLuz Bot ⚡🤖 — Comparador Inteligente de Faturas de Eletricidade

Um bot de Telegram aberto, gratuito e partilhável que analisa faturas de eletricidade em Portugal (EDP Comercial, Endesa, Galp, Iberdrola, Goldenergy, Plenitude, Repsol, SU Eletricidade, etc.) através de **Inteligência Artificial Vision** e encontra a alternativa mais barata no mercado regulado pela **ERSE**.

---

## ✨ Funcionalidades

- 📸 **Leitura Multimodal por IA (100% Gratuita)**: Envia uma fatura em **PDF** ou uma **fotografia** tirada com o telemóvel. O modelo Google Gemini Flash extrai automaticamente a potência contratada (`kVA`), ciclo horário (`Simples` ou `Bi-horário`) e consumo (`kWh`).
- 🏛️ **Base Oficial da ERSE**: Cruza o teu perfil de consumo com os 10 principais comercializadores do mercado português em tempo real (`data/erse_tariffs.json`).
- 💰 **Cálculo Real de Poupança**: Aplica o regime fiscal português completo (IVA escalonado de 6% e 23%, CAV 2,85€, DGEG 0,07€ e IEC).
- 🏆 **Ranking dos Melhores Fornecedores**: Mostra o fornecedor #1 mais barato e o Top 3/Top 5 com a poupança estimada em **€/mês** e **€/ano**.
- 🔒 **Zero-Retention (RGPD)**: As faturas são lidas na memória e descartadas de imediato. Não guardamos nomes, NIF, moradas nem IBAN.
- 💬 **Modo Manual (`/manual`)**: Permite simular escolhendo a potência e consumo através de botões interativos, sem enviar qualquer ficheiro.
- 📝 **Guia de Mudança (`/comomudar`)**: Explica como mudar de fornecedor gratuitamente sem cortes de energia.

---

## 🚀 Como Configurar e Executar

### 1. Obter o Token do Telegram (Grátis, ~30 segundos)
1. No Telegram, pesquisa por `@BotFather` e clica em **Começar**.
2. Envia `/newbot`.
3. Escolhe um nome para o bot (ex: `Poupa Luz PT`) e um username terminado em `bot` (ex: `O_Meu_PoupaLuz_bot`).
4. O `@BotFather` vai devolver um token do tipo:
   `7891234567:AAFlzAbcDeFgHiJkLmNoPqRsTuVwXyZ`

### 2. Obter a Chave da API Gemini (100% Gratuita)
1. Acede a [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Clica em **Create API Key**.
3. O plano gratuito oferece **1 500 pedidos por dia** e 15 pedidos por minuto (muito acima do necessário para uso pessoal e partilha com amigos).

### 3. Configurar as Variáveis de Ambiente
Na raiz do projeto, copia o ficheiro `.env.example` para `.env`:
```bash
cp .env.example .env
```
Abre o `.env` e preenche:
```env
TELEGRAM_BOT_TOKEN=7891234567:AAFlzAbcDeFgHiJkLmNoPqRsTuVwXyZ
GEMINI_API_KEY=AIzaSyD...a_tua_chave...
```

### 4. Executar o Bot
```bash
python -m telegram_bot.main
```
Deverás ver a mensagem de sucesso na consola:
```text
=================================================================
 ⚡ POUPALUZ BOT :: COMPARADOR DE FATURAS DE ELETRICIDADE
=================================================================
  • Motor de Visão AI: Ativo (Google Gemini Flash)
  • Base de Dados ERSE: Ativa (simuladorprecos.erse.pt)
  • Modo de Operação: Polling assíncrono seguro
=================================================================
A iniciar o bot... Pressiona Ctrl+C para parar.
```

---

## 📱 Como Partilhar com Outras Pessoas

Quando o bot estiver a correr:
1. Partilha o link direto do teu bot:
   `https://t.me/<username_do_teu_bot>`
2. Qualquer pessoa que abra o link e clique em **Começar** (`/start`) pode enviar uma fatura ou usar o simulador `/manual`!
3. Os utilizadores podem ainda carregar no botão **📤 Partilhar Bot** no próprio Telegram para reencaminhar diretamente a amigos e familiares.

---

## ☁️ Alojamento 24/7 na Cloud (Opcional)

Para manter o bot ligado 24 horas por dia sem precisares de ter o computador ligado:

### Opção A: Railway / Render (Free / Low-cost)
1. Cria um repositório no GitHub com este código.
2. No [Railway.app](https://railway.app) ou [Render.com](https://render.com), cria um novo **Web Service** ou **Worker** ligado ao repositório.
3. Adiciona as variáveis de ambiente (`TELEGRAM_BOT_TOKEN` e `GEMINI_API_KEY`).
4. O bot arranca automaticamente através do `Dockerfile` incluído.

### Opção B: VPS Linux / Raspberry Pi
```bash
docker build -t poupaluz-bot -f telegram_bot/Dockerfile .
docker run -d --name poupaluz --env-file .env --restart unless-stopped poupaluz-bot
```

---

## 🧪 Testes Unitários

Podes verificar o motor de cálculo e a validação de faturas executando:
```bash
python -m unittest discover -s telegram_bot/tests
```

