import os
import base64
import mimetypes
import json
from typing import Optional

from groq import Groq

from app.core.config import settings
from app.schemas.analyze import AIAnalyzeResult


UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "uploads",
)


SYSTEM_PROMPT = """
You are CivicAI Vision Analyzer, an expert civic infrastructure
and municipal issue classification AI.

Your job is to carefully inspect the uploaded image and identify
the SPECIFIC civic problem that is actually visible.

Do NOT give a generic answer such as:
"Civic Hazard / Municipal Issue"

Do NOT assume the issue is a pothole.

You must distinguish between different civic problems.

Examples:

- A hole/depression in asphalt -> pothole
- Accumulated garbage/waste -> garbage / waste accumulation
- Broken or non-functional streetlight -> streetlight
- Visible water escaping from a pipe -> water leakage
- Open/uncovered manhole -> open manhole
- Fallen tree blocking a road -> fallen tree
- Damaged footpath -> broken footpath
- Flooded/waterlogged road -> waterlogging
- Traffic signal malfunction -> traffic signal
- Exposed electrical wire -> electrical hazard

Use only information that is visually supported by the image.

Return ONLY valid JSON.

The JSON must have exactly these fields:

{
  "issue_type": "specific civic issue",
  "category": "one allowed category",
  "severity": "low | medium | high | critical",
  "safety_risk": true,
  "description": "factual description of what is visible",
  "complaint_title": "professional complaint title",
  "complaint_description": "actionable complaint description",
  "confidence_score": 0.0,
  "tags": ["tag1", "tag2", "tag3"]
}

Allowed categories:

- sanitation
- road_infrastructure
- electrical
- water_supply
- urban_safety
- traffic_management
- horticulture_and_parks
- stormwater_drainage
- animal_control
- general_infrastructure

Important:

1. Identify the SPECIFIC issue visible in the image.
2. Do not invent objects that are not visible.
3. Do not automatically classify everything as a pothole.
4. Do not automatically classify everything as general_infrastructure.
5. confidence_score must be between 0 and 1.
6. severity must be exactly one of:
   low, medium, high, critical.
7. safety_risk must be a boolean.
8. Return raw JSON only.
"""


def fallback_heuristic_analyzer(
    optional_text: Optional[str] = None,
    image_url: Optional[str] = None,
) -> AIAnalyzeResult:

    text = f"{optional_text or ''} {image_url or ''}".lower()

    if any(k in text for k in ["garbage", "trash", "waste", "dump", "debris", "bin", "litter"]):
        return AIAnalyzeResult(
            issue_type="Overflowing Waste Dump",
            category="sanitation",
            severity="medium",
            safety_risk=False,
            description="Municipal solid waste accumulation is reported.",
            complaint_title="Uncollected Municipal Solid Waste",
            complaint_description="Solid waste accumulation requires municipal sanitation inspection and clearance.",
        )

    if any(k in text for k in ["pothole", "crater", "asphalt", "road damage"]):
        return AIAnalyzeResult(
            issue_type="Road Pothole",
            category="road_infrastructure",
            severity="high",
            safety_risk=True,
            description="A road surface defect is reported.",
            complaint_title="Road Pothole Requires Repair",
            complaint_description="Road surface damage requires inspection and repair.",
        )

    if any(k in text for k in ["streetlight", "lamp", "electric", "wire", "bulb"]):
        return AIAnalyzeResult(
            issue_type="Streetlight / Electrical Issue",
            category="electrical",
            severity="high",
            safety_risk=True,
            description="An electrical or public lighting issue is reported.",
            complaint_title="Streetlight / Electrical Issue",
            complaint_description="Electrical infrastructure requires inspection.",
        )

    if any(k in text for k in ["water", "leak", "pipe", "burst", "sewage"]):
        return AIAnalyzeResult(
            issue_type="Water Leakage",
            category="water_supply",
            severity="high",
            safety_risk=True,
            description="A water-related infrastructure issue is reported.",
            complaint_title="Water Leakage Requires Repair",
            complaint_description="Water infrastructure requires urgent inspection and repair.",
        )

    return AIAnalyzeResult(
        issue_type="Unclassified Civic Issue",
        category="general_infrastructure",
        severity="medium",
        safety_risk=False,
        description="The image could not be reliably classified.",
        complaint_title="Civic Issue Requires Inspection",
        complaint_description="The reported civic issue requires field inspection.",
    )


