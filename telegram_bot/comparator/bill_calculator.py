"""
Portuguese residential electricity bill calculator (Baixa Tensão Normal - BTN).
Calculates exact capacity charges, energy costs, and official Portuguese taxes
(IVA tiered 6%/23%, CAV, IEC, DGEG) matching ERSE simulation methodology.
"""

from dataclasses import dataclass
from typing import Dict, Optional


@dataclass
class BillResult:
    """Detailed calculation result for a supplier tariff."""
    supplier: str
    plan_name: str
    com_code: str
    is_regulated: bool
    is_indexed: bool
    green_energy: bool
    power_kva: float
    cycle_type: str
    tf_daily: float
    tv_rate_avg: float
    capacity_cost: float
    energy_cost: float
    cav: float
    dgeg: float
    iec: float
    total_vat: float
    subtotal_no_vat: float
    period_total: float
    monthly_total: float
    annual_total: float
    website: str


def calculate_pt_bill(
    tariff: Dict,
    power_kva: float,
    cycle_type: str,
    kwh_total: float,
    kwh_fv: Optional[float] = None,
    kwh_v: Optional[float] = None,
    period_days: int = 30
) -> Optional[BillResult]:
    """
    Calculates low-voltage residential electricity bill for Portugal.
    """
    rates_dict = tariff.get("rates", {})
    if not rates_dict:
        return None

    # Find closest power tier in rates
    str_power = f"{power_kva:.2f}"
    if str_power not in rates_dict:
        # Fallback to standard tiers
        available_powers = [float(k) for k in rates_dict.keys()]
        if not available_powers:
            return None
        closest_p = min(available_powers, key=lambda x: abs(x - power_kva))
        str_power = f"{closest_p:.2f}"
        if str_power not in rates_dict:
            str_power = str(closest_p)

    power_plan = rates_dict.get(str_power)
    if not power_plan:
        return None

    # Determine rate plan (simple vs dual)
    clean_cycle = "dual" if cycle_type == "dual" else "simple"
    rate_details = power_plan.get(clean_cycle)
    if not rate_details:
        # Fallback to simple if dual is not present
        rate_details = power_plan.get("simple")
        clean_cycle = "simple"
        if not rate_details:
            return None

    days = max(1, period_days)

    # 1. Capacity term (Termo Fixo)
    tf_daily = float(rate_details.get("tf", 0.0))
    capacity_cost = tf_daily * days

    # 2. Energy term (Termo Variável)
    energy_cost = 0.0
    tv_avg = 0.0

    if clean_cycle == "simple":
        tv = float(rate_details.get("tv", 0.0))
        energy_cost = kwh_total * tv
        tv_avg = tv
    else:
        tv_fv = float(rate_details.get("tv_fora_vazio", 0.0))
        tv_v = float(rate_details.get("tv_vazio", 0.0))

        if kwh_fv is not None and kwh_v is not None and (kwh_fv + kwh_v) > 0:
            energy_cost = (kwh_fv * tv_fv) + (kwh_v * tv_v)
        else:
            # Standard ERSE residential profile: 60% Fora Vazio (day/peak), 40% Vazio (night/weekend)
            calc_fv = kwh_total * 0.60
            calc_v = kwh_total * 0.40
            energy_cost = (calc_fv * tv_fv) + (calc_v * tv_v)

        tv_avg = (energy_cost / kwh_total) if kwh_total > 0 else tv_fv

    # 3. Regulated levies
    cav = 2.85 * (days / 30.0) # Contribuição Audiovisual
    dgeg = 0.07 * (days / 30.0) # Taxa de exploração DGEG
    iec = kwh_total * 0.001 # Imposto Especial de Consumo (0.001 €/kWh)

    # 4. Portuguese VAT (IVA) calculation (Decreto-Lei n.º 60/2019)
    # For power <= 6.90 kVA, first 100 kWh/month is taxed at 6%. Remainder taxed at 23%.
    # CAV is taxed at 6%.
    # Capacity term (TF), remaining energy, DGEG and IEC are taxed at 23%.
    monthly_equivalent_factor = 30.0 / days
    monthly_kwh = kwh_total * monthly_equivalent_factor

    reduced_kwh_monthly = min(monthly_kwh, 100.0)
    reduced_kwh_period = (reduced_kwh_monthly / monthly_equivalent_factor)
    standard_kwh_period = max(0.0, kwh_total - reduced_kwh_period)

    energy_vat_6 = (reduced_kwh_period * tv_avg) * 0.06
    energy_vat_23 = (standard_kwh_period * tv_avg) * 0.23
    capacity_vat_23 = capacity_cost * 0.23
    levies_vat_23 = (dgeg + iec) * 0.23
    cav_vat_6 = cav * 0.06

    total_vat = energy_vat_6 + energy_vat_23 + capacity_vat_23 + levies_vat_23 + cav_vat_6

    subtotal_no_vat = capacity_cost + energy_cost + cav + dgeg + iec
    period_total = subtotal_no_vat + total_vat

    # Monthly and annual projections
    monthly_total = period_total * (30.0 / days)
    annual_total = monthly_total * 12.0

    return BillResult(
        supplier=tariff.get("supplier", "Desconhecido"),
        plan_name=tariff.get("plan_name", "Eletricidade"),
        com_code=tariff.get("com_code", ""),
        is_regulated=bool(tariff.get("is_regulated", False)),
        is_indexed=bool(tariff.get("is_indexed", False)),
        green_energy=bool(tariff.get("green_energy", False)),
        power_kva=power_kva,
        cycle_type=clean_cycle,
        tf_daily=tf_daily,
        tv_rate_avg=tv_avg,
        capacity_cost=capacity_cost,
        energy_cost=energy_cost,
        cav=cav,
        dgeg=dgeg,
        iec=iec,
        total_vat=total_vat,
        subtotal_no_vat=subtotal_no_vat,
        period_total=period_total,
        monthly_total=monthly_total,
        annual_total=annual_total,
        website=tariff.get("website", "https://simuladorprecos.erse.pt/")
    )

