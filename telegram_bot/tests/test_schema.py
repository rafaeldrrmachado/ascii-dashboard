"""
Unit tests for invoice schema validation and Portuguese normalization.
"""

import unittest
from telegram_bot.parsers.schema import InvoiceData


class TestSchema(unittest.TestCase):
    """Test suite for InvoiceData Pydantic validation."""

    def test_power_normalization(self):
        """Verifies kVA strings with commas or units are properly normalized."""
        inv1 = InvoiceData(contracted_power_kva="3,45 kVA")
        self.assertEqual(inv1.contracted_power_kva, 3.45)

        inv2 = InvoiceData(contracted_power_kva="6.90")
        self.assertEqual(inv2.contracted_power_kva, 6.90)

        # Closes to nearest BTN tier (e.g. 3.5 -> 3.45)
        inv3 = InvoiceData(contracted_power_kva=3.5)
        self.assertEqual(inv3.contracted_power_kva, 3.45)

    def test_cycle_normalization(self):
        """Verifies cycle strings are normalized to simple or dual."""
        inv1 = InvoiceData(cycle_type="Bi-horário")
        self.assertEqual(inv1.cycle_type, "dual")

        inv2 = InvoiceData(cycle_type="Tarifa Simples")
        self.assertEqual(inv2.cycle_type, "simple")

        inv3 = InvoiceData(cycle_type="vazio / fora de vazio")
        self.assertEqual(inv3.cycle_type, "dual")

    def test_kwh_normalization(self):
        """Verifies kWh strings with commas are normalized."""
        inv = InvoiceData(kwh_total="245,8 kWh")
        self.assertEqual(inv.kwh_total, 245.8)

    def test_currency_and_units_normalization(self):
        """Verifies euros, days, and rate strings with symbols are cleanly parsed."""
        inv = InvoiceData(
            billed_total_eur="52,40 €",
            period_days="30 dias",
            current_tf_daily="0,2891 €/dia",
            current_tv_rate="0,1540 €/kWh"
        )
        self.assertEqual(inv.billed_total_eur, 52.40)
        self.assertEqual(inv.period_days, 30)
        self.assertAlmostEqual(inv.current_tf_daily, 0.2891, places=4)
        self.assertAlmostEqual(inv.current_tv_rate, 0.1540, places=4)


if __name__ == "__main__":
    unittest.main()

