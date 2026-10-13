"""
Portuguese messages and report formatting templates for Telegram bot.
"""

from ..comparator.savings_engine import ComparisonResult


WELCOME_TEXT = """⚡ *Olá! Bem-vindo ao PoupaLuz Bot* 🇵🇹

Ajudo-te a descobrir se estás a pagar a mais na tua conta de eletricidade e qual é a melhor alternativa no mercado regulado pela ERSE.

📄 *Como funciona:*
1. Envia-me a tua última **fatura de eletricidade** (em ficheiro **PDF** ou **fotografia** do telemóvel).
2. A inteligência artificial lê os teus consumos (kWh e potência kVA).
3. Comparo o teu custo com todos os 10 comercializadores em Portugal (EDP, Endesa, Galp, Plenitude, SU Regulado, etc.).
4. Recebes imediatamente um relatório com quanto podes poupar!

🔒 *Privacidade Garantida:*
As faturas são analisadas na memória e descartadas de imediato. Não guardamos NIF, Nome, Morada nem dados bancários.

👉 *Envia o teu PDF ou foto agora*, ou clica em /manual para simular sem enviar ficheiro.
"""

HELP_TEXT = """ℹ️ *Ajuda & Dicas de Utilização*

📌 *Que faturas posso enviar?*
Qualquer fatura de eletricidade em Portugal:
• EDP Comercial
• Endesa
• Galp
• Iberdrola
• Goldenergy
• Plenitude
• Repsol
• SU Eletricidade (Mercado Regulado)
• Coopérnico, Luzboa, etc.

📸 *Dicas para fotografias:*
• Tira a foto com boa iluminação.
• Garante que a secção *"Dados do Contrato"* (potência kVA) e *"Detalhe do Consumo"* (kWh) estão bem visíveis.

⚙️ *Comandos disponíveis:*
/start - Iniciar ou reiniciar o bot
/manual - Simular inserindo potência e consumo manualmente
/privacidade - Saber como protegemos os teus dados
/comomudar - Guia passo-a-passo para mudar de comercializador
/partilhar - Enviar este bot a amigos e familiares
"""

PRIVACY_TEXT = """🔒 *Compromisso de Privacidade e Proteção de Dados (RGPD)*

1. *Zero Armazenamento de Faturas*:
Os ficheiros enviados (PDF ou imagem) são processados temporariamente na memória pela IA e eliminados imediatamente.

2. *Dados Pessoais Ignorados*:
O nosso extrator é programado para ignorar o teu Nome, Morada, NIF, IBAN e dados de faturação pessoal. Apenas recolhemos os valores técnicos:
• Potência Contratada (ex: 3.45 kVA)
• Ciclo Horário (Simples ou Bi-horário)
• Eletricidade consumida (kWh)
• Preço unitário (€/kWh e €/dia)

3. *Transparência*:
Todas as tarifas de comparação provêm da base de dados oficial e pública da ERSE (Entidade Reguladora dos Serviços Energéticos).
"""

HOW_TO_SWITCH_TEXT = """📝 *Guia: Como Mudar de Comercializador em Portugal*

Mudar de fornecedor de eletricidade em Portugal é simples, rápido e protegido por lei:

✅ *100% Gratuito:*
Não há qualquer custo de adesão nem penalização na grande maioria dos contratos domésticos.

💡 *Zero Cortes de Eletricidade:*
A rede física e os cabos continuam a pertencer à **E-Redes**. O fornecimento de energia nunca é interrompido.

📄 *O novo fornecedor trata de tudo:*
Não precisas de cancelar o contrato antigo. O novo comercializador rescinde automaticamente com o anterior.

⏱️ *Rápido:*
O processo demora habitualmente entre 1 e 3 dias úteis.

📋 *O que precisas para aderir ao novo fornecedor?*
1. O teu **CPE** (Código de Ponto de Entrega - começa por `PT0002...`, visível na fatura).
2. O teu **NIF** e Identificação.
3. O teu **IBAN** (para débito direto, se pretendido).
4. Uma leitura atual do contador.

🔗 Podes aderir diretamente no website do fornecedor escolhido ou através do simulador oficial da ERSE: https://simuladorprecos.erse.pt/
"""

SHARE_TEXT = """⚡ *Partilha o PoupaLuz Bot com os teus amigos!*

Muitas famílias em Portugal pagam mais 100€ a 200€ por ano na luz sem saberem.

👉 Envia-lhes este link no Telegram:
https://t.me/{bot_username}

Ou reencaminha esta mensagem! Eles só precisam de enviar a fatura em PDF ou foto para descobrirem a melhor tarifa.
"""


