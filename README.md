# Tech Art Atlas

Free, interactive learning units on the workflows behind real-time graphics for game development.
Each unit explains one technique in small steps. Every formula is live: its symbols are sliders, and the
result is drawn as a picture and a graph. Chapters link to the lessons that explain the ideas they use
(with previews on hover), optional checks sit between lessons, and engine notes map everything to
Unity HDRP, Unity URP and Unreal Engine. Nothing is scored.

Plain static HTML, CSS and JavaScript. No framework, no tracking. One small Python script (`tools/build.py`)
regenerates the link index after you add or change chapters; the site runs without it.

## Units

Every unit ends with an implementation chapter (**Build it in Unity HDRP**, or **Set it up in Designer and Unity HDRP** / **Set it up in Unity** for the Substance Designer and Unity project units): the tools it needs, numbered steps, and complete `.hlsl`, `.cs`, `.compute`, Python and shell files to copy, plus URP and Unreal notes.
The Surfaces units explain the theory renderer-neutrally first (with OpenPBR as the reference), then have a full
**Build it in Unity HDRP** chapter and a full **Build it in Unreal Engine** chapter.
Ray Marching, Fast POM, Colour Tinting and Clamping, and Eye Shading follow the same pattern and form the learning path
**Ray marching to a realistic eye**. The eight Foliage units form the path **Foliage from tree to forest**. Frame Profiling and the six mesh and texture optimisation
units form **Optimizing meshes and textures** (featured on the hub).

