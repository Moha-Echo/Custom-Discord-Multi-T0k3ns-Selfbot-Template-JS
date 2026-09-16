const fs = require('fs');

const config = require('../config.json');
const prefix = config.prefix;
const defaultPrefix = config.defaultPrefix;

module.exports = {
    name: "cmd name",
    aliases: [],
    description: "desc",
    category: "cmd's category (useless)",
    command: true,
    skip: true, // "true" if u dont want it to load, else change it to "false"
    locked: ["user id of acc that cannot use this command"],

    async run(client, msg, args, cmds, cmdName, clients) {
        const ClientId = client?.user?.id;
        const clientPrefix = prefix[ClientId] || defaultPrefix;

        //...

        if (msg) {
            const d = new Date();
            console.log(`[?] | Date: ${d.toLocaleString('fr-FR')} | Author: ${msg.author.username} | Cmd: ${cmdName} | Target: ${targetInput}`);
        }
    }
};
