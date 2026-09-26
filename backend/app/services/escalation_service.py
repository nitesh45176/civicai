from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.complaint import Complaint
from app.models.authority import Authority
from app.services.email_service import send_email


ESCALATION_INTERVAL_DAYS = 30


def process_overdue_complaints(db: Session) -> int:
    """
    Find unresolved complaints whose SLA deadline has passed
    and send an escalation email when appropriate.

    Returns the number of emails successfully sent.
    """

    now = datetime.now()
    escalation_cutoff = now - timedelta(days=ESCALATION_INTERVAL_DAYS)

    statement = (
        select(Complaint, Authority)
        .join(Authority, Complaint.authority_id == Authority.id)
        .where(
            Complaint.sla_deadline.is_not(None),
            Complaint.sla_deadline < now,
            Complaint.status != "RESOLVED",
            Authority.is_active.is_(True),
            Authority.email.is_not(None),
        )
    )

    results = db.execute(statement).all()

    sent_count = 0

    for complaint, authority in results:

        # Prevent repeated emails on every scheduler run.
        if (
            complaint.last_escalation_at is not None
            and complaint.last_escalation_at > escalation_cutoff
        ):
            continue

        subject = (
            f"CivicAI SLA Escalation - "
            f"{complaint.complaint_id}"
        )

        body = f"""
Dear {authority.name},

This is an automated CivicAI escalation regarding an unresolved civic complaint.

Complaint ID: {complaint.complaint_id}
Issue: {complaint.issue_type}
Severity: {complaint.severity}
Location: {complaint.location_text or "Not available"}

SLA Deadline:
{complaint.sla_deadline}

Current Status:
{complaint.status}

The complaint has exceeded its configured resolution SLA.

Please review and take the necessary action.

Regards,
CivicAI
"""

        success = send_email(
            to_email=authority.email,
            subject=subject,
            body=body.strip(),
        )

        if success:
            complaint.last_escalation_at = now
            complaint.escalation_count += 1
            sent_count += 1

    db.commit()

    return sent_count