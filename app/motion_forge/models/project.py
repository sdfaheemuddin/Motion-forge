from dataclasses import dataclass, field
from pathlib import Path

@dataclass
class Project:
    """Validated project data shared by CLI, Python API and HTTP API."""
    root: Path
    document: dict
    assets: dict
    branding: dict
    scenes: dict
    timeline: dict
    export: dict
    sources: dict = field(default_factory=dict)

    layouts: dict = field(default_factory=dict)
    compositions: dict = field(default_factory=dict)

    @property
    def canvas_size(self):
        canvas = self.document['canvas']
        return canvas['width'], canvas['height']

    @property
    def duration(self):
        return self.document['timeline']['duration']

    @property
    def fps(self):
        return self.document['timeline']['fps']

    @property
    def frame_count(self):
        return round(self.duration * self.fps)
