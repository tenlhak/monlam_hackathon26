# Landing page artwork

The four section images on the landing page live in `web/public/art/`:

| File             | Section   | Depicts                                        |
| ---------------- | --------- | ---------------------------------------------- |
| `chat.webp`      | Chat      | A speech bubble under a butter lamp, "Sherab"  |
| `practice.webp`  | Practice  | An open book showing a letter, pencil, waveform |
| `news.webp`      | News      | A stupa against peaks and a rising sun          |
| `resources.webp` | Resources | A stack of books under a butter lamp            |

They are wired up in the `ART` constant at the top of `web/src/routes/index.tsx`,
which also holds each one's `alt` text.

## Specs, if you replace one

- **16:10.** The current set is 1586 × 992. The panel renders at most 976px wide
  — that happens just below the `lg` breakpoint, where the section is still one
  column; above `lg` it splits into two columns and drops to 456px. So 1586px is
  a little over 1.6x at the widest case. 1952px would be a true 2x if you ever
  regenerate them.
- **WebP.** The source PNGs were ~1.5 MB each; at quality 82 these are 28–42 KB
  with no visible loss, because the art is flat. Converted with:

  ```sh
  magick chat.png -strip -quality 82 -define webp:method=6 chat.webp
  ```

- Rendered with `object-cover`, so anything not 16:10 is centre-cropped rather
  than letterboxed. Keep whatever matters away from the edges.
- Corners and the 1px border are applied in CSS — export full-bleed rectangles,
  with no rounded corners or frame baked in.

## Note on the palette

This set is cream paper, terracotta, charcoal and soft mountain greys. The rest
of the app is still on the blue/sunrise theme from before, so the panels sit
warm against a cool navy UI. Repainting the global tokens to match the artwork is
the outstanding piece of the redesign.
