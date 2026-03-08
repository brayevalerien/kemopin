from io import BytesIO

from PIL import Image

MAX_EDGE = 2048
JPEG_QUALITY = 85


def _has_transparency(image: Image.Image) -> bool:
    if image.mode == "RGBA":
        extrema = image.getextrema()
        if len(extrema) >= 4:
            alpha_minimum = extrema[3][0]
            return alpha_minimum < 255
    return False


def process_image(data: bytes) -> tuple[bytes, str]:
    """Resize and compress an uploaded image.

    Args:
        data: Raw image bytes from the upload.

    Returns:
        Tuple of (processed_bytes, extension) where extension is
        ".png" for transparent images or ".jpg" otherwise.
    """
    image = Image.open(BytesIO(data))
    transparent = _has_transparency(image)

    width, height = image.size
    longest = max(width, height)
    if longest > MAX_EDGE:
        scale = MAX_EDGE / longest
        image = image.resize(
            (int(width * scale), int(height * scale)), Image.LANCZOS
        )

    buffer = BytesIO()
    if transparent:
        image.save(buffer, format="PNG", optimize=True)
        return buffer.getvalue(), ".png"
    else:
        if image.mode in ("RGBA", "P", "LA"):
            image = image.convert("RGB")
        image.save(buffer, format="JPEG", quality=JPEG_QUALITY)
        return buffer.getvalue(), ".jpg"
