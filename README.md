# WoW Forever gamepad bar planner

Plan World of Warcraft: Forever's gamepad action bars for any class and controller, then put the layout on your bars in game with the PadPlan addon.

**Open the planner:** https://blog.shanekeulen.com/wow-pad-planner/

## What it does

- Draws the gamepad HUD the way the game does: the bar with no trigger held, the LT bar, the RT bar and the LT + RT bar, across all three bar sets.
- Drag spells from your class's list onto any slot. All nine classes are there, with icons, the level each spell is learned at and a short description.
- Pick your controller (Xbox, Xbox Elite, DualSense, DualSense Edge, Steam Controller, Steam Deck). The button symbols change to match, and back buttons show up when the controller has them.
- Back buttons can become extra spell slots on every trigger layer (with the SNRN Backhand addon), or be marked as used by something else.
- The Steam Input steps and a table of every control are written from your choices.
- A starter layout for every class, each with a note on why it's laid out that way.
- Layouts are saved in your browser. Share them as a code or a file.

## Putting a layout in the game

1. Download `PadPlan.zip` from the [latest release](https://github.com/SeeThruHead/wow-pad-planner/releases/latest) and unzip it into `World of Warcraft/_forever_/Interface/AddOns/`.
2. For back-button slots, also install [SNRN Backhand](https://www.curseforge.com/wow/addons/snrn-backhand).
3. In the planner, press **Copy code for the addon**.
4. In game, type `/padplan import`, paste the code and press Import.
5. In gamepad mode and out of combat, type `/padplan apply`.

`/padplan check` lists the slots that differ from the layout. `/padplan forget` drops the imported layout. If you'd rather use a file, **Download PadPlanData.lua** and put it in the PadPlan folder.

Spells you haven't learned yet are skipped; run `/padplan apply` again after visiting a trainer. Spells always go on at their highest known rank. Macros in a layout become character macros named `PP ...`.

## Keys for back buttons on Linux and Steam Deck

Steam Input can send F13 to F24, but under Proton the standard Linux keymap turns F13 to F18 and F20 to F22 into media keys, and Wine passes them to WoW as no key at all. F9, F10, F11, F19, F23 and F24 work everywhere. The planner warns when a back button uses a key that only works on Windows.

## Building

The page is plain HTML, CSS and JavaScript in `page/`. `bun run build` writes one self-contained file, `dist/wow-pad-planner.html`, with every icon inlined.

- `bun run catalog <path>` rebuilds `page/catalog.json` and `page/icons/` from the WhatsTraining addon's Forever ("Camelot") trainer data. It looks names and icons up on Wowhead, cached in `data/wowhead-cache.json`.
- `page/starters.js` holds the built-in layouts.
- `addon/PadPlan` is the addon.
- `bun run check` runs the starter check, a browser test of the page (Chromium at `/usr/bin/chromium`, or set `CHROME_PATH`) and a test of the addon against a mocked WoW API.

## Credits

- Spell icons and spell names are Blizzard Entertainment's, from World of Warcraft. This is a fan-made tool and is not affiliated with or endorsed by Blizzard. Icons are fetched from Wowhead's icon CDN when the catalog is built.
- The spell lists come from the [WhatsTraining](https://www.curseforge.com/wow/addons/whatstraining) addon's trainer data.
- Back-button slots use [SNRN Backhand](https://www.curseforge.com/wow/addons/snrn-backhand). PadPlan places actions with the same client calls as SNRN Grimoire.

## Licence

MIT. See `LICENSE`.
