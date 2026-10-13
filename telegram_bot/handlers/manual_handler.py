"""
Manual guided questionnaire handler allowing simulation without uploading an invoice.
"""

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes

from ..parsers.schema import InvoiceData
from ..comparator.savings_engine import SavingsEngine
from .start_handler import get_template

savings_engine = SavingsEngine()


async def manual_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Entry point for /manual simulation flow."""
    context.user_data["manual_flow"] = {}

    keyboard = [
        [
            InlineKeyboardButton("3.45 kVA (Típico T1-T2)", callback_data="manual_p_3.45"),
            InlineKeyboardButton("4.60 kVA (Típico T3)", callback_data="manual_p_4.60")
        ],
        [
            InlineKeyboardButton("6.90 kVA (Família / AC)", callback_data="manual_p_6.90"),
            InlineKeyboardButton("10.35 kVA (Bomba / VE)", callback_data="manual_p_10.35")
        ]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    text = """⚡ *Simulação Manual (Passo 1 de 3)*

Qual é a tua **potência contratada** (kVA)?
_(Podes consultar no disjuntor da entrada ou na fatura antiga)_"""

    if update.callback_query:
        await update.callback_query.edit_message_text(text, parse_mode="Markdown", reply_markup=reply_markup)
    else:
        await update.message.reply_text(text, parse_mode="Markdown", reply_markup=reply_markup)


async def manual_callback_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Processes interactive steps of the manual simulation flow."""
    query = update.callback_query
    await query.answer()
    data = query.data

    flow = context.user_data.setdefault("manual_flow", {})

    # Step 1: Power chosen
    if data.startswith("manual_p_"):
        power_val = float(data.replace("manual_p_", ""))
        flow["power"] = power_val

        keyboard = [
            [
                InlineKeyboardButton("Simples (Preço único 24h)", callback_data="manual_c_simple"),
                InlineKeyboardButton("Bi-horário (Vazio + Fora Vazio)", callback_data="manual_c_dual")
            ]
        ]
        text = f"""⚡ *Simulação Manual (Passo 2 de 3)*

Potência selecionada: *{power_val:.2f} kVA*

Qual é o teu **ciclo horário**?"""
        await query.edit_message_text(text, parse_mode="Markdown", reply_markup=InlineKeyboardMarkup(keyboard))
        return

    # Step 2: Cycle chosen
    if data.startswith("manual_c_"):
        cycle_val = "dual" if "dual" in data else "simple"
        flow["cycle"] = cycle_val
        cycle_name = "Bi-horário" if cycle_val == "dual" else "Simples"

        keyboard = [
            [
                InlineKeyboardButton("100 kWh/mês (1 pessoa)", callback_data="manual_k_100"),
                InlineKeyboardButton("160 kWh/mês (Casal)", callback_data="manual_k_160")
            ],
            [
                InlineKeyboardButton("325 kWh/mês (Família 3-4)", callback_data="manual_k_325"),
                InlineKeyboardButton("460 kWh/mês (Elevado / VE)", callback_data="manual_k_460")
            ]
        ]
        text = f"""⚡ *Simulação Manual (Passo 3 de 3)*

Potência: *{flow.get('power', 3.45):.2f} kVA*
Ciclo: *{cycle_name}*

Qual é o teu **consumo mensal aproximado**?"""
        await query.edit_message_text(text, parse_mode="Markdown", reply_markup=InlineKeyboardMarkup(keyboard))
        return

    # Step 3: Consumption chosen -> Run calculation!
    if data.startswith("manual_k_"):
        kwh_val = float(data.replace("manual_k_", ""))
        flow["kwh"] = kwh_val

        power = flow.get("power", 3.45)
        cycle = flow.get("cycle", "simple")

        invoice = InvoiceData(
            supplier="Estimativa Média de Mercado",
            contracted_power_kva=power,
            cycle_type=cycle,
            period_days=30,
            kwh_total=kwh_val,
            billed_total_eur=None # Will be benchmarked vs Regulated
        )

        res = savings_engine.compare_invoice(invoice)
        if not res:
            await query.edit_text("❌ Erro ao calcular ofertas da ERSE.", parse_mode="Markdown")
            return

        context.user_data["last_comparison"] = res
        tpl = get_template(context)

        report_text = tpl.format_comparison_card(res)

        keyboard = [
            [
                InlineKeyboardButton("📊 Ver Top 5 Ofertas", callback_data="view_top_5"),
                InlineKeyboardButton("📝 Como Mudar", callback_data="how_to_switch")
            ],
            [
                InlineKeyboardButton("🔄 Repetir Simulação", callback_data="start_manual"),
                InlineKeyboardButton("📤 Partilhar Bot", callback_data="share_bot")
            ]
        ]
        await query.edit_message_text(
            report_text,
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup(keyboard),
            disable_web_page_preview=True
        )

