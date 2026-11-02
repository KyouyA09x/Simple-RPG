# Stick RPG

A single-player stickman action RPG for Windows. Fight waves of monsters across eight biomes, shop in a village before every boss, delve into dungeons, collect gear, and be reborn stronger. All art, animation and sound are drawn and synthesized by code.

> **Version 0.3.0** · see the [update log](#update-log)

> **AI "vibe coded" project.** Written almost entirely with an AI assistant (Claude) and tested mostly by running the game and automated checks. Expect bugs, changing balance, and no warranty. Keep a copy of your `saves` folder.

## Play

1. Download **Stick-RPG-Setup-<version>.exe** (an installer, no admin rights needed) from the [latest release](../../releases/latest).
2. Run it. No Node.js needed.

Windows may warn that the app is unsigned: click **More info**, then **Run anyway**. Saves are kept in `%APPDATA%\Stick RPG`, even if you uninstall, and updating is just running the newer installer. Tested on Windows 11 only (about 300 MB on disk, 0.5 GB of RAM).

## Controls

| Key | Action |
|---|---|
| **W A S D** / arrows | Move |
| **Space** | Attack |
| **Shift** | Roll |
| **Q** | Use the equipped utility (potion or Return Scroll) |
| **R** (hold) | Utility wheel |
| **X** | Swap to the spare weapon |
| **M** | Character |
| **Tab** (hold) | Menu wheel (inventory, skills) |
| **E** | Talk, enter, open |
| **Esc** / **F** | Menu / fullscreen |

## Features

- **Combat:** endless waves with a boss every 10 waves, mutations, elites, evolving creatures and pack leaders, ailments, and 30 weapons including bows, staves and boss weapons.
- **World:** eight biomes with their own creatures and bosses, weather, a day and night cycle, and dungeons of sleeping elites with chests and an evolved boss.
- **Village:** a new layout every visit with shops, an inn, an enchantress (runes and weapon essences), a church, a quest board and 14 villagers.
- **Progression:** eight gear grades, upgrades, runes, and rebirth with permanent bonuses.
- **Saving:** three slots, four difficulties, checkpoints, save export and import.

## Update log

### 0.3.1
- **A new opening:** the story begins in a village that does not survive the night.
- **Prestige** is the new name for rebirth, and every prestige raises the ceiling on crit chance and crit damage.
- **Crits are rare:** lower base crit, lower crit rolls on gear, and the Cooldown and Critical stats are gone (their points are given back).
- **Tougher monsters:** more health on every difficulty.
- **Creature moves:** mutated and evolved creatures use moves of their own, shown before they land. Some creatures resist or ignore burning, poison, bleeding, cold or stun.
- **Potions:** Swiftness and Ward at the Alchemist.
- **Quests:** a Quests window on the Tab wheel, and new escort and delivery quests.
- **Inns:** rent a room (every door has a sign) and sleep in your own bed to wake well rested for 10 minutes. The innkeepers and the guild share rumours, some of which start quests or foretell a stone door.
- **Villagers:** the Saintess joins the church, and the villagers look more varied, with hair that moves.
- **Installer:** the game now comes as a Windows installer.

## Build from source

Needs [Node.js](https://nodejs.org/) 22+.

```bash
npm ci          # install Electron and the packager
npm start       # run from the source folder
npm run pack    # build launcher/Stick RPG.exe
```

Pushing a tag that starts with `v` builds the Windows installer and publishes a Release.

## Licence

GNU General Public License v3.0. See [LICENSE](LICENSE).
