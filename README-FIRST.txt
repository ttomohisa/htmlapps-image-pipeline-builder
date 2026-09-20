Image Pipeline Builder v1.0.0

Start here:
- README.md / README.ja.md: usage, Recipes/Pipeline JSON, privacy, build and development notes
- APP_SPEC.md: stable v1.0.0 scope and release acceptance
- docs/ARCHITECTURE.md: Node Editor Core / Consumer boundary and runtime behavior
- VERIFY_OFFLINE.md / VERIFY_OFFLINE.ja.md: fully-local verification

Canonical Node Editor Core: use the exact user-provided htmlapps-node-editor-core.zip snapshot. Do not replace it by version label alone.

v1.0.0 is the first stable release. Preserve the v0.9.0 release-candidate guarantees: strictly sequential Batch execution, cancellation checkpoints, shared branch evaluation, Preview-cache cleanup, Batch-result memory release, ZIP generation, Recipe/Pipeline separation, and desktop/mobile standalone behavior.
