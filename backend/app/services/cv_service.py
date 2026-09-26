from io import BytesIO
from pathlib import Path
import urllib.request

from PIL import Image, ImageOps
from ultralytics import YOLO


BASE_DIR = Path(__file__).resolve().parents[2]
MODEL_PATH = BASE_DIR / "models" / "civicai_yolo11n_best.pt"
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


CLASS_NAMES = {
    0: "pothole",
    1: "garbage",
    2: "fallen_tree",
    3: "damaged_electrical",
}


model = YOLO(str(MODEL_PATH))


def _resolve_image_path(image_url: str) -> Path:
    """
    Convert the local URL or remote Cloudinary URL returned by upload_image()
    into an actual filesystem path for YOLO inference.
    """
    if image_url.startswith("http://") or image_url.startswith("https://"):
        clean_url = image_url.split("?")[0]
        filename = Path(clean_url).name
        if not filename or not any(
            filename.lower().endswith(ext)
            for ext in [".jpg", ".jpeg", ".png", ".webp"]
        ):
            filename = f"remote_{abs(hash(image_url))}.jpg"

        image_path = UPLOAD_DIR / filename
        if not image_path.exists():
            req = urllib.request.Request(
                image_url,
                headers={"User-Agent": "Mozilla/5.0"},
            )
            with urllib.request.urlopen(req) as resp:
                data = resp.read()

            image = Image.open(BytesIO(data))
            image = ImageOps.exif_transpose(image)
            image = image.convert("RGB")
            image.save(image_path, format="JPEG", quality=90)

        return image_path

    filename = Path(image_url).name
    image_path = UPLOAD_DIR / filename

    if not image_path.exists():
        raise FileNotFoundError(
            f"Uploaded image not found: {image_path}"
        )

    return image_path


import torch


def detect_civic_issue(
    image_url: str,
    confidence_threshold: float = 0.40,
) -> dict:
    """
    Run CivicAI YOLO11n detection on a locally uploaded image or Cloudinary URL.
    """
    try:
        image_path = _resolve_image_path(image_url)

        with torch.no_grad():
            results = model.predict(
                source=str(image_path),
                conf=confidence_threshold,
                device="cpu",
                verbose=False,
            )

        result = results[0]

        detections = []

        if result.boxes is not None:
            for box in result.boxes:
                class_id = int(box.cls[0])
                confidence = float(box.conf[0])

                detections.append(
                    {
                        "category": CLASS_NAMES.get(
                            class_id,
                            "unknown",
                        ),
                        "confidence": round(confidence, 4),
                        "bbox": [
                            round(float(value), 2)
                            for value in box.xyxy[0].tolist()
                        ],
                    }
                )

        detections.sort(
            key=lambda detection: detection["confidence"],
            reverse=True,
        )

        if not detections:
            return {
                "category": "unknown",
                "confidence": 0.0,
                "bbox": None,
                "detections": [],
            }

        top_detection = detections[0]

        return {
            "category": top_detection["category"],
            "confidence": top_detection["confidence"],
            "bbox": top_detection["bbox"],
            "detections": detections,
        }
    except Exception as err:
        print(f"[Warning] CV detection failed: {err}")
        return {
            "category": "unknown",
            "confidence": 0.0,
            "bbox": None,
            "detections": [],
        }