"""
Multimodal Vision AI Invoice Parser using Google Gemini Flash API.
Extracts structured contract terms, consumption, and rates from Portuguese electricity bills.
Supports both PDF documents and image photos/scans (JPEG, PNG, WEBP).
"""

import base64
import json
import logging
from typing import Optional, Tuple
import httpx

from ..config import GEMINI_API_KEY, GEMINI_MODEL, get_ssl_context
from .schema import InvoiceData

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Você é um assistente especialista em faturas de eletricidade em Portugal (EDP Comercial, Endesa, Galp, Iberdrola, Goldenergy, Plenitude, Repsol, SU Eletricidade, Coopérnico, Luzboa, etc.).
O seu objetivo é analisar a imagem ou documento PDF da fatura de eletricidade e extrair EXCLUSIVAMENTE os dados contratuais e técnicos de consumo em formato JSON.

REGRAS ESTRITAS DE PRIVACIDADE:
- NUNCA extraia dados pessoais: Não recolha NIF, Nome do cliente, Morada, IBAN ou dados bancários.

CAMPOS A EXTRAIR:
1. "supplier": Nome do comercializador de energia (ex: "EDP Comercial", "Endesa", "Galp", "Goldenergy", "Iberdrola", "Plenitude", "Repsol", "SU Eletricidade").
2. "contracted_power_kva": Potência contratada em kVA (valores típicos em Portugal: 1.15, 2.30, 3.45, 4.60, 5.75, 6.90, 10.35). Número float.
3. "cycle_type": Ciclo horário: "simple" se for tarifa Simples (preço único), ou "dual" se for Bi-horário (horas de vazio e fora de vazio/cheias/ponta).
4. "period_days": Número de dias faturados no período (geralmente entre 28 e 33 dias, padrão 30). Inteiro.
5. "kwh_total": Consumo total faturado em kWh durante o período. Float.
6. "kwh_fv": Se bi-horário, kWh consumidos em Fora de Vazio (Cheias + Ponta). Se simples, null.
7. "kwh_v": Se bi-horário, kWh consumidos em Horas de Vazio. Se simples, null.
8. "current_tf_daily": Termo fixo / preço da potência diário em €/dia (ex: 0.2891). Se a fatura mostrar em €/mês ou o total dos dias, calcule o valor unitário em €/dia.
9. "current_tv_rate": Preço da energia simples em €/kWh (ex: 0.1650). Se bi-horário, pode ser a média ponderada ou null.
10. "billed_total_eur": Valor total faturado a pagar em Euros (€) com todos os impostos e taxas incluídos.
11. "confidence_score": Confiança da leitura entre 0.0 e 1.0.
12. "notes": Resumo curto em português (ex: "Fatura EDP Comercial de 30 dias com consumo de 190 kWh em tarifa simples").

