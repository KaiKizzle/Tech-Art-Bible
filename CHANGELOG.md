# Changelog

Newest first. Each entry lists what a reader will notice on the site.

---

## 2026-10-27 · Foliage

**New topic: Foliage** (tone `#9cc04a`), with the learning path **Foliage from tree to forest**, now the featured path on the home page.

| Unit | Covers |
|---|---|
| Procedural Trees: SpeedTree and Houdini | Tree structure, growth rules, generators |
| Foliage Vertex Data: Pivots and Hierarchy | Pivots, hierarchy and masks in UV channels and vertex colour |
| Foliage Wind | Procedural wind in the vertex shader |
| Skinned and Baked Foliage Animation | Bones, simulation, vertex animation textures (VAT) |
| Foliage Shading: Normals and Translucency | Normal manipulation, two-sided leaves, translucency |
| Foliage Cards, Overdraw and Atlases | Alpha test vs blending, cutouts, depth prepass, one atlas vs several |
| Foliage LODs, Impostors and Budgets | LOD chains, impostors, voxels, budgets, LOD count vs draw calls |
| Foliage Rendering and Instancing | Draw calls, instancing, GPU culling, Unity setup |

- **Shared vertex layout** across all eight units: branch pivot in UV2–3, twig pivot in UV4–5, masks in vertex colour.
- Every unit has theory, a **Unity HDRP** build and an **Unreal Engine** build, with live formula widgets and sources.
- **Code:**
  - C#: `TreeImportCheck`, `PivotGizmos`, `WindDriver`, `VATTrigger`, `TextureArrayBuilder`, `LODReport`, `FoliageChunkRenderer`
  - HLSL: wind, pivots, VAT, normals, octahedral impostor
  - Houdini VEX wrangles
  - Unreal custom-node `.ush` files
- **Assets:** new key art and icons for the eight units.
- **Docs:** README units table and STYLE topic tone updated.
- **Site totals:** 59 units · 509 chapters · 604 cross-links · 0 broken.

## 2026-10-26 · Visual refinement

- **No chapter numbers** in the rail, chapter headings or unit headers.
- **Plain titles:** wording changed to state facts (25 units, 282 chapters, 260 widgets), and heading typography toned down.
- **Explained once:** 20 principles that were explained in several units now live only in their owning unit. Other units show a *ref card* with a short recap and a link.
- Removed 4 duplicate chapters.
- Fixed the Snell's law chapter title.
- **STYLE.md** gains writing rules: titles state facts; explain once, reference elsewhere.

## 2026-10-25 · Optics and parallax

- **New units:** Eye rendering, Ray marching, Fast parallax occlusion mapping (FPOM), Colour tint.
- **Unit page layout v5.**
