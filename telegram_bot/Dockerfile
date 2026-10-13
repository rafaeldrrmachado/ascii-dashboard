# Lightweight container definition for PoupaLuz Telegram Bot
FROM python:3.11-slim

# Prevent Python from writing .pyc files & enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install dependencies
COPY telegram_bot/requirements.txt /app/telegram_bot/requirements.txt
RUN pip install --no-cache-dir -r /app/telegram_bot/requirements.txt

# Copy application files
COPY . /app

# Run bot
CMD ["python", "-m", "telegram_bot.main"]

