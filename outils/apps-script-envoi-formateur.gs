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
 */

var NOM_DOSSIER_RACINE = 'Formation climat scolaire – réponses';
var NOM_CLASSEUR = 'Réponses formation';

function doGet() {
  return json_({ ok: true, message: 'Service de réception actif.' });
}

function doPost(e) {
  var verrou = LockService.getScriptLock();
  verrou.waitLock(20000);
  try {
    var d = JSON.parse(e.postData.contents);
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
