"""
Main application entrypoint for the PoupaLuz Telegram Bot.
Initializes dispatcher, registers command & media handlers, and starts polling.

Usage:
    python -m telegram_bot.main
"""

import logging
import sys
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    filters
)

from telegram.request import HTTPXRequest
from .config import (
    TELEGRAM_BOT_TOKEN,
    GEMINI_API_KEY,
    check_config,
    get_ssl_context
)
from .handlers import (
    start_command,
    help_command,
    privacy_command,
    how_to_switch_command,
    share_command,
    lang_command,
    document_handler,
    photo_handler,
    manual_command,
    manual_callback_handler,
    callback_query_handler
)

# Configure logging
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO
)
logger = logging.getLogger("PoupaLuzBot")


def main():
    """Starts the Telegram bot service."""
    # Ensure UTF-8 output on Windows
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    missing = check_config()
    if missing:
        print("=" * 65)
        print("⚠️  AVISO DE CONFIGURAÇÃO DO BOT TELEGRAM")
        print("=" * 65)
        for item in missing:
            print(f"  • Em falta: {item}")
        print("\nPara configurar, cria um ficheiro .env na raiz do projeto com:")
        print("TELEGRAM_BOT_TOKEN=o_teu_token_do_botfather")
        print("GEMINI_API_KEY=a_tua_chave_gratuita_do_aistudio\n")
        print("=" * 65)
        if not TELEGRAM_BOT_TOKEN:
            print("❌ O bot não pode iniciar sem TELEGRAM_BOT_TOKEN. A encerrar.")
            sys.exit(1)

    print("=" * 65)
    print(" ⚡ POUPALUZ BOT :: COMPARADOR DE FATURAS DE ELETRICIDADE")
    print("=" * 65)
    print("  • Motor de Visão AI: Ativo (Google Gemini Flash)")
    print("  • Base de Dados ERSE: Ativa (simuladorprecos.erse.pt)")
    print("  • Modo de Operação: Polling assíncrono seguro")
    print("=" * 65)
    print("A iniciar o bot... Pressiona Ctrl+C para parar.\n")

    # Configure custom HTTPX request to trust system / Windows CA certs (corporate proxy support)
    ssl_ctx = get_ssl_context()
    request_client = HTTPXRequest(httpx_kwargs={"verify": ssl_ctx})
    get_updates_request_client = HTTPXRequest(httpx_kwargs={"verify": ssl_ctx})

    # Build Telegram Application
    app = (
        ApplicationBuilder()
        .token(TELEGRAM_BOT_TOKEN)
        .request(request_client)
        .get_updates_request(get_updates_request_client)
        .build()
    )

    # Register Command Handlers
    app.add_handler(CommandHandler(["start"], start_command))
    app.add_handler(CommandHandler(["ajuda", "help"], help_command))
    app.add_handler(CommandHandler(["privacidade", "privacy"], privacy_command))
    app.add_handler(CommandHandler(["comomudar", "howtoswitch"], how_to_switch_command))
    app.add_handler(CommandHandler(["partilhar", "share"], share_command))
    app.add_handler(CommandHandler(["manual", "simular"], manual_command))
    app.add_handler(CommandHandler(["lang", "idioma"], lang_command))

    # Register Media Handlers
    app.add_handler(MessageHandler(filters.Document.ALL, document_handler))
    app.add_handler(MessageHandler(filters.PHOTO, photo_handler))

    # Register Inline Callback Handlers
    app.add_handler(CallbackQueryHandler(manual_callback_handler, pattern="^manual_"))
    app.add_handler(CallbackQueryHandler(callback_query_handler))

    # Start Polling
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()

