"""
Document and photo message handler for electricity invoice uploads.
Downloads file in-memory, invokes multimodal Vision AI, and responds with the savings analysis.
"""

import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.constants import ChatAction
from telegram.ext import ContextTypes

from ..parsers.vision_parser import parse_invoice_with_vision
from ..comparator.savings_engine import SavingsEngine
from .start_handler import get_template

logger = logging.getLogger(__name__)
savings_engine = SavingsEngine()


async def process_file_bytes(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    file_bytes: bytes,
    mime_type: str
) -> None:
    """Processes invoice bytes, runs Vision AI extraction, and sends savings report."""
    tpl = get_template(context)

    # Inform user that AI is working
    status_msg = await update.message.reply_text(
        "🔍 *A analisar a tua fatura com Inteligência Artificial Vision...*\n"
        "_Isto demora habitualmente entre 2 e 4 segundos._",
        parse_mode="Markdown"
    )

    try:
        # Keep typing action active
        await update.message.chat.send_action(action=ChatAction.TYPING)

        # 1. Parse with Vision AI
        invoice, err = await parse_invoice_with_vision(file_bytes, mime_type)

        if err or not invoice:
            await status_msg.edit_text(
                f"{err or 'Não foi possível ler os dados da fatura.'}\n\n"
                "💡 *Dica:* Certifica-te de que a fatura tem a secção de dados do contrato (kVA) e consumo visíveis, "
                "ou clica em /manual para simular inserindo os valores à mão.",
                parse_mode="Markdown"
            )
            return

        # 2. Run ERSE Market Comparison
        res = savings_engine.compare_invoice(invoice)
        if not res:
            await status_msg.edit_text(
                "❌ Não foi possível carregar a base de dados de tarifas da ERSE. "
                "Tenta novamente dentro de alguns momentos.",
                parse_mode="Markdown"
            )
            return

        # Store in user session for inline callbacks
        context.user_data["last_comparison"] = res

        # 3. Format Report & Action Buttons
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
        reply_markup = InlineKeyboardMarkup(keyboard)

        # Update message with report
        await status_msg.edit_text(
            report_text,
            parse_mode="Markdown",
            reply_markup=reply_markup,
            disable_web_page_preview=True
        )

    except Exception as e:
        logger.exception("Error processing invoice file: %s", e)
        await status_msg.edit_text(
            f"❌ Ocorreu um erro ao processar a fatura: `{str(e)}`\n\n"
            "Podes tentar novamente ou usar o comando /manual.",
            parse_mode="Markdown"
        )


async def document_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handles incoming document files (PDFs, images)."""
    doc = update.message.document
    if not doc:
        return

    mime_type = doc.mime_type or "application/pdf"
    file_name = doc.file_name or ""

    # Check size limit (max 15MB)
    if doc.file_size and doc.file_size > 15 * 1024 * 1024:
        await update.message.reply_text("⚠️ O ficheiro é demasiado grande (limite de 15MB). Por favor envia um ficheiro mais leve.")
        return

    # Check extension / mime
    is_pdf = "pdf" in mime_type.lower() or file_name.lower().endswith(".pdf")
    is_img = "image" in mime_type.lower() or any(file_name.lower().endswith(ext) for ext in [".jpg", ".jpeg", ".png", ".webp"])

    if not (is_pdf or is_img):
        await update.message.reply_text(
            "⚠️ Por favor envia uma fatura em formato **PDF** ou **imagem** (JPG/PNG).",
            parse_mode="Markdown"
        )
        return

    # Download in-memory
    tg_file = await doc.get_file()
    file_bytes = await tg_file.download_as_bytearray()

    await process_file_bytes(update, context, bytes(file_bytes), mime_type)


async def photo_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handles incoming smartphone camera photos."""
    photos = update.message.photo
    if not photos:
        return

    # Select highest resolution version
    best_photo = photos[-1]
    tg_file = await best_photo.get_file()
    file_bytes = await tg_file.download_as_bytearray()

    await process_file_bytes(update, context, bytes(file_bytes), "image/jpeg")

