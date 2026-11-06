/* Envoi des réponses d'une partie d'atelier vers le Drive du formateur.
 * Usage : <script src="envoi-formateur.js" data-atelier="atelier2" defer></script>
 * Chaque <section class="section"> qui contient des champs à compléter (texte, liste, radio,
 * cases à cocher, appréciations .rating, tableaux table[data-envoi])
 * reçoit un encadré « Nom + Envoyer au formateur ».
 * Tant que URL_SCRIPT est vide, rien ne s'affiche.
 */
(function () {
  'use strict';

  // Adresse de l'application Web Google Apps Script (se termine par /exec).
  var URL_SCRIPT = 'https://script.google.com/macros/s/AKfycbyhqJ870EWeVcYU7mAHwqTUODmAphjKhZRyQyKCzVZgS8NMupRqqIuH2FZv71IYv2_7/exec';

  var tag = document.currentScript || document.querySelector('script[data-atelier]');
  var atelier = (tag && tag.getAttribute('data-atelier')) || location.pathname.split('/').pop().replace('.html', '').replace('-', '');
  if (!URL_SCRIPT) return;

  var CLE_NOM = 'formation-climat-nom-stagiaire';

  function texte(el) { return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; }

  function titreCarte(el) {
    var carte = el.closest('.card,article,.factor');
    return carte ? texte(carte.querySelector('h3')) : '';
  }

  function prefixe(titre, base) {
    if (titre && base.indexOf(titre) !== 0) return titre + (base ? ' : ' + base : '');
    return base;
  }

  function libelle(champ) {
    var l = champ.id ? document.querySelector('label[for="' + champ.id + '"]') : null;
    var base = texte(l);
    if (!base) {
      var prec = champ.previousElementSibling;
      if (prec && !/^(TEXTAREA|INPUT|SELECT|BUTTON)$/.test(prec.tagName) && texte(prec).length < 220) base = texte(prec);
    }
    var tr = champ.closest('tr');
    if (tr) base = texte(tr.querySelector('td,th')) + (base ? ' : ' + base : '');
    base = prefixe(titreCarte(champ), base);
    return base || champ.getAttribute('placeholder') || champ.id || champ.getAttribute('data-k') || 'Réponse';
  }

  // Recense tout ce qui se complète dans une partie et renvoie une fonction de lecture.
  function lecteurs(section) {
    var liste = [], radiosVus = {}, casesVues = [];
    var champs = section.querySelectorAll('textarea,select,input,[role="group"].rating,table[data-envoi]');
    [].forEach.call(champs, function (c) {
      if (c.closest('.envoi-formateur') || c.closest('form')) return;
      if (c.tagName === 'TABLE') {
        liste.push(function () {
          var lignes = [].slice.call(c.querySelectorAll('tbody tr')).filter(function (tr) { return !tr.querySelector('td[colspan]'); })
            .map(function (tr) { return [].slice.call(tr.cells).filter(function (td) { return !td.querySelector('button'); }).map(texte).filter(Boolean).join(' | '); });
          return { question: c.getAttribute('data-envoi'), reponse: lignes.join('\n') };
        });
        return;
      }
      if (c.classList.contains('rating')) {
        liste.push(function () {
          return { question: prefixe(titreCarte(c), c.getAttribute('aria-label') || 'Appréciation'), reponse: texte(c.querySelector('[aria-pressed="true"]')) };
        });
        return;
      }
      var type = (c.getAttribute('type') || '').toLowerCase();
      if (c.tagName === 'INPUT' && /^(button|submit|reset|hidden|file|search)$/.test(type)) return;
      if (type === 'radio') {
        if (radiosVus[c.name]) return;
        radiosVus[c.name] = true;
        var groupe = c.closest('.choices') || c.parentNode.parentNode;
        var q = groupe.previousElementSibling && groupe.previousElementSibling.classList.contains('question') ? texte(groupe.previousElementSibling) : '';
        liste.push(function () {
          var coche = section.querySelector('input[type="radio"][name="' + c.name + '"]:checked');
          return { question: prefixe(titreCarte(c), q) || c.name, reponse: coche ? texte(coche.closest('label')) || coche.value : '' };
        });
        return;
      }
      if (type === 'checkbox') {
        var bloc = c.closest('.card,article,fieldset') || section;
        if (casesVues.indexOf(bloc) >= 0) return;
        casesVues.push(bloc);
        liste.push(function () {
          var coches = [].slice.call(bloc.querySelectorAll('input[type="checkbox"]:checked')).map(function (x) { return '✓ ' + texte(x.closest('label')); });
          return { question: texte(bloc.querySelector('h3')) || 'Cases cochées', reponse: coches.join('\n') };
        });
        return;
      }
      liste.push(function () {
        var v = c.tagName === 'SELECT' ? (c.value ? texte(c.options[c.selectedIndex]) : '') : c.value;
        return { question: libelle(c), reponse: (v || '').trim() };
      });
    });
    return liste;
  }

  var css = document.createElement('style');
  css.textContent =
    '.envoi-formateur{margin-top:26px;border:2px dashed var(--b,#176780);background:#fff;border-radius:14px;padding:16px 20px;display:flex;flex-wrap:wrap;gap:10px 14px;align-items:center}' +
    '.envoi-formateur strong{flex:1 1 100%;color:var(--n,#123d57)}' +
    '.envoi-formateur input{flex:1 1 220px;max-width:340px;border:1px solid var(--l,#d9e6eb);border-radius:10px;padding:10px 12px}' +
    '.envoi-formateur button{border:0;border-radius:10px;background:var(--b,#176780);color:#fff;font-weight:800;padding:11px 17px}' +
    '.envoi-formateur button[disabled]{opacity:.6;cursor:wait}' +
    '.envoi-formateur .etat{font-size:14px;font-weight:700}' +
    '.envoi-formateur .ok{color:var(--g,#227460)}.envoi-formateur .ko{color:var(--o,#a85c24)}';
  document.head.appendChild(css);

  [].forEach.call(document.querySelectorAll('section.section'), function (section) {
    var lire = lecteurs(section);
    if (!lire.length) return;
    var partie = texte(section.querySelector('h2')) || section.id;
    var boite = document.createElement('div');
    boite.className = 'envoi-formateur';
    boite.innerHTML =
      '<strong>Envoyer les réponses de cette partie au formateur</strong>' +
      '<input type="text" autocomplete="family-name" placeholder="Votre nom" aria-label="Votre nom">' +
      '<button type="button">Envoyer au formateur</button>' +
      '<span class="etat" role="status" aria-live="polite"></span>';
    var nom = boite.querySelector('input'), bouton = boite.querySelector('button'), etat = boite.querySelector('.etat');
    try { nom.value = localStorage.getItem(CLE_NOM) || ''; } catch (e) {}
    nom.addEventListener('input', function () {
      try { localStorage.setItem(CLE_NOM, nom.value); } catch (e) {}
      [].forEach.call(document.querySelectorAll('.envoi-formateur input'), function (i) { if (i !== nom) i.value = nom.value; });
    });
    (section.querySelector('.wrap') || section).appendChild(boite);

    function afficher(msg, cls) { etat.textContent = msg; etat.className = 'etat ' + (cls || ''); }

    bouton.addEventListener('click', function () {
      var n = nom.value.trim();
      if (!n) { afficher('Indiquez votre nom avant l\'envoi.', 'ko'); nom.focus(); return; }
      var reponses = lire.map(function (f) { return f(); });
      if (!reponses.some(function (r) { return r.reponse; })) { afficher('Cette partie est encore vide.', 'ko'); return; }
      var idEnvoi = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      var corps = JSON.stringify({ id: idEnvoi, atelier: atelier, partie: partie, nom: n, page: location.href, reponses: reponses });
      bouton.disabled = true; afficher('Envoi en cours…');
      fetch(URL_SCRIPT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: corps })
        .then(function (r) { return r.json(); })
        .then(function (j) { if (!j || !j.ok) throw new Error((j && j.erreur) || 'refus'); afficher('✓ Envoyé au formateur (' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + ').', 'ok'); })
        .catch(function () {
          // Repli : envoi sans lecture de la réponse (certains réseaux bloquent la redirection Google).
          return fetch(URL_SCRIPT, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: corps })
            .then(function () { afficher('✓ Envoyé (confirmation non disponible sur ce réseau).', 'ok'); })
            .catch(function () { afficher('Échec de l\'envoi : vérifiez la connexion et réessayez.', 'ko'); });
        })
        .then(function () { bouton.disabled = false; });
    });
  });
})();
