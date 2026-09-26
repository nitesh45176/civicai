import smtplib
from email.message import EmailMessage

from app.core.config import settings


def send_email(
    to_email: str,
    subject: str,
    body: str,
) -> bool:
    if not all([
        settings.SMTP_HOST,
        settings.SMTP_USERNAME,
        settings.SMTP_PASSWORD,
        settings.SMTP_FROM_EMAIL,
    ]):
        print("SMTP is not configured. Email skipped.")
        return False

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.SMTP_FROM_EMAIL
    message["To"] = to_email
    message.set_content(body)

    try:
        with smtplib.SMTP(
            settings.SMTP_HOST,
            settings.SMTP_PORT,
            timeout=20,
        ) as server:

            if settings.SMTP_USE_TLS:
                server.starttls()

            server.login(
                settings.SMTP_USERNAME,
                settings.SMTP_PASSWORD,
            )

            server.send_message(message)

        return True

    except Exception as exc:
        print(f"Failed to send email: {exc}")
        return False