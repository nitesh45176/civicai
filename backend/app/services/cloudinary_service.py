import os
import uuid
from fastapi import UploadFile, HTTPException, status
from app.core.config import settings
from app.utils.validators import validate_image_file, ALLOWED_IMAGE_MIME_TYPES
from io import BytesIO
from PIL import Image, ImageOps

# Configure Cloudinary if credentials provided
is_cloudinary_configured = bool(
    settings.CLOUDINARY_CLOUD_NAME and
    settings.CLOUDINARY_API_KEY and
    settings.CLOUDINARY_API_SECRET
)

if is_cloudinary_configured:
    import cloudinary
    import cloudinary.uploader
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True
    )

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

async def upload_image(file: UploadFile) -> tuple[str, str]:
    """
    Validates, processes, and uploads image.
    Always saves locally for YOLO inference.
    Uploads to Cloudinary for display if configured.

    Returns:
        (display_url, local_url) — display_url is Cloudinary or local,
        local_url is always a /uploads/... path for YOLO.
    """
    validate_image_file(file, max_size_mb=settings.MAX_IMAGE_SIZE_MB)

    # Read content and check size
    contents = await file.read()

    # Convert browser formats such as AVIF/WebP to JPEG with EXIF orientation correction
    try:
        image = Image.open(BytesIO(contents))
        image = ImageOps.exif_transpose(image)
        image = image.convert("RGB")

        output = BytesIO()
        image.save(output, format="JPEG", quality=90)
        contents = output.getvalue()

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid image: {e}"
        )
    max_bytes = settings.MAX_IMAGE_SIZE_MB * 1024 * 1024
    if len(contents) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image size exceeds the maximum allowed limit of {settings.MAX_IMAGE_SIZE_MB}MB."
        )

    # Reset file pointer
    await file.seek(0)

    # Always save locally for YOLO inference
    filename = f"{uuid.uuid4().hex}.jpg"
    filepath = os.path.join(UPLOAD_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(contents)
    local_url = f"/uploads/{filename}"

    # If Cloudinary is configured, also upload for public display URL
    if is_cloudinary_configured:
        try:
            import cloudinary.uploader
            upload_result = cloudinary.uploader.upload(
                contents,
                folder="civicai/complaints",
                resource_type="image"
            )
            display_url = upload_result.get("secure_url") or upload_result.get("url")
            return display_url, local_url
        except Exception as e:
            print(f"[Warning] Cloudinary upload failed: {e}. Using local URL.")

    return local_url, local_url