async def _load_image_bytes(
    image_url: str,
) -> tuple[Optional[bytes], str]:

    supported_mimes = {
        "image/jpeg",
        "image/png",
        "image/webp",
    }

    try:

        # Base64 data URL
        if image_url.startswith("data:"):

            header, base64_str = image_url.split(",", 1)

            raw_mime = (
                header
                .split(";")[0]
                .replace("data:", "")
                .strip()
                .lower()
            )

            mime = (
                raw_mime
                if raw_mime in supported_mimes
                else "image/jpeg"
            )

            return base64.b64decode(base64_str), mime

        # Remote image
        if image_url.startswith(("http://", "https://")):

            import httpx

            async with httpx.AsyncClient(timeout=15.0) as client:

                response = await client.get(image_url)

                if response.status_code == 200:

                    raw_mime = (
                        response.headers
                        .get("content-type", "image/jpeg")
                        .split(";")[0]
                        .strip()
                        .lower()
                    )

                    mime = (
                        raw_mime
                        if raw_mime in supported_mimes
                        else "image/jpeg"
                    )

                    return response.content, mime

        # Local uploaded image
        filename = os.path.basename(image_url)

        local_path = os.path.join(
            UPLOAD_DIR,
            filename,
        )

        if os.path.exists(local_path):

            with open(local_path, "rb") as file:

                content = file.read()

            raw_mime, _ = mimetypes.guess_type(local_path)

            mime = (
                raw_mime
                if raw_mime in supported_mimes
                else "image/jpeg"
            )

            return content, mime

    except Exception as exc:

        print(
            f"[Warning] Failed to load image: {exc}"
        )

    return None, "image/jpeg"


async def analyze_image_with_llm(
    image_url: str,
    optional_text: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
) -> AIAnalyzeResult:

    if not settings.GROQ_API_KEY:

        print(
            "[Warning] GROQ_API_KEY not configured. "
            "Using fallback analyzer."
        )

        return fallback_heuristic_analyzer(
            optional_text,
            image_url,
        )

    image_bytes, mime_type = await _load_image_bytes(
        image_url
    )

    if not image_bytes:

        print(
            "[Warning] Could not load image."
        )

        return fallback_heuristic_analyzer(
            optional_text,
            image_url,
        )

    image_base64 = base64.b64encode(
        image_bytes
    ).decode("utf-8")

    image_data_url = (
        f"data:{mime_type};base64,{image_base64}"
    )

    prompt = f"""
{SYSTEM_PROMPT}

Citizen Description:
{optional_text or "None provided."}
"""

    if latitude is not None and longitude is not None:

        prompt += f"""

GPS Coordinates:
{latitude}, {longitude}
"""

    prompt += """

Now analyze the uploaded image.

Focus on the actual visual evidence.

Return ONLY the JSON object.
"""

    try:

        client = Groq(
            api_key=settings.GROQ_API_KEY
        )

        completion = (
            client.chat.completions.create(
                model=settings.GROQ_MODEL,

                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are CivicAI's "
                            "visual civic issue "
                            "classification system."
                        ),
                    },
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": prompt,
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": image_data_url
                                },
                            },
                        ],
                    },
                ],

                temperature=0.2,

                max_completion_tokens=1200,

                response_format={
                    "type": "json_object"
                },

                reasoning_effort="none",

                stream=False,
            )
        )

        text_response = (
            completion
            .choices[0]
            .message
            .content
        )

        print(
            "[AI] Groq response:",
            text_response,
        )

        parsed = json.loads(
            text_response
        )

        issue_type = str(
            parsed.get(
                "issue_type",
                "Unclassified Civic Issue",
            )
        ).strip()

        category = str(
            parsed.get(
                "category",
                "general_infrastructure",
            )
        ).strip().lower().replace(
            " ",
            "_",
        )

        allowed_categories = {
            "sanitation",
            "road_infrastructure",
            "electrical",
            "water_supply",
            "urban_safety",
            "traffic_management",
            "horticulture_and_parks",
            "stormwater_drainage",
            "animal_control",
            "general_infrastructure",
        }

        if category not in allowed_categories:

            print(
                f"[Warning] Invalid category from AI: {category}"
            )

            category = "general_infrastructure"

        severity = str(
            parsed.get(
                "severity",
                "medium",
            )
        ).lower().strip()

        if severity not in {
            "low",
            "medium",
            "high",
            "critical",
        }:

            severity = "medium"

        try:

            confidence = float(
                parsed.get(
                    "confidence_score",
                    0.5,
                )
            )

            confidence = max(
                0.0,
                min(1.0, confidence),
            )

        except (
            ValueError,
            TypeError,
        ):

            confidence = 0.5

        tags = parsed.get(
            "tags",
            [],
        )

        if not isinstance(tags, list):

            tags = []

        return AIAnalyzeResult(
            issue_type=issue_type,
            category=category,
            severity=severity,
            safety_risk=bool(
                parsed.get(
                    "safety_risk",
                    False,
                )
            ),
            description=str(
                parsed.get(
                    "description",
                    "Civic issue detected visually.",
                )
            ),
            complaint_title=str(
                parsed.get(
                    "complaint_title",
                    f"Report: {issue_type}",
                )
            )[:100],
            complaint_description=str(
                parsed.get(
                    "complaint_description",
                    "Civic issue requires municipal inspection.",
                )
            ),
        )

    except Exception as exc:

        print(
            f"[ERROR] Groq vision analysis failed: {exc}"
        )

        return fallback_heuristic_analyzer(
            optional_text,
            image_url,
        )