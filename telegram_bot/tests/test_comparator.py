"""
Unit tests for the Telegram bot comparator, bill calculations, and savings engine.
"""

import unittest
from pathlib import Path

from telegram_bot.parsers.schema import InvoiceData
from telegram_bot.comparator.tariff_service import TariffService
from telegram_bot.comparator.bill_calculator import calculate_pt_bill
from telegram_bot.comparator.savings_engine import SavingsEngine
from telegram_bot.templates import messages_pt, messages_en


class TestComparator(unittest.TestCase):
    """Test suite for Portuguese electricity calculation engine."""

    def setUp(self):
        self.tariff_service = TariffService()
        self.engine = SavingsEngine(self.tariff_service)

    def test_tariffs_loaded(self):
        """Verifies that official ERSE tariffs are loaded."""
        tariffs = self.tariff_service.get_tariffs()
        self.assertGreater(len(tariffs), 0, "Tariffs list should not be empty")

        # Must include regulated supplier (TUR)
        reg = self.tariff_service.get_regulated_tariff()
        self.assertIsNotNone(reg, "Regulated supplier TUR should exist")
        self.assertTrue(reg.get("is_regulated") or reg.get("com_code") == "TUR")

    def test_bill_calculation_simple(self):
        """Tests bill calculation under simple flat tariff."""
        reg = self.tariff_service.get_regulated_tariff()
        res = calculate_pt_bill(
            tariff=reg,
            power_kva=3.45,
            cycle_type="simple",
            kwh_total=190.0,
            period_days=30
        )
        self.assertIsNotNone(res)
        self.assertGreater(res.monthly_total, 25.0)
        self.assertLess(res.monthly_total, 60.0)
        self.assertAlmostEqual(res.annual_total, res.monthly_total * 12.0, places=2)
        # Check VAT
        self.assertGreater(res.total_vat, 0)
        self.assertEqual(res.cav, 2.85)

    def test_bill_calculation_dual(self):
        """Tests bill calculation under dual (bi-horário) tariff."""
        reg = self.tariff_service.get_regulated_tariff()
        res = calculate_pt_bill(
            tariff=reg,
            power_kva=6.90,
            cycle_type="dual",
            kwh_total=350.0,
            kwh_fv=210.0,
            kwh_v=140.0,
            period_days=30
        )
        self.assertIsNotNone(res)
        self.assertGreater(res.monthly_total, 40.0)
        self.assertLess(res.monthly_total, 110.0)

    def test_savings_engine_comparison(self):
        """Tests savings analysis when user has a high-cost bill."""
        # Simulated high-cost bill (e.g. 58€ for 190 kWh on 3.45 kVA)
        mock_invoice = InvoiceData(
            supplier="EDP Comercial",
            contracted_power_kva=3.45,
            cycle_type="simple",
            period_days=30,
            kwh_total=190.0,
            current_tf_daily=0.3500,
            current_tv_rate=0.2000,
            billed_total_eur=58.00
        )

        comparison = self.engine.compare_invoice(mock_invoice)
        self.assertIsNotNone(comparison)
        self.assertTrue(comparison.has_savings)
        self.assertGreater(comparison.monthly_savings, 5.0)
        self.assertGreater(comparison.annual_savings, 60.0)
        self.assertGreaterEqual(len(comparison.top_offers), 3)

        # Ensure best offer is cheaper than current bill
        self.assertLess(comparison.best_offer.monthly_total, comparison.current_monthly_cost)

        # Test card formatting (Portuguese)
        card_pt = messages_pt.format_comparison_card(comparison)
        self.assertIn("ANÁLISE DA TUA FATURA", card_pt)
        self.assertIn("MELHOR ALTERNATIVA", card_pt)

        # Test card formatting (English)
        card_en = messages_en.format_comparison_card(comparison)
        self.assertIn("ELECTRICITY INVOICE ANALYSIS", card_en)
        self.assertIn("BEST MARKET ALTERNATIVE", card_en)


if __name__ == "__main__":
    unittest.main()

