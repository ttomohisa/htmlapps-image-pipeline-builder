# Image Pipeline Builder

[![GitHub Pages](https://github.com/ttomohisa/htmlapps-image-pipeline-builder/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/ttomohisa/htmlapps-image-pipeline-builder/actions/workflows/deploy-pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Single HTML](https://img.shields.io/badge/distribution-single%20HTML-0ea5e9)](https://ttomohisa.github.io/htmlapps-image-pipeline-builder/)

[日本語版 README](README.ja.md)

A privacy-focused, single-HTML browser app for building reusable image-processing pipelines and running the same flow across multiple JPEG, PNG, and WebP images without uploading selected files to a server.

## 🚀 Live demo

### [Open Image Pipeline Builder on GitHub Pages](https://ttomohisa.github.io/htmlapps-image-pipeline-builder/)

GitHub Pages delivers the initial HTML. After it loads, image decoding, Preview, processing, Batch execution, encoding, Recipe execution, and ZIP generation are handled locally on your device. Selected images are not uploaded by the app.

[![Image Pipeline Builder screenshot](assets/screenshot.png)](https://ttomohisa.github.io/htmlapps-image-pipeline-builder/)

## Features

- **Build image processing as a visible flow** — Connect Resize, Crop, Rotate, Flip, Canvas, Adjust, Grayscale, Blur, Sharpen, Border, Rounded Corners, Text Watermark, and Output nodes on the Canvas.
- **Process multiple images with one reusable pipeline** — Add JPEG, PNG, and WebP files, choose one representative image for Preview, and run the same graph sequentially across the full input list.
- **Branch to multiple outputs without a Split node** — Connect one image output port directly to multiple downstream branches and reuse shared upstream results.
- **Inspect intermediate results before running the full Batch** — Select a node and switch between Before / After Preview. Output nodes also show the representative image's actual encoded size.
- **Reuse common work with Recipes** — Register the current Pipeline in browser-local storage, select new images from a saved Recipe card, and either run it immediately or apply it to the Canvas for further editing.
- **Keep portable Pipeline backups separate from Recipes** — Save/Open Pipeline JSON for backup or transfer between environments. Image files are never embedded in Recipe or Pipeline JSON data.
- **Save structured output safely** — Configure JPEG/PNG/WebP per Output, filename templates, ZIP subfolders, duplicate-name handling, individual downloads, and ZIP export.
- **Desktop and mobile editing** — Desktop uses a three-pane Nodes / Flow / Node settings workspace; mobile uses fixed Flow / Images / Node / Run navigation with a touch-friendly node sheet.
- **Private, single-HTML operation** — The standalone build uses `connect-src 'none'`, requires no runtime CDN, and performs image work in the browser.

## Quick start

### Use the web demo

Just [open the demo](https://ttomohisa.github.io/htmlapps-image-pipeline-builder/). No installation or account is required.

### Use the downloaded HTML

1. Download `dist/index.html` from a release or build artifact.
2. Open it directly in a current Chromium-based browser.
3. Add images and run the Pipeline without a local web server.

The compact `dist/index.self-extract.html` contains the same readable standalone HTML as a self-extracting payload and opens the app locally after expansion in the browser.

### Build the standalone files on Windows

1. Download or clone this repository.
2. Run `build-standalone.bat`.
3. The builder generates and verifies `dist/index.html` and `dist/index.self-extract.html`.
4. Copy either generated HTML file wherever you need it.

The project has no runtime npm-library dependency in `dependencies.json`; the image runtime and ZIP writer are implemented in this repository. The supplied Node Editor Core snapshot is bundled in the app source.

## Usage

1. Add one or more JPEG, PNG, or WebP images from the **Images** node or the Images page on mobile.
2. Add processing nodes from the left palette. On desktop you can click a node or drag it directly to the desired Canvas position.
3. Connect ports to define the processing order. One output port can feed multiple branches.
4. Select a node and use **Before / After** to inspect the representative image at that stage.
5. Configure each **Output** with its label, JPEG/PNG/WebP format, quality, filename template, and optional ZIP subfolder.
6. Choose **Run pipeline** to process the entire input list. One failed image does not stop the remaining inputs; failures are listed separately.
7. Save individual output files or use **Save ZIP** to package successful results.
8. For repeated work, save the current Pipeline as a **Recipe**. A saved Recipe can run directly against newly selected images and automatically download the completed result, or it can be applied back to the Canvas for editing.
9. Use **Save Pipeline / Open Pipeline** when you want a portable JSON backup. Source images are not included.

The default graph starts as `Images → Resize → Output`.

### Built-in templates

The Template menu provides editable starting points:

- **Web images** — resize to a web-friendly maximum size and export WebP.
- **Main + thumbnail** — branch one input into large and thumbnail WebP outputs.
- **Social square** — crop to 1:1, resize to 1080 × 1080, and export JPEG.
- **Watermarked images** — resize, add a text watermark, and export WebP.
- **Minimal flow** — `Images → Output` for building from a small base.

Templates are ordinary graphs after loading; every node and connection can be edited.

### Filename templates

Output filenames support:

- `{name}` — source filename without extension
- `{index}` — 1-based source index
- `{index:N}` — zero-padded source index, for example `{index:3}` → `001`
- `{width}` / `{height}` — final output dimensions

Duplicate paths are resolved deterministically with suffixes such as `-2`, `-3`, and so on. Unsafe absolute paths and parent-directory traversal in ZIP subfolders are rejected before processing.

### Keyboard and Canvas operations

| Shortcut / operation | Action |
| --- | --- |
| `Ctrl` / `⌘` + `Enter` | Run the current Pipeline |
| `Ctrl` / `⌘` + `Z` | Undo graph changes |
| `Ctrl` / `⌘` + `Shift` + `Z` | Redo graph changes |
| `Delete` / `Backspace` | Delete selected nodes or connections when applicable |
| `Esc` | Close expanded workspace / dialogs where applicable |
| Drag a palette node | Place it at the dropped Canvas position |
| Drag or tap ports | Create a connection |

The Canvas also provides zoom, Fit All, Fit Selection, helper lines, Grid Snap, MiniMap, multi-selection, copy/paste/duplicate, and a floating expanded workspace.

## Recipes and Pipeline JSON

Recipes and Pipeline JSON intentionally serve different purposes.

**Recipe**

- Stored in the current browser's local storage.
- Designed for quickly reusing a processing flow with different images.
- Appears as a quick Recipe card above the editor.
- Does not store source image files or generated output files.
- Names must be unique (ignoring surrounding spaces and case). Choose another name to register a copy; **Update** replaces the named Recipe only after confirmation.
- **Update** and **Delete** cannot be undone. Cancel the confirmation to keep the saved Recipe.
- If browser storage is full or unavailable, a save error leaves the old Recipe and entered name intact so you can retry.
- Quick Recipes and regular Batch processing run one job at a time. **Cancel** preserves completed outputs and enables a new run after processing stops.

- To back up a saved Recipe without changing your current Canvas, open the Recipe library and choose **Export Pipeline JSON** beside that Recipe. Edit the filename, then export. The dialog captures the saved settings; Cancel, Escape or clicking outside leaves everything unchanged. Names are sanitized and end in `.image-pipeline.json`.

**Pipeline JSON**

- A newer JSON selection or an intervening graph/source edit cancels an older pending import. Late reads cannot overwrite your newer work.

- Downloaded/uploaded explicitly by the user.
- Designed for backup or moving a graph to another browser/device.
- Stores graph structure and node settings only.
- Does not store source images, Preview snapshots, Batch output Blobs, or ZIP bytes.

## GitHub Pages publishing

The repository includes workflows that validate the standalone files and deploy `dist` to GitHub Pages.

1. Push the repository to GitHub as `htmlapps-image-pipeline-builder`.
2. Open **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**.
3. Push to `main`, or manually run **Deploy standalone app to GitHub Pages** from the Actions tab.
4. After a successful deployment, the demo is available at `https://ttomohisa.github.io/htmlapps-image-pipeline-builder/`.

The deployment workflow runs `scripts/check-repository.ps1` before publishing and uploads both standalone variants plus their manifests.

The repository check requires Node.js 24 (no npm packages are needed) and runs all Core/Consumer tests after building. Regenerate the root `image-pipeline-builder.html` download from `dist/index.html` whenever the source changes; release tests check the root, readable and self-extract contents.

## Development and build layout

```text
.
├─ src/
│  ├─ index.template.html             # Application shell / UI
│  ├─ core/
│  │  └─ node-editor-core.mjs         # Supplied Node Editor Core snapshot
│  └─ image-pipeline/
│     └─ image-pipeline.mjs           # Image-specific runtime/helpers
├─ tests/                              # Core + consumer regression tests
├─ dependencies.json                  # Runtime dependency declaration (currently empty)
├─ dependencies.lock.json             # Locked dependency metadata
├─ app.config.json                    # App/build metadata
├─ build-standalone.bat               # Windows build entry point
├─ build-standalone.ps1               # Readable standalone builder
├─ scripts/
│  ├─ check-repository.ps1            # Full repository/build verification
│  ├─ verify-standalone.ps1
│  ├─ build-self-extract.ps1
│  └─ verify-self-extract.ps1
└─ dist/
   ├─ index.html
   ├─ index.self-extract.html
   ├─ dependency-manifest.json
   ├─ build-size-report.json
   ├─ self-extract-manifest.json
   └─ .nojekyll
```

Run JavaScript tests with:

```bash
npm test
```

On Windows, build and verify the release artifacts with:

```bat
build-standalone.bat
```

or run the full repository verification directly in PowerShell 7:

```powershell
./scripts/check-repository.ps1
```

Do not edit generated `dist` HTML by hand; update the source and rebuild.

## Privacy and runtime network protection

Image decoding, transforms, Preview, Batch execution, encoding, Recipe execution, and ZIP generation run locally in the browser.

The standalone HTML includes a Content Security Policy with `connect-src 'none'`. The app does not use a runtime CDN, analytics, telemetry, or a cloud image-processing API. The GitHub Pages version requires the initial HTML request, but selected images and generated results are not transmitted by the app.

Browser-local Recipe/current-Pipeline recovery stores graph/settings metadata only. Source images, image bytes, Preview snapshots, generated output Blobs, and ZIP bytes are not persisted there.

Output images are newly encoded by the browser. Original EXIF/GPS metadata is not intentionally copied. Embedded ICC profile preservation is not guaranteed, so this app is not intended as a color-managed print-production tool.

See [Offline / privacy verification](VERIFY_OFFLINE.md).

## Limitations

- Input is limited to static JPEG, PNG, and WebP in v1.0.0. Animated GIF/WebP, HEIC/HEIF, TIFF, RAW, SVG, and PSD are not supported as source formats.
- Output is JPEG, PNG, or WebP. AVIF is not included in v1.0.0.
- Crop is batch-oriented and uses ratio/size/anchor settings rather than per-image freehand crop handles.
- Text Watermark uses system fonts; external web fonts are not loaded.
- JPEG output flattens transparency against the configured background color.
- Original EXIF/GPS metadata is not carried over to newly encoded output files.
- Embedded ICC profiles are not guaranteed to survive browser decode/encode.
- Very large images, large batches, many branches, and high-resolution Preview/Output work can consume substantial device memory. Batch processing is intentionally sequential to reduce peak usage.
- Cancellation is checked between major processing stages; a synchronous Canvas operation already in progress cannot be interrupted in the middle of that single operation.
- Recipe/current-Pipeline storage is browser-local and may be cleared by browser/site-data controls. Use Pipeline JSON for portable backup.
- Browser/device memory limits vary, so there is no fixed promise that a particular image count or pixel size will succeed on every device.

## Dependencies

There are no third-party npm runtime libraries declared in `dependencies.json` for v1.0.0.

The application includes the Browser Kitty / ttomohisa Node Editor Core source snapshot under the same repository MIT license. Browser APIs provide image decoding/encoding, Canvas processing, Blob/File handling, and downloads. The ZIP writer is implemented in the project itself.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for details.

## Contributing

Bug reports and feature proposals are welcome through GitHub Issues. See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidance.

## License

Copyright © 2026 ttomohisa

Licensed under the [MIT License](LICENSE).
