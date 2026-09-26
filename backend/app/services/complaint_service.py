from datetime import datetime, timezone
from typing import Optional, List, Tuple

from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, desc
from fastapi import HTTPException, status
import os

from app.models.complaint import Complaint
from app.models.authority import Authority
from app.models.status_history import StatusHistory
from app.schemas.complaint import ComplaintCreate
from app.schemas.status import StatusEnum
from app.utils.complaint_id import generate_complaint_id
from app.services.sla_service import calculate_sla_deadline


def _add_sla_status(complaint: Complaint) -> Complaint:
    """
    Adds computed SLA information to the complaint object.

    The actual database fields remain unchanged.
    This function dynamically attaches:
      - sla_status
      - hours_remaining
    """

    complaint.sla_status = "NO_SLA"
    complaint.hours_remaining = None

    if not complaint.sla_deadline:
        return complaint

    # SQLite returns naive datetimes in the current setup,
    # so use a naive UTC/local-compatible datetime here.
    now = datetime.now()

    # Normalize timezone-aware deadline if necessary.
    deadline = complaint.sla_deadline
    if deadline.tzinfo is not None:
        deadline = deadline.replace(tzinfo=None)

    seconds_remaining = (
        deadline - now
    ).total_seconds()

    complaint.hours_remaining = round(
        seconds_remaining / 3600,
        1,
    )

    if complaint.status == StatusEnum.RESOLVED.value:
        complaint.sla_status = "RESOLVED"

    elif seconds_remaining <= 0:
        complaint.sla_status = "BREACHED"

    elif seconds_remaining <= 24 * 3600:
        complaint.sla_status = "DUE_SOON"

    else:
        complaint.sla_status = "ON_TRACK"

    return complaint


def create_complaint(
    db: Session,
    complaint_data: ComplaintCreate
) -> Complaint:
    """Creates an official civic complaint and records the initial SUBMITTED status history."""

    # Verify authority exists
    authority = (
        db.query(Authority)
        .filter(Authority.id == complaint_data.authority_id)
        .first()
    )

    if not authority:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                f"Authority with id "
                f"{complaint_data.authority_id} does not exist."
            )
        )

    # Generate unique formatted complaint ID
    # Example: CIV-2026-XXXXX
    complaint_id_str = generate_complaint_id(db)

    now = datetime.now(timezone.utc)

    sla_deadline = calculate_sla_deadline(
        created_at=now,
        issue_type=complaint_data.issue_type,
        severity=complaint_data.severity,
    )

    complaint = Complaint(
        complaint_id=complaint_id_str,
        issue_type=complaint_data.issue_type,
        category=complaint_data.category,
        severity=complaint_data.severity,
        safety_risk=complaint_data.safety_risk,
        ai_description=complaint_data.ai_description,
        complaint_title=complaint_data.complaint_title,
        complaint_description=complaint_data.complaint_description,
        image_url=complaint_data.image_url,
        latitude=complaint_data.latitude,
        longitude=complaint_data.longitude,
        location_text=complaint_data.location_text,
        authority_id=complaint_data.authority_id,
        status=StatusEnum.SUBMITTED.value,
        created_at=now,
        updated_at=now,
        sla_deadline=sla_deadline,
        escalation_count=0,
    )

    db.add(complaint)
    db.flush()

    # Create initial status history entry
    initial_history = StatusHistory(
        complaint_id=complaint.id,
        status=StatusEnum.SUBMITTED.value,
        note=(
            "Complaint logged by citizen and routed "
            "to responsible municipal department."
        ),
        changed_at=now
    )

    db.add(initial_history)
    db.commit()

    # Re-fetch with eager loaded relationships
    complaint = (
        db.query(Complaint)
        .options(
            joinedload(Complaint.authority),
            joinedload(Complaint.status_history)
        )
        .filter(Complaint.id == complaint.id)
        .first()
    )

    return _add_sla_status(complaint)


def get_complaints(
    db: Session,
    status_filter: Optional[str] = None,
    severity_filter: Optional[str] = None,
    category_filter: Optional[str] = None,
    authority_id: Optional[int] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 10
) -> Tuple[List[Complaint], int]:
    """Retrieves paginated complaints with optional filtering and search."""

    query = db.query(Complaint).options(
        joinedload(Complaint.authority),
        joinedload(Complaint.status_history)
    )

    if status_filter and status_filter.upper() != "ALL":
        query = query.filter(
            Complaint.status == status_filter.upper()
        )

    if severity_filter and severity_filter.lower() != "all":
        query = query.filter(
            Complaint.severity.ilike(severity_filter)
        )

    if category_filter and category_filter.lower() != "all":
        query = query.filter(
            Complaint.category.ilike(category_filter)
        )

    if authority_id is not None:
        query = query.filter(
            Complaint.authority_id == authority_id
        )

    if search:
        search_term = f"%{search.strip()}%"

        query = query.filter(
            or_(
                Complaint.complaint_id.ilike(search_term),
                Complaint.complaint_title.ilike(search_term),
                Complaint.complaint_description.ilike(search_term),
                Complaint.issue_type.ilike(search_term),
                Complaint.location_text.ilike(search_term),
            )
        )

    total = query.count()

    offset = max(
        0,
        (page - 1) * limit
    )

    items = (
        query
        .order_by(desc(Complaint.created_at))
        .offset(offset)
        .limit(limit)
        .all()
    )

    # Add computed SLA information
    for complaint in items:
        _add_sla_status(complaint)

    return items, total


