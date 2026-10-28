# Changelog

All notable changes to Tech Art Atlas, newest first.
Each release is grouped into **Content**, **Features**, **Navigation**, **Visual** and **Fixes**. Groups with no changes are left out.

---

## Mesh and texture optimization — 2026-10-27

### Content
- **Mesh Optimization: Hidden Faces and Vertex Counts** — what a mesh costs, deleting faces nobody sees, visibility culling, silhouettes, thin triangles, vertex cache order
- **Bevels and Custom Normals** — chamfer cost, face-weighted normals, the mid-poly workflow, baked bevels, normal transfer
- **UV Layout and Cost** — bytes per UV channel, 16-bit precision on tiling UVs, seams and lightmap UVs, packing, interpolators
- **Atlases, Texture Arrays and Unique Textures** — what sharing a texture saves per batching method, padding and mips, array limits, streaming, bindless
- **Texture and Cell Bombing** — per-cell offsets, Voronoi cell bombing, hex tiling, histogram-preserving blending, gradients at cell borders
- **Layered Tiling Materials and Decals** — the layer stack, blend masks and vertex paint, height blending, tiling scales that never line up, decals, an Indiana Jones and the Great Circle case study
- Each unit has Unity HDRP and Unreal Engine builds with ready-to-use tools: mesh and UV audits, a hidden-face culler, weighted normals, an atlas baker, anti-tiling and layer-blend shaders, and Blender scripts for culling and bevel baking

### Navigation
- **Topic renamed: Performance & tools → Performance & optimization**, now holding Frame Profiling and the six new units
- **New learning path: Optimizing meshes and textures** — seven units in order
- **Featured banner** on the home page now points to the new path
- **Foliage Cards** links to the general atlas and array chapter with a reference card

### Visual
- **Key art and icons** for all six units

---

## Foliage — 2026-10-27

### Content
- **Procedural Trees: SpeedTree and Houdini** — tree structure, growth rules, generators
- **Foliage Vertex Data: Pivots and Hierarchy** — pivots and masks in UV channels and vertex colour
- **Foliage Wind** — layered procedural wind in the vertex shader
- **Skinned and Baked Foliage Animation** — bones, simulation, vertex animation textures
- **Foliage Shading: Normals and Translucency** — grass and canopy normals, two-sided leaves
- **Foliage Cards, Overdraw and Atlases** — alpha test, cutouts, depth prepass, atlas strategy
- **Foliage LODs, Impostors and Budgets** — LOD chains, impostors, voxels, LOD count vs draw calls
- **Foliage Rendering and Instancing** — instancing, GPU culling, Unity terrain and GPU Resident Drawer
- All eight units use one shared vertex layout and include Unity HDRP and Unreal Engine builds

### Navigation
- **New topic: Foliage** — in the Topic filter and as its own row on the home page
- **New learning path: Foliage from tree to forest** — eight units in order
- **Featured banner** on the home page now points to the Foliage path
- **Search** finds the new units by terms such as SpeedTree, VAT, Pivot Painter, impostor and Nanite foliage

### Visual
- **Foliage colour** (lime green, `#9cc04a`) on unit tiles and the path card
- **Key art and icons** for all eight units

---

## Visual refinement — 2026-10-25

### Features
- **Reference cards** — when a chapter uses a principle explained in another unit, it shows a short recap and a link to the full explanation

### Visual
- **No chapter numbers** in the sidebar, chapter headings or unit headers
- **Calmer headings** — smaller, less stylised unit and chapter titles
- **Sidebar title** set in the body font

### Content
- **Plain titles** — 282 chapter titles and 260 widget titles in 25 units reworded to state facts
- **Explained once** — 20 principles that appeared in several units now live in one unit each
- **4 duplicate chapters** removed

### Fixes
- Snell's law chapter title corrected

---

## Optics and parallax — 2026-10-25

### Content
- **Ray Marching**, **Fast Parallax Occlusion Mapping**, **Colour Tinting and Clamping**, **Eye Shading**
- **New learning path: Ray marching to a realistic eye**

### Navigation
- **Shared top bar** — unit and legal pages use the home page's top bar, including search
- **Breadcrumbs** shown as chips at the top of the chapter sidebar

### Visual
- **New unit page layout** — chapter sidebar as a card next to a wider content column
- **Unit header and key art** side by side
- **Live formulas** show their controls next to the plot on wide screens
