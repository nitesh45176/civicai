from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, Text, Float, Boolean, DateTime, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.authority import Authority
    from app.models.status_history import StatusHistory

class Complaint(Base):
    __tablename__ = "complaints"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    complaint_id: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    issue_type: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    severity: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    safety_risk: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    ai_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    complaint_title: Mapped[str] = mapped_column(String(255), nullable=False)
    complaint_description: Mapped[str] = mapped_column(Text, nullable=False)
    image_url: Mapped[str] = mapped_column(String(500), nullable=False)
    resolution_image_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    location_text: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    authority_id: Mapped[int] = mapped_column(
        ForeignKey("authorities.id"),
        nullable=False,
        index=True
    )
    status: Mapped[str] = mapped_column(String(50), default="SUBMITTED", index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

    sla_deadline: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True
    )

    last_escalation_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

    escalation_count: Mapped[int] = mapped_column(
        default=0,
        nullable=False
    )

    # Relationships
    authority: Mapped["Authority"] = relationship("Authority", back_populates="complaints")
    status_history: Mapped[List["StatusHistory"]] = relationship(
        "StatusHistory",
        back_populates="complaint",
        cascade="all, delete-orphan",
        order_by="StatusHistory.changed_at.asc()"
    )
