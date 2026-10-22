Images you add by name
======================

Drop a file into one of these folders with the right name, run
  python tools/build.py
and the hub and unit pages pick it up. Without a file, the site shows the
drawn placeholder (hub tiles) or the rendered key art (unit banners).

Accepted formats: .webp (preferred), .avif, .jpg, .png, .svg
If several formats exist for one name, the first in that order wins.

units/<slug>-tile.webp     hub tile, 4:3, at least 640 x 480
units/<slug>-hero.webp     unit banner, 21:8, at least 1600 x 610
                           (replaces the rendered key art on the unit page)
paths/<path-id>.webp       learning path card and the featured banner on
                           the home page, 16:9 or wider, at least 1600 x 900
software/<id>.svg          software badge on tiles, square, about 64 x 64
                           ids: any, unity, unreal, sd, blender

<slug> is the folder name of the unit under units/, for example
  units/metals-tile.webp, units/water-hero.webp

<path-id> is the id of the learning path in assets/catalog.js:
  shader-basics, ray-traced, light-for-artists, screen-effects, materials,
  surfaces, character-shading, substance-designer, unity-hygiene

Software badges: use artwork you are allowed to use. The official logos of
Unity, Unreal Engine, Substance and Blender are trademarks with their own
brand rules; check those before adding them to a public site.
