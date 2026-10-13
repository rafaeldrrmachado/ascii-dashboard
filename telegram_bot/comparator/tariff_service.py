"""
Tariff service managing access to verified ERSE retail electricity offers.
Loads and caches data/erse_tariffs.json and synchronizes when needed.
"""

import json
import logging
import time
from pathlib import Path
from typing import Dict, List, Optional

from ..config import TARIFFS_PATH, BASE_DIR

logger = logging.getLogger(__name__)


class TariffService:
    """Provides validated ERSE retail tariffs for all suppliers in Portugal."""

    def __init__(self, json_path: Optional[Path] = None):
        self.json_path = json_path or TARIFFS_PATH
        self._cache: Optional[Dict] = None
        self._cache_time: float = 0
        self._cache_ttl: float = 3600 # 1 hour

    def ensure_data(self) -> bool:
        """Ensures that data/erse_tariffs.json exists. Triggers sync if missing."""
        if self.json_path.exists():
            return True

        logger.info("Tariff dataset missing at %s. Attempting auto-sync...", self.json_path)
        try:
            from sync_erse_pt import sync_erse_tariffs
            sync_erse_tariffs()
            return self.json_path.exists()
        except Exception as e:
            logger.error("Failed to auto-sync ERSE tariffs: %s", e)
            return False

    def get_dataset(self) -> Optional[Dict]:
        """Loads and returns the ERSE tariffs JSON dictionary."""
        now = time.time()
        if self._cache and (now - self._cache_time < self._cache_ttl):
            return self._cache

        if not self.ensure_data():
            return None

        try:
            with open(self.json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            self._cache = data
            self._cache_time = now
            return data
        except Exception as e:
            logger.error("Error reading %s: %s", self.json_path, e)
            return None

    def get_tariffs(self) -> List[Dict]:
        """Returns list of all supplier tariffs."""
        data = self.get_dataset()
        if not data or "tariffs" not in data:
            return []
        return data["tariffs"]

    def get_regulated_tariff(self) -> Optional[Dict]:
        """Returns SU Eletricidade (TUR) regulated benchmark tariff."""
        for t in self.get_tariffs():
            if t.get("is_regulated") or t.get("com_code") == "TUR":
                return t
        tariffs = self.get_tariffs()
        return tariffs[0] if tariffs else None

