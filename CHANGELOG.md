# Changelog

All notable changes to Image Pipeline Builder are documented here.

## [1.0.0] - 2026-09-21

### Stable release

- Promote Image Pipeline Builder from the v0.9.0 release candidate to the first stable release without adding a new processing-node category.
- Finalize version metadata, in-app help, release documentation, and Japanese/English screenshots for v1.0.0.
- Rewrite README.md and README.ja.md in the Browser Kitty release format, covering Live demo, features, quick start, usage, Recipe/Pipeline reuse, GitHub Pages, build layout, privacy, limitations, dependencies, contribution, and license.

### Verified

- Preserve the v0.9.0 guarantees for sequential Batch execution, cancellation checkpoints, shared 1→3 branch evaluation, Preview-cache cleanup, Batch-result memory release, ZIP generation, Recipe direct execution, and desktop/mobile behavior.
- Keep the supplied Node Editor Core snapshot byte-for-byte unchanged.
- Keep `connect-src 'none'`, zero runtime CDN/API dependencies, readable standalone output, and self-extract output.

## [0.9.0] - 2026-09-21

### Changed

- Treat v0.9.0 as the release candidate: no new processing-node category, with focus on performance, cancellation, memory cleanup, and regression coverage.
- Add AbortSignal checkpoints after image decode, between graph stages, and around Output encoding so cancellation stops before further heavy work.
- Make the sequential Batch runner treat an AbortError from the current item as cancellation instead of a failed image.
- Dispose Preview LRU snapshot canvas backing stores when cache entries are evicted or cleared.
- Drop successful Batch Output Blob references when results are invalidated and release Preview/Batch references on pagehide.

### Verification

- Add a 100-item strictly sequential Batch stress regression.
- Add a 1→3 branch shared-upstream regression.
- Add a 300-entry stored-ZIP regression including UTF-8 paths.
- Preserve all v0.8.3 UI/Recipe/Preview/mobile behavior and keep Node Editor Core byte-for-byte unchanged.

## [0.8.3] - 2026-09-21

### Changed

- Replace the **Fit All** toolbar icon with an inward-fit symbol so it is visually distinct from the floating workspace expand icon.
- Let the desktop Canvas viewport shrink within the fixed 640 px workspace and keep the status row as a non-shrinking footer, preventing **Flow is ready / Selected / Connection waiting** from being clipped.

### Preserved

- Node Editor Core remains byte-for-byte unchanged.
- v0.8.2 palette drag placement, aspect-correct Preview, Recipe auto-download, fixed desktop side panels, mobile navigation, Batch, branching, and ZIP behavior remain intact.

## [0.8.2] - 2026-09-21

### Changed

- Add PDF Pipeline Builder-style drag-and-drop placement from the left Node palette directly onto the Canvas.
- Preserve Preview aspect ratio inside the Preview stage so square/cropped images are not stretched to the panel width.
- Make **Use this Recipe** automatically download the completed output; multiple outputs are bundled into one ZIP.
- Fix the desktop workspace height to 640 px and make the Nodes / Node settings columns scroll internally, aligned with Data Pipeline Builder.

### Preserved

- Node Editor Core remains byte-for-byte unchanged.
- Recipe/Pipeline separation, mobile navigation, batch processing, branching, multiple Outputs, ZIP export, and image-processing nodes remain intact.

## [0.8.1] - 2026-09-20

### Changed

- Use the supplied Image Pipeline Builder SVG as the shared favicon and header brand icon.
- Align the header, page intro, and fully-local badge with PDF Pipeline Builder.
- Replace the saved Workflow UI with the PDF Pipeline Builder-style Recipe library and quick Recipe cards.
- Separate browser-local Recipe storage from portable Pipeline JSON save/open actions in the UI.
- Allow saved Recipes to run directly on selected images without replacing the current Canvas, or apply the Recipe and selected images to the Canvas for editing.
- On mobile, reveal the Run page after a quick Recipe finishes so the generated results are immediately visible.
- Update Japanese/English help, README, architecture, screenshots, and offline-verification notes for the Recipe/Pipeline model.

### Preserved

- Node Editor Core remains byte-for-byte unchanged.
- v0.8.0 Mobile / UX / Accessibility and all existing image processing, Preview, branch, Batch, and ZIP behavior remain intact.

## [0.8.0] - 2026-09-18

### Added

- Added a smartphone-specific fixed bottom navigation with **Flow / Images / Node / Run** pages instead of vertically stacking the desktop editor.
- Added a mobile Add-node bottom sheet with backdrop, safe-area padding, and 44 px touch targets.
- Added node-palette search with a clear action and localized matching.
- Added `Ctrl+Enter` / `Command+Enter` Batch execution outside typing controls and modal dialogs.
- Added live-region announcements for mobile page changes and Batch completion/progress semantics.
- Added regression coverage for mobile navigation, bottom-sheet behavior, safe-area spacing, long filenames, bounded dialogs, node search, and keyboard execution.

