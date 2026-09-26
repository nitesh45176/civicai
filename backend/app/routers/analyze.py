from typing import Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.analyze import AnalyzeResponse, LocationSimple
from app.schemas.authority import AuthoritySimple
from app.services.cloudinary_service import upload_image
from app.services.ai_service import analyze_image_with_llm
from app.services.authority_service import resolve_or_create_authority
from app.utils.validators import validate_coordinates
from app.services.cv_service import detect_civic_issue


CV_CONFIDENCE_THRESHOLD = 0.60

CV_CATEGORY_MAP = {
    "pothole": {
        "issue_type": "pothole",
        "category": "road_infrastructure",
    },
    "garbage": {
        "issue_type": "garbage",
        "category": "sanitation",
    },
    "fallen_tree": {
        "issue_type": "fallen_tree",
        "category": "horticulture_and_parks",
    },
    "damaged_electrical": {
        "issue_type": "damaged_electrical",
        "category": "electrical",
    },
}


router = APIRouter(prefix="/analyze", tags=["Analyze"])

@router.post(
    "",
    response_model=AnalyzeResponse,
    status_code=status.HTTP_200_OK,
    summary="Analyze civic hazard photo using Vision AI and route authority"
)
async def analyze_civic_issue(
    image: UploadFile = File(..., description="Photographic evidence of civic problem"),
    latitude: Optional[float] = Form(None, description="GPS Latitude (-90 to 90)"),
    longitude: Optional[float] = Form(None, description="GPS Longitude (-180 to 180)"),
    optional_text: Optional[str] = Form(None, description="Optional citizen context notes"),
    db: Session = Depends(get_db),
):
    """
    1. Validates image and GPS coordinates.
    2. Uploads image to secure Cloudinary storage.
    3. Runs multimodal AI vision analysis.
    4. Deterministically maps category to responsible municipal authority.
    5. Returns analysis proposal without creating a database complaint record.
    """
    # 1. Validate coordinates if provided
    validate_coordinates(latitude, longitude)

    # 2. Upload image (always saved locally for YOLO, optionally to Cloudinary for display)
    image_url, local_image_url = await upload_image(image)

    cv_result = detect_civic_issue(local_image_url)
    print("[CV] Detection:", cv_result)
    
    # 3. Analyze with Multimodal AI
    ai_result = await analyze_image_with_llm(
    image_url=image_url,
    optional_text=optional_text,
    latitude=latitude,
    longitude=longitude
)

    # Use specialized CV classification when confidence is high.
    final_issue_type = ai_result.issue_type
    final_category = ai_result.category
    classification_source = "groq"

    if cv_result["confidence"] >= CV_CONFIDENCE_THRESHOLD:
        cv_mapping = CV_CATEGORY_MAP.get(cv_result["category"])

        if cv_mapping:
            final_issue_type = cv_mapping["issue_type"]
            final_category = cv_mapping["category"]
            classification_source = "cv"

            print(
                f"[HYBRID] Using CV classification: "
                f"{final_issue_type} ({cv_result['confidence']:.2f})"
            )
        else:
            print("[HYBRID] CV detected unknown mapping; using Groq classification.")
    else:
        print(
            f"[HYBRID] CV confidence too low "
            f"({cv_result['confidence']:.2f}); using Groq classification."
        )

    # 4. Deterministically resolve or retrieve authority
    authority = resolve_or_create_authority(
        db=db,
        issue_type=final_issue_type,
        category=final_category
    )

    # 5. Assemble and return response
    return AnalyzeResponse(
        issue_type=final_issue_type,
        category=final_category,
        severity=ai_result.severity,
        safety_risk=ai_result.safety_risk,
        description=ai_result.description,
        complaint_title=ai_result.complaint_title,
        complaint_description=ai_result.complaint_description,
        authority=AuthoritySimple(
            id=authority.id,
            name=authority.name,
            department=authority.department
        ),
        location=LocationSimple(latitude=latitude, longitude=longitude) if (latitude or longitude) else None,
        image_url=image_url,
        cv_detection=cv_result,
        classification_source=classification_source,
    )
