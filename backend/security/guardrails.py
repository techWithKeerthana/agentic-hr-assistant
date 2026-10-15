import re
import logging

logger = logging.getLogger(__name__)

INJECTION_PATTERNS = [
    r"ignore\s+(previous|all|prior)\s+instructions?",
    r"system\s+prompt",
    r"you\s+are\s+now",
    r"reveal\s+(your|the)\s+",
    r"act\s+as\s+(if|a|an|though)",
    r"jailbreak",
    r"disregard\s+(your|all)",
    r"forget\s+(your|all|previous)",
    r"pretend\s+(you|to)",
    r"override\s+(your|the|all)",
    r"new\s+persona",
    r"DAN\s+mode",
    r"developer\s+mode",
    r"do\s+anything\s+now",
    r"unlimited\s+power",
    r"<\s*script",
    r"<\s*iframe",
    r"javascript\s*:",
    r"eval\s*\(",
    r"exec\s*\(",
]

MAX_INPUT_LENGTH = 2000
EMAIL_PATTERN = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")


def check_injection(message: str) -> bool:
    msg_lower = message.lower()
    for pattern in INJECTION_PATTERNS:
        if re.search(pattern, msg_lower, re.IGNORECASE):
            logger.warning("Injection pattern detected in input")
            return True
    return False


def sanitize_input(message: str) -> str:
    # Truncate to max length
    message = message[:MAX_INPUT_LENGTH]
    # Remove null bytes
    message = message.replace("\x00", "")
    # Collapse excessive whitespace
    message = re.sub(r"\s{10,}", " ", message)
    return message.strip()


def validate_email(email: str) -> bool:
    return bool(EMAIL_PATTERN.match(email.strip()))


def validate_booking_input(name: str, email: str, slot_id: str) -> dict:
    errors = []
    if not name or len(name.strip()) < 2:
        errors.append("Name must be at least 2 characters")
    if not email or not validate_email(email):
        errors.append("Invalid email address format")
    if not slot_id or not slot_id.startswith("s"):
        errors.append("Invalid slot ID")
    return {"valid": len(errors) == 0, "errors": errors}


def mask_pii(text: str) -> str:
    # Mask email addresses in log output
    text = re.sub(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", "[EMAIL]", text)
    return text
