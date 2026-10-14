"""
Configuration module for the Telegram Electricity Analyzer Bot.
Loads environment variables and sets project-wide defaults.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root or telegram_bot directory
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")
load_dotenv(Path(__file__).resolve().parent / ".env")

# Telegram Bot Credentials
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()

# Gemini Vision AI Credentials (free tier at https://aistudio.google.com)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite").strip()

# ERSE Tariffs Database Path
DEFAULT_TARIFFS_PATH = BASE_DIR / "data" / "erse_tariffs.json"
TARIFFS_PATH = Path(os.getenv("TARIFFS_PATH", str(DEFAULT_TARIFFS_PATH)))

# Default Locale ('pt' or 'en')
DEFAULT_LANGUAGE = os.getenv("DEFAULT_LANGUAGE", "pt").strip().lower()

# Verification / Sanity check
def check_config():
    missing = []
    if not TELEGRAM_BOT_TOKEN:
        missing.append("TELEGRAM_BOT_TOKEN (Obtain from @BotFather on Telegram)")
    if not GEMINI_API_KEY:
        missing.append("GEMINI_API_KEY (Free at https://aistudio.google.com - required for reading invoice files)")
    return missing


def get_ssl_context():
    """
    Returns an SSL context that trusts both the system CA bundle and Windows/enterprise
    root certificates (essential when running behind corporate proxies or SSL inspection).
    Can be bypassed if SSL_VERIFY=false is configured in .env.
    """
    import ssl
    ssl_verify_env = os.getenv("SSL_VERIFY", "true").strip().lower()
    if ssl_verify_env in ("false", "0", "no"):
        return False

    try:
        ctx = ssl.create_default_context()
        ctx.load_default_certs()
        return ctx
    except Exception:
        return True


