"""
English messages and report formatting templates for Telegram bot.
"""

from ..comparator.savings_engine import ComparisonResult


WELCOME_TEXT = """⚡ *Welcome to PoupaLuz Bot* 🇵🇹

I help you discover if you are overpaying on your electricity bill in Portugal and find the best alternative from the official ERSE database.

📄 *How it works:*
1. Send me your latest **electricity invoice** (as a **PDF file** or **mobile photo**).
2. AI vision analyzes your consumption (kWh and contracted power in kVA).
3. I compare your costs against all 10 retail suppliers in Portugal (EDP, Endesa, Galp, Plenitude, Regulated SU, etc.).
4. You receive an instant savings report!

🔒 *Guaranteed Privacy:*
Invoices are processed in-memory and deleted immediately. We never store your NIF, Name, Address or bank details.

👉 *Send your PDF or photo now*, or tap /manual to simulate without uploading a file.
"""

HELP_TEXT = """ℹ️ *Help & Tips*

📌 *What bills are supported?*
Any low-voltage domestic electricity bill in Portugal:
• EDP Comercial, Endesa, Galp, Iberdrola, Goldenergy, Plenitude, Repsol, SU Eletricidade, Coopérnico, Luzboa, etc.

📸 *Photo tips:*
• Ensure good lighting without reflections.
• Make sure the "Contract Data" (kVA power) and "Consumption Details" (kWh) are clear.

⚙️ *Available commands:*
/start - Start or restart the bot
/manual - Simulate by entering power and kWh manually
/privacy - Learn about our zero-retention privacy policy
/howtoswitch - Step-by-step guide on switching suppliers in Portugal
/share - Share this bot with friends and family
"""

PRIVACY_TEXT = """🔒 *Privacy & GDPR Commitment*

1. *Zero File Storage*:
Uploaded files (PDF or photos) are parsed in-memory by Vision AI and deleted immediately.

2. *Personal Identifiers Ignored*:
Our extractor ignores customer names, addresses, NIF, and IBAN numbers. Only technical parameters are extracted:
• Contracted Power (e.g. 3.45 kVA)
• Hourly cycle (Simple or Dual)
• Electricity consumed (kWh)
• Unit rates (€/kWh and €/day)

3. *Independent Verification*:
All competitor tariffs come directly from the official regulatory database of ERSE (simuladorprecos.erse.pt).
"""

HOW_TO_SWITCH_TEXT = """📝 *Guide: How to Switch Electricity Suppliers in Portugal*

Switching electricity suppliers in Portugal is 100% free and protected by law:

✅ *Zero Cost:*
No switching fees and no lock-in periods on standard domestic contracts.

💡 *No Energy Cuts:*
The physical grid and wires continue to be managed by **E-Redes**. Power is never cut off.

📄 *The new provider handles everything:*
You do not need to contact your old supplier. The new company handles contract termination automatically.

⏱️ *Fast:*
The switch usually takes between 1 and 3 business days.

📋 *What you need to sign up:*
1. Your **CPE** code (starts with `PT0002...`, visible on your bill).
2. Your **NIF** and ID document.
3. Your **IBAN** for direct debit.
4. An up-to-date meter reading.
"""

SHARE_TEXT = """⚡ *Share PoupaLuz Bot with your friends!*

Many families in Portugal overpay 100€ to 200€ every year on electricity without realizing it.

👉 Send them this Telegram link:
https://t.me/{bot_username}
"""


def format_comparison_card(res: ComparisonResult) -> str:
    """Formats the main comparison summary card in English."""
    inv = res.invoice
    best = res.best_offer

    cycle_display = "Bi-hourly (Peak/Off-Peak)" if inv.cycle_type == "dual" else "Simple (Flat)"
    kwh_display = f"{inv.kwh_total:.0f} kWh" if inv.kwh_total > 0 else "N/A"
    current_eur_str = f"{res.current_monthly_cost:.2f} €/mo"

    if res.has_savings:
        savings_headline = f"🎉 *ESTIMATED SAVINGS:* \n👉 *+{res.monthly_savings:.2f} € / month* (~ *{res.annual_savings:.2f} € / year*)"
    else:
        savings_headline = "✅ *Your contract is already among the most competitive on the market!*"

    badges = []
    if best.green_energy:
        badges.append("🌱 100% Green")
    if best.is_indexed:
        badges.append("📈 OMIE Spot Indexed")
    if best.is_regulated:
        badges.append("🏛️ Regulated TUR")
    badge_str = f" ({', '.join(badges)})" if badges else ""

    top_3_lines = []
    medals = ["🥇", "🥈", "🥉"]
    for i, offer in enumerate(res.top_offers[:3]):
        medal = medals[i] if i < len(medals) else f"{i+1}."
        diff = res.current_monthly_cost - offer.monthly_total
        diff_str = f"(-{diff:.2f} €)" if diff > 0.3 else f"(+{abs(diff):.2f} €)" if diff < -0.3 else "(=)"
        top_3_lines.append(f"{medal} *{offer.supplier}* :: {offer.monthly_total:.2f} €/mo {diff_str}")

    top_3_str = "\n".join(top_3_lines)

    insights_str = ""
    if res.key_insights:
        insights_str = "\n\n💡 *Notes:*\n" + "\n".join(f"• {ins}" for ins in res.key_insights)

    return f"""📊 *ELECTRICITY INVOICE ANALYSIS*
══════════════════════════════════════
📍 *Current Supplier:* {inv.supplier}
⚡ *Contracted Power:* {inv.contracted_power_kva:.2f} kVA ({inv.period_days} days)
🔋 *Consumption:* {kwh_display} ({cycle_display})
💶 *Estimated Current Cost:* {current_eur_str}

🏆 *BEST MARKET ALTERNATIVE:*
──────────────────────────────────────
🥇 *{best.supplier}* — _{best.plan_name}_{badge_str}
💰 *Estimated New Bill:* *{best.monthly_total:.2f} € / month* (~ {best.annual_total:.2f} €/year)

{savings_headline}

📋 *TOP 3 RECOMMENDED SUPPLIERS:*
{top_3_str}{insights_str}

_Verified official tariffs from ERSE (simuladorprecos.erse.pt). Includes all PT taxes (VAT, CAV, IEC, DGEG)._"""


def format_top_offers_list(res: ComparisonResult) -> str:
    """Formats full top 5 offers list in English."""
    lines = ["📊 *TOP 5 ERSE MARKET ELECTRICITY OFFERS:*\n"]
    for i, offer in enumerate(res.top_offers[:5]):
        diff = res.current_monthly_cost - offer.monthly_total
        diff_str = f"Savings: *+{diff:.2f} €/mo*" if diff > 0.5 else f"*+{abs(diff):.2f} €/mo more expensive*" if diff < -0.5 else "*Equal price*"

        tag = " [Regulated]" if offer.is_regulated else (" [Indexed OMIE]" if offer.is_indexed else "")
        lines.append(
            f"*{i+1}. {offer.supplier}*{tag}\n"
            f"• Plan: _{offer.plan_name}_\n"
            f"• Estimated cost: *{offer.monthly_total:.2f} €/mo* ({offer.annual_total:.2f} €/year)\n"
            f"• Power: {offer.tf_daily:.4f} €/day · Energy: {offer.tv_rate_avg:.4f} €/kWh\n"
            f"• {diff_str}\n"
        )

    lines.append("_Values include all mandatory taxes in Portugal._")
    return "\n".join(lines)

