# Offline / Local-processing verification

Image Pipeline Builder is designed for fully local image processing.

## Build-time checks

The standalone verifier requires:

- `connect-src 'none'`
- no unresolved standalone placeholders
- no runtime external script/style imports
- embedded canonical favicon/brand icon

Run on Windows:

```powershell
.\scripts\check-powershell-syntax.ps1
.\scripts\check-repository.ps1
```

Or use:

```bat
build-standalone.bat
```

## Manual runtime check

1. Build `dist/index.html`.
2. Open DevTools → Network.
3. Reload the page.
4. Add multiple JPEG/PNG/WebP images.
5. Add a second Resize / Output branch and give the Outputs different ZIP subfolders.
6. Insert one or more Appearance / Composition nodes, for example Adjust → Text Watermark, and confirm Before / After reflects that node boundary.
7. Confirm Grayscale / Blur / Sharpen preserve dimensions, outside Border expands dimensions, Rounded Corners creates transparent corners, and Text Watermark changes pixels using a system font.
8. Switch back to an unchanged node Preview and confirm the cache-reuse state appears. Change only a downstream Output setting and confirm an upstream Preview can still be reused.
9. Select Output After and confirm the representative encoded size is displayed.
10. Run the batch and confirm progress plus Output rows appear, then save the ZIP and inspect its relative paths. Confirm that no unexpected external network request occurs. Repeat with the network disabled.

Recommended failure check: include one intentionally broken image together with valid images. The broken item should fail independently while valid images continue processing.

## What remains local

- selected image files and input-list metadata
- decoded pixels for the current preview/batch item
- resize results and preview Canvas
- encoded output Blobs and batch result state
- application graph/settings

v1.0.1 also performs Adjust / Grayscale / Blur / Sharpen / Border / Rounded Corners / Text Watermark, Before/After Preview, small display snapshots, Preview cache entries, and representative Output encodes in the browser. Batch processing and ZIP packaging remain local. The app does not upload or cloud-store the input set, previews, outputs, or generated ZIP and does not include analytics, telemetry, cloud storage, or image APIs.

## Recipe / Pipeline JSON / template verification

1. Apply **Main + thumbnail** from Templates and confirm it expands to five ordinary editable nodes with two Outputs.
2. Register the current Pipeline as a named Recipe, then use, update, and delete it from the Recipe library.
3. Save Pipeline JSON, replace the graph, open the JSON again, and confirm the graph/settings return.
4. Inspect browser local storage: graph/settings may be present, but source image filenames/bytes, Preview snapshots, Batch Blobs, and ZIP bytes must not be persisted.
5. Reopen the page and confirm the graph/settings recover while source images remain unselected.
6. Repeat while DevTools Network is open and confirm no unexpected runtime request occurs.

## Mobile / UX / Accessibility verification (v1.0.1)

At 390 px, verify the Flow / Images / Node / Run bottom navigation, Add-node bottom sheet, long filenames, Recipe/Template/Help dialogs, toast placement, and floating workspace. There must be no page-level horizontal overflow and fixed navigation must not cover important controls or results.

Palette search and the `Ctrl+Enter` / `Command+Enter` Batch shortcut remain browser-local UI behavior and add no external requests.

## v1.0.1 UI regression checks

- Confirm the **Fit All** icon is visually distinct from the workspace expand icon.
- Confirm the bottom Flow status row remains fully visible at desktop widths with both side panels open.

1. On desktop, drag a node from the left palette onto the Canvas and confirm it appears near the drop point. Confirm click-to-add still works.
2. Preview square, portrait, and landscape results and confirm the visible Preview preserves their aspect ratio while fitting the stage.
3. Choose images in a saved Recipe and press **Use this Recipe**. Confirm processing automatically downloads the image for one output, or a ZIP for multiple successful outputs.
4. On desktop, confirm the Nodes and Node settings columns share the editor's fixed height and scroll internally when their content is taller.
