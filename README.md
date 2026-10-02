# Stick RPG

A single-player stickman action RPG for the desktop. You fight endless waves of monsters across eight biomes, visit a village before every boss, collect gear and level up, and can be reborn at a shrine to start again stronger. Everything you see and hear (art, animation, music, sound effects) is drawn and synthesized by code. The game has no image or audio files.

## ⚠️ Read this first: AI "vibe coded" project

This game was **written almost entirely with an AI coding assistant (Claude, by Anthropic)**, directed by the owner through plain-language requests, and tested mostly by running the game and automated checks. It is a hobby project made for fun, not production software.

- Expect bugs, rough edges and unfinished ideas. Nobody has reviewed every line of the code by hand.
- Balance is still being tuned and can change between updates.
- Saves from older builds are migrated where possible, but keep a copy of the `saves` folder if you care about your progress.
- It comes with no warranty (see the licence below). Only download or run it if you are comfortable with that.

## What is it about?

You are a lone stickman holding a sword. Monsters come at you in waves. Survive them, level up, loot gear, and fight a boss at the end of every ten waves. Before each boss you can rest in a village: buy potions and gear, upgrade your weapons, sleep through the night, and prepare. When you reach the level cap you can be reborn at the shrine: you start over at level 1 with permanent bonuses and a higher level cap.

The game is built around fast, readable combat (move, swing, roll), a gear chase across eight grades, and a world that changes with the biome, the weather and the time of day.

## System requirements

The game was developed and tested on **Windows 11**. Other systems are untested.

| | Minimum | Recommended |
|---|---|---|
| OS | Windows 10 or 11, 64-bit | Windows 11 |
| CPU | Any dual-core from the last ~8 years | Quad-core |
| RAM | 2 GB free (the game itself used about 0.5 GB when measured) | 4 GB free |
| Graphics | Anything that runs Chrome. **Low** quality needs no GPU features | A GPU with WebGL 2 for Ultra quality and the upscaler |
| Screen | 1280 × 720 | 1920 × 1080 or higher; a 144 Hz+ screen if you want high frame rates |
| Storage | **about 300 MB** for the built game (about 130 MB as a zip) | the same |
| Extra for building from source | Node.js 22+ and about 400 MB for `node_modules` | an SSD |

Only one computer was tested, so the minimum and recommended columns are estimates; the storage and memory figures were measured. Saves are tiny text files (a few KB each). The game follows your screen's refresh rate; the frame cap in Settings can lower it.

## How to launch