| Category | Unit | Folder |
|---|---|---|
| Foundations | GPU Rendering Basics | `units/gpu-basics/` |
| Foundations | Shader Anatomy (types, stages, built-in functions) | `units/shader-anatomy/` |
| Foundations | Vectors | `units/vectors/` |
| Foundations | Dot and Cross Product | `units/dot-cross/` |
| Foundations | Coordinate Spaces (matrices, projection, tangent space) | `units/spaces/` |
| Foundations | Textures and Sampling | `units/textures-sampling/` |
| Foundations | Buffers and Render Targets (incl. append buffers) | `units/buffers/` |
| Foundations | Compute Shaders (threads, groups, dispatch, shared memory, readback) | `units/compute-shaders/` |
| Foundations | Colour Values (linear, sRGB, HDR) | `units/color-values/` |
| Foundations | Ray Intersections | `units/rays-math/` |
| Shaders & rendering | Interior Mapping (rooms behind windows from one quad) | `units/interior-mapping/` |
| Shaders & rendering | Full-Screen Ray Setup (full-screen ray setup) | `units/ray-sphere/` |
| Shaders & rendering | Depth Buffer Effects (depth, soft particles, SSAO) | `units/depth-effects/` |
| Shaders & rendering | Transparency and Alpha (blending, sorting, alpha test, OIT) | `units/transparency/` |
| Shaders & rendering | Volumetric Cloud Layer (volumetric clouds) | `units/cloud-march/` |
| Shaders & rendering | Parallax Mapping and POM | `units/parallax/` |
| Shaders & rendering | Ray Marching (fixed steps, bisection and secant, sphere tracing, height fields, volumes, jitter, GPU cost) | `units/ray-marching/` |
| Shaders & rendering | Fast Parallax Occlusion Mapping (adaptive steps, Hmax start, coarse + secant, analytic heights, gradients, fades) | `units/fpom/` |
| Lighting & GI | Exposure and Tonemapping (light units, exposure, tonemapping) | `units/exposure/` |
| Lighting & GI | PBR BRDF (GGX, Fresnel, geometry, IBL) | `units/pbr-brdf/` |
| Lighting & GI | Shadow Maps (bias, PCF, cascades) | `units/shadow-maps/` |
| Lighting & GI | Lightmaps and Light Probes (SH, leaking, box projection) | `units/baked-gi/` |
| Lighting & GI | Light Types and Falloff (point, spot, sun, area, IES) | `units/light-types/` |
| Materials & texture pipeline | PBR Material Inputs (base colour, metallic, roughness, AO) | `units/pbr-basics/` |
| Materials & texture pipeline | Texturing a Game Asset (UVs, padding, density, baking, trims) | `units/texturing/` |
| Materials & texture pipeline | Texture Memory (memory, mips, compression, packing) | `units/texture-memory/` |
| Materials & texture pipeline | Texture Packing and Import Settings (formats, layouts, import script, packer) | `units/texture-settings/` |
| Materials & texture pipeline | Texture Mapping Techniques (planar, triplanar, detail, flow, matcap, decals) | `units/mapping/` |
| Materials & texture pipeline | Colour Tinting and Clamping (linear maths, grey tint masks, luminance, hue-preserving saturation caps, plausible ranges) | `units/color-tint/` |
| Characters | Skin Shading (wrap, diffusion profiles, pre-integrated, transmission) | `units/skin/` |
| Characters | Hair Shading (Kajiya–Kay, shifted highlights, sorting) | `units/hair/` |
| Characters | Cloth Shading (sheen, cloth visibility, silk anisotropy, fuzz, weave) | `units/cloth/` |
| Characters | Fabric Folds and Wrinkles (normal blending, wrinkle maps, Verlet cloth lab) | `units/fabric-folds/` |
| Characters | Eye Shading (cornea, parallax, two meshes, refraction, iris profile, march, tint, cost) | `units/eyes/` |
| Performance & optimization | Frame Profiling (budgets, batching, overdraw, LODs) | `units/reading-a-frame/` |
| Performance & optimization | Mesh Optimization: Hidden Faces and Vertex Counts (hidden faces, visibility culling, silhouettes, triangulation, vertex cache) | `units/mesh-optimization/` |
| Performance & optimization | Bevels and Custom Normals (chamfer cost, weighted normals, mid-poly, baked bevels, normal transfer) | `units/bevels-normals/` |
| Performance & optimization | UV Layout and Cost (bytes per channel, 16-bit precision, seams, packing, interpolators) | `units/uv-cost/` |
| Performance & optimization | Atlases, Texture Arrays and Unique Textures (batching, padding and mips, arrays, streaming, bindless) | `units/atlas-array/` |
| Performance & optimization | Texture and Cell Bombing (offsets, Voronoi bombing, hex tiling, histogram-preserving blending, gradients) | `units/texture-bombing/` |
| Performance & optimization | Layered Tiling Materials and Decals (layer stack, masks, height blending, tiling scales, decals, Indiana Jones case study) | `units/layered-tiling/` |
| Substance Designer | Graphs, Bit Depth and Colour Space (inheritance, 8/16 bit, float, sRGB vs linear) | `units/sd-graphs/` |
| Substance Designer | Blend Modes (every mode as a formula, masks, height blend) | `units/sd-blend/` |
| Substance Designer | Warps and Distortion (directional, gradient, vector warp, slope blur) | `units/sd-warps/` |
| Substance Designer | Pixel Processor and FX-Maps (function graphs, quadtrees, scattering) | `units/sd-pixel-fx/` |
| Substance Designer | Graph Performance (resolution, formats, cache, heavy nodes, runtime) | `units/sd-performance/` |
| Substance Designer | Parameters, Publishing and Export (exposing, outputs, export, SBSAR) | `units/sd-publish/` |
| Unity projects & assets | GUIDs and .meta Files (references, breakage, version control) | `units/unity-guids/` |
| Unity projects & assets | FBX, Prefabs, Variants and Nested Prefabs (overrides, reimports) | `units/unity-prefabs/` |
| Unity projects & assets | Scene Management (single and additive, async, memory, bootstrap) | `units/unity-scenes/` |
| Unity projects & assets | Addressables (groups, refcounts, duplicates, catalogs, breakage) | `units/unity-addressables/` |
| Surfaces | PBR Terminology (terminology across renderers, OpenPBR) | `units/pbr-terms/` |
| Surfaces | Metals (complex IOR, Fresnel, edge tint, measured colours, anisotropy, coatings, rust) | `units/metals/` |
| Surfaces | Reflections and Mirrors (probes, box projection, SSR, planar, RT, fakes) | `units/reflections/` |
| Surfaces | Glass (Fresnel, Snell, shapes, absorption, screen refraction, frost, cheap glass) | `units/glass/` |
| Surfaces | Screen-Space Transparency (copies, masks, leaks, thickness) | `units/screen-transparency/` |
| Surfaces | Water (waves, depth, absorption, foam, refraction, caustics, underwater, tiers) | `units/water/` |
| Foliage | Procedural Trees: SpeedTree and Houdini (structure, pipe model, phyllotaxis, L-systems, cards, tool output) | `units/foliage-trees/` |
| Foliage | Foliage Vertex Data: Pivots and Hierarchy (UV channels, precision, layouts, Pivot Painter 2, pitfalls) | `units/foliage-vertex-data/` |
| Foliage | Foliage Wind (wind field, bend, branch sway, flutter, motion vectors, interaction, cost) | `units/foliage-wind/` |
| Foliage | Skinned and Baked Foliage Animation (bones, springs, vertex animation textures, Nanite skinning) | `units/foliage-animation/` |
| Foliage | Foliage Shading: Normals and Translucency (grass and canopy normals, two-sided modes, translucency, variation) | `units/foliage-shading/` |
| Foliage | Foliage Cards, Overdraw and Atlases (alpha test, cutouts, prepass, shadows, atlases, texture arrays) | `units/foliage-cards/` |
| Foliage | Foliage LODs, Impostors and Budgets (LOD chains, LOD count vs batches, impostors, voxels, budgets) | `units/foliage-lods/` |
| Foliage | Foliage Rendering and Instancing (draw calls, instancing, GPU-driven drawing, culling, placement, profiling) | `units/foliage-instancing/` |

