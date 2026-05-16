module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        // Handle autocomplete interactions
        if (interaction.isAutocomplete()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command || !command.autocomplete) return;

            try {
                await command.autocomplete(interaction);
            } catch (error) {
                console.error('Autocomplete error:', error);
            }
            return;
        }

        if (!interaction.isChatInputCommand()) return;

        const command = interaction.client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        console.log(`[Interaction] Executing command: ${interaction.commandName}`);
        try {
            await command.execute(interaction);
            console.log(`[Interaction] Command ${interaction.commandName} finished.`);
        } catch (error) {
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an error while executing this command!', flags: [64] });
            } else {
                await interaction.reply({ content: 'There was an error while executing this command!', flags: [64] });
            }
        }
    },
};
