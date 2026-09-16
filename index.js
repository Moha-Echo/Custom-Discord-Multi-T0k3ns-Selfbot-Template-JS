const { Client } = require("discord.js-selfbot-v13");
const fs = require("fs");
const config = require("./config.json");

const { delay, downloadImage, betterMsg, downloadTelegramMediaToTemp, sleep, HideToken, HideString, HideCookie, getFirstPartTokenFromId, addTokenForEachUser, getIdFromToken, getTokenFromId, getClientById, getRandom, noExistingCommand, fetchDialogs, miyekUnPeuSurToiAzbe } = require('./src/utils/standard.js');
const log = require("./src/utils/logger.js");

const accounts = config.tokens;
const clients = [];
const commands = new Map();
const passives = new Map();
const accountIds = () => clients.map(client => client.user?.id);
const getAuthorIdentifier = (message) => {
    return [message.author.id, message.author.username];
};

class FakeClient {
    constructor(username, fakeId) {
        this.user = {
            username: username,
            id: fakeId
        };
    }
}

const Fclient = new FakeClient('FAKE USERNAME', 'FAKE ID');
clients.push(Fclient);

const AuthorizedIds = [];

fs.readdirSync('./commands').forEach(file => {
    const command = require(`./commands/${file}`);

    if (command.command === true && command.skip === false) {
      commands.set(command.name, command);
      console.log(`[+] | Loaded command: "${command.name}" from ${file}`)
    } else if (command.command === false && command.skip === false) {
      passives.set(command.name, command);
      console.log(`[+] | Loaded passive: "${command.name}" from ${file}`)
    }
});

function createClient(token) {
    const client = new Client({
        checkUpdate: false,
    });

/*  // la ca donnait les meme commande (map) a touuuut les client et direcmtent a la creation du client sans wait le "ready"
    client.commands = commands; 
    client.passives = passives;
*/

    // mais ici mtn ca créé une map de cmd/passive pr chaque client et verifie si ya le champ "locked" existe et vaud l'id du client qui se met en "ready" si oui alors il a pas la comamnde :)
    client.commands = new Map();
    client.passives = new Map();

    
    client.once('ready', () => {
        AuthorizedIds.push(client.user?.id, Fclient.user.id);
        client.commandsLoaded = 0;
        client.passivesLoaded = 0;

        if (commands.size > 0) {
            console.log(`[i] | Setting up commands and passives for ${client.user?.username} [${client.user?.id}]...`);

            commands.forEach((cmd, cmdName) => {
                if (cmd.locked && (cmd.locked.includes(client.user?.id) || cmd.locked.includes(client.user?.username))) {
                    return;
                }
                client.commands.set(cmdName, cmd);
                client.commandsLoaded++;
            }); 

            passives.forEach((passive, passiveName) => {
                if (passive.locked && (passive.locked.includes(client.user?.id) || passive.locked.includes(client.user?.username))) {
                    return;
                }
                client.passives.set(passiveName, passive);
                client.passivesLoaded++;
            });

            //console.log(`[i] | Loaded ${client.commandsLoaded} commands and ${client.passivesLoaded} passives for ${client.user?.username} [${client.user?.id}]`);
            console.log(`[i] | ${client.commandsLoaded} loaded commands for ${client.user?.username} [${client.user?.id}]`);
            console.log(`[i] | ${client.passivesLoaded} loaded passives for ${client.user?.username} [${client.user?.id}]`);
        }

        console.log(`[c] | Client ready: ${client.user.username} [${client.user.id}]`);
    })


    client.on('messageCreate', (message) => {
        const ClientId = client.user.id;
        const clientPrefix = config.prefix;
 
        if (!message.content.startsWith(clientPrefix)) return; 
        if (!AuthorizedIds.includes(message.author.id)) return;
        
        const args = message.content.slice(clientPrefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();
        const type = "command";

        if (!commandName) return;

        const command = client.commands.get((commandName.replace(/\d+$/, "")));

        if (!command) return noExistingCommand(message, commandName);
        
        if (command.locked) {
            const [authorId, authorUsername] = getAuthorIdentifier(message);
            if (command.locked.includes(authorId) || command.locked.includes(authorUsername)) {
                console.log(`[!] | Commande "${commandName}" bloquée : L'auteur ${authorUsername} [${authorId}] est dans la liste 'locked'.`);
                return;
            }
        }

        try {
            let actionType = "Command"
            command.run(client, message, args, commands, commandName, clients, type).then(
            console.log(`[?] | Date: ${message.createdAt.toLocaleString('fr-FR')} | Author: ${message.author.username} [${message.author.id}] | Type: ${actionType}| Command: ${commandName} | ${args.length} Args: ${args.join(' ').replace(commandName, "")}`)
            )
        } catch(e) {
            console.error('[!] Erreur command : ', commandName, "\n", e)
            message.edit('\`\`\`[!] Erreur command : ' + commandName + "\`\`\`\n-# " + e)
            return;
        }
    })

    client.login(token).catch(e => { console.warn("[!] | Client login failed ", HideToken(token), (config.debug ? (": " + e) : '') )});
    console.log("[t] | Loaded token:", HideToken(token), getIdFromToken(token))
    return client;
}

for (const account of accounts) {
    if (account.token) {
        const { token } = account;
        const client = createClient(token);
        clients.push(client);
    } else if (account.invalid) {
        console.warn(`[!] | Token invalide ignoré :`, HideToken(account.invalid));
    } else {
        console.error(`[!] | Élément inconnu dans la config :`, JSON.stringify(account));
    }
}

console.log(`[p] | Default Prefix : ${config.defaultPrefix}`);
console.log(`[c] | Client ready: ${Fclient.user.username} [${Fclient.user.id}]`);
