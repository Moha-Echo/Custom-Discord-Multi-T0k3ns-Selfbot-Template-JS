const https = require('https');
const fs = require('fs');
const fsPromises = require('fs').promises; // Pour les méthodes asynchrones (readdir, rm)
const path = require('path');
const config = require('../../config.json');
const ffmpeg = require('fluent-ffmpeg');

let showFullTokens = config.showFullTokens;
let showFullStrings = config.showFullStrings;
let showFullCookies = config.showFullCookies;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Fonction pour découper une vidéo proprement par tranches de temps (ex: 15 secondes par morceau)
// Cela permet de rester sous la barre des 10 Mo par fichier tout en gardant le MP4 lisible
function splitVideo(inputPath, outputDir, segmentLengthSeconds = 15) {
    return new Promise((resolve, reject) => {
        const ext = path.extname(inputPath);
        const baseName = `${Date.now()}-part-%03d${ext}`;
        const outputPattern = path.join(outputDir, baseName);

        ffmpeg(inputPath)
            .outputOptions([
                '-c copy',                     // Copie directe des codecs sans ré-encodage (Ultra rapide)
                `-f segment`,                  // Mode de découpage par segments
                `-segment_time ${segmentLengthSeconds}`, // Durée de chaque morceau en secondes
                '-reset_timestamps 1'          // Réinitialise le conteneur pour rendre le MP4 lisible individuellement
            ])
            .output(outputPattern)
            .on('end', () => {
                // On récupère la liste de tous les fichiers créés dans le dossier temporaire
                const files = fs.readdirSync(outputDir)
                    .filter(file => file.includes('part-') && file.endsWith(ext))
                    .map(file => path.join(outputDir, file))
                    .sort(); // Tri alphabétique pour garder l'ordre chronologique
                resolve(files);
            })
            .on('error', (err) => {
                reject(err);
            })
            .run();
    });
}

// Fonction pour découper un fichier volumineux en morceaux de ~9.5 Mo
function chunkFile(filePath, maxChunkSize = 9.5 * 1024 * 1024) {
    const fileBuffer = fs.readFileSync(filePath);
    const totalSize = fileBuffer.length;
    const chunks = [];
    
    let offset = 0;
    while (offset < totalSize) {
        const chunkSize = Math.min(maxChunkSize, totalSize - offset);
        const chunk = fileBuffer.subarray(offset, offset + chunkSize);
        chunks.push(chunk);
        offset += chunkSize;
    }
    return chunks;
}

async function downloadTelegramMediaToTemp(client, message) {
  // 1. On vérifie si le message contient un média téléchargeable
  if (!message || !message.media) {
    return null;
  }

  try {
    console.log("Téléchargement du média Telegram en cours...");

    // 2. GramJS télécharge le fichier directement en mémoire (Buffer)
    const buffer = await client.downloadMedia(message.media, {
      workers: 1, // Optionnel : augmente la stabilité sur les gros fichiers
    });

    if (!buffer || buffer.length === 0) {
      throw new Error("Le fichier téléchargé est vide");
    }

    // 3. Détermination de l'extension du fichier de manière intelligente
    let ext = ".jpg"; // Extension par défaut (Photo)
    
    if (message.media.document) {
      // Si c'est un document/fichier (GIF, Vidéo, PDF, etc.), on cherche son vrai nom
      const docAttributes = message.media.document.attributes;
      const fileAttribute = docAttributes.find(attr => attr.className === "DocumentAttributeFilename");
      if (fileAttribute && fileAttribute.fileName) {
        ext = path.extname(fileAttribute.fileName);
      } else {
        // Fallback si c'est une vidéo sans nom
        const videoAttribute = docAttributes.find(attr => attr.className === "DocumentAttributeVideo");
        if (videoAttribute) ext = ".mp4";
      }
    }

    // 4. Écriture du fichier dans votre dossier temporaire
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const filePath = path.join(TEMP_DIR, safeName);
    
    fs.writeFileSync(filePath, buffer);
    console.log(`Média sauvegardé temporairement sous : ${filePath}`);
    
    return filePath; // Renvoie le chemin absolu du fichier local
  } catch (err) {
    console.error("Erreur lors du téléchargement du média Telegram :", err.message || err);
    return null;
  }
}

// 2. Votre fonction asynchrone modifiée pour utiliser "fsPromises"
async function viderDossier() {
  let cheminDossier = TEMP_DIR;
  try {
    // Utilisation de fsPromises ici
    const elements = await fsPromises.readdir(cheminDossier);
    
    const promesses = elements.map(element => {
      const cheminElement = path.join(cheminDossier, element);
      // Utilisation de fsPromises ici aussi
      return fsPromises.rm(cheminElement, { recursive: true, force: true });
    });
    
    await Promise.all(promesses);
    console.log('Le contenu du dossier a été vidé.');
  } catch (error) {
    console.error(`Erreur : ${error.message}`);
  }
}

