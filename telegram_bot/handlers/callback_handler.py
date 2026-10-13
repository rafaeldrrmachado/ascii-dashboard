"""
Callback query handler for inline button actions (Top 5, Como Mudar, Partilhar, etc.).
"""

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes

from .start_handler import get_template, get_user_lang
from .manual_handler import manual_command


async def callback_query_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Dispatches inline keyboard button callbacks."""
    query = update.callback_query
    await query.answer()
    data = query.data

    tpl = get_template(context)
    res = context.user_data.get("last_comparison")

    if data == "view_top_5":
        if not res:
            await query.edit_message_text("⚠️ Nenhuma simulação ativa. Envia uma fatura ou usa /manual para começar.")
            return

        text = tpl.format_top_offers_list(res)
        keyboard = [
            [
                InlineKeyboardButton("⬅️ Voltar ao Resumo", callback_data="back_to_summary"),
                InlineKeyboardButton("📝 Como Mudar", callback_data="how_to_switch")
            ]
        ]
        await query.edit_message_text(text, parse_mode="Markdown", reply_markup=InlineKeyboardMarkup(keyboard))

    elif data == "back_to_summary":
        if not res:
            return
        report_text = tpl.format_comparison_card(res)
        keyboard = [
            [
                InlineKeyboardButton("📊 Ver Top 5 Ofertas", callback_data="view_top_5"),
                InlineKeyboardButton("📝 Como Mudar", callback_data="how_to_switch")
            ],
            [
                InlineKeyboardButton("🌐 Simulador Oficial ERSE ↗", url="https://simuladorprecos.erse.pt/"),
                InlineKeyboardButton("📤 Partilhar Bot", callback_data="share_bot")
            ]
        ]
        await query.edit_message_text(report_text, parse_mode="Markdown", reply_markup=InlineKeyboardMarkup(keyboard), disable_web_page_preview=True)

    elif data == "how_to_switch":
        keyboard = [
            [InlineKeyboardButton("⬅️ Voltar", callback_data="back_to_summary")]
        ] if res else []
        await query.message.reply_text(
            tpl.HOW_TO_SWITCH_TEXT,
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup(keyboard) if keyboard else None,
            disable_web_page_preview=True
        )

    elif data == "share_bot":
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
        await query.message.reply_text(text, parse_mode="Markdown", reply_markup=InlineKeyboardMarkup(keyboard))

    elif data == "help_info":
        await query.message.reply_text(tpl.HELP_TEXT, parse_mode="Markdown")

    elif data == "privacy_info":
        await query.message.reply_text(tpl.PRIVACY_TEXT, parse_mode="Markdown")

    elif data == "start_manual":
        await manual_command(update, context)

    elif data == "toggle_lang":
        curr = get_user_lang(context)
        new_lang = "en" if curr == "pt" else "pt"
        context.user_data["lang"] = new_lang

        msg = "🌐 Idioma alterado para Inglês!" if new_lang == "en" else "🌐 Idioma alterado para Português!"
        await query.message.reply_text(msg)
