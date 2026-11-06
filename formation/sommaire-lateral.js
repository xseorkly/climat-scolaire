/* Menu latéral des parties d'un atelier.
 * Usage : <script src="sommaire-lateral.js" defer></script>
 * Construit la liste à partir des <section class="section"> et de leur titre <h2>.
 * Écran large : menu fixe à gauche. Écran étroit : bouton « Parties » qui ouvre le menu.
 */
(function () {
  'use strict';

  function texte(el) { return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; }

  var sections = [].slice.call(document.querySelectorAll('section.section')).filter(function (s) {
    return s.querySelector('h2');
  });
  if (sections.length < 2) return;

  sections.forEach(function (s, i) { if (!s.id) s.id = 'partie-' + (i + 1); });

  var css = document.createElement('style');
  css.textContent =
    'section.section{scroll-margin-top:84px}' +
    '.sommaire{position:fixed;top:0;left:0;bottom:0;width:250px;z-index:50;background:#fff;border-right:1px solid var(--l,#d9e6eb);display:flex;flex-direction:column;font-family:inherit}' +
    '.sommaire-tete{padding:18px 18px 12px;border-bottom:1px solid var(--l,#d9e6eb)}' +
    '.sommaire-tete small{display:block;font-size:11px;font-weight:850;letter-spacing:.14em;text-transform:uppercase;color:var(--b,#176780)}' +
    '.sommaire-tete strong{display:block;font-size:15px;line-height:1.3;margin-top:4px;color:var(--n,#123d57)}' +
    '.sommaire ol{list-style:none;margin:0;padding:10px 10px 18px;overflow-y:auto;flex:1;counter-reset:p}' +
    '.sommaire li{margin:2px 0}' +
    '.sommaire a{display:flex;gap:10px;align-items:flex-start;text-decoration:none;color:var(--t,#183849);font-size:13.5px;line-height:1.35;padding:9px 10px;border-radius:10px;border-left:3px solid transparent}' +
    '.sommaire a:hover{background:var(--e,#eaf3f7)}' +
    '.sommaire a.actif{background:var(--e,#eaf3f7);border-left-color:var(--b,#176780);font-weight:800;color:var(--n,#123d57)}' +
    '.sommaire a b{flex:0 0 24px;height:24px;display:grid;place-items:center;border-radius:7px;background:var(--e,#eaf3f7);color:var(--b,#176780);font-size:12px}' +
    '.sommaire a.actif b{background:var(--b,#176780);color:#fff}' +
    '.sommaire .haut{border-top:1px solid var(--l,#d9e6eb);padding:10px 20px;font-size:13px;font-weight:800;color:var(--b,#176780);text-decoration:none}' +
    '.sommaire-bouton{display:none;position:fixed;left:16px;bottom:16px;z-index:51;border:0;border-radius:12px;background:var(--b,#176780);color:#fff;font-weight:800;font-size:14px;padding:12px 16px;box-shadow:0 8px 24px #123d5733;cursor:pointer}' +
    '.sommaire-voile{display:none;position:fixed;inset:0;z-index:49;background:#0b223040}' +
    '@media (min-width:1150px){body.avec-sommaire{padding-left:250px}}' +
    '@media (max-width:1149px){.sommaire{transform:translateX(-105%);transition:transform .2s;box-shadow:0 0 40px #123d5733;width:280px}' +
    '.sommaire.ouvert{transform:none}.sommaire.ouvert~.sommaire-bouton{display:none}.sommaire.ouvert~.sommaire-voile{display:block}.sommaire-bouton{display:block}}' +
    '@media print{.sommaire,.sommaire-bouton,.sommaire-voile{display:none!important}body.avec-sommaire{padding-left:0!important}}';
  document.head.appendChild(css);

  var titreAtelier = document.title.split(' | ')[0].replace(/\s*·\s*(Nicosie|Formation).*$/, '').trim();
  var nav = document.createElement('nav');
  nav.className = 'sommaire';
  nav.setAttribute('aria-label', 'Parties de l\'atelier');
  nav.innerHTML = '<div class="sommaire-tete"><small>Parties de l\'atelier</small><strong></strong></div><ol></ol><a class="haut" href="#">↑ Haut de page</a>';
  nav.querySelector('strong').textContent = titreAtelier;
  var ol = nav.querySelector('ol');

  var liens = sections.map(function (s, i) {
    var li = document.createElement('li');
    var a = document.createElement('a');
    a.href = '#' + s.id;
    a.innerHTML = '<b></b><span></span>';
    a.querySelector('b').textContent = i + 1;
    a.querySelector('span').textContent = texte(s.querySelector('h2'));
    li.appendChild(a);
    ol.appendChild(li);
    return a;
  });

  var bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = 'sommaire-bouton';
  bouton.textContent = '☰ Parties';
  bouton.setAttribute('aria-expanded', 'false');
  var voile = document.createElement('div');
  voile.className = 'sommaire-voile';

  document.body.appendChild(nav);
  document.body.appendChild(voile);
  document.body.appendChild(bouton);
  document.body.classList.add('avec-sommaire');

  function fermer() { nav.classList.remove('ouvert'); bouton.setAttribute('aria-expanded', 'false'); }
  bouton.addEventListener('click', function () {
    var o = nav.classList.toggle('ouvert');
    bouton.setAttribute('aria-expanded', String(o));
  });
  voile.addEventListener('click', fermer);
  nav.addEventListener('click', function (e) { if (e.target.closest('a')) fermer(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fermer(); });
  nav.querySelector('.haut').addEventListener('click', function (e) {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Partie en cours mise en évidence pendant le défilement.
  function maj() {
    var ligne = window.innerHeight * 0.3, actif = -1;
    sections.forEach(function (s, i) { if (s.getBoundingClientRect().top <= ligne) actif = i; });
    // En bas de page, la dernière partie visible devient active même si elle est courte.
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
      for (var k = sections.length - 1; k >= 0; k--) {
        if (sections[k].getBoundingClientRect().top < window.innerHeight) { actif = k; break; }
      }
    }
    liens.forEach(function (a, i) {
      var on = i === actif;
      a.classList.toggle('actif', on);
      if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
  }
  var attente = false;
  window.addEventListener('scroll', function () {
    if (attente) return;
    attente = true;
    requestAnimationFrame(function () { attente = false; maj(); });
  }, { passive: true });
  window.addEventListener('resize', maj);
  maj();
})();