Interior Mapping was written against Unity HDRP; its maths carries over to other engines, and the catalogue
says so on its card. Every other unit has notes for all three engines.

## Structure

```
index.html              hub: icon rail, search, filters (type, software, topic, level, sort), featured banner, rows per topic
impressum.html          legal notice template (German law, § 5 DDG) — fill in before going live
datenschutz.html        privacy policy template (GDPR / TDDDG) — fill in before going live
assets/atlas.css        shared design system (tokens, dark/light theme, unit layout, hub layout); unit pages share the hub's icon rail and search bar
assets/fonts.css        self-hosted fonts; files and OFL licenses in assets/fonts/
assets/atlas.js         shared runtime: rail, breadcrumbs, cross-link previews, live formulas (Atlas.fx), checks, glossary, engine notes, canvas helpers
assets/index.js         generated by tools/build.py: chapter lists, link targets and "Used in" backlinks
tools/build.py          regenerates assets/index.js and reports links to chapters that do not exist
assets/renders.js       GLSL key-art scenes (source for assets/keyart/*.webp, see tools/render_keyart.py)
assets/keyart/          the rendered key art, one WebP per unit
assets/icons.js         line icons for the hub tiles and placeholders
assets/img/             your own images by name: tiles, unit banners, path banners, software badges (see assets/img/README.txt)
assets/surf.js          shared Fresnel, GGX and picture helpers for the Surfaces units
sw.js                   service worker: caches pages and versioned assets for fast repeat visits
assets/site.js          shared footer with legal links and trademark notice
assets/catalog.js       site settings (name, owner, licenses) and one entry per unit
assets/hub.js           hub rendering
units/<slug>/index.html one unit
units/<slug>/<name>.js  that unit's formulas and labs
units/_template/        a starting point for new units
STYLE.md                visual rules: render, diagram, pixel grid and voxel modes
```

The site makes no third-party requests: no font CDN, no analytics, no embeds. Keep it that way, it is what keeps
the privacy policy short (see `datenschutz.html`).

## Run it locally

Any static server works. From this folder:

```
python3 -m http.server 8000
```

Then open http://localhost:8000. Opening `index.html` directly from disk also works in most browsers.

## Publish on GitHub Pages

1. Create a new public repository on GitHub, for example `tech-art-atlas`.
2. Upload the contents of this folder to the repository root (or `git init`, commit and push).
   Keep the empty `.nojekyll` file: it tells Pages to serve the files as they are.
3. In the repository go to **Settings → Pages**, set **Source** to *Deploy from a branch*,
   choose `main` and `/ (root)`, and save.
4. After a minute the site is live at `https://<your-user>.github.io/tech-art-atlas/`.
5. Optional: put the repository URL into `repo` in `assets/catalog.js` to show the "Source on GitHub" link,
   and add a custom domain under Settings → Pages.

