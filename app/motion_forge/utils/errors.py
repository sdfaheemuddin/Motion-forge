class MotionForgeError(Exception):
    """An actionable project, dependency or rendering error."""

class ValidationError(MotionForgeError):
    def __init__(self, errors):
        self.errors = list(errors)
        super().__init__("Project validation failed:\n" + "\n".join(f"- {error}" for error in self.errors))
