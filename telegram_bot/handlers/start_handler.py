"""
Command handlers for /start, /ajuda, /privacidade, /comomudar, /partilhar, /lang.
"""

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes

from ..templates import messages_pt, messages_en


def get_user_lang(context: ContextTypes.DEFAULT_TYPE) -> str:
    """Returns 'pt' or 'en' for the current user."""
    return context.user_data.get("lang", "pt")


def get_template(context: ContextTypes.DEFAULT_TYPE):
    """Returns localized message module based on user language."""
    lang = get_user_lang(context)
    return messages_en if lang == "en" else messages_pt


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handles /start command."""
    tpl = get_template(context)
    keyboard = [
        [
            InlineKeyboardButton("📄 Como Enviar Fatura", callback_data="help_info"),
            InlineKeyboardButton("⚡ Simular Sem Ficheiro", callback_data="start_manual")
        ],
        [
            InlineKeyboardButton("🔒 Privacidade (RGPD)", callback_data="privacy_info"),
            InlineKeyboardButton("🌐 Mudar Idioma / Lang", callback_data="toggle_lang")
        ]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await update.message.reply_text(
        tpl.WELCOME_TEXT,
        parse_mode="Markdown",
        reply_markup=reply_markup,
        disable_web_page_preview=True
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handles /ajuda or /help command."""
    tpl = get_template(context)
    await update.message.reply_text(tpl.HELP_TEXT, parse_mode="Markdown")


async def privacy_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handles /privacidade or /privacy command."""
    tpl = get_template(context)
    await update.message.reply_text(tpl.PRIVACY_TEXT, parse_mode="Markdown")


async def how_to_switch_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handles /comomudar or /howtoswitch command."""
    tpl = get_template(context)
    await update.message.reply_text(tpl.HOW_TO_SWITCH_TEXT, parse_mode="Markdown", disable_web_page_preview=True)


async def share_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handles /partilhar or /share command."""
    tpl = get_template(context)
    bot_username = (await context.bot.get_me()).username or "PoupeLuzBot"
    text = tpl.SHARE_TEXT.format(bot_username=bot_username)

    keyboard = [
        [
            InlineKeyboardButton(
                "📤 Encaminhar a Amigos",
                url=f"https://t.me/share/url?url=https://t.me/{bot_username}&text=Descobre%20se%20est%C3%A1s%20a%20pagar%20a%20mais%20na%20conta%20da%20luz!"
            )
        ]
    ]
    await update.message.reply_text(
        text,
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup(keyboard),
        disable_web_page_preview=True
    )


async def lang_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handles /lang or language swapping."""
    curr = get_user_lang(context)
    new_lang = "en" if curr == "pt" else "pt"
    context.user_data["lang"] = new_lang

    msg = "🌐 Idioma alterado para Inglês (English)!" if new_lang == "en" else "🌐 Idioma alterado para Português!"
    await update.message.reply_text(msg)

