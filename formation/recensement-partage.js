/* Atelier 3 : maquette de recensement partagée entre tous les participants.
 * Les lignes sont stockées dans l'onglet « recensement » du classeur du formateur
 * (même script Google que envoi-formateur.js, à charger avant ce fichier).
 * Sans adresse de script, la maquette locale d'origine reste en place.
 */
(function () {
  'use strict';
  var ADRESSE = window.URL_SCRIPT_FORMATEUR;
  var $ = function (id) { return document.getElementById(id); };
  if (!ADRESSE || !$('trackform')) return;

  // Lecture du tableau par balise <script> (JSONP) : les navigateurs ne la bloquent pas,
  // contrairement à fetch() vers Google quand plusieurs comptes sont connectés.
  var compteur = 0;
  function lire() {
    return new Promise(function (ok, ko) {
      var nom = 'recensementRetour' + Date.now().toString(36) + (compteur++);
      var tag = document.createElement('script'), fini = false;
      var minuteur = setTimeout(function () { fin(); ko(new Error('délai')); }, 15000);
      function fin() { fini = true; clearTimeout(minuteur); try { delete window[nom]; } catch (e) { window[nom] = undefined; } tag.remove(); }
      window[nom] = function (j) { if (fini) return; fin(); ok(j); };
      tag.onerror = function () { if (fini) return; fin(); ko(new Error('réseau')); };
      tag.src = ADRESSE + '?action=recensement&callback=' + nom + '&t=' + Date.now();
      document.head.appendChild(tag);
    });
  }

  // Le mode partagé ne s'active que si le script Google sait répondre au recensement ;
  // sinon la maquette locale d'origine reste en place.
  lire().then(function (j) { if (j && j.ok && Array.isArray(j.lignes)) demarrer(j.lignes); }).catch(function () {});

  function demarrer(lignesInitiales) {

  var CLE_NOM = 'formation-climat-nom-stagiaire';
  var lignes = lignesInitiales || [], enAttente = [], supprimees = {}, derniereErreur = false;

  // Remplace les éléments de la maquette locale pour retirer ses anciens comportements.
  function neuf(id) { var a = $(id); if (!a) return null; var b = a.cloneNode(true); a.parentNode.replaceChild(b, a); return b; }
  var form = neuf('trackform'), exemple = neuf('example-tracker'), toutEffacer = neuf('clear-track'), csv = neuf('download-csv');
  if (toutEffacer) toutEffacer.style.display = 'none';

  // Texte d'explication et colonne « Ajouté par ».
  var intro = form.previousElementSibling;
  if (intro && intro.tagName === 'P') intro.innerHTML = '<strong>Tableau partagé :</strong> chaque action ajoutée ici est visible par tous les participants, sur tous les appareils, en quelques secondes. N\'y saisissez pas de données personnelles sur les élèves.';
  var tete = document.querySelector('#tracktable thead tr');
  if (tete && tete.cells.length === 6) { var th = document.createElement('th'); th.textContent = 'Ajouté par'; tete.insertBefore(th, tete.cells[5]); }

  // Champ « Votre nom » dans le formulaire (le même que pour l'envoi au formateur).
  var grille = form.querySelector('.formgrid');
  var lab = document.createElement('label');
  lab.innerHTML = 'Votre nom<input id="tr-auteur" maxlength="60" placeholder="Ex. Dupont" autocomplete="family-name">';
  (grille || form).appendChild(lab);
  var auteur = $('tr-auteur');
  try { auteur.value = localStorage.getItem(CLE_NOM) || ''; } catch (e) {}
  auteur.addEventListener('input', function () {
    try { localStorage.setItem(CLE_NOM, auteur.value); } catch (e) {}
    [].forEach.call(document.querySelectorAll('.envoi-formateur input'), function (i) { i.value = auteur.value; });
  });

  function nouvelId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function td(v) { var x = document.createElement('td'); x.textContent = String(v == null ? '' : v); return x; }
  function etat(t) { var s = $('track-status'); if (s) s.textContent = t; }

  function toutes() {
    var vus = {};
    return lignes.concat(enAttente).filter(function (r) {
      if (supprimees[r.id] || vus[r.id]) return false;
      vus[r.id] = true;
      return true;
    });
  }

  function afficher() {
    var rows = toutes(), body = $('trackbody'), group = {};
    body.replaceChildren();
    if (!rows.length) {
      var tr0 = document.createElement('tr'), c0 = td('Aucune activité recensée pour l\'instant : ajoutez la première ligne.');
      c0.colSpan = 7; c0.className = 'muted'; tr0.appendChild(c0); body.appendChild(tr0);
    }
    rows.forEach(function (r) {
      var tr = document.createElement('tr');
      if (r.attente) tr.style.opacity = '.55';
      [r.action, r.classe, r.periode, Number(r.heures).toLocaleString('fr-FR') + ' h', r.trace || '—', r.auteur || '—'].forEach(function (v) { tr.appendChild(td(v)); });
      var c = document.createElement('td'), del = document.createElement('button');
      del.type = 'button'; del.textContent = '×'; del.setAttribute('aria-label', 'Supprimer la ligne ' + r.action);
      del.addEventListener('click', function () {
        if (!confirm('Supprimer cette ligne pour tous les participants ?\n\n' + r.action + ' · ' + r.classe)) return;
        supprimees[r.id] = true; afficher();
        envoyer({ type: 'recensement-suppr', id: r.id }).then(charger);
      });
      c.appendChild(del); tr.appendChild(c); body.appendChild(tr);
      group[r.classe] = (group[r.classe] || 0) + Number(r.heures);
    });
    var totals = $('totals'); totals.replaceChildren();
    Object.keys(group).sort().forEach(function (k) {
      var sp = document.createElement('span');
      sp.textContent = k + ' : ' + group[k].toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' / 10 h';
      totals.appendChild(sp);
    });
    if (!rows.length) { var sp = document.createElement('span'); sp.textContent = 'Pas encore de données.'; totals.appendChild(sp); }
    etat(derniereErreur
      ? 'Connexion au tableau partagé impossible pour l\'instant : nouvel essai dans quelques secondes.'
      : rows.length + ' action(s) dans le tableau partagé · mis à jour à ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  }

  function envoyer(d) {
    var corps = JSON.stringify(d);
    // Envoi sans lecture de la réponse : la relecture du tableau confirme l'enregistrement.
    return fetch(ADRESSE, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: corps })
      .then(function () { return { ok: true }; })
      .catch(function () { return { ok: false }; });
  }

  var chargement = false;
  function charger() {
    if (chargement) return Promise.resolve();
    chargement = true;
    return lire()
      .then(function (j) {
        if (!j || !j.ok) throw new Error('réponse');
        lignes = j.lignes || [];
        var ids = lignes.map(function (r) { return r.id; });
        enAttente = enAttente.filter(function (r) { return ids.indexOf(r.id) < 0 && Date.now() - r.t < 60000; });
        Object.keys(supprimees).forEach(function (id) { if (ids.indexOf(id) < 0) delete supprimees[id]; });
        derniereErreur = false;
      })
      .catch(function () { derniereErreur = true; })
      .then(function () { chargement = false; afficher(); });
  }

  function ajouter(r) {
    r.id = nouvelId(); r.attente = true; r.t = Date.now();
    enAttente.push(r); afficher();
    var d = { type: 'recensement-ajout', id: r.id, action: r.action, classe: r.classe, periode: r.periode, heures: r.heures, trace: r.trace, auteur: r.auteur };
    return envoyer(d);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var action = $('tr-action').value.trim(), classe = $('tr-class').value.trim(), periode = $('tr-period').value.trim(),
      h = Number($('tr-hours').value), trace = $('tr-proof').value.trim();
    if (!action || !classe || !periode || !isFinite(h) || h < 0.25 || h > 10) return;
    ajouter({ action: action, classe: classe, periode: periode, heures: h, trace: trace, auteur: auteur.value.trim() }).then(charger);
    var nom = auteur.value; form.reset(); auteur.value = nom;
  });

  if (exemple) exemple.addEventListener('click', function () {
    if (!confirm('Ajouter 3 lignes FICTIVES au tableau partagé ? Elles seront visibles par tous.')) return;
    var a = auteur.value.trim() || 'exemple';
    Promise.all([
      ajouter({ action: 'Débat sur le rôle des témoins (exemple)', classe: '5e A [fictif]', periode: 'Période 1', heures: 1, trace: 'Fiche EMC', auteur: a }),
      ajouter({ action: 'Atelier empathie (exemple)', classe: '5e A [fictif]', periode: 'Période 2', heures: 1, trace: 'Séance CPS', auteur: a }),
      ajouter({ action: 'Safer Internet Day (exemple)', classe: '5e A [fictif]', periode: 'Période 3', heures: 1.5, trace: 'Quiz cybercitoyenneté', auteur: a })
    ]).then(charger);
  });

  if (csv) csv.addEventListener('click', function () {
    var cell = function (s) { var v = String(s == null ? '' : s); if (/^[=+@\-\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
    var data = [['Action', 'Classe / groupe', 'Période', 'Durée réelle (heures)', 'Trace', 'Ajouté par']]
      .concat(toutes().map(function (r) { return [r.action, r.classe, r.periode, r.heures, r.trace, r.auteur]; }));
    var blob = new Blob(['﻿' + data.map(function (r) { return r.map(cell).join(';'); }).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var u = window.URL.createObjectURL(blob), a = document.createElement('a');
    a.href = u; a.download = 'nicosie-atelier3-recensement-partage.csv'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { window.URL.revokeObjectURL(u); }, 2000);
  });

  afficher();
  setInterval(function () { if (!document.hidden) charger(); }, 10000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) charger(); });
  }
})();
