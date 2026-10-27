# Visual style

The hub looks like an asset library browser: a narrow icon rail on the left, a large pill search bar, a row of dropdown
filters, a featured banner and rows of tiles grouped by topic. Neutral greys, one green accent (#417D31), and a colour per topic.
The key art and the diagrams carry the colour; the UI itself stays grey.

## Four image modes

Every picture on the site uses exactly one of these modes. Pick the mode from the subject, never for decoration.

| Mode | Use it when | Rules |
|---|---|---|
| **Render** | Key art for every unit; any topic about light, materials, surfaces or shading | Physically lit, ACES tonemapped, dark studio backdrop with a soft contact shadow, one subject centered. No outlines, no text inside the image. Debug views (mip levels, step counts, heatmaps, a coarse pixel grid) appear as a clean split next to the lit image. Foundations use small SDF still lifes (arrows, spheres, boxes) on the same studio floor. |
| **Diagram** | Explaining a mechanism: rays, vectors, timelines, curves, pipelines | Flat 2D on the page background. 1.5–2.5 px strokes. Ink for structure, one accent for the thing that changes, the axis colors (red X, green Y, blue Z) only for axes. Labels in the body or mono font, never inside filled shapes. No gradients, shadows or 3D. |
| **Pixel grid** | Only when the pixel or texel is the subject: rasterization, 2×2 quads, mip levels, BC blocks, sampling, quantization | Hard square pixels, nearest filtering, integer scaling, visible grid lines when counting matters. Never used as a "retro" look. |
| **Voxel** | Only when the data really is a 3D grid: volumetric clouds and fog (froxels), voxel GI, SDF bricks, probe grids | Isometric cubes, one light direction (top lightest, left mid, right darkest), grid lines on cube edges. Never used as decoration. |

If a topic seems to need pixel or voxel art for style reasons, use a render or a diagram instead.

## Key art

Each unit has one key image, shown as a static WebP (`assets/keyart/<slug>.webp`, 1600 × 610) so pages never compile shaders.
It shows the unit's own technique working. The images are rendered from the GLSL scenes in `assets/renders.js`:

1. Add a scene to `SCENES` in `assets/renders.js` with a `vec3 render(vec2 frag)` function that returns linear color.
   Use `screenUV(frag)`, `studio(rd)` for the backdrop and the helpers in the prelude.
2. Run `python tools/render_keyart.py <slug>` to write `assets/keyart/<slug>.webp`.
3. Or render the image in Blender, Unity or Unreal instead and save it under the same name and size, with the same studio lighting.

## Hub tiles

Each tile carries three signals, always in the same places:

- **Software badges** top left: which tool the unit targets (`software` in the catalogue: `any`, `unity`, `unreal`, `sd`, `blender`).
  By default they are neutral text chips (ANY, UNITY, UE, SD, BLENDER), not official logos: those are trademarks with brand rules.
  Drop your own badge art into `assets/img/software/<id>.svg` to replace a chip.
- **Kind** top right: `UNIT` (a learning unit) or `WORKFLOW` (accent-coloured, clipped corner). Set with `type` in the catalogue.
- **Topic colour**: a 4 px bar under the image and a dot before the meta line, from the category `tone`.

The image is a drawn placeholder (the unit's line icon on a tinted grid) until you add a render with the naming in
`assets/img/README.txt`: `assets/img/units/<slug>-tile.webp` (4:3), `<slug>-hero.webp` (21:8, replaces the key art on the
unit page), `assets/img/paths/<path-id>.webp`. Run `python tools/build.py` after adding images.

Icons (`assets/icons.js`) are 48 × 48 viewBox, 2.2 px strokes in `currentColor`, the one element that matters in the accent
class `a`. No fills except one accent dot (`af`), no text, no perspective tricks.

## Topic colours

| Topic | Tone |
|---|---|
| Foundations | `#8a97ab` |
| Shading | `#b07ce8` |
| Light | `#e3b341` |
| Surfaces | `#4aa3f0` |
| Materials & texture pipeline | `#2fb3b3` |
| Characters | `#e06cae` |
| Performance | `#e05a4f` |
| Substance Designer | `#d9822b` |
| Foliage | `#9cc04a` |
| Unity projects & assets | `#5b6ee8` |

Topic colours appear only as the tile bar, the dot, the unit header's left border and the placeholder tint, never as text colour.

## Type and color

- Headings and body: Source Sans 3 (headings 700, body 17 px). Oswald (condensed, uppercase) for hub banners and row titles.
  Archivo only for the logo. Code and numbers: JetBrains Mono.
- All fonts are self-hosted in `assets/fonts/` (SIL Open Font License). Do not link Google Fonts or any other font CDN.
- Colors are tokens in `assets/atlas.css`. Use color scarcely: the UI is neutral grey; the green `--accent` (#417D31, with
  `--accent-ink` for text on dark and light) marks the current item, primary buttons, the logo and focus. Topics have the tones
  above. Links are underlined text, not colored.
  Inside live formulas and labs, colors carry meaning (one per variable, axis colors for X/Y/Z) and stay.
- Layout: the hub and the unit pages share the icon rail and the top search bar. A unit page is a centred grid of two
  columns: a sticky **rail card** (268 px) and the content column (`--col`, up to 1180 px). The rail card holds the breadcrumbs
  as pill chips ("All units", then the topic with its colour dot), the unit name in plain body type and the chapter list,
  without numbers; the current chapter gets the accent tint and a bar. The unit header and key art sit side by side on wide screens. Every chapter is a framed card;
  live formulas with a drawing put the canvases left and the sliders right once the chapter is wider than 860 px (container
  queries), so a widget fits on one screen. Under 980 px the rail card hides and everything is one column.
  Widgets, labs, code and tables inside a chapter are framed again with 1 px lines. Panels have small radii and no shadows.
- Dark is the default theme; light is an explicit choice of the reader. Draw lab canvases with `Atlas.col('token')`
  so they follow both.

## Writing

Titles state facts. Units, chapters and live formulas are named by the technique, quantity or setting they cover
("Snell's law", "Mip level from derivatives", "Channel packing layouts"), as noun phrases in sentence case. No questions,
no slogans, no "the trick", no chapter numbers. Unit titles use title case.

Each principle is explained once. If a chapter needs a principle another unit owns (Fresnel, Beer–Lambert absorption,
linear and sRGB, mip selection, the slab test and so on), it gives a one-line recap with `ref('unit#chapter', 'recap')`
instead of explaining it again, and keeps only what is specific to its own topic. The reference card links to the full
chapter, and the owning chapter lists every unit that uses it under "Used in".

Plain, direct sentences. Name things by what readers know from their engine. No marketing adjectives, no emoji.

- Small steps. A chapter introduces one idea and uses only ideas from earlier chapters or linked lessons.
  If a sentence needs something the reader may not know, link it (`a.x`) instead of assuming it.
- Every formula is a live `Atlas.fx` widget: each symbol a control, with a picture of what it computes and a graph.
  Continuous values get sliders; anything with only a few settings (a format, a mode, on/off, up to eight steps) gets buttons:
  give the variable `values` and `labels` and the widget draws them as a button row automatically.
  Show the substituted numbers, and intermediate steps when there are several.
- Checks are optional panels between lessons, a few questions each, with an explanation for every answer.
- Every unit has a final **"Build it in Unity HDRP"** chapter (`id="implement"`, class `chapter impl`), placed before the sources:
  which tools it needs (Shader Graph, HLSL Custom Function file, C# script, compute shader, Custom Pass, settings),
  numbered steps that name the exact menus and node settings, and complete, copyable files in a `.files` tab box
  (`<div class="file" data-name="Name.hlsl" data-lang="hlsl"><pre>…</pre></div>`; languages `hlsl`, `cs`, `py`).
  Add URP and Unreal notes in an `.engines` box labelled "Other pipelines". Prefer compute when the work is a simulation,
  a reduction or data generation, and say so. Code must compile as written: guard HDRP-only calls with
  `#ifdef SHADERGRAPH_PREVIEW` for node previews, release GPU buffers in `OnDisable`.
- Every unit ends with sources and a glossary.
