from datetime import datetime, timedelta, timezone


# Prototype SLA policy for CivicAI.
# These values are configurable product rules, not official government mandates.
SLA_HOURS = {
    "damaged_electrical": 24,
    "fallen_tree": 24,
    "garbage": 72,
    "pothole": 168,
    "other": 336,
}


def get_sla_hours(issue_type: str, severity: str) -> int:
    """
    Return the SLA duration in hours for a complaint.

    Critical/high severity issues get a shorter response window.
    """
    normalized_issue = issue_type.strip().lower().replace(" ", "_")
    normalized_severity = severity.strip().lower()

    hours = SLA_HOURS.get(normalized_issue, SLA_HOURS["other"])

    if normalized_severity == "critical":
        hours = min(hours, 24)
    elif normalized_severity == "high":
        hours = min(hours, 48)

    return hours


def calculate_sla_deadline(
    created_at: datetime,
    issue_type: str,
    severity: str,
) -> datetime:
    """Calculate when the complaint's SLA expires."""
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)

    return created_at + timedelta(
        hours=get_sla_hours(issue_type, severity)
    )