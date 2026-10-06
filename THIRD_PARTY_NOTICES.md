# Third-Party Notices

Image Pipeline Builder v1.0.1 contains no bundled third-party npm library code. The ZIP writer, Preview cache, Recipe/Pipeline persistence/templates, mobile UX/accessibility code, and Appearance / Composition image operations are implemented in the project itself and do not add a third-party runtime dependency.

The application bundles Node Editor Core source maintained in the same Browser Kitty/ttomohisa codebase and distributed under the repository MIT license. The exact Core source snapshot supplied for this app is kept in `src/core/node-editor-core.mjs`.

Browser APIs and system fonts are used directly. GitHub Actions workflows reference their respective GitHub-maintained actions under the terms published by those projects.

If a future version adds a package to `dependencies.json`, record its exact version, license/homepage, required notices, and committed tarball lock before release.
