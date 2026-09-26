# Source brand assets

These are the supplied ProofDrop brand images. They are kept here as the source of truth for the
artwork and are **not served at runtime**: no component, script, or build step reads this folder.

| File | Dimensions | Use |
|------|------------|-----|
| `proofdrop.jpg` | 1408x768 JPEG | Logo source. A rounded-square mark centered on a light background. |
| `proofdropcover.jpg` | 1376x768 JPEG | Cover / hero artwork. |

## Derived, web-served versions

The app loads only these files from `apps/web/public/brand/`:

| File | Dimensions | Derivation |
|------|------------|-------------|
| `logo-192.png` | 192x192 PNG | Square center crop of `proofdrop.jpg`, resized. Header mark, favicon, manifest icon. |
| `logo-512.png` | 512x512 PNG | Same square crop, resized. Web manifest icon. |
| `apple-touch-icon.png` | 180x180 PNG | Same square crop, resized. Apple touch icon. |
| `cover.jpg` | 1200x670 JPEG | `proofdropcover.jpg` resized to 1200 wide. Source aspect ratio preserved exactly. |
| `og-cover.jpg` | 1200x630 JPEG | `cover.jpg` center-cropped vertically to the 1200x630 Open Graph ratio. |

Nothing is redrawn, squashed, or recolored. The mark occupies `x[420,986] y[69,651]` of
`proofdrop.jpg`; the icon crop is a 704x704 square centered on it, which leaves roughly 69px of
horizontal and 61px of vertical padding. To regenerate after a source change, extract
`{ left: 351, top: 8, width: 704, height: 704 }` with the `sharp` package already installed in this
repository, then resize to each icon size.

`cover.jpg` and `og-cover.jpg` are used by the landing hero and by the Open Graph / social preview
declared in `apps/web/app/layout.tsx`. `apps/web/public/site.webmanifest` references the two PNG
icons.

## Rights

No author, license, or trademark holder is asserted for these images. Confirm usage rights before
distributing them outside this repository.