def get_complaint_by_id(
    db: Session,
    identifier: str
) -> Optional[Complaint]:
    """
    Retrieves complaint by numeric ID or formatted complaint_id string.
    Example: CIV-2026-XXXXX
    """

    query = db.query(Complaint).options(
        joinedload(Complaint.authority),
        joinedload(Complaint.status_history)
    )

    if identifier.isdigit():
        complaint = (
            query
            .filter(Complaint.id == int(identifier))
            .first()
        )

        if complaint:
            return _add_sla_status(complaint)

    complaint = (
        query
        .filter(Complaint.complaint_id.ilike(identifier))
        .first()
    )

    if complaint:
        return _add_sla_status(complaint)

    return None


def update_complaint_status(
    db: Session,
    identifier: str,
    new_status: str,
    note: Optional[str] = None,
    resolution_image: Optional[str] = None
) -> Complaint:
    """Updates complaint status and appends an auditable record to status_history."""

    complaint = get_complaint_by_id(
        db,
        identifier
    )

    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Complaint '{identifier}' was not found."
        )

    # Validate status against allowed enum
    norm_status = new_status.upper().strip()

    allowed_statuses = {
        s.value for s in StatusEnum
    }

    if norm_status not in allowed_statuses:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Invalid status '{new_status}'. "
                f"Allowed statuses: "
                f"{', '.join(allowed_statuses)}"
            )
        )

    # Update complaint
    now = datetime.now(timezone.utc)

    complaint.status = norm_status
    complaint.updated_at = now

    # Handle resolution image
    if resolution_image:

        if resolution_image.startswith("data:image/"):

            try:
                from app.services.cloudinary_service import (
                    is_cloudinary_configured,
                    UPLOAD_DIR
                )

                if is_cloudinary_configured:

                    try:
                        import cloudinary.uploader

                        upload_res = cloudinary.uploader.upload(
                            resolution_image,
                            folder="civicai/resolutions",
                            resource_type="image"
                        )

                        complaint.resolution_image_url = (
                            upload_res.get("secure_url")
                            or upload_res.get("url")
                        )

                    except Exception as cloud_err:
                        print(
                            "[Warning] "
                            f"Cloudinary resolution image upload failed: "
                            f"{cloud_err}"
                        )

                # Fallback to local storage
                if not complaint.resolution_image_url:

                    import base64
                    import uuid

                    header, encoded = resolution_image.split(
                        ",",
                        1
                    )

                    ext = ".jpg"

                    if "png" in header:
                        ext = ".png"

                    elif "webp" in header:
                        ext = ".webp"

                    file_bytes = base64.b64decode(
                        encoded
                    )

                    filename = (
                        f"resolution_"
                        f"{uuid.uuid4().hex}"
                        f"{ext}"
                    )

                    filepath = os.path.join(
                        UPLOAD_DIR,
                        filename
                    )

                    with open(filepath, "wb") as f:
                        f.write(file_bytes)

                    complaint.resolution_image_url = (
                        f"/uploads/{filename}"
                    )

            except Exception as e:

                print(
                    "[Warning] "
                    f"Failed to decode resolution image data URL: "
                    f"{e}"
                )

                complaint.resolution_image_url = resolution_image

        else:
            complaint.resolution_image_url = resolution_image

    # Record history entry
    default_notes = {
        "SUBMITTED": (
            "Complaint submitted to civic registry."
        ),
        "ASSIGNED": (
            "Dispatched to department inspector "
            "and ward response unit."
        ),
        "IN_PROGRESS": (
            "Field crew dispatched and remediation "
            "work active."
        ),
        "RESOLVED": (
            "Issue verified resolved and closed "
            "by municipal supervisor."
        ),
    }

    history_entry = StatusHistory(
        complaint_id=complaint.id,
        status=norm_status,
        note=(
            note
            or default_notes.get(
                norm_status,
                f"Status changed to {norm_status}."
            )
        ),
        changed_at=now
    )

    db.add(history_entry)

    db.commit()
    db.refresh(complaint)

    # Recalculate SLA status after status update
    return _add_sla_status(complaint)