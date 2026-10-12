# SAIFI website

This project contains the SAIFI website with its existing Arabic and English page layout, fonts, interactions, navigation and responsive styles. The shared brand color is `#22366B`. Approved wallet and company artwork is in `branding/`.

## Build and verify

Run `npm run build` to regenerate the ready-to-publish site in `dist/`. No dependency installation is required. Run `npm test` to check the 90 route documents, complete page data, language direction, local content responses, bilingual search, service relationships, FAQ pagination, metadata, brand assets and loading completion. Serve `dist/` using a static web server that supports directory index files; opening HTML files directly is insufficient.

Retained React Flight data includes raw text rows with declared UTF-8 byte lengths. Changing identity text without updating these headers caused the homepage and service pages to fail during client initialization. Canonical page documents now contain corrected headers; the build validates and repairs affected transport rows while preserving the original component tree. Regression checks use the shipped React decoder on every page, reproduce the former four-page failures and verify one-byte stream fragments. This is data decoding validation, not a browser rendering comparison.

The shared introductory screen displays the SAIFI white logo for at most 600 milliseconds after mounting. Its completion does not depend on browser storage, optional animation files or navigation events. The repaired bundle has a new content URL so browsers load the corrected client.

The hosted origin is configured in `site.config.json`. Arabic and English paths remain `/ar` and `/en`.

## Files

- `vendor/public`: canonical SAIFI client bundles, styles and assets.
- `vendor/routes`: canonical page documents.
- `vendor/data`: published content served from a local snapshot.
- `src/runtime.js`: local content API, search, document navigation and availability dialogs.
- `src/brand.mjs` and `src/brand.css`: shared identity configuration.
- `src/flight-stream.mjs`: retained page transport validation and byte-length repair.
- `src/brand-runtime.js`: social-preview and browser-theme metadata.
- `scripts/build.mjs`: reproducible static export.
- `scripts/verify.mjs`, `scripts/verify-brand.mjs`, `scripts/verify-loading.mjs` and `scripts/verify-flight.mjs`: functional, identity, loading and complete page data checks.

The frontend uses retained compiled components plus readable adapters. A handwritten framework authoring repository and source maps were not supplied.

## Official links and forms

The iOS link uses the verified numeric app ID without a descriptive name in the URL. A new Android package ID and new social account URLs have not been supplied. Their controls now display an explicit availability dialog; unverified links are not invented. Phone and support destinations without outdated identifiers remain available. Set approved integration destinations when they are provided.

Content requests use `/api/content/` or `/api/proxy` and are answered locally by the snapshot adapter. The site no longer requires the previous external content API. Contact and subscription submissions need a configured backend at `/api/visitor-problem` and `/api/visitor`; unavailable submissions report failure clearly.

## Remaining media and verification limits

Some phone screenshots, app videos and event photography still contain previous artwork inside the media itself. Approved replacement app captures and editable motion sources are required to complete that visual migration. These media files are distinct from textual source identifiers and filenames. Existing layout and instructional content are retained until approved replacements are supplied.

Two external image files remain at their original image-hosting URLs because local copies were unavailable. Browser visual comparisons and viewport interaction checks were not performed because the required browser capability is unavailable. See `branding-report.json`, `build-report.json` and `verification-report.json` for completed checks.
