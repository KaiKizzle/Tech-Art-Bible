/* Tech Art Atlas — site settings and the catalogue.
   Add a unit: create units/<slug>/index.html (copy units/_template), add an entry below, run `python tools/build.py`.
   Chapter lists, counts, link previews and "Used in" links come from assets/index.js, which build.py writes. */
(function () {
  'use strict';
  window.ATLAS_SITE = {
    name: 'Tech Art Atlas',
    tagline: 'Free, interactive units on the workflows behind real-time graphics.',
    owner: 'Kai Mergener',          // shown in the footer; must match the Impressum
    contentLicense: 'CC BY 4.0',    // text and figures
    codeLicense: 'MIT',             // JavaScript and CSS
    repo: ''                        // e.g. 'https://github.com/you/tech-art-atlas' — the footer link appears once this is set
  };

  window.ATLAS_CATEGORIES = [
    { id: 'found', name: 'Foundations', tone: '#8a97ab', blurb: 'Short lessons from zero: what a GPU does, vectors, spaces, textures, buffers. Every other unit links back here.' },
    { id: 'shade', name: 'Shaders & rendering', tone: '#b07ce8', blurb: 'What the GPU computes per pixel, and the maths that makes cheap tricks look expensive.' },
    { id: 'light', name: 'Lighting & GI', tone: '#e3b341', blurb: 'Physical light, exposure and the path from scene light to display pixels.' },
    { id: 'surf', name: 'Surfaces', tone: '#4aa3f0', blurb: 'How real surfaces reflect and transmit light, renderer-agnostic first (with OpenPBR as the reference), then built in HDRP and Unreal, with cheap fallbacks for each.' },
    { id: 'tex', name: 'Materials & texture pipeline', tone: '#2fb3b3', blurb: 'How textures are authored, packed, compressed and budgeted for the GPU.' },
    { id: 'char', name: 'Characters', tone: '#e06cae', blurb: 'Skin, hair and cloth: the shading models characters need, and how fabric folds in real time.' },
    { id: 'perf', name: 'Performance & optimization', tone: '#e05a4f', blurb: 'Finding what is slow in a frame, and making meshes, UVs and textures cheaper: hidden faces, vertex counts, bevels and normals, UV cost, anti-tiling, atlases and arrays, layered tiling materials and decals.' },
    { id: 'sd', name: 'Substance Designer', tone: '#d9822b', blurb: 'Procedural materials in Substance 3D Designer: what the numbers in a graph mean, how the core nodes combine them, how to keep graphs fast, and how to ship the result.' },
    { id: 'foli', name: 'Foliage', tone: '#9cc04a', blurb: 'Trees, grass and bushes for games: procedural generation in SpeedTree and Houdini, vertex data and wind, shading, overdraw, LODs and impostors, and rendering thousands of instances.' },
    { id: 'proj', name: 'Unity projects & assets', tone: '#5b6ee8', blurb: 'How a Unity project keeps track of its files: GUIDs and .meta files, prefabs and variants, scenes and Addressables, and why references break.' }
  ];

  /* Suggested orders for newcomers. Shown on the hub. */
  window.ATLAS_PATHS = [
    { id: 'shader-basics', name: 'Shader basics from zero', units: ['gpu-basics', 'shader-anatomy', 'vectors', 'dot-cross', 'spaces', 'textures-sampling', 'buffers', 'compute-shaders', 'color-values', 'rays-math'] },
    { id: 'ray-traced', name: 'Ray-traced effects in shaders', units: ['vectors', 'spaces', 'rays-math', 'ray-sphere', 'cloud-march', 'parallax', 'interior-mapping'] },
    { id: 'light-for-artists', name: 'Light for artists', units: ['color-values', 'exposure', 'light-types', 'pbr-brdf', 'shadow-maps', 'baked-gi'] },
    { id: 'screen-effects', name: 'Screen effects and cost', units: ['buffers', 'depth-effects', 'transparency', 'texture-memory', 'reading-a-frame'] },
    { id: 'materials', name: 'Materials from scratch', units: ['color-values', 'pbr-basics', 'texturing', 'texture-settings', 'texture-memory', 'mapping', 'pbr-brdf'] },
    { id: 'character-shading', name: 'Character shading', units: ['pbr-brdf', 'skin', 'hair', 'cloth', 'fabric-folds', 'mapping'] },
    { id: 'substance-designer', name: 'Substance Designer from zero', units: ['color-values', 'sd-graphs', 'sd-blend', 'sd-warps', 'sd-pixel-fx', 'sd-performance', 'sd-publish', 'texture-settings'] },
    { id: 'unity-hygiene', name: 'Unity project hygiene', units: ['unity-guids', 'unity-prefabs', 'unity-scenes', 'unity-addressables', 'texture-settings'] },
    { id: 'surfaces', name: 'Surfaces: metal, glass and water', units: ['pbr-terms', 'pbr-basics', 'metals', 'reflections', 'glass', 'screen-transparency', 'depth-effects', 'water'] },
    { id: 'eyes-raymarch', name: 'Ray marching to a realistic eye', units: ['rays-math', 'ray-marching', 'parallax', 'fpom', 'glass', 'color-tint', 'eyes'] },
    { id: 'foliage', name: 'Foliage from tree to forest', units: ['foliage-trees', 'foliage-vertex-data', 'foliage-wind', 'foliage-animation', 'foliage-shading', 'foliage-cards', 'foliage-lods', 'foliage-instancing'] },
    { id: 'optimization', name: 'Optimizing meshes and textures', units: ['reading-a-frame', 'mesh-optimization', 'bevels-normals', 'uv-cost', 'atlas-array', 'texture-bombing', 'layered-tiling'] }
  ];

  /* The banner at the top of the hub. kind 'path' (id from ATLAS_PATHS) or 'unit' (a slug).
     Its picture is assets/img/paths/<id>.webp (or the unit's hero image); a placeholder is drawn until one exists. */
  window.ATLAS_FEATURED = { kind: 'path', id: 'optimization', date: '2026-10-27', title: 'Optimizing meshes and textures', subtitle: 'Hidden faces and vertex counts, bevels and weighted normals, what UVs cost, atlases against arrays, texture and cell bombing, and layered tiling materials with decals.', button: 'Go to path' };

  const ALL = ['Unity HDRP', 'Unity URP', 'Unreal'];
  window.ATLAS_UNITS = [
    /* Foundations */
    { slug: 'gpu-basics', cat: 'found', title: 'GPU Rendering Basics', topic: 'Pixels, shaders, waves, the pipeline', minutes: 25, level: 'Start here', engines: ALL,
      summary: 'The screen as a grid, one small program per pixel, why pixels cannot see each other, and how triangles become pixels.',
      tags: ['gpu', 'pixel', 'shader', 'rasterization', 'frame', 'wave', 'pipeline', 'beginner'] },
    { slug: 'shader-anatomy', cat: 'found', title: 'Shader Anatomy', topic: 'Types, stages, built-in functions', minutes: 35, level: 'Start here', engines: ALL,
      summary: 'Types and swizzles, vertex and pixel stages, interpolation, material properties, and the built-in functions as graphs.',
      tags: ['hlsl', 'shader graph', 'swizzle', 'lerp', 'smoothstep', 'saturate', 'frac', 'interpolation', 'barycentric', 'material properties'] },
    { slug: 'vectors', cat: 'found', title: 'Vectors', topic: 'Positions, directions, length', minutes: 25, level: 'Start here', engines: ALL,
      summary: 'Points and directions, adding and subtracting, length, normalizing, and how engines orient their axes.',
      tags: ['vector', 'normalize', 'length', 'direction', 'axes', 'left-handed', 'y-up', 'z-up'] },
    { slug: 'dot-cross', cat: 'found', title: 'Dot and Cross Product', topic: 'Angles, lighting, reflections, normals', minutes: 35, level: 'Start here', engines: ALL,
      summary: 'The two vector products behind lighting, facing tests, reflections and surface normals.',
      tags: ['dot product', 'cross product', 'lambert', 'n dot l', 'reflect', 'projection', 'normal'] },
    { slug: 'spaces', cat: 'found', title: 'Coordinate Spaces', topic: 'Matrices, projection, screen', minutes: 40, level: 'Foundations', engines: ALL,
      summary: 'Object, world, view, clip and screen space, transform matrices, the perspective divide and tangent space.',
      tags: ['matrix', 'world space', 'view space', 'clip space', 'ndc', 'perspective', 'projection', 'tangent space', 'tbn'] },
    { slug: 'textures-sampling', cat: 'found', title: 'Textures and Sampling', topic: 'UVs, wrapping, filtering', minutes: 30, level: 'Foundations', engines: ALL,
      summary: 'What a texture is, UV coordinates, wrap modes, bilinear filtering and why mipmaps exist.',
      tags: ['texture', 'uv', 'sampling', 'bilinear', 'wrap', 'clamp', 'mipmap', 'texel'] },
    { slug: 'buffers', cat: 'found', title: 'Buffers and Render Targets', topic: 'GPU memory you read and write', minutes: 45, level: 'Foundations', engines: ALL,
      summary: 'Vertex and index buffers, constant buffers and packing, structured and append buffers, and render targets.',
      tags: ['buffer', 'constant buffer', 'cbuffer', 'structured buffer', 'append buffer', 'compute', 'render target', 'depth buffer', 'gbuffer'] },
    { slug: 'compute-shaders', cat: 'found', title: 'Compute Shaders', topic: 'GPU code without triangles', minutes: 50, level: 'Foundations', engines: ALL,
      summary: 'Threads, groups and dispatches, the ID semantics, waves, group shared memory, atomics, dispatching from C# and reading results back.',
      tags: ['compute shader', 'compute', 'dispatch', 'numthreads', 'thread group', 'groupshared', 'uav', 'rwtexture', 'atomics', 'asyncgpureadback', 'kernel'] },
    { slug: 'color-values', cat: 'found', title: 'Colour Values', topic: 'RGB, linear and sRGB, HDR', minutes: 25, level: 'Foundations', engines: ALL,
      summary: 'Colours as three numbers, why maths happens in linear values, values above 1, and luminance.',
      tags: ['color', 'colour', 'rgb', 'linear', 'srgb', 'gamma', 'hdr', 'luminance'] },
    { slug: 'rays-math', cat: 'found', title: 'Ray Intersections', topic: 'Lines, planes, spheres, boxes', minutes: 40, level: 'Foundations', engines: ALL,
      summary: 'A ray as a formula, hitting a plane, the quadratic behind sphere hits, and the slab test for boxes.',
      tags: ['ray', 'intersection', 'quadratic', 'discriminant', 'plane', 'sphere', 'aabb', 'slab test'] },

    /* Shaders & rendering */
    { slug: 'ray-sphere', cat: 'shade', title: 'Full-Screen Ray Setup', topic: 'Full-screen ray setup', minutes: 60, level: 'Beginner', engines: ALL,
      summary: 'Build the first step of a sky or cloud effect: a ray per pixel and where it enters and leaves a planet-sized cloud layer.',
      tags: ['ray', 'sphere', 'full screen pass', 'clouds', 'atmosphere', 'camera relative', 'fov'] },
    { slug: 'interior-mapping', cat: 'shade', title: 'Interior Mapping', topic: 'Interior mapping', minutes: 90, level: 'Intermediate', engines: ['Unity HDRP'], transfers: true,
      summary: 'Fake rooms behind flat windows: room space, the slab test, atlas projection, variation from one seed, curtains, mip seams and a bug lab.',
      tags: ['interior mapping', 'parallax', 'ray box', 'slab test', 'atlas', 'facade', 'shader graph', 'hlsl'] },
    { slug: 'depth-effects', cat: 'shade', title: 'Depth Buffer Effects', topic: 'Depth, soft particles, SSAO', minutes: 50, level: 'Beginner', engines: ALL,
      summary: 'What the depth buffer stores, why it is not linear, getting metres and positions back, and the effects built on it: soft particles, water, SSAO, outlines.',
      tags: ['depth', 'z-buffer', 'reversed-z', 'linear eye depth', 'soft particles', 'water', 'ssao', 'ambient occlusion', 'outline', 'reconstruct position'] },
    { slug: 'transparency', cat: 'shade', title: 'Transparency and Alpha', topic: 'Blending, sorting, alpha test, dithering', minutes: 50, level: 'Beginner', engines: ALL,
      summary: 'How blending works, why order matters, premultiplied alpha, alpha test and thinning foliage, alpha to coverage, dithering and order-independent transparency.',
      tags: ['alpha', 'blending', 'transparent', 'sorting', 'premultiplied', 'alpha test', 'cutout', 'alpha to coverage', 'dither', 'oit', 'foliage'] },
    { slug: 'cloud-march', cat: 'shade', title: 'Volumetric Cloud Layer', topic: 'Volumetric clouds', minutes: 70, level: 'Intermediate', engines: ALL,
      summary: 'From the layer interval to a raymarch: step sizes, density from height and noise, transmittance, light marching, phase functions and what it costs.',
      tags: ['clouds', 'volumetric', 'raymarching', 'fbm', 'noise', 'beer lambert', 'henyey greenstein', 'phase function', 'powder', 'transmittance'] },
    { slug: 'ray-marching', cat: 'shade', title: 'Ray Marching', topic: 'Stepping along a ray until it hits', minutes: 50, level: 'Intermediate', engines: ALL, software: ['any', 'unity', 'unreal'],
      summary: 'The general method behind POM, clouds and SDF scenes: fixed steps, finding the crossing with bisection and secant steps, sphere tracing distance fields, height fields with bounding slabs, volumes, step budgets, jitter, and loops on the GPU.',
      tags: ['ray marching', 'raymarch', 'sphere tracing', 'sdf', 'signed distance field', 'secant', 'bisection', 'height field', 'volume', 'step count', 'jitter', 'blue noise', 'loop', 'ddx'] },
    { slug: 'fpom', cat: 'shade', title: 'Fast Parallax Occlusion Mapping', topic: 'POM with a small budget', minutes: 45, level: 'Intermediate', engines: ALL, software: ['any', 'unity', 'unreal'],
      summary: 'What makes parallax occlusion mapping fast: adaptive step counts, starting at the highest point, coarse steps with secant refinement, analytic heights instead of fetches, gradients taken once, and distance fades.',
      tags: ['fpom', 'pom', 'parallax occlusion mapping', 'fast pom', 'height map', 'secant', 'adaptive steps', 'sample grad', 'mip', 'derivatives', 'texture fetch', 'performance'] },
    { slug: 'parallax', cat: 'shade', title: 'Parallax Mapping and POM', topic: 'Height maps without geometry', minutes: 55, level: 'Intermediate', engines: ALL,
      summary: 'Offset parallax, steep parallax and parallax occlusion mapping step by step, adaptive step counts, self-shadowing, gradients and depth offset.',
      tags: ['parallax', 'pom', 'parallax occlusion mapping', 'height map', 'steep parallax', 'relief', 'self shadow', 'pixel depth offset'] },

    /* Lighting */
    { slug: 'exposure', cat: 'light', title: 'Exposure and Tonemapping', topic: 'Exposure and tonemapping', minutes: 75, level: 'Beginner', engines: ALL,
      summary: 'Lumens, candela, lux and nits, EV100 and the physical camera, auto exposure, tonemapping curves and display encoding.',
      tags: ['exposure', 'ev100', 'lux', 'lumen', 'candela', 'nits', 'tonemapping', 'aces', 'auto exposure', 'hdr', 'srgb'] },
    { slug: 'pbr-brdf', cat: 'light', title: 'PBR BRDF', topic: 'Diffuse, GGX, Fresnel, geometry', minutes: 65, level: 'Intermediate', engines: ALL,
      summary: 'The physically based shading model term by term: Lambert diffuse, the half vector, the GGX distribution, Fresnel, the geometry term and image-based light.',
      tags: ['pbr', 'brdf', 'ggx', 'fresnel', 'schlick', 'smith', 'roughness', 'metallic', 'specular', 'ibl', 'cook-torrance'] },
    { slug: 'shadow-maps', cat: 'light', title: 'Shadow Maps', topic: 'Depth from the light, bias, cascades', minutes: 50, level: 'Beginner', engines: ALL,
      summary: 'Rendering depth from the light, the comparison, shadow acne and bias, texel size, PCF soft edges and cascade splits.',
      tags: ['shadows', 'shadow map', 'bias', 'acne', 'peter panning', 'pcf', 'cascades', 'csm', 'light space'] },
    { slug: 'baked-gi', cat: 'light', title: 'Lightmaps and Light Probes', topic: 'Indirect light, SH, probes', minutes: 60, level: 'Intermediate', engines: ALL,
      summary: 'Bounce light, lightmap budgets, irradiance from a sky, spherical harmonics, probe interpolation and leaking, and box-projected reflection probes.',
      tags: ['gi', 'global illumination', 'lightmap', 'light probe', 'spherical harmonics', 'sh', 'irradiance', 'reflection probe', 'box projection', 'apv', 'lumen'] },
    { slug: 'light-types', cat: 'light', title: 'Light Types and Falloff', topic: 'Point, spot, sun, area lights', minutes: 45, level: 'Beginner', engines: ALL,
      summary: 'Inverse-square falloff with a finite range, spot cones and their units, the sun\'s soft shadow, area lights, IES profiles and the cost of many lights.',
      tags: ['light', 'point light', 'spot light', 'directional', 'sun', 'area light', 'falloff', 'attenuation', 'ies', 'clustered lighting'] },

    /* Textures */
    { slug: 'texture-memory', cat: 'tex', title: 'Texture Memory', topic: 'Texture memory and compression', minutes: 70, level: 'Beginner', engines: ALL,
      summary: 'What a texture costs, mipmaps and texel density, BC1 to BC7 and ASTC, sRGB versus data, channel packing per engine, and normal maps.',
      tags: ['texture', 'compression', 'bc1', 'bc7', 'bc5', 'astc', 'mipmap', 'texel density', 'srgb', 'mask map', 'orm', 'channel packing', 'normal map'] },
    { slug: 'color-tint', cat: 'tex', title: 'Colour Tinting and Clamping', topic: 'Tint masks, luminance and saturation limits', minutes: 40, level: 'Beginner', engines: ALL, software: ['any', 'unity', 'unreal'],
      summary: 'Colour maths for tintable materials: working in linear, multiply tints, the 50 % grey tint-mask convention, luminance, hue-preserving desaturation, clamping colours to a plausible range, and other tint tools.',
      tags: ['tint', 'tinting', 'colour', 'color', 'luminance', 'saturation', 'desaturate', 'clamp', 'hue', 'grey mask', 'tint mask', 'linear', 'srgb', 'team colour', 'gradient map', 'iris colour'] },
    { slug: 'pbr-basics', cat: 'tex', title: 'PBR Material Inputs', topic: 'What each map means', minutes: 45, level: 'Beginner', engines: ALL,
      summary: 'The metal/roughness workflow from the artist side: base colour ranges, metallic as a switch, roughness, normal, AO and height, and how to check values.',
      tags: ['pbr', 'albedo', 'base color', 'metallic', 'roughness', 'smoothness', 'specular gloss', 'ambient occlusion', 'height', 'material validation'] },
    { slug: 'texturing', cat: 'tex', title: 'Texturing a Game Asset', topic: 'UVs, baking, tiling and trims', minutes: 55, level: 'Beginner', engines: ALL,
      summary: 'UV seams and islands, padding and mip bleeding, texel density targets, baking mesh maps from a high-poly model, unique versus tiling textures and trim sheets.',
      tags: ['texturing', 'uv unwrap', 'seams', 'padding', 'dilation', 'texel density', 'baking', 'cage', 'trim sheet', 'tiling', 'substance painter'] },
    { slug: 'texture-settings', cat: 'tex', title: 'Texture Packing and Import Settings', topic: 'Formats, flags and automation', minutes: 50, level: 'Intermediate', engines: ALL,
      summary: 'Import settings per map type in Unity and Unreal, BC and ASTC formats, packed mask maps, an AssetPostprocessor that sets everything from file names, and a channel packer.',
      tags: ['import settings', 'texture importer', 'compression', 'bc7', 'bc5', 'bc4', 'astc', 'mask map', 'orm', 'channel packing', 'assetpostprocessor', 'max size'] },
    { slug: 'mapping', cat: 'tex', title: 'Texture Mapping Techniques', topic: 'Planar, triplanar, detail, flow, matcap', minutes: 55, level: 'Beginner', engines: ALL,
      summary: 'Texturing without (or beyond) UVs: planar and triplanar projection, detail maps, scrolling and flow maps, matcaps, spherical lookups and projected decals.',
      tags: ['triplanar', 'planar mapping', 'world space uv', 'detail map', 'overlay', 'flow map', 'uv scrolling', 'matcap', 'equirectangular', 'decal'] },

    /* Surfaces */
    { slug: 'pbr-terms', cat: 'surf', title: 'PBR Terminology', topic: 'Why one map has many names', minutes: 35, level: 'Start here', engines: ALL, software: ['any', 'unity', 'unreal'],
      summary: 'Where the names come from: diffuse maps with baked light, albedo as physics, base colour from the metallic workflow, and every other pair of names for the same map, across OpenPBR, Unity, Unreal, Substance and Blender.',
      tags: ['terminology', 'diffuse', 'albedo', 'base color', 'base colour', 'specular', 'gloss', 'smoothness', 'roughness', 'f0', 'reflectance', 'bump', 'normal', 'height', 'displacement', 'openpbr', 'standard surface', 'gltf'] },
    { slug: 'metals', cat: 'surf', title: 'Metals', topic: 'Conductors, F0, edge tint, rust', minutes: 55, level: 'Beginner', engines: ALL, software: ['any', 'unity', 'unreal'],
      summary: 'Why metals reflect in colour and have no diffuse, complex IOR, measured F0 values, edge tint (F82), roughness and energy loss, brushed metal, coatings, rust and patina, and when metallic may sit between 0 and 1.',
      tags: ['metal', 'metallic', 'conductor', 'f0', 'f82', 'edge tint', 'complex ior', 'fresnel', 'anisotropy', 'brushed metal', 'clear coat', 'rust', 'patina', 'openpbr', 'gold', 'copper'] },
    { slug: 'reflections', cat: 'surf', title: 'Reflections and Mirrors', topic: 'Probes, SSR, planar, ray tracing, fakes', minutes: 60, level: 'Intermediate', engines: ALL, software: ['any', 'unity', 'unreal'],
      summary: 'Where reflections come from in real time: prefiltered cubemaps and roughness mips, box projection, screen-space reflections and their holes, planar mirrors, ray tracing, and the cheap fallbacks that still read as metal.',
      tags: ['reflection', 'reflection probe', 'cubemap', 'box projection', 'ssr', 'planar reflection', 'mirror', 'ray tracing', 'lumen', 'specular occlusion', 'matcap', 'mobile', 'cheap metal'] },
    { slug: 'glass', cat: 'surf', title: 'Glass', topic: 'Fresnel, refraction, absorption, frost', minutes: 55, level: 'Intermediate', engines: ALL, software: ['any', 'unity', 'unreal'],
      summary: 'How glass reflects and transmits: Fresnel from 4 % to 100 %, IOR and Snell, thin and thick glass, coloured glass by absorption, screen-space refraction, frosted glass, sorting and dirt.',
      tags: ['glass', 'refraction', 'ior', 'snell', 'fresnel', 'transmission', 'beer lambert', 'absorption', 'frosted glass', 'thin walled', 'color pyramid', 'scene color', 'transparency'] },
    { slug: 'screen-transparency', cat: 'surf', title: 'Screen-Space Transparency', topic: 'Blending versus sampling the screen', minutes: 45, level: 'Intermediate', engines: ALL, software: ['any', 'unity', 'unreal'],
      summary: 'Real alpha blending against sampling the opaque colour buffer: grab pass, opaque texture, colour pyramid and scene colour, full-screen passes with stencil masks, and the artefacts each one brings.',
      tags: ['transparency', 'grab pass', 'opaque texture', 'color pyramid', 'scene color', 'custom pass', 'full screen pass', 'stencil', 'distortion', 'refraction', 'dither'] },
    { slug: 'water', cat: 'surf', title: 'Water', topic: 'Surfaces, depth, absorption, foam', minutes: 70, level: 'Intermediate', engines: ALL, software: ['any', 'unity', 'unreal'],
      summary: 'A water material from the ground up: Fresnel between reflection and refraction, normals and waves, depth from the depth buffer, per-channel absorption, shoreline foam, refraction without leaks, caustics and underwater fog.',
      tags: ['water', 'ocean', 'river', 'fresnel', 'gerstner', 'waves', 'flow map', 'depth', 'absorption', 'beer lambert', 'foam', 'caustics', 'underwater', 'single layer water', 'hdrp water'] },

    /* Foliage */
    { slug: 'foliage-trees', cat: 'foli', title: 'Procedural Trees: SpeedTree and Houdini', topic: 'Tree structure, growth rules, generators', minutes: 50, level: 'Intermediate', engines: ALL, software: ['any', 'unity', 'unreal'],
      summary: 'How game trees are built: branch levels, the pipe model for radii, phyllotaxis, length and gravity profiles, L-systems, leaf cards against leaf meshes, SpeedTree and the Houdini Labs Tree Tools, and what the pipeline must hand to the engine.',
      tags: ['tree', 'foliage', 'vegetation', 'speedtree', 'houdini', 'labs tree', 'l-system', 'phyllotaxis', 'golden angle', 'branch', 'leaf cards', 'procedural'] },
    { slug: 'foliage-vertex-data', cat: 'foli', title: 'Foliage Vertex Data: Pivots and Hierarchy', topic: 'Pivots, hierarchy and masks in UVs and colours', minutes: 45, level: 'Intermediate', engines: ALL, software: ['any', 'unity', 'unreal'],
      summary: 'What a wind shader needs per vertex and where to store it: vertex colours, UV channels and textures, precision of 8-bit, half and float data, pivot layouts for branch hierarchies, Pivot Painter 2, baking in Houdini, and what breaks the data.',
      tags: ['foliage', 'pivot', 'pivot painter', 'uv channel', 'vertex color', 'hierarchy', 'wind data', 'precision', 'half float', 'static batching', 'houdini'] },
    { slug: 'foliage-wind', cat: 'foli', title: 'Foliage Wind', topic: 'Procedural wind in the vertex shader', minutes: 55, level: 'Intermediate', engines: ALL, software: ['any', 'unity', 'unreal'],
      summary: 'Layered procedural wind: a wind field with gusts, trunk bending with length preservation, branch rotation around stored pivots, leaf flutter, wave functions, normals and motion vectors, interaction, and what wind costs per pass.',
      tags: ['wind', 'foliage', 'vertex animation', 'world position offset', 'wpo', 'bend', 'gust', 'flutter', 'crysis', 'motion vectors', 'taa', 'interaction', 'wind zone'] },
    { slug: 'foliage-animation', cat: 'foli', title: 'Skinned and Baked Foliage Animation', topic: 'Bones, simulation and vertex animation textures', minutes: 45, level: 'Advanced', engines: ALL, software: ['any', 'unity', 'unreal'],
      summary: 'When procedural wind is not enough: bones and skinning, spring simulation, vertex animation textures (layout, precision, soft-body and rigid modes, playback), Nanite skinning, and how to choose.',
      tags: ['vat', 'vertex animation texture', 'skinning', 'bones', 'skeletal', 'foliage', 'houdini', 'labs vat', 'falling tree', 'spring', 'nanite skinning', 'dynamic wind'] },
    { slug: 'foliage-shading', cat: 'foli', title: 'Foliage Shading: Normals and Translucency', topic: 'Normal manipulation, two-sided leaves, translucency', minutes: 45, level: 'Intermediate', engines: ALL, software: ['any', 'unity', 'unreal'],
      summary: 'Why card normals fail and how to fix them: grass normals toward up or the terrain, spherical and proxy normals for canopies, flip and mirror for back faces, thin translucency, occlusion and colour variation per instance.',
      tags: ['foliage', 'normals', 'spherical normals', 'grass', 'translucency', 'two sided', 'double sided', 'foliage shading', 'subsurface', 'variation', 'ao'] },
    { slug: 'foliage-cards', cat: 'foli', title: 'Foliage Cards, Overdraw and Atlases', topic: 'Alpha test, cutouts, prepass, atlases', minutes: 45, level: 'Intermediate', engines: ALL, software: ['any', 'unity', 'unreal'],
      summary: 'Why foliage is alpha-tested and why its overdraw costs more, tight cutouts against wasted pixels, depth prepasses, shadow casters, and one atlas per species against shared atlases and texture arrays.',
      tags: ['foliage', 'overdraw', 'alpha test', 'alpha clip', 'cutout', 'depth prepass', 'early z', 'atlas', 'texture array', 'leaf cards', 'shadow'] },
    { slug: 'foliage-lods', cat: 'foli', title: 'Foliage LODs, Impostors and Budgets', topic: 'LOD chains, impostors, voxels, budgets', minutes: 50, level: 'Intermediate', engines: ALL, software: ['any', 'unity', 'unreal'],
      summary: 'LOD chains for trees, how the number of LODs changes draw calls and batches, cross-fades, billboards, octahedral impostors, voxels and Nanite Foliage, and how to set and check foliage budgets.',
      tags: ['lod', 'foliage', 'impostor', 'octahedral', 'billboard', 'voxel', 'nanite foliage', 'cross-fade', 'dither', 'budget', 'draw calls', 'batches'] },
    { slug: 'foliage-instancing', cat: 'foli', title: 'Foliage Rendering and Instancing', topic: 'Draw calls, instancing, culling, Unity setup', minutes: 50, level: 'Intermediate', engines: ALL, software: ['any', 'unity', 'unreal'],
      summary: 'Rendering thousands of plants: draw calls per pass, GPU instancing and per-instance data, GPU-driven indirect drawing, culling, terrain trees and details, memory, and a profiling routine, built with the GPU Resident Drawer and a compute-culled renderer in Unity HDRP and with the Foliage tool, PCG and Nanite in Unreal.',
      tags: ['instancing', 'gpu instancing', 'gpu resident drawer', 'batchrenderergroup', 'indirect', 'culling', 'terrain', 'details', 'grass', 'foliage', 'hism', 'pcg', 'draw calls'] },

    /* Characters */
    { slug: 'eyes', cat: 'char', title: 'Eye Shading', topic: 'Cornea refraction, iris depth, tint', minutes: 75, level: 'Advanced', engines: ALL, software: ['any', 'unity', 'unreal'],
      summary: 'Eye anatomy in shader terms, then five tiers of eye shader: a painted sphere, parallax offset, two meshes with refraction, one mesh refracted onto an iris plane (HDRP Eye), and an iris raymarched against an analytic profile with one texture fetch. Tinting, mesh conventions and cost.',
      tags: ['eye', 'eyes', 'iris', 'cornea', 'sclera', 'limbus', 'pupil', 'refraction', 'raymarch', 'fpom', 'parallax', 'hdrp eye', 'cornea refraction', 'iris tint', 'caustic', 'diffusion profile', 'character'] },
    { slug: 'skin', cat: 'char', title: 'Skin Shading', topic: 'Subsurface scattering', minutes: 60, level: 'Intermediate', engines: ALL,
      summary: 'Why skin is not Lambert: wrap lighting, diffusion profiles, screen-space and pre-integrated scattering, transmission through ears, and a dual-lobe specular.',
      tags: ['skin', 'subsurface scattering', 'sss', 'diffusion profile', 'pre-integrated', 'wrap lighting', 'transmission', 'thickness', 'dual specular', 'character'] },
    { slug: 'hair', cat: 'char', title: 'Hair Shading', topic: 'Hair cards and anisotropic shading', minutes: 55, level: 'Intermediate', engines: ALL,
      summary: 'Hair cards and their cost, shading along the strand (Kajiya–Kay), shifted highlights, sorting and alpha, and root-to-tip variation.',
      tags: ['hair', 'hair cards', 'kajiya kay', 'marschner', 'anisotropic', 'strand', 'flow map', 'groom', 'character'] },
    { slug: 'cloth', cat: 'char', title: 'Cloth Shading', topic: 'Sheen, velvet, silk', minutes: 50, level: 'Intermediate', engines: ALL,
      summary: 'Why fabric looks different from plastic: the Charlie sheen, the cloth visibility term, wrapped diffuse, anisotropic silk and fuzz.',
      tags: ['cloth', 'fabric', 'sheen', 'charlie', 'velvet', 'silk', 'satin', 'anisotropic', 'fuzz', 'weave', 'character'] },
    { slug: 'fabric-folds', cat: 'char', title: 'Fabric Folds and Wrinkles', topic: 'Wrinkles, normal blending, cloth sim', minutes: 65, level: 'Intermediate', engines: ALL,
      summary: 'How folds form, baked folds and blending detail normals, wrinkle maps driven by stretch and joint angles, and a cloth simulation you can drag.',
      tags: ['folds', 'wrinkles', 'wrinkle map', 'tension map', 'cloth simulation', 'verlet', 'position based dynamics', 'normal blending', 'rnm', 'character'] },

    /* Performance */
    { slug: 'reading-a-frame', cat: 'perf', title: 'Frame Profiling', topic: 'Profiling and GPU cost', minutes: 70, level: 'Intermediate', engines: ALL,
      summary: 'Frame budgets, CPU- versus GPU-bound, draw calls and batching, overdraw, quad efficiency, shader divergence and LOD screen sizes.',
      tags: ['profiling', 'performance', 'draw calls', 'batching', 'srp batcher', 'instancing', 'overdraw', 'quad overdraw', 'divergence', 'lod', 'frame budget'] },

    /* Performance & optimization: meshes and textures */
    { slug: 'mesh-optimization', cat: 'perf', title: 'Mesh Optimization: Hidden Faces and Vertex Counts', topic: 'Hidden faces, silhouettes, triangulation', minutes: 50, level: 'Intermediate', engines: ALL, software: ['any', 'unity', 'unreal', 'blender'],
      summary: 'What a mesh costs on the GPU, deleting faces nobody sees by hand and by visibility tests, vertices on the silhouette, modelling rules that save vertices, thin triangles and triangulation, and vertex cache order.',
      tags: ['mesh optimization', 'hidden faces', 'backface', 'visibility culling', 'simplygon', 'jacket', 'jacketing', 'silhouette', 'triangulation', 'sliver', 'acmr', 'vertex cache', 'meshoptimizer', 'vertex count', 'floaters'] },
    { slug: 'bevels-normals', cat: 'perf', title: 'Bevels and Custom Normals', topic: 'Chamfers, weighted normals, baked bevels', minutes: 50, level: 'Intermediate', engines: ALL, software: ['any', 'unity', 'unreal', 'blender'],
      summary: 'Why sharp edges look wrong, three ways to round an edge, what chamfers really cost, face-weighted normals and the mid-poly workflow, baking bevels into normal maps, transferring normals, and what destroys them.',
      tags: ['bevel', 'chamfer', 'weighted normals', 'face weighted normals', 'fwn', 'mid-poly', 'custom normals', 'normal transfer', 'bevel shader', 'bake', 'hard edges', 'smoothing groups', 'mikktspace'] },
    { slug: 'uv-cost', cat: 'perf', title: 'UV Layout and Cost', topic: 'UV bytes, precision, seams, packing', minutes: 45, level: 'Intermediate', engines: ALL, software: ['any', 'unity', 'unreal'],
      summary: 'What a UV channel costs in bytes and bandwidth, 16-bit UVs and large tiling coordinates, seams in every channel and lightmap UVs, packing efficiency, overlapping and mirrored UVs, extra channels and interpolators.',
      tags: ['uv', 'uv channel', 'uv cost', 'half precision', 'fp16', 'full precision uvs', 'vertex compression', 'lightmap uv', 'seams', 'packing', 'texel density', 'mirrored uvs', 'interpolators', 'varyings'] },
    { slug: 'atlas-array', cat: 'perf', title: 'Atlases, Texture Arrays and Unique Textures', topic: 'When each container wins', minutes: 45, level: 'Intermediate', engines: ALL, software: ['any', 'unity', 'unreal'],
      summary: 'Unique textures, atlases, texture arrays and bindless or virtual texturing: what a shared texture saves with each kind of batching, padding and mips, array limits and streaming, and a decision table.',
      tags: ['atlas', 'texture atlas', 'texture array', 'texture2darray', 'unique textures', 'batching', 'srp batcher', 'static batching', 'merge actors', 'bindless', 'virtual texturing', 'mip bleeding', 'streaming'] },
    { slug: 'texture-bombing', cat: 'perf', title: 'Texture and Cell Bombing', topic: 'Breaking up tiling in the shader', minutes: 45, level: 'Advanced', engines: ALL, software: ['any', 'unity', 'unreal'],
      summary: 'Why tiling shows, random offsets per cell, texture bombing and Voronoi cell bombing, hex tiling and histogram-preserving blending, gradients at cell borders, rotated normal maps, and cost against cheaper alternatives.',
      tags: ['texture bombing', 'cell bombing', 'anti-tiling', 'stochastic texturing', 'hex tiling', 'histogram preserving', 'voronoi', 'texture repetition', 'samplegrad', 'quilez', 'mikkelsen', 'heitz neyret'] },
    { slug: 'layered-tiling', cat: 'perf', title: 'Layered Tiling Materials and Decals', topic: 'Tiling layers, masks, decals', minutes: 55, level: 'Intermediate', engines: ALL, software: ['any', 'unity', 'unreal'],
      summary: 'Why unique textures do not scale, the stack of base materials, material blending and decals, blend masks and vertex paint, height-modulated blending, tiling scales that never repeat together, and a case study of Indiana Jones and the Great Circle.',
      tags: ['layered materials', 'material blending', 'tiling', 'masks', 'vertex paint', 'height blend', 'heightlerp', 'layered lit', 'material layers', 'mesh decals', 'geo decals', 'projected decals', 'indiana jones', 'great circle', 'machinegames', 'id tech', 'doom eternal'] },

    /* Substance Designer */
    { slug: 'sd-graphs', cat: 'sd', title: 'Graphs, Bit Depth and Colour Space', topic: 'Resolution, 8/16 bit, float, sRGB and linear', minutes: 45, level: 'Beginner', engines: ALL,
      summary: 'Output size and inheritance, what 8 and 16 bits mean, why heights band, float formats, and sRGB versus linear inside a graph and on export.',
      tags: ['substance designer', 'substance', 'bit depth', '8 bit', '16 bit', 'float', 'half', 'banding', 'srgb', 'linear', 'ocio', 'aces', 'relative to parent', 'output size', 'inheritance'] },
    { slug: 'sd-blend', cat: 'sd', title: 'Blend Modes', topic: 'Copy, add, multiply, max, overlay, masks', minutes: 45, level: 'Beginner', engines: ALL,
      summary: 'The Blend node as formulas: copy, add, subtract, multiply, divide, max and min, add-sub, screen and overlay, with opacity, masks, clamping and height blending.',
      tags: ['substance designer', 'blend', 'blend modes', 'multiply', 'add', 'subtract', 'overlay', 'screen', 'max', 'min', 'add sub', 'opacity', 'mask', 'height blend', 'histogram scan', 'levels'] },
    { slug: 'sd-warps', cat: 'sd', title: 'Warps and Distortion', topic: 'Warp, directional, vector warp, slope blur', minutes: 45, level: 'Beginner', engines: ALL,
      summary: 'How a warp reads its input at shifted positions: Directional Warp, Warp along a gradient, Vector Warp, Slope Blur, the artefacts they cause and what they cost.',
      tags: ['substance designer', 'warp', 'directional warp', 'vector warp', 'slope blur', 'distortion', 'displacement', 'erosion', 'gradient'] },
    { slug: 'sd-pixel-fx', cat: 'sd', title: 'Pixel Processor and FX-Maps', topic: 'Function graphs, per-pixel maths, pattern scattering', minutes: 55, level: 'Intermediate', engines: ALL,
      summary: 'Function graphs, the Pixel Processor as a pixel shader, sampling neighbours, and FX-Maps: quadtrees, Iterate, random per pattern, blending, and when to use which.',
      tags: ['substance designer', 'pixel processor', 'fx-map', 'fxmap', 'function graph', 'quadrant', 'iterate', 'tile sampler', '$pos', '$size', 'random seed', 'scatter'] },
    { slug: 'sd-performance', cat: 'sd', title: 'Graph Performance', topic: 'Resolution, formats, caching, heavy nodes', minutes: 40, level: 'Intermediate', engines: ALL,
      summary: 'Measuring node times, cost per resolution step, greyscale and 8 bit, where exposed parameters belong, cheap blurs, and what runs at load time in an engine.',
      tags: ['substance designer', 'performance', 'optimization', 'timing', 'cache', 'blur', 'warp', 'fx-map', 'resolution', 'gpu engine', 'cpu engine', 'sbsar'] },
    { slug: 'sd-publish', cat: 'sd', title: 'Parameters, Publishing and Export', topic: 'Exposed inputs, SBSAR, texture export', minutes: 50, level: 'Beginner', engines: ALL,
      summary: 'Exposing and grouping parameters, driving many nodes from one, Visible If, outputs and usages, exporting textures with the right format and colour space, normal formats, and SBSAR in Unity and Unreal.',
      tags: ['substance designer', 'expose', 'parameters', 'visible if', 'presets', 'sbsar', 'publish', 'export', 'outputs', 'usage', 'png', 'exr', 'normal format', 'directx', 'opengl', 'substance plugin'] },

    /* Unity projects & assets */
    { slug: 'unity-guids', cat: 'proj', title: 'GUIDs and .meta Files', topic: 'How Unity references assets', minutes: 40, level: 'Beginner', engines: ['Unity HDRP', 'Unity URP'],
      summary: 'What a .meta file holds, how a reference is a GUID plus a fileID, the ways references break, missing scripts and renamed fields, and version control settings.',
      tags: ['unity', 'guid', 'meta', '.meta', 'fileid', 'missing reference', 'missing script', 'serialization', 'force text', 'yaml', 'version control', 'git', 'formerlyserializedas'] },
    { slug: 'unity-prefabs', cat: 'proj', title: 'FBX, Prefabs, Variants and Nested Prefabs', topic: 'Model import and prefab workflows', minutes: 50, level: 'Beginner', engines: ['Unity HDRP', 'Unity URP'],
      summary: 'What importing an FBX creates, prefabs and overrides, nested prefabs, prefab variants, where to make a change, wrapping models, and why reimports break overrides.',
      tags: ['unity', 'fbx', 'model', 'prefab', 'prefab variant', 'nested prefab', 'overrides', 'apply', 'revert', 'unpack', 'model importer', 'scale factor', 'reimport'] },
    { slug: 'unity-scenes', cat: 'proj', title: 'Scene Management', topic: 'Single and additive loading, bootstraps', minutes: 45, level: 'Beginner', engines: ['Unity HDRP', 'Unity URP'],
      summary: 'Loading scenes single and additive, the active scene, async loading and activation hitches, peak memory when switching, bootstrap scenes, cross-scene references and lighting.',
      tags: ['unity', 'scene', 'scenemanager', 'additive', 'loadsceneasync', 'allowsceneactivation', 'active scene', 'bootstrap', 'dontdestroyonload', 'multi-scene', 'lightmaps', 'light probes'] },
    { slug: 'unity-addressables', cat: 'proj', title: 'Addressables', topic: 'Loading content by address', minutes: 60, level: 'Intermediate', engines: ['Unity HDRP', 'Unity URP'],
      summary: 'Why direct references load everything, groups and labels, loading and releasing, reference counts, duplicated dependencies, catalogs and content builds, addressable scenes and why builds break.',
      tags: ['unity', 'addressables', 'assetbundle', 'asset reference', 'loadassetasync', 'release', 'reference count', 'groups', 'labels', 'catalog', 'duplicate dependencies', 'analyze', 'content update', 'resources'] }
  ];
  /* When each unit was added (newest first on the hub). */
  const ADDED = {
    '2026-10-14': ['gpu-basics', 'shader-anatomy', 'vectors', 'dot-cross', 'spaces', 'textures-sampling', 'buffers', 'color-values', 'rays-math', 'ray-sphere', 'interior-mapping', 'depth-effects', 'transparency', 'cloud-march', 'parallax', 'exposure', 'pbr-brdf', 'shadow-maps', 'baked-gi', 'light-types', 'texture-memory', 'reading-a-frame'],
    '2026-10-17': ['skin', 'hair', 'cloth', 'fabric-folds', 'mapping'],
    '2026-10-18': ['compute-shaders', 'pbr-basics', 'texturing', 'texture-settings'],
    '2026-10-21': ['sd-graphs', 'sd-blend', 'sd-warps', 'sd-pixel-fx', 'sd-performance', 'sd-publish', 'unity-guids', 'unity-prefabs', 'unity-scenes', 'unity-addressables'],
    '2026-10-22': ['pbr-terms', 'metals', 'reflections', 'glass', 'screen-transparency', 'water'],
    '2026-10-25': ['ray-marching', 'fpom', 'color-tint', 'eyes'],
    '2026-10-26': ['foliage-trees', 'foliage-vertex-data', 'foliage-wind', 'foliage-animation', 'foliage-shading', 'foliage-cards', 'foliage-lods', 'foliage-instancing'],
    '2026-10-27': ['mesh-optimization', 'bevels-normals', 'uv-cost', 'atlas-array', 'texture-bombing', 'layered-tiling']
  };
  /* Defaults for the tile badges.
     type: 'unit' (a lesson) or 'workflow' (a step-by-step production recipe).
     software: which tools the unit is built in — 'any' (renderer-agnostic), 'unity', 'unreal', 'sd' (Substance Designer), 'blender'. */
  window.ATLAS_SOFTWARE = { any: 'Any renderer', unity: 'Unity', unreal: 'Unreal Engine', sd: 'Substance Designer', blender: 'Blender' };
  window.ATLAS_UNITS.forEach(u => {
    u.path = 'units/' + u.slug + '/index.html';
    u.type = u.type || 'unit';
    u.software = u.software || (u.cat === 'sd' ? ['sd'] : u.cat === 'proj' ? ['unity'] : u.engines.length < 3 ? ['unity'] : ['unity', 'unreal']);
    u.added = u.added || Object.keys(ADDED).find(d => ADDED[d].includes(u.slug)) || '2026-10-14';
  });
})();
