# Animations and effects

Property tracks change an element's state; effects process its drawn RGBA surface. They can be combined independently.

| Preset | Parameters | Writes |
| --- | --- | --- |
| fadeIn | from 0, to 1 | opacity |
| fadeOut | from 1, to 0 | opacity |
| slideIn | from [-200,0], to [0,0] | position |
| zoomIn | from [0.8,0.8], to [1,1] | scale |
| pulse | property opacity, from 0.4, to 1 | selected property |
| followPath | path ID, speedMode constant, orientToPath false | position; optionally rotation |
| wipeReveal | from 0, to 1 | reveal, left to right |
| typewriter | from 0, to 1 | textReveal |

The pulse completes one smooth low-high-low cycle per play. Easing names are linear, easeIn, easeOut and easeInOut. Use repeat explicitly for another play; transitions between scene captions do not reset independent tracks.

Effects: glow (color, radius, intensity), shadow (color, radius, intensity, offset), blur (radius) and trail (duration, samples, intensity). Effects apply in declaration order. Glow is normalized for visible bloom around small points. A trail samples earlier element states on the shared timeline. Trail color follows the rendered element. Presets do not create visibility intervals: use the element's visibility settings when it should not be present before a track.

Blueprint linework uses path elements and can animate opacity/reveal alongside separately rendered PNG assets. No named preset assumes any PV, BESS or other engineering content.