All links are relative, so the site works in a subfolder or on a custom domain without changes.

## Add a unit

1. Copy `units/_template/` to `units/<new-slug>/`. Its `index.html` explains every part in a comment at the top.
2. Chapters: `<section class="chapter" id="short-name" data-title="…" data-summary="…" data-builds="unit#chapter …">`.
   Use meaningful ids, other units link to them. The rail, breadcrumbs and phone navigation are generated. Chapter titles
   name the topic as a fact (see `STYLE.md`).
3. Formulas: place `<div class="fx" data-fx="name"></div>` and define it in the unit's script with
   `Atlas.fx('name', { title, expr, vars, out, draw, plot })`. Write variables in `expr` as `{key}`; each becomes a
   coloured chip with a slider, and the reader can graph the output against any of them. `units/_template/template.js`
   has a complete example; every unit's `.js` file has many more.
4. Cross-links: `<a class="x" href="../<unit>/index.html#<chapter>">…</a>` for any idea explained elsewhere. When a chapter
   relies on a principle another unit owns, do not explain it again: add a reference card,
   `<aside class="refcard"><div class="rc-t"><span class="rk">Explained once, used here</span><p>one-line recap</p></div><a class="x refto" href="../<unit>/index.html#<chapter>">Open the full explanation</a></aside>`,
   and keep only what is specific to your topic.
   `needs` (before this unit) and `next` cards go in `<div class="needs" data-needs="unit#chapter …">` and
   `<div class="next" data-next="unit …">`.
5. Checks: `<details class="check"><summary></summary><script type="application/json">[[question, [options], right, why], …]</script></details>`
   between lessons. They are optional for the reader and never scored or stored.
6. Glossary words: `<button type="button" class="term" data-term="key">word</button>` plus an entry in the
   `glossary-data` JSON at the end of the page: `"key": ["Term", "Definition", "optional link"]`.
7. Engine notes: `<div class="engines">` with `<div class="eng" data-engine="hdrp|urp|unreal">` panes.
8. Labs: `Atlas.fig(canvas, draw)` draws in the canvas' fixed logical size (its width/height attributes) and never
   resizes itself. Use `Atlas.range`, `Atlas.seg`, `Atlas.pointer`, and read colours through `Atlas.col('token')`.
9. Key art: a scene in `assets/renders.js` named after the slug, rendered with `python tools/render_keyart.py <slug>`, or your own image (see `STYLE.md`). Add a hub icon in `assets/icons.js`.
10. Add an entry to `window.ATLAS_UNITS` in `assets/catalog.js` (and to a learning path in `ATLAS_PATHS` if it fits).
    Optional fields: `type: 'workflow'` (default `'unit'`), `software: ['any', 'unity', 'unreal', 'sd', 'blender']` (the badges;
    a default is derived from the topic and engines), `added: 'YYYY-MM-DD'` (or list the slug under a date in `ADDED`).
    The home banner is `window.ATLAS_FEATURED` at the end of the catalogue: `{ kind: 'path' | 'unit', id, date, title, subtitle, button }`.
11. Run `python3 tools/build.py` last. It rewrites `assets/index.js`, lists any links to chapters that do not exist, and stamps every CSS/JS link with a content hash (`?v=`) so browsers and the service worker pick up changes.

## Rename the site

The name appears in `ATLAS_SITE.name` (`assets/catalog.js`), the hub's `<title>` and header in `index.html`,
and the "← Tech Art Atlas" link and footer of each unit. A search and replace for "Tech Art Atlas" covers it.

## Privacy

The only things stored are the reader's theme and engine choice, in their own browser (`localStorage`, keys
`atlas:theme` and `atlas:engine`). Nothing is scored, tracked or sent anywhere.

## Before you go live

1. Fill in `impressum.html` and `datenschutz.html` and remove the yellow "Vorlage" box on each.
2. Check the owner name and licenses in `ATLAS_SITE` in `assets/catalog.js`.
3. Check `LICENSE` (CC BY 4.0 for text and figures, MIT for code) and change it if you prefer other terms; update the footer to match.

## License

Text and figures: CC BY 4.0. Code: MIT. Fonts: SIL Open Font License 1.1 (see `assets/fonts/OFL-*.txt`).
