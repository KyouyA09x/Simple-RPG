# Stick RPG

A single-player stickman action RPG for Windows. Fight waves of monsters across eight biomes, shop in a village before every boss, delve into dungeons, collect gear, and be reborn stronger. All art, animation and sound are drawn and synthesized by code.

> **Version 0.3.0** · see the [update log](#update-log)

> **AI "vibe coded" project.** Written almost entirely with an AI assistant (Claude) and tested mostly by running the game and automated checks. Expect bugs, changing balance, and no warranty. Keep a copy of your `saves` folder.

## Play

1. Download **Stick-RPG-windows.zip** from the [latest release](../../releases/latest).
2. Unzip it anywhere and run **Stick RPG.exe**. No Node.js or installer needed.

Windows may warn that the app is unsigned: click **More info**, then **Run anyway**. Saves go in a `saves` folder next to the exe and settings in `data`; copy both when you update. Tested on Windows 11 only (about 300 MB on disk, 0.5 GB of RAM).

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

## 0.3.0
- **Dungeons:** a building (ruined cathedral, cave mouth, mausoleum, broken tower, well or stone gate) opens now and then after a wave. Three to five floors of sleeping elites and evolved creatures in mazes, rooms, ring halls and crypts, with sunlight or moonlight through the ceiling. The evolved boss waits alone on its own floor, and dungeon loot is always Polished or better.
- **Ranged weapons:** bows and staves with their own attacks.
- **Boss weapons:** each of the eight bosses can drop its own signature weapon.
- **Looks:** katanas and whips come in many colours, and katana guards in several shapes.
- **Creatures:** idle fidgets and a unique death scene for every creature.
- **Drops:** runes and essences are rarer.
- **Main menu:** the version number and an update log.
- **Dev menu:** tools for dungeons, boss weapons and creatures.

## 0.2.0
- Runes and essences, biome creatures, a bigger village with a church and quest board, the Return Scroll and utility wheel, ailments.

Older versions are in [CHANGELOG.md](CHANGELOG.md).

## Build from source

Needs [Node.js](https://nodejs.org/) 22+.

```bash
npm ci          # install Electron and the packager
npm start       # run from the source folder
npm run pack    # build launcher/Stick RPG.exe
```

Pushing a tag that starts with `v` builds the Windows zip and publishes a Release.

## Licence

GNU General Public License v3.0. See [LICENSE](LICENSE).
