# PVInsight — Blueprint to Reality template

A self-contained, 40-second, 1920 × 1080, 24 fps silent video template. It includes the PV trackers, BESS, substation, transmission lines, data center and site as separate transparent PNGs, plus blueprint path assets and transparent company logos.

The energy point makes one continuous trip with glow and a trail. The closing message is:

FROM GENERATION TO GRID.
ENGINEERING EVERY CONNECTION.

## Run directly

From the repository root after installation:

```powershell
motion-forge validate templates/pvinsight-blueprint/project.json
motion-forge preview templates/pvinsight-blueprint/project.json --time 34
motion-forge render templates/pvinsight-blueprint/project.json
```

On Windows you can also use:

```powershell
.\render.bat templates\pvinsight-blueprint\project.json
```

The default export is `output/pvinsight-blueprint-template/pvinsight-blueprint-template.mp4`. This is separate from the original example project's output.

## Create another project

Copy this entire directory into `projects/my-video`. The assets and configuration references are local to the template, so it does not depend on the original project directory. Then edit:

- `project.json`: ID, name, canvas, duration and frame rate.
- `assets.json` and `assets/`: image/path/font/media sources.
- `branding.json`: palette, logo ID and text styles.
- `layouts/infrastructure.json`: reusable logo/text positions, viewport and navigation styles.
- `scenes/*.json`: seven scenes with text values, active navigation and focus rectangles.
- `compositions/world.json`: shared equipment, images, paths and effects.
- `timeline.json`: scene durations, continuous animation tracks and the energy route.
- `export.json`: output filename, directory and encoding settings.

Choose a distinct export filename/directory when creating a project. Replacing an image with a different size may require changing its scene position, scale or anchor. The included placement metadata records the original asset layout; composition JSON contains the actual rendered transforms.

Blender is not needed to render the included assets. The existing optional generator targets the original PVInsight example project. See ASSET_SOURCES.md for logo and generated asset provenance.
