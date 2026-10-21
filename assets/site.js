/* Tech Art Atlas — shared site footer with legal links and trademark notice. Works on the hub and on every unit page.
   Edit names and licenses in ATLAS_SITE (assets/catalog.js). Units that do not load catalog.js get the defaults below. */
(function () {
  'use strict';
  const me = document.currentScript && document.currentScript.src;
  const root = me ? new URL('../', me).href : './';
  const S = Object.assign({ name: 'Tech Art Atlas', owner: 'Kai Mergener', year: new Date().getFullYear(), contentLicense: 'CC BY 4.0', codeLicense: 'MIT', repo: '' }, window.ATLAS_SITE || {});
  // cache pages and assets for fast repeat visits (https only; GitHub Pages)
  if ('serviceWorker' in navigator && location.protocol === 'https:') { try { navigator.serviceWorker.register(root + 'sw.js'); } catch (e) {} }
  const foot = document.getElementById('site-foot') || document.querySelector('footer.foot');
  if (!foot) return;
  const isHub = document.body.dataset.unit === 'hub';
  foot.innerHTML = `
    <div class="footlinks">
      <span>© ${S.year} ${S.owner}</span>
      <span>Text and figures: <a href="https://creativecommons.org/licenses/by/4.0/deed.en" rel="license">${S.contentLicense}</a> · Code: ${S.codeLicense}</span>
      ${isHub ? '' : `<a href="${root}index.html">All units</a>`}
      <a href="${root}impressum.html">Impressum</a>
      <a href="${root}datenschutz.html">Datenschutz</a>
      ${S.repo ? `<a href="${S.repo}">Source</a>` : ''}
    </div>
    <p class="legal">Unity and the Unity logo are trademarks or registered trademarks of Unity Technologies or its affiliates in the U.S. and elsewhere. Unreal and Unreal Engine are trademarks or registered trademarks of Epic Games, Inc. in the United States of America and elsewhere. Other names may be trademarks of their owners. ${S.name} is an independent project and is not sponsored by or affiliated with Unity Technologies, Epic Games or their affiliates.</p>`;
})();
