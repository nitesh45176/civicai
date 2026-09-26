from typing import Optional
from pydantic import BaseModel
from app.schemas.authority import AuthoritySimple

class LocationSimple(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class AIAnalyzeResult(BaseModel):
    issue_type: str
    category: str
    severity: str
    safety_risk: bool
    description: str
    complaint_title: str
    complaint_description: str
    confidence_score: float = 0.0
    tags: list[str] = []

class AnalyzeResponse(BaseModel):
    issue_type: str
    category: str
    severity: str
    safety_risk: bool
    description: str
    complaint_title: str
    complaint_description: str
    authority: AuthoritySimple
    location: Optional[LocationSimple] = None
    image_url: str
    cv_detection: Optional[dict] = None
    classification_source: str