def format_comparison_card(res: ComparisonResult) -> str:
    """Formats the main comparison summary card in Telegram Markdown."""
    inv = res.invoice
    best = res.best_offer

    cycle_display = "Bi-horário" if inv.cycle_type == "dual" else "Simples"
    kwh_display = f"{inv.kwh_total:.0f} kWh" if inv.kwh_total > 0 else "N/D"

    # Current invoice breakdown
    current_eur_str = f"{res.current_monthly_cost:.2f} €/mês"

    # Savings header
    if res.has_savings:
        savings_headline = f"🎉 *POUPANÇA ESTIMADA:* \n👉 *+{res.monthly_savings:.2f} € / mês* (~ *{res.annual_savings:.2f} € / ano*)"
    else:
        savings_headline = "✅ *O teu contrato já tem uma das tarifas mais competitivas do mercado!*"

    # Best offer badges
    badges = []
    if best.green_energy:
        badges.append("🌱 100% Verde")
    if best.is_indexed:
        badges.append("📈 Indexado OMIE")
    if best.is_regulated:
        badges.append("🏛️ Regulado TUR")
    badge_str = f" ({', '.join(badges)})" if badges else ""

    # Top 3 list
    top_3_lines = []
    medals = ["🥇", "🥈", "🥉"]
    for i, offer in enumerate(res.top_offers[:3]):
        medal = medals[i] if i < len(medals) else f"{i+1}."
        diff = res.current_monthly_cost - offer.monthly_total
        diff_str = f"(-{diff:.2f} €)" if diff > 0.3 else f"(+{abs(diff):.2f} €)" if diff < -0.3 else "(=)"
        top_3_lines.append(f"{medal} *{offer.supplier}* :: {offer.monthly_total:.2f} €/mês {diff_str}")

    top_3_str = "\n".join(top_3_lines)

    # Insights section
    insights_str = ""
    if res.key_insights:
        insights_str = "\n\n💡 *Dicas e Observações:*\n" + "\n".join(f"• {ins}" for ins in res.key_insights)

    return f"""📊 *ANÁLISE DA TUA FATURA DE ELETRICIDADE*
══════════════════════════════════════
📍 *Fornecedor Atual:* {inv.supplier}
⚡ *Potência:* {inv.contracted_power_kva:.2f} kVA ({inv.period_days} dias)
🔋 *Consumo Faturado:* {kwh_display} ({cycle_display})
💶 *Custo Estimado Atual:* {current_eur_str}

🏆 *MELHOR ALTERNATIVA NO MERCADO:*
──────────────────────────────────────
🥇 *{best.supplier}* — _{best.plan_name}_{badge_str}
💰 *Novo Custo Estimado:* *{best.monthly_total:.2f} € / mês* (~ {best.annual_total:.2f} €/ano)

{savings_headline}

📋 *TOP 3 FORNECEDORES RECOMENDADOS:*
{top_3_str}{insights_str}

_Tarifas oficiais verificadas da ERSE (simuladorprecos.erse.pt). Inclui IVA, CAV, IEC e DGEG._"""


def format_top_offers_list(res: ComparisonResult) -> str:
    """Formats full top 5 offers list."""
    lines = ["📊 *TOP 5 MELHORES TARIFAS DO MERCADO ERSE:*\n"]
    for i, offer in enumerate(res.top_offers[:5]):
        diff = res.current_monthly_cost - offer.monthly_total
        diff_str = f"Poupança: *+{diff:.2f} €/mês*" if diff > 0.5 else f"*+{abs(diff):.2f} €/mês mais caro*" if diff < -0.5 else "*Preço equivalente*"

        tag = " [Regulado]" if offer.is_regulated else (" [Indexado OMIE]" if offer.is_indexed else "")
        lines.append(
            f"*{i+1}. {offer.supplier}*{tag}\n"
            f"• Plano: _{offer.plan_name}_\n"
            f"• Custo estimado: *{offer.monthly_total:.2f} €/mês* ({offer.annual_total:.2f} €/ano)\n"
            f"• Potência: {offer.tf_daily:.4f} €/dia · Energia: {offer.tv_rate_avg:.4f} €/kWh\n"
            f"• {diff_str}\n"
        )

    lines.append("_Valores com todos os impostos regulamentares em Portugal._")
    return "\n".join(lines)

