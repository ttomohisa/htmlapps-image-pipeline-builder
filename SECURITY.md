# Security Policy

Image Pipeline Builder is a static browser application. It does not require a backend and is designed to keep selected image data in the browser.

## Security design

- Runtime network connections are blocked by Content Security Policy (`connect-src 'none'`).
- No runtime CDN, remote font, analytics, telemetry, or image-processing API is used.
- Browser-native File/Canvas/Blob APIs handle image data locally.
- Saved-Recipe JSON exports contain only validated graph/settings snapshots; they do not include source or generated images and do not upload data. User-edited names are sanitized before the local download.
- Asynchronous Pipeline reads cannot overwrite newer selections or graph/source revisions, including through late errors or cleanup.
- Persistent Core graph data is JSON-safe settings/connection data; selected files and decoded image objects are not serialized into it.
- Dependency versions and tarball hashes must be locked before a future dependency can enter a release build.

## Reporting a vulnerability

Please report security issues through the repository's private GitHub security reporting mechanism when available rather than publishing exploitable details in a public issue.