There is no ready-made download on this page yet, so you run it from source or build it yourself. You need [Node.js](https://nodejs.org/) 22 or newer.

```bash
npm ci          # install Electron and the packager (about 400 MB)
npm start       # run the game straight from the source folder
```

To make a standalone Windows app that you can copy anywhere:

```bash
npm run pack    # builds launcher/Stick RPG.exe
```

Then run `launcher/Stick RPG.exe`. No installer is needed; keep the whole `launcher` folder together. Your saves go in a `saves` folder next to the exe and your settings in a `data` folder, and both survive updates.

Notes:
- The game starts fullscreen. **F** toggles windowed mode, **Esc** opens the menu.
- `npm run selftest` boots the packaged app, plays a few frames and checks the basics.
- The repository also has a GitHub Actions workflow ("Build desktop app", run it from the Actions tab) that tries to build for Windows, macOS and Linux. It has not been fully tested yet.
- The game can also be opened in a browser through any local web server (serve the folder and open `index.html`), but saves then live in the browser's storage and the desktop-only buttons are hidden.

## Controls

| Key | Action |
|---|---|
| **W A S D** / arrows | Move |
| **Space** | Attack |
| **Shift** | Roll (invulnerable for a moment; costs stamina) |
| **Q** | Drink the selected potion |
| **R** | Switch potion kind |
| **X** | Swap to the spare weapon (once unlocked) |
| **M** | Character window (stats) |
| **Tab** | Inventory window |
| **E** | Talk, read, enter (in the village) |
| **Esc** | Menu |
| **F** | Fullscreen or windowed |
| **`** | Developer menu (cheats and debugging tools) |

## Features

### Combat and monsters
- Endless waves with a boss every 10 waves; monsters grow tougher and hit harder with every boss you beat.
- Five monster types (goblin, minotaur, slime, archer, ogre), each with its own behaviour, and warnings before the big attacks.
- Six mutations (Mutated/poison, Armored, Swift, Frenzied, Giant, Vampiric) and named elite monsters.
- Eight bosses, one per biome, with their own attack patterns, ground hazards and themed drops.
- A roll that makes you invulnerable, stamina, critical hits, knockback, dodging, poison and chill effects shown as icons above your bars.

### The world
- Eight biomes: Whispering Forest, Scorched Desert, Frozen Wastes, Molten Caldera, Murky Swamp, Emerald Jungle, Haunted Ruins and Windswept Highlands. The next biome is random after each boss.
- 19 weather types (rain, storms, fog, blizzards, sandstorms, ash, aurora and more) and a full day and night cycle.
- Fog of war: night and bad weather limit how far you can see, and lanterns widen your light.
- Wildlife and ambient animals, and a minimap.

### The village and campfires
- A village before every boss, with a randomly generated layout and 14 villagers who walk around, work, sleep and talk based on the situation.
- Shops: potions, general store (lanterns), weapons, armour, jewellery, and a blacksmith who upgrades or buys your gear.
- The inn: rest for free, sleep until a time of day (with a night-time animation), or reset your stat points for gold.
- A notice board, a gate guard, a dog (Biscuit), children and hens.
- A campfire after each boss, set at the real time of day.

### Character and gear
- Level cap of 15 (higher after each rebirth) and five stats: Vitality, Strength, Stamina, Cooldown and Critical. Several have caps so gear matters.
- Six equipment slots (weapon, armour, helmet, two rings, necklace) plus a third ring and a spare weapon slot unlocked by rebirth, and a backpack that grows with rebirth.
- Eight rarity grades (Broken, Common, Uncommon, Rare, Polished, Legendary, Mythical, Secret) with random stat lines and special unique effects.
- An inventory with a compare picker so you can compare any two pieces.
- Seven sword types, from the Wooden Sword to Excalibur.
- Potions: healing and Cure-All (up to 15 of each), switchable with a key.
- Health regeneration that stops short of full health, so running and potions both matter.

### Rebirth
- A shrine in every village. At the level cap you can be reborn: level, stats, gold and ordinary gear reset, while Mythical and Secret gear, your lantern and permanent bonuses stay.
- Each rebirth raises the level cap and adds damage, health, dodge, XP and gold bonuses, better drops, more starting stat points, more backpack slots and milestone rewards.
- A short scene plays when you are reborn.

### Saving
- Three save slots and four difficulty levels (Easy, Normal, Hard, Nightmare).
- Saves happen at villages, campfires and as checkpoints every 5 waves. Dying returns you to your last save and costs gold.
- Export a save to a file and import it again, with an "open save folder" button in the desktop app.

### Graphics and performance
- Four quality presets (Low to Ultra), a resolution choice, and a render scale with a sharpening upscaler.
- Ultra adds animated grass, weather effects, screen shake and a GPU post-processing pass (bloom, colour grading, vignette).
- Frame cap, an FPS counter, and a "reduce flashing and shake" comfort option.

### Sound
- Procedurally synthesized music for each area, sound effects, and ambience per biome, weather and time of day, with separate volume sliders.

### Other
- A cinematic intro (skippable; it plays in a shorter form after the first time).
- The picture scales to any window size, with a consistent glass-style HUD.

## Project layout

- `index.html` and the `*.js` files in the top folder are the whole game (plain JavaScript on a canvas; no framework).
- `main.js` and `preload.js` are the small Electron wrapper (window, saves, fullscreen).
- `build/pack.js` builds the desktop app; `build/selftest.js` checks it.

## Licence

GNU General Public License v3.0. See [LICENSE](LICENSE).
