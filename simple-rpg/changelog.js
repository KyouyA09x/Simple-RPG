// The game's version and its update log (shown from the main menu). Keep GAME_VERSION the same as "version" in package.json.
const GAME_VERSION = '0.3.1';
const CHANGELOG = [
  { v: '0.3.1', notes: [
    'A new opening: the story begins in a village that does not survive the night.',
    'Prestige is the new name for rebirth. Each prestige also raises the ceiling on crit chance and crit damage.',
    'Crits are rare now: lower base crit, lower crit rolls on gear, and the Cooldown and Critical stats are gone (their points are given back).',
    'Monsters have more health on every difficulty.',
    'Mutated and evolved creatures use moves of their own, shown before they land. Some creatures resist or ignore burning, poison, bleeding, cold or stun.',
    'Swiftness and Ward potions at the Alchemist.',
    'The Quests window on the Tab wheel; new escort and delivery quests.',
    'Inns: rent a room (each door has a sign) and sleep in your own bed to wake well rested for 10 minutes. The innkeepers and the guild now share rumours, some of which start quests or foretell a stone door.',
    'The Saintess joins the church, and villagers look more varied, with hair that moves.',
    'A Windows installer, as well as the zip.'] },
  { v: '0.3.0', notes: [
    'Dungeons: stone doors lead down through eight or more floors of sleeping elites and chests to an evolved boss, in buildings such as a ruined cathedral, a cave mouth or a mausoleum.',
    'New weapon families: bows, staves, and a signature weapon from each boss.',
    'A much bigger church: halls, a cloister garden, a scriptorium and an upper floor with the bell.',
    "Orin's Rune Atelier for improving runes and essences; runes only fit the gear they suit.",
    'Every creature has idle fidgets and its own death scene.',
    'Version number and this update log on the main menu.'] },
  { v: '0.2.0', notes: [
    'Runes, essences and the Enchantress.',
    'Biome creatures, evolutions and pack leaders.',
    'A bigger village with a church and priestess, and a quest board.',
    'Return Scroll and the utility wheel (hold R).',
    'Ailments, new inventory and settings tabs, music and sound overhaul.'] },
  { v: '0.1.0', notes: ['First public release: waves, eight biomes and bosses, villages, gear, prestige and a Windows build.'] },
];
