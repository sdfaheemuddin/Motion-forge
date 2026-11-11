from pathlib import Path
import sys
from .errors import MotionForgeError

def resource_directory(name):
    """Locate resources in a checkout, editable install, or installed wheel."""
    candidates = [Path(__file__).resolve().parents[3] / name,
                  Path(sys.prefix) / "share" / "motion-forge" / name]
    for candidate in candidates:
        if candidate.is_dir():
            return candidate
    raise MotionForgeError(f"Missing {name} resources. Reinstall Motion Forge with pip.")

def project_path(root, value):
    path = Path(value).expanduser()
    return path.resolve() if path.is_absolute() else (root / path).resolve()
