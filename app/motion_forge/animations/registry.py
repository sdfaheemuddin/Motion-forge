from ..utils.errors import MotionForgeError

class Registry:
    """Shared extension registry for named animation and effect implementations."""
    def __init__(self):
        self.handlers = {}
        self.properties = {}

    def register(self, name, handler, properties=None):
        if name in self.handlers:
            raise MotionForgeError(f"Duplicate registered extension '{name}'")
        self.handlers[name] = handler
        self.properties[name] = set(properties or [])

    def get(self, name):
        if name not in self.handlers:
            raise MotionForgeError(f"Unknown extension '{name}'. Available: {', '.join(self.handlers)}")
        return self.handlers[name]