### Changed

- Mobile Images now focuses the Images-node inspector/source list; Node focuses the last editable node plus intermediate Preview/settings; Run focuses Batch progress/results.
- Mobile fixed UI, dialogs, toasts, source filenames, and floating workspace were hardened for 390 px layouts and device safe areas.
- The existing desktop FFmpeg Filter Builder-aligned three-panel workspace, side-panel collapse controls, and floating expansion are preserved.
- Updated Japanese/English help, README, architecture, screenshots, and offline-verification notes for the v0.8.0 UX/accessibility scope.

### Preserved

- Node Editor Core remains byte-for-byte unchanged.
- v0.7 reusable workflows/templates/JSON portability and all v0.6-and-earlier processing, Preview, branch, Batch, and ZIP behavior remain intact.

## [0.7.0] - 2026-09-18

### Added

- Added automatic local recovery for the current graph/settings without storing source image files.
- Added named workflows with save/update, open, rename, and delete operations.
- Added the `image-pipeline-builder-workflow` JSON envelope (`formatVersion: 1`) with an application migration hook before Core deserialization.
- Added Workflow JSON export/import for portable graph/settings reuse.
- Added five editable built-in templates: Web images, Main + thumbnail, Social square, Watermarked images, and Minimal flow.
- Added workflow/preset UI, mobile dialog handling, and regression tests for persistence, migration, template validity, and image-file exclusion.

### Changed

- Flow controls now show Templates, Workflow, and the current workflow name.
- Replacing a graph through a template/import/open keeps in-memory source images for the current session but clears stale Preview/Batch runtime results.
- Updated Japanese/English help, README, architecture, screenshots, and offline-verification notes for reusable workflows.

### Privacy

- Browser storage contains graph/settings metadata only. Input `File` objects, image bytes, Preview snapshots, Batch result Blobs, and ZIP bytes are not persisted in workflow data.

### Preserved

- Node Editor Core remains byte-for-byte unchanged.
- v0.6 Appearance / Composition, v0.5 intermediate Preview, Geometry, branching, multiple Outputs, Batch/partial failure, and ZIP behavior remain intact.

## [0.6.0] - 2026-09-18

### Added

- Added Adjust for brightness, contrast, and saturation.
- Added Grayscale with adjustable strength and Blur with adjustable radius.
- Added Sharpen using a local 3×3 convolution with alpha preservation.
- Added Border with inside/outside placement; outside borders expand output dimensions.
- Added Rounded Corners with pixel or short-side-percentage radius and transparent corners.
- Added Text Watermark with system fonts, size, color, opacity, nine-position placement, margin, and rotation.
- Added pure Consumer helpers and regression tests for Appearance / Composition settings, border geometry, rounded radii, watermark placement, and sharpen pixel behavior.

### Changed

- The node palette now separates Geometry, Appearance, and Composition groups.
- Preview, Batch processing, branches, selected-image export, and ZIP output evaluate the new nodes through the same Consumer graph runtime.
- Updated Japanese/English help, README, architecture, screenshots, and offline-verification notes for v0.6.0.

### Preserved

- Node Editor Core remains byte-for-byte unchanged.
- v0.5 Before / After Preview and cache behavior remain intact.
- Existing Geometry, branch, multiple-Output, partial-failure Batch, and local ZIP behavior remain intact.

## [0.5.0] - 2026-09-18

### Added

- Added **Before / After** intermediate preview for the currently selected node.
- Added upstream-only preview signatures so downstream or layout-only changes do not invalidate unrelated previews.
- Added a bounded LRU preview cache keyed by representative image and upstream graph state.
- Added loading / cached / updated / error states to the Preview panel.
- Output-node After preview now performs a real browser encode and reports the resulting representative-file size.
- Added regression tests for preview target resolution, upstream signature isolation, Output-setting invalidation, and LRU eviction.

### Changed

- Preview caches display-sized snapshots rather than full-resolution intermediate canvases to keep memory bounded.
- Preview selection now explicitly resolves the node input for Before and the node result for After.
- Updated Japanese/English help, README, architecture, screenshots, and offline-verification steps for v0.5.0.

### Preserved

- Node Editor Core remains byte-for-byte unchanged.
- v0.4 Geometry nodes and v0.3 branch / multiple-Output / ZIP behavior remain intact.
- Existing generation-token protection continues to reject stale asynchronous Preview results.

## [0.4.0] - 2026-09-18

### Added

- Added Crop with common/custom aspect ratios, fixed pixel size, and nine anchor positions.
- Added Rotate with 90° / 180° / 270° presets and arbitrary-angle expanded bounds.
- Added horizontal / vertical / both Flip modes.
- Added Canvas resizing with nine placement anchors and transparent or solid-color backgrounds without scaling the source image.
- Added Resize `contain` and `exact` sizing modes while preserving the existing no-upscale default.
- Added pure Geometry math helpers and regression tests outside Node Editor Core.