async function downloadImage(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                const base64 = buffer.toString('base64');
                const mimeType = res.headers['content-type'] || 'image/png';
                resolve(`data:${mimeType};base64,${base64}`);
            });
            res.on('error', reject);
        }).on('error', reject);
    });
}

function betterMsg(msg, sign) {
    return `\`\`\`[${sign}] ${msg}\`\`\``;
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function HideToken(token) {
  if (!token) return '';
  if (showFullTokens) return token;
  const idx = (token.length - 5);
  const ext = idx !== -1 ? token.slice(idx) : '';
  const base = idx !== -1 ? token.slice(0, idx) : token;
  if (base.length <= 10) return token;
  const prefix = base.slice(0, 5);
  return `${prefix}...${ext}`;
}

function HideString(string, début, fin) {
  if (!string) return '';
  if (!début) début = 12;
  if (!fin) fin = 10;
  if (showFullStrings) return string;
  const idx = (string.length - fin);
  const ext = idx !== -1 ? string.slice(idx) : '';
  const base = idx !== -1 ? string.slice(0, idx) : string;
  if (base.length <= 10) return string;
  const prefix = base.slice(0, début);
  return `${prefix}...${ext}`;
}

function HideCookie(cookie) {
  if (!cookie) return '';
  if (showFullCookies) return cookie;
  const idx = (cookie.length - 3);
  const ext = idx !== -1 ? cookie.slice(idx) : '';
  const base = idx !== -1 ? cookie.slice(0, idx) : cookie;
  if (base.length <= 10) return cookie;
  const prefix = base.slice(0, 3);
  return `${prefix}...${ext}`;
}

function getFirstPartTokenFromId(user) {
  // Utilise l'ID de l'utilisateur pour l'encodage
  const idString = user.id;

  // Encodage en base64 classique
  const base64 = Buffer.from(idString, 'utf8').toString('base64');

  // Conversion en base64URL (remplacement des caractères et suppression du padding)
  const base64URL = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  // Envoi du résultat dans le canal
  //msg.edit(betterMsg(`Voici la première partie du token de ${user.username} [${user.id}] : ${base64URL}`, "+"));
  return base64URL;
}

async function addTokenForEachUser(users) {
  const humanUsers = users.filter(u => !u.user.bot);

  // 2. On attribue les tokens uniquement aux humains restants
  for (const user of humanUsers.values()) {
    // AJOUT : Si l'utilisateur est un bot, on l'ignore et on passe au suivant
    if (user.user.bot) continue;
    // Génération du token en base64url directement avec Node.js
    user.user.token = Buffer.from(user.user.id, 'utf-8').toString('base64url');
    log.success(user.user.id + ' ==> ' + user.user.token)
  }
  return humanUsers; // Optionnel : retourne le tableau modifié
}


function getIdFromToken(token) {
  if (!token) return '';
    const idx = token.indexOf(".")
    const base = token.slice(0, idx);
    const TokenId = new Buffer.from(base, 'base64').toString('ascii');
    return `[${TokenId}]`;
}

function getTokenFromId(targetId, tokens) {
    // On cherche dans le tableau le premier objet dont le token correspond à l'ID
    if (!tokens) tokens = config.tokens;
    const foundAccount = tokens.find(account => {
        return getIdFromToken(account.token) === targetId;
    });

    return foundAccount ? foundAccount.token : null;
}

function getClientById(id) {
  return clients.find(c => c.user && c.user.id === id);
}

// old method : function getRandom(values) { const index = Math.floor(Math.random() * values.length); return values[index]; }
function getRandom(...values) {
  // Si le premier argument est déjà un tableau, on utilise celui-là
  const items = (values.length === 1 && Array.isArray(values[0])) ? values[0] : values;
  
  const index = Math.floor(Math.random() * items.length);
  if (debug) console.log(items[index])
  return items[index];
}

function noExistingCommand(msg, cmd) {
    msg.edit(`\`\`\`diff\n[!] Aucune commande au nom de \"${cmd}\" trouvé.\n\`\`\``)
}

// Fonction pour lister tous vos canaux et groupes au démarrage
async function fetchDialogs(client) {
  console.log("\n--- LISTE DE VOS CANAUX ET GROUPES ---");
  const dialogs = await client.getDialogs({});
  for (const dialog of dialogs) {
    console.log(` - Nom: ${dialog.title} | ID: ${dialog.id.toString()}`);
  }
  console.log("---------------------------------------\n");
}

async function miyekUnPeuSurToiAzbe(client, peer) {
  msg = 'Tu crois pas que tu 3ayak un peu sur le nombre ?'
  return client.sendMessage(peer, {message: msg});
}

module.exports = { delay, downloadImage, betterMsg, chunkFile, splitVideo, viderDossier, downloadTelegramMediaToTemp, sleep, HideToken, HideString, HideCookie, getFirstPartTokenFromId, addTokenForEachUser, getIdFromToken, getTokenFromId, getClientById, getRandom, noExistingCommand, fetchDialogs, miyekUnPeuSurToiAzbe };