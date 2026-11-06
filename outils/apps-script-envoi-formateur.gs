/**
 * Réception des réponses des ateliers de formation (site climat-scolaire).
 * À coller dans un projet Google Apps Script, puis :
 * Déployer → Nouveau déploiement → Application Web
 *   Exécuter en tant que : Moi · Qui a accès : Tout le monde
 *
 * Dans le Drive du formateur, le script crée :
 *   Formation climat scolaire – réponses/
 *     Réponses formation (classeur, un onglet par atelier, une ligne par question)
 *     atelier2/
 *       <partie>/
 *         atelier2 – <partie> – <Nom>   (Google Doc, remplacé si la personne renvoie)
 *
 * Il tient aussi le tableau de recensement partagé de l'atelier 3
 * (onglet « recensement » du classeur, lu par le site toutes les 10 secondes).
 */

var NOM_DOSSIER_RACINE = 'Formation climat scolaire – réponses';
var NOM_CLASSEUR = 'Réponses formation';

function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'recensement') return json_(recensementLire_());
  return json_({ ok: true, message: 'Service de réception actif.' });
}

/* ---------- Tableau de recensement partagé (atelier 3) ---------- */
var ONGLET_RECENSEMENT = 'recensement';
var ENTETES_RECENSEMENT = ['Id', 'Date', 'Action', 'Classe / groupe', 'Période', 'Durée (h)', 'Trace', 'Ajouté par'];

function feuilleRecensement_() {
  var ss = classeur_(dossier_(DriveApp.getRootFolder(), NOM_DOSSIER_RACINE));
  var f = ss.getSheetByName(ONGLET_RECENSEMENT);
  if (!f) {
    f = ss.insertSheet(ONGLET_RECENSEMENT);
    f.appendRow(ENTETES_RECENSEMENT);
    f.setFrozenRows(1);
    f.getRange('B:B').setNumberFormat('dd/MM/yyyy HH:mm');
  }
  return f;
}

function recensementLire_() {
  var f = feuilleRecensement_();
  var n = f.getLastRow() - 1;
  if (n < 1) return { ok: true, lignes: [] };
  var v = f.getRange(2, 1, n, 8).getValues();
  return {
    ok: true,
    lignes: v.filter(function (r) { return r[0]; }).map(function (r) {
      return { id: String(r[0]), action: String(r[2]), classe: String(r[3]), periode: String(r[4]), heures: Number(r[5]) || 0, trace: String(r[6]), auteur: String(r[7]) };
    })
  };
}

function recensement_(d) {
  var f = feuilleRecensement_();
  var id = String(d.id || '').slice(0, 40);
  if (!id) return { ok: false, erreur: 'Identifiant manquant.' };
  var ids = f.getLastRow() > 1 ? f.getRange(2, 1, f.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
  var pos = ids.indexOf(id);
  if (d.type === 'recensement-suppr') {
    if (pos >= 0) f.deleteRow(pos + 2);
    return { ok: true };
  }
  if (pos >= 0) return { ok: true, doublon: true };
  var h = Number(d.heures);
  if (!d.action || !d.classe || !d.periode || !(h >= 0.25 && h <= 10)) return { ok: false, erreur: 'Ligne incomplète.' };
  f.appendRow([id, new Date(), cellule_(d.action, 100), cellule_(d.classe, 35), cellule_(d.periode, 45), h, cellule_(d.trace || '', 180), cellule_(d.auteur || '', 60)]);
  return { ok: true };
}

// Empêche une saisie d'être interprétée comme une formule dans le classeur.
function cellule_(s, max) {
  var v = String(s).replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function doPost(e) {
  var verrou = LockService.getScriptLock();
  verrou.waitLock(20000);
  try {
    var d = JSON.parse(e.postData.contents);
    if (d.type === 'recensement-ajout' || d.type === 'recensement-suppr') return json_(recensement_(d));
    var atelier = propre_(d.atelier || 'atelier', 40);
    var partie = propre_(d.partie || 'partie', 90);
    var nom = propre_(d.nom || 'sans nom', 60);
    var reponses = Array.isArray(d.reponses) ? d.reponses.slice(0, 60) : [];
    if (!reponses.length) return json_({ ok: false, erreur: 'Aucune réponse.' });

    // Un même envoi reçu deux fois (repli réseau) n'est enregistré qu'une fois.
    var cache = CacheService.getScriptCache();
    if (d.id && cache.get('envoi-' + d.id)) return json_({ ok: true, doublon: true });

    var maintenant = new Date();
    var racine = dossier_(DriveApp.getRootFolder(), NOM_DOSSIER_RACINE);

    // 1. Document Google : un par atelier / partie / nom
    var dossierPartie = dossier_(dossier_(racine, atelier), partie);
    var titre = atelier + ' – ' + partie + ' – ' + nom;
    var existants = dossierPartie.getFilesByName(titre);
    var doc;
    if (existants.hasNext()) {
      doc = DocumentApp.openById(existants.next().getId());
      doc.getBody().clear();
    } else {
      doc = DocumentApp.create(titre);
      DriveApp.getFileById(doc.getId()).moveTo(dossierPartie);
    }
    var corps = doc.getBody();
    corps.appendParagraph(titre).setHeading(DocumentApp.ParagraphHeading.TITLE);
    corps.appendParagraph('Envoyé le ' + Utilities.formatDate(maintenant, 'Europe/Nicosia', 'dd/MM/yyyy à HH:mm'));
    reponses.forEach(function (r) {
      corps.appendParagraph(String(r.question || '')).setHeading(DocumentApp.ParagraphHeading.HEADING3);
      corps.appendParagraph(String(r.reponse || '—'));
    });
    doc.saveAndClose();

    // 2. Classeur : une ligne par question, pour trier et comparer
    var feuille = onglet_(classeur_(racine), atelier);
    var lignes = reponses.map(function (r) {
      return [maintenant, partie, nom, String(r.question || ''), String(r.reponse || '')];
    });
    feuille.getRange(feuille.getLastRow() + 1, 1, lignes.length, 5).setValues(lignes);

    if (d.id) cache.put('envoi-' + d.id, '1', 21600);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, erreur: String(err) });
  } finally {
    verrou.releaseLock();
  }
}

function dossier_(parent, nom) {
  var it = parent.getFoldersByName(nom);
  return it.hasNext() ? it.next() : parent.createFolder(nom);
}

function classeur_(racine) {
  var it = racine.getFilesByName(NOM_CLASSEUR);
  if (it.hasNext()) return SpreadsheetApp.openById(it.next().getId());
  var ss = SpreadsheetApp.create(NOM_CLASSEUR);
  DriveApp.getFileById(ss.getId()).moveTo(racine);
  return ss;
}

function onglet_(ss, nom) {
  var f = ss.getSheetByName(nom);
  if (!f) {
    f = ss.insertSheet(nom);
    f.appendRow(['Date', 'Partie', 'Nom', 'Question', 'Réponse']);
    f.setFrozenRows(1);
    f.getRange('A:A').setNumberFormat('dd/MM/yyyy HH:mm');
    var vide = ss.getSheetByName('Feuille 1') || ss.getSheetByName('Sheet1');
    if (vide && ss.getSheets().length > 1) ss.deleteSheet(vide);
  }
  return f;
}

function propre_(s, max) {
  return String(s).replace(/[\\\/:*?"<>|\n\r\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) || 'sans titre';
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/** À lancer une fois depuis l'éditeur pour accorder les autorisations Drive. */
function autoriser() {
  dossier_(DriveApp.getRootFolder(), NOM_DOSSIER_RACINE);
}