Responda ESTRITAMENTE com o objeto JSON correspondente."""


async def parse_invoice_with_vision(
    file_bytes: bytes,
    mime_type: str = "application/pdf"
) -> Tuple[Optional[InvoiceData], Optional[str]]:
    """
    Sends file bytes (PDF or Image) to Gemini Flash Vision API and returns validated InvoiceData.
    Returns: (InvoiceData, error_message)
    """
    if not GEMINI_API_KEY:
        return None, (
            "⚠️ A chave GEMINI_API_KEY não está configurada no bot.\n\n"
            "Podes obter uma chave 100% gratuita em https://aistudio.google.com "
            "e adicioná-la ao ficheiro .env. Em alternativa, usa o comando /manual."
        )

    # Normalize mime_type
    mime_type_clean = mime_type.lower().split(";")[0].strip()
    if mime_type_clean not in ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"]:
        if "pdf" in mime_type_clean:
            mime_type_clean = "application/pdf"
        elif "png" in mime_type_clean:
            mime_type_clean = "image/png"
        else:
            mime_type_clean = "image/jpeg"

    # Encode file in base64
    b64_data = base64.b64encode(file_bytes).decode("utf-8")

    models_to_try = [GEMINI_MODEL]
    for fallback in ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemini-3-flash-preview", "gemini-3.8-flash"]:
        if fallback and fallback not in models_to_try:
            models_to_try.append(fallback)

    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "inline_data": {
                            "mime_type": mime_type_clean,
                            "data": b64_data
                        }
                    },
                    {
                        "text": SYSTEM_PROMPT
                    }
                ]
            }
        ],
        "generationConfig": {
            "response_mime_type": "application/json",
            "temperature": 0.1
        }
    }

    try:
        ssl_ctx = get_ssl_context()
        async with httpx.AsyncClient(verify=ssl_ctx, timeout=35.0) as client:
            last_error_code = None
            last_error_text = ""

            for model_name in models_to_try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={GEMINI_API_KEY}"
                resp = await client.post(url, json=payload)

                if resp.status_code == 200:
                    res_json = resp.json()
                    candidates = res_json.get("candidates", [])
                    if not candidates:
                        return None, "❌ Não foi possível ler o documento. Certifica-te de que a imagem ou PDF está nítida."

                    content_parts = candidates[0].get("content", {}).get("parts", [])
                    if not content_parts:
                        return None, "❌ A IA não devolveu resposta legível."

                    raw_text = content_parts[0].get("text", "").strip()
                    # Clean possible markdown wrap
                    if raw_text.startswith("```json"):
                        raw_text = raw_text[7:]
                    if raw_text.startswith("```"):
                        raw_text = raw_text[3:]
                    if raw_text.endswith("```"):
                        raw_text = raw_text[:-3]

                    parsed_raw = json.loads(raw_text.strip())

                    # Handle list responses e.g. [{"supplier": "EDP..."}]
                    if isinstance(parsed_raw, list):
                        if not parsed_raw:
                            return None, "❌ A IA não encontrou dados estruturados na fatura."
                        parsed_dict = parsed_raw[0] if isinstance(parsed_raw[0], dict) else {}
                    elif isinstance(parsed_raw, dict):
                        # Handle possible wrappers e.g. {"invoice": {...}} or {"data": {...}}
                        if "invoice" in parsed_raw and isinstance(parsed_raw["invoice"], dict):
                            parsed_dict = parsed_raw["invoice"]
                        elif "data" in parsed_raw and isinstance(parsed_raw["data"], dict):
                            parsed_dict = parsed_raw["data"]
                        elif "result" in parsed_raw and isinstance(parsed_raw["result"], dict):
                            parsed_dict = parsed_raw["result"]
                        else:
                            parsed_dict = parsed_raw
                    else:
                        return None, "❌ Formato inesperado de dados da fatura."

                    if not isinstance(parsed_dict, dict) or not parsed_dict:
                        return None, "❌ Não foi possível extrair os dados da fatura em formato adequado."

                    try:
                        invoice = InvoiceData.model_validate(parsed_dict)
                        return invoice, None
                    except Exception as val_err:
                        logger.error("Pydantic validation error: %s on data: %s", val_err, parsed_dict)
                        return None, "❌ Erro ao validar os dados extraídos da fatura. Certifica-te de que a fatura é legível."

                if resp.status_code == 429:
                    return None, "⏳ Limite temporário da API excedido. Por favor, aguarda 30 segundos e tenta novamente."

                last_error_code = resp.status_code
                last_error_text = resp.text
                logger.warning(
                    "Gemini Vision model '%s' returned HTTP %d. Detail: %s",
                    model_name,
                    resp.status_code,
                    resp.text[:200]
                )

                # Retry next fallback model if deprecated (404) or overloaded (503)
                if resp.status_code in (404, 503):
                    continue
                else:
                    break

            logger.error("Gemini Vision API error %s: %s", last_error_code, last_error_text)
            return None, f"❌ Erro na análise visual por IA (Código {last_error_code}). Verifica se a tua chave Gemini API é válida."

    except httpx.TimeoutException:
        return None, "⏱️ O tempo de resposta expirou. O ficheiro pode ser muito pesado ou a ligação está lenta. Tenta uma foto mais leve ou em formato JPG."
    except json.JSONDecodeError as e:
        logger.error("JSON decode error from Gemini: %s", e)
        return None, "❌ Erro ao formatar os dados extraídos da fatura."
    except Exception as e:
        logger.exception("Unexpected error in parse_invoice_with_vision: %s", e)
        return None, f"❌ Ocorreu um erro inesperado ao analisar a fatura: {str(e)}"

