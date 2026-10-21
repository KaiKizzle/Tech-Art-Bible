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
    { id: 'found', name: 'Foundations', color: 'cat-found', blurb: 'Short lessons from zero: what a GPU does, vectors, spaces, textures, buffers. Every other unit links back here.' },
    { id: 'shade', name: 'Shaders & rendering', color: 'cat-shade', blurb: 'What the GPU computes per pixel, and the maths that makes cheap tricks look expensive.' },
    { id: 'light', name: 'Lighting & GI', color: 'cat-light', blurb: 'Physical light, exposure and the path from scene light to display pixels.' },
    { id: 'tex', name: 'Materials & texture pipeline', color: 'cat-tex', blurb: 'How textures are authored, packed, compressed and budgeted for the GPU.' },
    { id: 'char', name: 'Characters', color: 'cat-char', blurb: 'Skin, hair and cloth: the shading models characters need, and how fabric folds in real time.' },
    { id: 'perf', name: 'Performance & tools', color: 'cat-perf', blurb: 'Finding what is slow in a frame and the tools that show it.' },
    { id: 'sd', name: 'Substance Designer', color: 'cat-sd', blurb: 'Procedural materials in Substance 3D Designer: what the numbers in a graph mean, how the core nodes combine them, how to keep graphs fast, and how to ship the result.' },
    { id: 'proj', name: 'Unity projects & assets', color: 'cat-proj', blurb: 'How a Unity project keeps track of its files: GUIDs and .meta files, prefabs and variants, scenes and Addressables, and why references break.' }
  ];

  /* Suggested orders for newcomers. Shown on the hub. */
  window.ATLAS_PATHS = [
    { name: 'Shader basics from zero', units: ['gpu-basics', 'shader-anatomy', 'vectors', 'dot-cross', 'spaces', 'textures-sampling', 'buffers', 'compute-shaders', 'color-values', 'rays-math'] },
    { name: 'Ray-traced effects in shaders', units: ['vectors', 'spaces', 'rays-math', 'ray-sphere', 'cloud-march', 'parallax', 'interior-mapping'] },
    { name: 'Light for artists', units: ['color-values', 'exposure', 'light-types', 'pbr-brdf', 'shadow-maps', 'baked-gi'] },
    { name: 'Screen effects and cost', units: ['buffers', 'depth-effects', 'transparency', 'texture-memory', 'reading-a-frame'] },
    { name: 'Materials from scratch', units: ['color-values', 'pbr-basics', 'texturing', 'texture-settings', 'texture-memory', 'mapping', 'pbr-brdf'] },
    { name: 'Character shading', units: ['pbr-brdf', 'skin', 'hair', 'cloth', 'fabric-folds', 'mapping'] },
    { name: 'Substance Designer from zero', units: ['color-values', 'sd-graphs', 'sd-blend', 'sd-warps', 'sd-pixel-fx', 'sd-performance', 'sd-publish', 'texture-settings'] },
    { name: 'Unity project hygiene', units: ['unity-guids', 'unity-prefabs', 'unity-scenes', 'unity-addressables', 'texture-settings'] }
  ];

  const ALL = ['Unity HDRP', 'Unity URP', 'Unreal'];
  window.ATLAS_UNITS = [
    /* Foundations */
    { slug: 'gpu-basics', cat: 'found', title: 'How a GPU Draws a Frame', topic: 'Pixels, shaders, waves, the pipeline', minutes: 25, level: 'Start here', engines: ALL,
      summary: 'The screen as a grid, one small program per pixel, why pixels cannot see each other, and how triangles become pixels.',
      tags: ['gpu', 'pixel', 'shader', 'rasterization', 'frame', 'wave', 'pipeline', 'beginner'] },
    { slug: 'shader-anatomy', cat: 'found', title: 'Reading a Shader', topic: 'Types, stages, built-in functions', minutes: 35, level: 'Start here', engines: ALL,
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
    { slug: 'color-values', cat: 'found', title: 'Colour as Numbers', topic: 'RGB, linear and sRGB, HDR', minutes: 25, level: 'Foundations', engines: ALL,
      summary: 'Colours as three numbers, why maths happens in linear values, values above 1, and luminance.',
      tags: ['color', 'colour', 'rgb', 'linear', 'srgb', 'gamma', 'hdr', 'luminance'] },
    { slug: 'rays-math', cat: 'found', title: 'Rays and Solving for t', topic: 'Lines, planes, spheres, boxes', minutes: 40, level: 'Foundations', engines: ALL,
      summary: 'A ray as a formula, hitting a plane, the quadratic behind sphere hits, and the slab test for boxes.',
      tags: ['ray', 'intersection', 'quadratic', 'discriminant', 'plane', 'sphere', 'aabb', 'slab test'] },

    /* Shaders & rendering */
    { slug: 'ray-sphere', cat: 'shade', title: 'Rays, Spheres and Shaders', topic: 'Full-screen ray setup', minutes: 60, level: 'Beginner', engines: ALL,
      summary: 'Build the first step of a sky or cloud effect: a ray per pixel and where it enters and leaves a planet-sized cloud layer.',
      tags: ['ray', 'sphere', 'full screen pass', 'clouds', 'atmosphere', 'camera relative', 'fov'] },
    { slug: 'interior-mapping', cat: 'shade', title: 'Rooms Behind Glass', topic: 'Interior mapping', minutes: 90, level: 'Intermediate', engines: ['Unity HDRP'], transfers: true,
      summary: 'Fake rooms behind flat windows: room space, the slab test, atlas projection, variation from one seed, curtains, mip seams and a bug lab.',
      tags: ['interior mapping', 'parallax', 'ray box', 'slab test', 'atlas', 'facade', 'shader graph', 'hlsl'] },
    { slug: 'depth-effects', cat: 'shade', title: 'Reading the Depth Buffer', topic: 'Depth, soft particles, SSAO', minutes: 50, level: 'Beginner', engines: ALL,
      summary: 'What the depth buffer stores, why it is not linear, getting metres and positions back, and the effects built on it: soft particles, water, SSAO, outlines.',
      tags: ['depth', 'z-buffer', 'reversed-z', 'linear eye depth', 'soft particles', 'water', 'ssao', 'ambient occlusion', 'outline', 'reconstruct position'] },
    { slug: 'transparency', cat: 'shade', title: 'Transparency and Alpha', topic: 'Blending, sorting, alpha test, dithering', minutes: 50, level: 'Beginner', engines: ALL,
      summary: 'How blending works, why order matters, premultiplied alpha, alpha test and thinning foliage, alpha to coverage, dithering and order-independent transparency.',
      tags: ['alpha', 'blending', 'transparent', 'sorting', 'premultiplied', 'alpha test', 'cutout', 'alpha to coverage', 'dither', 'oit', 'foliage'] },
    { slug: 'cloud-march', cat: 'shade', title: 'Marching a Cloud Layer', topic: 'Volumetric clouds', minutes: 70, level: 'Intermediate', engines: ALL,
      summary: 'From the layer interval to a raymarch: step sizes, density from height and noise, transmittance, light marching, phase functions and what it costs.',
      tags: ['clouds', 'volumetric', 'raymarching', 'fbm', 'noise', 'beer lambert', 'henyey greenstein', 'phase function', 'powder', 'transmittance'] },
    { slug: 'parallax', cat: 'shade', title: 'Parallax and POM', topic: 'Height maps without geometry', minutes: 55, level: 'Intermediate', engines: ALL,
      summary: 'Offset parallax, steep parallax and parallax occlusion mapping step by step, adaptive step counts, self-shadowing, gradients and depth offset.',
      tags: ['parallax', 'pom', 'parallax occlusion mapping', 'height map', 'steep parallax', 'relief', 'self shadow', 'pixel depth offset'] },

    /* Lighting */
    { slug: 'exposure', cat: 'light', title: 'Sun to Screen', topic: 'Exposure and tonemapping', minutes: 75, level: 'Beginner', engines: ALL,
      summary: 'Lumens, candela, lux and nits, EV100 and the physical camera, auto exposure, tonemapping curves and display encoding.',
      tags: ['exposure', 'ev100', 'lux', 'lumen', 'candela', 'nits', 'tonemapping', 'aces', 'auto exposure', 'hdr', 'srgb'] },
    { slug: 'pbr-brdf', cat: 'light', title: 'Inside a PBR Shader', topic: 'Diffuse, GGX, Fresnel, geometry', minutes: 65, level: 'Intermediate', engines: ALL,
      summary: 'The physically based shading model term by term: Lambert diffuse, the half vector, the GGX distribution, Fresnel, the geometry term and image-based light.',
      tags: ['pbr', 'brdf', 'ggx', 'fresnel', 'schlick', 'smith', 'roughness', 'metallic', 'specular', 'ibl', 'cook-torrance'] },
    { slug: 'shadow-maps', cat: 'light', title: 'Shadow Maps', topic: 'Depth from the light, bias, cascades', minutes: 50, level: 'Beginner', engines: ALL,
      summary: 'Rendering depth from the light, the comparison, shadow acne and bias, texel size, PCF soft edges and cascade splits.',
      tags: ['shadows', 'shadow map', 'bias', 'acne', 'peter panning', 'pcf', 'cascades', 'csm', 'light space'] },
    { slug: 'baked-gi', cat: 'light', title: 'Baked Light: Lightmaps and Probes', topic: 'Indirect light, SH, probes', minutes: 60, level: 'Intermediate', engines: ALL,
      summary: 'Bounce light, lightmap budgets, irradiance from a sky, spherical harmonics, probe interpolation and leaking, and box-projected reflection probes.',
      tags: ['gi', 'global illumination', 'lightmap', 'light probe', 'spherical harmonics', 'sh', 'irradiance', 'reflection probe', 'box projection', 'apv', 'lumen'] },
    { slug: 'light-types', cat: 'light', title: 'Light Types and Falloff', topic: 'Point, spot, sun, area lights', minutes: 45, level: 'Beginner', engines: ALL,
      summary: 'Inverse-square falloff with a finite range, spot cones and their units, the sun\'s soft shadow, area lights, IES profiles and the cost of many lights.',
      tags: ['light', 'point light', 'spot light', 'directional', 'sun', 'area light', 'falloff', 'attenuation', 'ies', 'clustered lighting'] },

    /* Textures */
    { slug: 'texture-memory', cat: 'tex', title: 'Texels on a Budget', topic: 'Texture memory and compression', minutes: 70, level: 'Beginner', engines: ALL,
      summary: 'What a texture costs, mipmaps and texel density, BC1 to BC7 and ASTC, sRGB versus data, channel packing per engine, and normal maps.',
      tags: ['texture', 'compression', 'bc1', 'bc7', 'bc5', 'astc', 'mipmap', 'texel density', 'srgb', 'mask map', 'orm', 'channel packing', 'normal map'] },
    { slug: 'pbr-basics', cat: 'tex', title: 'PBR Materials: the Basics', topic: 'What each map means', minutes: 45, level: 'Beginner', engines: ALL,
      summary: 'The metal/roughness workflow from the artist side: base colour ranges, metallic as a switch, roughness, normal, AO and height, and how to check values.',
      tags: ['pbr', 'albedo', 'base color', 'metallic', 'roughness', 'smoothness', 'specular gloss', 'ambient occlusion', 'height', 'material validation'] },
    { slug: 'texturing', cat: 'tex', title: 'Texturing a Game Asset', topic: 'UVs, baking, tiling and trims', minutes: 55, level: 'Beginner', engines: ALL,
      summary: 'UV seams and islands, padding and mip bleeding, texel density targets, baking mesh maps from a high-poly model, unique versus tiling textures and trim sheets.',
      tags: ['texturing', 'uv unwrap', 'seams', 'padding', 'dilation', 'texel density', 'baking', 'cage', 'trim sheet', 'tiling', 'substance painter'] },
    { slug: 'texture-settings', cat: 'tex', title: 'Texture Packing and Import Settings', topic: 'Formats, flags and automation', minutes: 50, level: 'Intermediate', engines: ALL,
      summary: 'Import settings per map type in Unity and Unreal, BC and ASTC formats, packed mask maps, an AssetPostprocessor that sets everything from file names, and a channel packer.',
      tags: ['import settings', 'texture importer', 'compression', 'bc7', 'bc5', 'bc4', 'astc', 'mask map', 'orm', 'channel packing', 'assetpostprocessor', 'max size'] },
    { slug: 'mapping', cat: 'tex', title: 'Simple Mapping Techniques', topic: 'Planar, triplanar, detail, flow, matcap', minutes: 55, level: 'Beginner', engines: ALL,
      summary: 'Texturing without (or beyond) UVs: planar and triplanar projection, detail maps, scrolling and flow maps, matcaps, spherical lookups and projected decals.',
      tags: ['triplanar', 'planar mapping', 'world space uv', 'detail map', 'overlay', 'flow map', 'uv scrolling', 'matcap', 'equirectangular', 'decal'] },

    /* Characters */
    { slug: 'skin', cat: 'char', title: 'Skin: Light Under the Surface', topic: 'Subsurface scattering', minutes: 60, level: 'Intermediate', engines: ALL,
      summary: 'Why skin is not Lambert: wrap lighting, diffusion profiles, screen-space and pre-integrated scattering, transmission through ears, and a dual-lobe specular.',
      tags: ['skin', 'subsurface scattering', 'sss', 'diffusion profile', 'pre-integrated', 'wrap lighting', 'transmission', 'thickness', 'dual specular', 'character'] },
    { slug: 'hair', cat: 'char', title: 'Hair: Strands and Cards', topic: 'Hair cards and anisotropic shading', minutes: 55, level: 'Intermediate', engines: ALL,
      summary: 'Hair cards and their cost, shading along the strand (Kajiya–Kay), shifted highlights, sorting and alpha, and root-to-tip variation.',
      tags: ['hair', 'hair cards', 'kajiya kay', 'marschner', 'anisotropic', 'strand', 'flow map', 'groom', 'character'] },
    { slug: 'cloth', cat: 'char', title: 'Cloth Shading', topic: 'Sheen, velvet, silk', minutes: 50, level: 'Intermediate', engines: ALL,
      summary: 'Why fabric looks different from plastic: the Charlie sheen, the cloth visibility term, wrapped diffuse, anisotropic silk and fuzz.',
      tags: ['cloth', 'fabric', 'sheen', 'charlie', 'velvet', 'silk', 'satin', 'anisotropic', 'fuzz', 'weave', 'character'] },
    { slug: 'fabric-folds', cat: 'char', title: 'Fabric Folds in Real Time', topic: 'Wrinkles, normal blending, cloth sim', minutes: 65, level: 'Intermediate', engines: ALL,
      summary: 'How folds form, baked folds and blending detail normals, wrinkle maps driven by stretch and joint angles, and a cloth simulation you can drag.',
      tags: ['folds', 'wrinkles', 'wrinkle map', 'tension map', 'cloth simulation', 'verlet', 'position based dynamics', 'normal blending', 'rnm', 'character'] },

    /* Performance */
    { slug: 'reading-a-frame', cat: 'perf', title: 'Reading a Frame', topic: 'Profiling and GPU cost', minutes: 70, level: 'Intermediate', engines: ALL,
      summary: 'Frame budgets, CPU- versus GPU-bound, draw calls and batching, overdraw, quad efficiency, shader divergence and LOD screen sizes.',
      tags: ['profiling', 'performance', 'draw calls', 'batching', 'srp batcher', 'instancing', 'overdraw', 'quad overdraw', 'divergence', 'lod', 'frame budget'] },

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
    { slug: 'sd-performance', cat: 'sd', title: 'Keeping Graphs Fast', topic: 'Resolution, formats, caching, heavy nodes', minutes: 40, level: 'Intermediate', engines: ALL,
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
  window.ATLAS_UNITS.forEach(u => { u.path = 'units/' + u.slug + '/index.html'; });
})();
