# Visual style

The site looks like an asset library (think Poly Haven): neutral greys, a top bar, a filter sidebar and a grid of rendered thumbnails.
The renders and the diagrams carry the color; the UI itself is grey with one orange accent.

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

Each unit has one rendered key image (`assets/renders.js`). It shows the unit's own technique working,
for example the interior-mapped facade, or a split view of the lit image and its cost. To add one:

1. Add a GLSL scene to `SCENES` in `assets/renders.js` with a `vec3 render(vec2 frag)` function that returns linear color.
   Use `screenUV(frag)`, `studio(rd)` for the backdrop and the helpers in the prelude.
2. Put `<canvas data-render="your-slug">` in the unit's `keyart` figure and on the hub (automatic from the catalogue slug).
3. Or render the image in Blender, Unity or Unreal instead: export a 2400×914 (21:8) JPEG, save it as
   `units/<slug>/keyart.jpg`, and replace the canvas with an `<img>`. Use the same studio lighting so it fits next to the others.

## Type and color

- Headings and body: Source Sans 3 (headings 700, body 17 px). Archivo only for the logo. Code and numbers: JetBrains Mono.
- All fonts are self-hosted in `assets/fonts/` (SIL Open Font License). Do not link Google Fonts or any other font CDN.
- Colors are tokens in `assets/atlas.css`. Use color scarcely: the UI is neutral grey; the orange `--accent` marks only the current
  item (active filter, current chapter), the logo and focus. Categories have no colors. Links are underlined text, not colored.
  Inside live formulas and labs, colors carry meaning (one per variable, axis colors for X/Y/Z) and stay.
- Layout: a sticky top bar (`.hubtop`) on every page; a left sidebar (hub filters or the unit's chapters); square-cornered
  (6 px) panels with 1 px lines instead of shadows.
- Dark is the default theme; light is an explicit choice of the reader. Draw lab canvases with `Atlas.col('token')`
  so they follow both.

## Writing

Plain, direct sentences. Name things by what readers know from their engine. No marketing adjectives, no emoji.

- Small steps. A chapter introduces one idea and uses only ideas from earlier chapters or linked lessons.
  If a sentence needs something the reader may not know, link it (`a.x`) instead of assuming it.
- Every formula is a live `Atlas.fx` widget: each symbol a slider, with a picture of what it computes and a graph.
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