### Changed

- Geometry nodes now appear together in the node palette and use dedicated inspectors.
- Newly added nodes are placed beside the current selection and moved to a free slot when another node already occupies that area, preventing different Geometry types from stacking on top of each other.
- Batch results now survive layout-only operations such as Fit View or moving nodes, so completed results and summaries remain available while inspecting and arranging the graph or switching languages.
- Preview, Batch, branch caching, multiple Outputs, and ZIP export now evaluate the new Geometry nodes with the same graph runtime.
- Updated Japanese/English help, README, architecture, and offline verification for the v0.4 Geometry scope.

### Preserved

- Node Editor Core remains unchanged; image-specific Canvas operations stay in the Consumer.
- v0.3 branching, multiple Outputs, collision-safe paths, shared upstream evaluation, partial-failure Batch behavior, and local ZIP generation remain intact.

## [0.3.0] - 2026-09-18

### Added

- Added direct graph branching by allowing image output ports to connect to multiple downstream nodes.
- Added multiple Resize and Output nodes while keeping a single Images input node.
- Added Output labels, ZIP subfolders, filename tokens (`{name}`, `{index}`, `{index:N}`, `{width}`, `{height}`), and deterministic duplicate-path suffixes.
- Added a per-source shared evaluation cache so common upstream image processing is reused across multiple Outputs.
- Added browser-local ZIP packaging for all successful batch outputs, including UTF-8 paths, without adding a runtime dependency.
- Added pre-run validation for unsafe Output folders such as absolute paths and parent-directory traversal.

### Changed

- Batch result rows are grouped by source image and list every generated Output separately.
- The primary batch save action now creates one ZIP instead of triggering a set of separate downloads.
- Additional same-type nodes are staggered when inserted to avoid exact overlap.
- Updated Japanese/English help, README, architecture, and privacy/offline documentation for branch and multiple-output behavior.

### Preserved

- Sequential per-image processing, partial-failure continuation, cancellation, representative Preview selection, and the FFmpeg Filter Builder-aligned workspace from v0.2.x.

## [0.2.0] - 2026-09-18

### Added

- Added multi-image JPEG / PNG / WebP input with file picker and drag and drop.
- Added an input list with preview selection, previous/next navigation, per-image removal, and clear-all confirmation.
- Added sequential batch processing so the same valid `Images → Resize → Output` flow can run across all added images without intentionally decoding the complete list at once.
- Added batch progress, current filename, cancellation, partial-failure handling, and successful-result preservation.
- Added per-result saving and a `Save all successful images` action.
- Added Core runtime status updates while batch processing is running or completes with success/warnings/errors.

### Changed

- Updated Preview to use one selected representative image while batch execution processes the complete input list.
- Updated help, Japanese/English copy, privacy notes, architecture documentation, and release screenshots for the multi-image workflow.
- Batch error rows now use a generic processing failure message instead of assuming every failure is a decode error.
- Fixed the Preview empty-state overlay so it no longer covers a successfully rendered image.
- Language switching now preserves the selected filename and completed batch status/summary.

### Scope

- Branches, multiple Output nodes, output subfolders/collision handling, and ZIP packaging remain planned for v0.3.0.

## [0.1.1] - 2026-09-18

### Fixed

- Aligned the node palette, Canvas, and node settings layout with FFmpeg Filter Builder, including independently collapsible left/right sidebars and in-Canvas reopen buttons.
- Expanded workspace now floats the complete editor rather than only the Canvas panel.
- Fixed a Consumer/Core CSS conflict that left a blank area below the dotted Canvas by making the Core Canvas host fill the full Canvas region.
- Kept the Preview as a separate panel below the editor so the right column is dedicated to node settings.

## [0.1.0] - 2026-09-18

### Added

- First Image Pipeline Builder consumer built on the supplied Node Editor Core snapshot.
- `Images`, `Resize`, and `Output` nodes using a Consumer-defined `image` port type.
- Initial `Images → Resize → Output` flow with Core validation and connection editing.
- JPEG / PNG / WebP local file input with file picker and drag and drop.
- Browser-local image decoding with `createImageBitmap` and image-element fallback.
- Aspect-preserving resize with optional upscaling.
- Selected-node preview and stale-preview generation protection.
- JPEG / PNG / WebP export, JPEG/WebP quality control, filename templates, and local download.
- Core Canvas features including Undo/Redo, Fit View, zoom, helper lines, Grid Snap, MiniMap, and expanded workspace.
- Japanese / English UI and responsive smartphone layout.
- Runtime network blocking with `connect-src 'none'`.
- Browser Kitty favicon/header icon, screenshots, README, tests, and release documentation.
