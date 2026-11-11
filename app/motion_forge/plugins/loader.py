from importlib.metadata import entry_points
import threading
from ..animations.presets import ANIMATIONS
from ..effects.registry import EFFECTS
from ..renderers.registry import RENDERERS
from ..effects import builtin
from ..renderers import builtin as builtin_renderers

_loaded=False
_lock=threading.Lock()

def load_plugins():
    """Load installed Python extensions; project JSON never executes Python code."""
    global _loaded
    with _lock:
        if not _loaded:
            for entry in entry_points(group='motion_forge.plugins'):
                entry.load()(animations=ANIMATIONS,effects=EFFECTS,renderers=RENDERERS)
            _loaded=True
