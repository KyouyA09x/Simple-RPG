# GAME IMPORTANCE

**Stick RPG: what is in the game** · updated 2026-10-01

Stick RPG is a stickman action RPG. You fight waves of monsters across eight biomes, level up, collect gear, rest in a
village before every boss, and try to survive the dark. It runs as a Windows desktop app (and, for development, in any
browser). Everything is drawn in code and the music and sound effects are synthesized: there are no image or audio files.

**Legend:** ✅ done · ~~struck through~~ = implemented

## Contents
- [The game today](#the-game-today)
- [Controls](#controls)
- [Changelog](#changelog)
- [Undoing a change (git)](#undoing-a-change-git)

## The game today

### Combat and levelling
- Move with **WASD**, swing with **Space**, dodge-flip with **Shift** (you are invincible during the flip).
- Every level gives 3 stat points to spend on **Vitality, Strength, Stamina, Cooldown, Crit Rate and Crit Damage**.
  Several stats have caps so no single stat can make you immune.
- Health slowly regenerates when you have not been hit for a few seconds.
- Seven swords (Wooden, Iron, Twin Dagger, Greatsword, Flame Blade, Frostbrand, Excalibur), unlocked by level. The Flame
  Blade burns and Frostbrand slows.
- Four difficulties: Easy, Normal, Hard, Nightmare.

### Waves, bosses and biomes
- Monsters come in waves. A **boss arrives every 10 waves**, and every boss you beat makes later monsters stronger.
- After each boss you rest at a campfire and wake in a **new random biome** (never the same one twice in a row).
- **Eight biomes**: Whispering Forest, Scorched Desert, Frozen Wastes, Molten Caldera, Murky Swamp, Emerald Jungle,
  Haunted Ruins and Windswept Highlands. Each has its own trees, rocks, water you can wade through, ground, harmless
  roaming creatures, air effects, music and ambience.
- A day and night cycle (8 minutes per day) and **19 kinds of weather**, chosen from a pool that suits each biome.

### The dark
- At night and in fog, storms, blizzards and similar weather, **you only see a small circle around you**. Enemies,
  drops, arrows and minimap dots outside it are genuinely hidden. Lightning briefly reveals everything.
- The light flickers and now and then gutters, the picture dims and cools, and sometimes a pair of eyes glints in the
  dark. Comfort mode calms the flicker and the blinking.
- Buy lanterns in the village to widen your circle of light.

### The village
- A safe village appears at **wave 9 of every set**, just before the boss. The game saves when you enter and again when
  you leave. Each biome gives it its own name, colours and buildings.
- **11 villagers live there with daily routines**: a gardener who waters the beds, a woodcutter who hauls and chops, a
  blacksmith who hammers, an innkeeper who sweeps, an alchemist, a merchant, a gate guard, an old woman who knits, three
  children who play ball and tag, plus a dog that follows you and hens. They greet you, chat, and go home at night.
- **Alchemist:** healing potions (heal 45%, carry up to 5, press **Q**). **General store:** three lantern tiers.
  **Inn:** rest and save for free, or **reset your stat points** for gold. **Blacksmith:** buys spare gear.
- Talk with **E**; number keys pick dialogue and shop options.

### Gear and inventory (press I)
- **Six equipment slots** (weapon, armor, helmet, two rings, necklace) and a **24-slot backpack**.
- **Eight rarity grades**: Broken, Common, Uncommon, Rare, Polished, Legendary, Mythical and Secret. Higher grades roll
  more stat lines and bigger numbers; Secret pieces also carry a special effect (Lifesteal, Vigor or Magnet).
- Gear drops from monsters (about 6% per kill) and bosses always drop 1 to 3 pieces. Deeper runs roll better grades.
- Gear adds damage, max HP, damage reduction, crit, speed, stamina, faster actions and gold find on top of your level
  stats, under hard caps: **60% damage reduction, 75% crit chance, 6x crit damage, +35% move speed**.
- The inventory compares any piece with what you are wearing (green and red differences) and shows your totals against
  the caps.

### Gold, saving and death
- Every kill drops gold, bosses shower it. **Dying loses the gold you carried** and reloads your last save.
- Save points are the start of a run, the village, and the campfire after each boss. Three save slots, with export and
  import to a `.json` file.

### Graphics, performance and sound
- Quality presets Low / Medium / High / Ultra. Ultra adds a GPU pass (bloom, colour grading, vignette).
- **Render scale** (100 / 85 / 75 / 67 / 50%) with an FSR-style upscaler (bicubic filter plus contrast-adaptive
  sharpening) and a sharpness slider. Frame generation 2x to 5x, an exact FPS cap, resolution choices.
- Sound is synthesized: music per area, wind and rain, creature calls, footsteps that change with the ground, and
  village work sounds that fade with distance. Separate music, effects and ambience volumes.

### The desktop app
- `Stick RPG.exe` is a self-contained folder: keep it together and run the exe.
- Saves and settings are kept in `saves` and `data` folders next to the exe. Updating the app keeps them.
- **Quit to Desktop** is in the title menu and the pause menu. The window remembers its size and position.

## Controls

| Key | Action |
|---|---|
| WASD / arrows | Move |
| Space | Attack |
| Shift | Flip (invincible) |
| Q | Drink a healing potion |
| E | Talk (village) |
| I | Inventory |
| L | Level up screen |
| Esc / P | Pause menu |
| F | Fullscreen |
| ` | Dev menu (testing) |

## Changelog

### 2026-10-01
- ✅ Environmental visibility (fog-of-war), later made harsher and scarier
- ✅ Gold, save points and the death penalty
- ✅ Boss every 10 waves with monster tiers, random biome per set
- ✅ Four new biomes and a visual overhaul of all eight (art, creatures, effects, ambience, footsteps)
- ✅ The village with living villagers, shops, inn and number-key dialogue
- ✅ Stat reset at the inn
- ✅ Gear and inventory with eight rarity grades, drops and selling
- ✅ Windows desktop app with portable saves, Quit to Desktop, a save-file backup and tests
- ✅ FSR-style render-scale upscaler, discrete GPU selection
- ✅ Audio balance: ambience, footsteps and village sounds brought up to the level of the effects

### 2026-09-23
- ✅ UI pass and a rebuilt HUD; stat rework (Vitality, Crit Rate, Crit Damage); stamina rework
- ✅ Day and night cycle, 19 weather types per biome, health regeneration
- ✅ Exact FPS cap, frame generation 2x to 5x, bug sweeps

## Undoing a change (git)
Each change from 2026-10-01 is its own commit with a tag:

| Tag | What it holds |
|---|---|
| `baseline-2026-10-01` | the game exactly as it was before that day |
| `feature-visibility` | fog-of-war at night and in bad weather |
| `feature-gold-saves` | gold and the new save points |
| `feature-boss-10` | boss every 10 waves, biome per set, monster tiers |
| `feature-biomes-1` / `-2` / `-3` | new biomes and art / creatures and effects / sound |
| `feature-village-1` | the village |
| `feature-village-numkeys` | number keys in dialogue and shops |
| `feature-desktop-app`, `desktop-only`, `portable-saves-quit` | the desktop app, its folder layout, saves next to the exe, Quit to Desktop |
| `feature-respec-fsr` | stat reset, render scale and upscaler |
| `feature-gear-inventory` | gear, inventory, rarity and drops |
| `tweak-vision-lights`, `tweak-vision-scary`, `tweak-audio-levels` | visibility, lighting and sound tuning |

- See the history: `git log --oneline`
- Undo one change and keep the rest: `git revert <tag>`. Revert **newest first**, because later changes touch the same files.
- Look at an old version without changing anything: `git checkout <tag>` (return with `git checkout main`).
