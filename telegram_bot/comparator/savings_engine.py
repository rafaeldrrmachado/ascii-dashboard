"""
Savings Engine comparing invoice parameters against all active ERSE market offers.
Computes net savings, ranks top alternatives, and generates actionable advice.
"""

from dataclasses import dataclass
from typing import List, Optional

from ..parsers.schema import InvoiceData
from .bill_calculator import BillResult, calculate_pt_bill
from .tariff_service import TariffService


@dataclass
class ComparisonResult:
    """Complete market comparison summary for an invoice."""
    invoice: InvoiceData
    current_monthly_cost: float
    current_annual_cost: float
    best_offer: BillResult
    monthly_savings: float
    annual_savings: float
    has_savings: bool
    top_offers: List[BillResult]
    regulated_offer: Optional[BillResult]
    key_insights: List[str]


class SavingsEngine:
    """Analyzes invoice metrics against ERSE tariffs."""

    def __init__(self, tariff_service: Optional[TariffService] = None):
        self.tariff_service = tariff_service or TariffService()

    def compare_invoice(self, invoice: InvoiceData) -> Optional[ComparisonResult]:
        """Compares extracted invoice data against all available Portuguese tariffs."""
        tariffs = self.tariff_service.get_tariffs()
        if not tariffs:
            return None

        power = invoice.contracted_power_kva
        cycle = invoice.cycle_type
        kwh = invoice.kwh_total
        kwh_fv = invoice.kwh_fv
        kwh_v = invoice.kwh_v
        days = invoice.period_days or 30

        # Calculate bill for every active supplier in ERSE database
        calculated_offers: List[BillResult] = []
        regulated_offer: Optional[BillResult] = None

        for t in tariffs:
            res = calculate_pt_bill(
                tariff=t,
                power_kva=power,
                cycle_type=cycle,
                kwh_total=kwh,
                kwh_fv=kwh_fv,
                kwh_v=kwh_v,
                period_days=days
            )
            if res:
                calculated_offers.append(res)
                if res.is_regulated or res.com_code == "TUR":
                    regulated_offer = res

        if not calculated_offers:
            return None

        # Sort offers by lowest monthly cost
        calculated_offers.sort(key=lambda x: x.monthly_total)

        best_offer = calculated_offers[0]

        # Determine user's current baseline cost
        current_monthly = 0.0
        if invoice.billed_total_eur and invoice.billed_total_eur > 0:
            current_monthly = invoice.billed_total_eur * (30.0 / days)
        elif invoice.current_tf_daily and invoice.current_tv_rate:
            # Reconstruct current bill with Portuguese tax framework
            mock_tariff = {
                "supplier": invoice.supplier,
                "plan_name": "Contrato Atual",
                "rates": {
                    str(power): {
                        cycle: {
                            "tf": invoice.current_tf_daily,
                            "tv": invoice.current_tv_rate,
                            "tv_fora_vazio": invoice.current_tv_rate,
                            "tv_vazio": invoice.current_tv_rate
                        }
                    }
                }
            }
            mock_res = calculate_pt_bill(mock_tariff, power, cycle, kwh, kwh_fv, kwh_v, days)
            if mock_res:
                current_monthly = mock_res.monthly_total
        else:
            # Fallback to regulated market as baseline if invoice amount was unreadable
            if regulated_offer:
                current_monthly = regulated_offer.monthly_total
            else:
                current_monthly = best_offer.monthly_total

        current_annual = current_monthly * 12.0

        monthly_savings = max(0.0, current_monthly - best_offer.monthly_total)
        annual_savings = monthly_savings * 12.0
        has_savings = monthly_savings > 0.50 # Over 50 cents/month savings

        # Generate intelligent insights
        insights: List[str] = []

        # 1. Energy rate insight
        if invoice.current_tv_rate and best_offer.tv_rate_avg:
            diff_tv = invoice.current_tv_rate - best_offer.tv_rate_avg
            if diff_tv > 0.015:
                insights.append(
                    f"A tua energia custa {invoice.current_tv_rate:.4f} €/kWh, mas a melhor oferta do mercado está a {best_offer.tv_rate_avg:.4f} €/kWh (-{diff_tv*100:.1f} c€/kWh)."
                )

        # 2. Capacity term insight
        if invoice.current_tf_daily and best_offer.tf_daily:
            diff_tf = invoice.current_tf_daily - best_offer.tf_daily
            if diff_tf > 0.05:
                insights.append(
                    f"A tua potência contratada custa {invoice.current_tf_daily:.4f} €/dia vs {best_offer.tf_daily:.4f} €/dia na melhor oferta."
                )

        # 3. Cycle optimization insight
        if cycle == "simple" and kwh > 250:
            insights.append(
                "Dica: Para consumos acima de 250 kWh/mês, considera a tarifa Bi-horária caso consigas deslocar máquinas de lavar para a noite ou fim-de-semana."
            )

        # 4. Spot-indexed insight
        if best_offer.is_indexed:
            insights.append(
                "Nota: A oferta mais barata é indexada ao mercado grossista OMIE (o preço varia mensalmente com as cotações ibéricas)."
            )

        return ComparisonResult(
            invoice=invoice,
            current_monthly_cost=current_monthly,
            current_annual_cost=current_annual,
            best_offer=best_offer,
            monthly_savings=monthly_savings,
            annual_savings=annual_savings,
            has_savings=has_savings,
            top_offers=calculated_offers[:5],
            regulated_offer=regulated_offer,
            key_insights=insights
        )

