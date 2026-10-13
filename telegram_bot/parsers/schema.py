"""
Pydantic data models for structured electricity invoice extraction and validation.
"""

from typing import Optional
from pydantic import BaseModel, Field, field_validator


class InvoiceData(BaseModel):
    """
    Normalized contractual and consumption data extracted from a Portuguese electricity bill.
    """
    supplier: str = Field(
        default="Desconhecido",
        description="Name of the electricity retailer (e.g., EDP Comercial, Endesa, Galp, Goldenergy, Iberdrola, Plenitude, Repsol, SU Eletricidade)."
    )
    contracted_power_kva: float = Field(
        default=3.45,
        description="Contracted electrical power in kVA (standard BTN tiers: 1.15, 2.30, 3.45, 4.60, 5.75, 6.90, 10.35, 13.80, 17.25, 20.70)."
    )
    cycle_type: str = Field(
        default="simple",
        description="Hourly billing cycle: 'simple' (flat rate) or 'dual' (bi-horário / peak and off-peak)."
    )
    period_days: int = Field(
        default=30,
        description="Number of billing days in the invoice period (typically between 28 and 33 days)."
    )
    kwh_total: float = Field(
        default=0.0,
        description="Total electricity consumption in kilowatt-hours (kWh) for the billing period."
    )
    kwh_fv: Optional[float] = Field(
        default=None,
        description="kWh consumed outside off-peak hours (Fora de Vazio: Cheias + Ponta) if cycle is dual/bi-horário."
    )
    kwh_v: Optional[float] = Field(
        default=None,
        description="kWh consumed during off-peak hours (Vazio / night and weekends) if cycle is dual/bi-horário."
    )
    current_tf_daily: Optional[float] = Field(
        default=None,
        description="Capacity daily fee in €/day (Termo Fixo de Potência) charged by current supplier."
    )
    current_tv_rate: Optional[float] = Field(
        default=None,
        description="Simple energy rate in €/kWh (Termo de Energia) charged by current supplier."
    )
    billed_total_eur: Optional[float] = Field(
        default=None,
        description="Total invoice amount to pay in Euros (€) including all taxes and charges."
    )
    confidence_score: float = Field(
        default=1.0,
        description="Extraction confidence from 0.0 to 1.0."
    )
    notes: Optional[str] = Field(
        default=None,
        description="Additional context or notes observed on the invoice."
    )

    @field_validator("cycle_type", mode="before")
    @classmethod
    def normalize_cycle(cls, val):
        if not val:
            return "simple"
        v = str(val).lower().strip()
        if "bi" in v or "dual" in v or "vazio" in v:
            return "dual"
        return "simple"

    @field_validator("contracted_power_kva", mode="before")
    @classmethod
    def normalize_power(cls, val):
        if val is None:
            return 3.45
        try:
            # Handle comma decimal strings (e.g. "3,45 kVA")
            clean_str = str(val).lower().replace(",", ".").replace("kva", "").strip()
            f = float(clean_str)
            # Match to standard Portuguese BTN power tiers
            valid_tiers = [1.15, 2.30, 3.45, 4.60, 5.75, 6.90, 10.35, 13.80, 17.25, 20.70]
            closest = min(valid_tiers, key=lambda x: abs(x - f))
            return closest
        except Exception:
            return 3.45

    @field_validator("kwh_total", mode="before")
    @classmethod
    def normalize_kwh(cls, val):
        if val is None:
            return 0.0
        try:
            clean_str = str(val).lower().replace(",", ".").replace("kwh", "").strip()
            return float(clean_str)
        except Exception:
            return 0.0

