"""Render key art: every scene in assets/renders.js becomes assets/keyart/<name>.webp (1600 x 610).
Pages show these static images, so visitors never compile the shaders.
Usage:  pip install playwright && playwright install chromium
        python tools/render_keyart.py            (all scenes)
        python tools/render_keyart.py skin hair  (only these)"""
import subprocess,time,sys,base64,pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
from playwright.sync_api import sync_playwright
OUT=pathlib.Path(ROOT / 'assets' / 'keyart')
srv=subprocess.Popen([sys.executable,'-m','http.server','8798','-d',str(ROOT)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
html='<html><body style="margin:0"><canvas id="c" style="width:1600px;height:610px;display:block"></canvas><script src="/assets/renders.js"></script></body></html>'
open(ROOT / '_ka.html','w').write(html)
try:
  with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg=b.new_page(viewport={'width':1600,'height':610},device_scale_factor=1)
    pg.on('console', lambda m: print('console',m.text[:300]) if m.type=='error' else None)
    pg.goto('http://localhost:8798/_ka.html'); pg.wait_for_timeout(500)
    names=sys.argv[1:] or pg.evaluate('AtlasRender.scenes')
    for n in names:
      t=time.time()
      url=pg.evaluate('n => { const c = document.getElementById("c"); delete c.dataset.rendered; AtlasRender.draw(c, n); return c.toDataURL("image/webp", 0.84); }', n)
      (OUT/f'{n}.webp').write_bytes(base64.b64decode(url.split(',',1)[1]))
      print(n, f'{time.time()-t:.1f}s', (OUT/f'{n}.webp').stat().st_size//1024, 'KB', flush=True)
    b.close()
finally:
  srv.terminate(); (ROOT / '_ka.html').unlink(missing_ok=True)
