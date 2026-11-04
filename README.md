# Jonkler: The One and Only

A pixel arena brawler for the "One and Only" jam. You are the one and only Jonkler, standing on
the one and only pillar, holding your one and only perk. Mimes, the Fun Police, pigeons and
eventually Chief Killjoy climb up to stop you. Bonk them off the edge before they bonk you.

## How the theme fits

- **One character:** you're Jonkler and nobody else.
- **One arena:** a single pillar, and from wave 6 it crumbles a little every 3 waves.
- **One perk:** after each wave you pick a perk, and taking it replaces the one you had.

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Move | A / D or arrows | < > |
| Jump (double jump) | W / Space / Up | JUMP |
| Bonk (3-hit combo, 3rd hit launches) | J / Z | BONK |
| Cream pie (cooldown) | K / X | PIE |
| Ground pound | S + J in the air | DOWN + BONK |
| Pause / Mute / Credits | P or Esc / M / C | |

Every hit raises an enemy's damage %, so they fly further the more they're hit. Enemies sent
flying knock over other enemies, and chaining knock-offs builds a score multiplier.

## Running it

It's plain HTML and JS with no build step. Serve the folder:

```bash
bunx serve game
```

Opening `index.html` directly also mostly works, but some browsers block the font when loading
from `file://`.

## Publishing on itch.io

Zip the **contents** of `game/` (so `index.html` sits at the root of the zip), upload it as an
HTML project, and set the viewport to 1280x720 or turn on fullscreen.

See [CREDITS.md](CREDITS.md) for the assets.
