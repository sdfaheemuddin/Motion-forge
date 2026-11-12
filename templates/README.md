# Video templates

Copy a complete template directory into `projects/<your-project>` and edit its JSON files, or render the template directly from the repository root.

| Template | Content |
| --- | --- |
| [basic-motion](basic-motion/) | Four-second generic title and animated point example |
| [pvinsight-blueprint](pvinsight-blueprint/) | Complete 40-second PVInsight blueprint-to-reality video with isolated vertical assets and branding |

```powershell
motion-forge validate templates/pvinsight-blueprint/project.json
motion-forge render templates/pvinsight-blueprint/project.json
```

A Windows shortcut after setup is `.\render.bat templates\pvinsight-blueprint\project.json`.

Each template includes its referenced configuration and assets. After copying, update the project ID/name and export filename/directory to keep outputs distinct. Read the template's README for its specific customization settings.
