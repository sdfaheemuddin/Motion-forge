from typing import Protocol

class Plugin(Protocol):
    def __call__(self, *, animations, effects, renderers) -> None:
        """Register installed extension handlers using the supplied registries."""
