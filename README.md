# Jonkler: The One and Only

A pixel arena brawler for the "One and Only" jam. You are the one and only Jonkler, standing on
the one and only pillar, holding your one and only perk. Mimes, the Fun Police, pigeons and
eventually Chief Killjoy climb up to stop you. Bonk them off the edge before they bonk you.

## How the theme fits

- **One character:** you're Jonkler and nobody else.
- **One arena:** a single pillar, and from wave 6 it crumbles a little every 3 waves.
- **One run:** after each wave you pick a perk. Perks stack to LV3, and a LV3 perk plus its partner
  perk evolves. Your build only lasts for that one run, but everything you discover stays in the
  perk tree.

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Move | A / D or arrows | < > |
| Jump (double jump) | W / Space / Up | JUMP |
| Bonk (3-hit combo, 3rd hit launches) | J / Z | BONK |
| Cream pie (cooldown, hold with Pie Machine Gun) | K / X | PIE |
| Ground pound | S + J in the air | DOWN + BONK |
| Pause / Mute / Credits / Perk tree | P or Esc / M / C / T | |

## Perks and evolutions

| Perk (stacks to LV3) | Evolves with | Evolution |
|---|---|---|
| Big Bonk: range +15%, knockback +8% per level | Heavy Bones | **Wrecking Ball**: combo finishers send a shockwave |
| Heavy Bones: take 15% less knockback per level | Laugh Track | **Iron Clown**: no knockback, getting hit sends out a CLANG blast |
| Laugh Track: +1 max HA per level, LV3 heals 2 per wave | Society | **Encore**: once per wave, survive a fall or a lethal hit |
| Society: every 5th/4th/3rd hit crits | Pie-romaniac | **Anarchy**: every 2nd hit crits, and crits explode |
| Pie-romaniac: pie cooldown -20% per level | Clown Shoes | **Pie Machine Gun**: hold to spray pies. It overheats and only cools while you let go |
| Clown Shoes: speed +10% per level, LV2 triple jump | Whoopee Cushion | **Jet Honkers**: +1 jump, and air jumps blast what's below |
| Whoopee Cushion: landings blast, bigger per level | Big Bonk | **Aftershock**: ground pounds send quakes along the floor |

Once an evolution is ready it's always one of the three cards offered. Active perks show as icons
in the top right. Level pips sit under each icon, and evolved perks get a gold frame.

Every hit raises an enemy's damage %, so they fly further the more they're hit. Enemies sent
flying knock over other enemies, and chaining knock-offs builds a score multiplier.

## Running it

It's plain HTML and JS with no build step. Serve the folder:

```bash
# from inside the game/ folder
bunx serve .
```

Then open the URL it prints (usually http://localhost:3000).

Opening `index.html` directly also mostly works, but some browsers block the font when loading
from `file://`.

## Publishing on itch.io

Zip the **contents** of `game/` (so `index.html` sits at the root of the zip), upload it as an
HTML project, and set the viewport to 1280x720 or turn on fullscreen.

See [CREDITS.md](CREDITS.md) for the assets.
