"""
Telegram command and message handlers package.
"""

from .start_handler import (
    start_command,
    help_command,
    privacy_command,
    how_to_switch_command,
    share_command,
    lang_command
)
from .file_handler import document_handler, photo_handler
from .manual_handler import manual_command, manual_callback_handler
from .callback_handler import callback_query_handler

__all__ = [
    "start_command",
    "help_command",
    "privacy_command",
    "how_to_switch_command",
    "share_command",
    "lang_command",
    "document_handler",
    "photo_handler",
    "manual_command",
    "manual_callback_handler",
    "callback_query_handler"
]

