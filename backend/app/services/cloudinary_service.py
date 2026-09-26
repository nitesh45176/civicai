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

async def upload_image(file: UploadFile) -> str:
    """
    Validates and uploads image to Cloudinary.
    Falls back to local file storage if Cloudinary credentials are not configured.
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

    # If Cloudinary is configured, upload to Cloudinary
    if is_cloudinary_configured:
        try:
            import cloudinary.uploader
            upload_result = cloudinary.uploader.upload(
                contents,
                folder="civicai/complaints",
                resource_type="image"
            )
            return upload_result.get("secure_url") or upload_result.get("url")
        except Exception as e:
            # Fallback to local storage if Cloudinary API call fails
            print(f"[Warning] Cloudinary upload failed: {e}. Falling back to local storage.")

    # Local storage fallback
    extension = ALLOWED_IMAGE_MIME_TYPES.get(file.content_type, ".jpg")
    filename = f"{uuid.uuid4().hex}{extension}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    with open(filepath, "wb") as f:
        f.write(contents)

    # Return local static URL path
    return f"/uploads/{filename}"
