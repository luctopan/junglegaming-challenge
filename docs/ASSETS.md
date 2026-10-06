# Asset inventory

Inventory of `assets/` as delivered by Jungle Gaming. The art is based on the
Kenney "Pirate Pack" (CC0); the UI atlas and sounds are a custom pack
("Pirate Battle UI asset pack" v1.0). Confirm licenses and record them in the
final README.

Visual contact sheets: `docs/reference/ships_grid.png` and
`docs/reference/tiles_grid.png`.

## Reference mockups (visual target, not runtime assets)

| File | Shows |
|---|---|
| `assets/sample.png` | In-game: player HP bar top-left (`76 / 100`, heart icon), score (star) + timer (clock) counters and pause button top-right, enemy HP bars above ships, touch controls (turn left / forward / turn right bottom-left; fire left / front / right bottom-right), Jungle Gaming logo bottom-right |
| `assets/sample_menu.png` | Main menu panel: title, tagline "SET SAIL. TAKE COMMAND.", PLAY, OPTIONS, small ship icon, "Navigate the islands. Survive the battle.", RANKING and MATCH HISTORY secondary buttons |
| `assets/sample_options.png` | OPTIONS: "Game session time" and "Enemy spawn time" with −/+ round steppers (values `120 s`, `3 s`), MAIN MENU |
| `assets/sample_pause.png` | PAUSED, "Ready when you are.", RESUME, OPTIONS, MAIN MENU |
| `assets/sample_result.png` | BATTLE COMPLETE, big score, `POINTS · 02:00 · TIME UP`, PLAY AGAIN, MAIN MENU (submission status must be added — required by spec) |
| `assets/sample_ranking.png` | "CAPTAIN'S LOG" wide panel with RANKING / MATCH HISTORY tabs, config subtitle `120 SECOND BATTLES · 3 SECOND SPAWN INTERVAL`, columns RANK / CAPTAIN / POINTS / PLAYED, current player row highlighted with a `YOU` badge, star on #1, pagination `PAGE 1 OF 3` with round arrow buttons, MAIN MENU |
| `assets/sample_history.png` | Same panel, subtitle `CAPTAIN JACK · YOUR RECENT BATTLES`, columns DATE / POINTS / DURATION / RESULT (`TIME UP`, `DEFEATED`), pagination |
| `assets/preview.png` | Kenney pack overview |
| `assets/ui_scene_background.png` (918×515) | Illustrated scene **with ships baked in**. Use only as a blurred/dimmed backdrop behind menus (as in the mockups). Do **not** use as the arena: the arena must be built from tiles so visuals match collision geometry. |
| `assets/logo_jungle_gaming.svg` | Brand logo (bottom-right in mockups) |

Menus in the mockups are drawn over the arena/background, darkened. No font
file is provided: pick a bold sans display font (e.g. a Google Font with an
OFL license, self-hosted) and record its license.

## Ships — `assets/png/default/ships/` (66×113, pointing **up**)

`ship_N` where `N = color + 6 × damageStage`:

| Color index | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| Sail | white | black (skull) | red (cross) | green (swords) | blue (horse) | yellow (X) |

| Damage stage | Files | Meaning |
|---|---|---|
| 0 | `ship_1`–`ship_6` | intact |
| 1 | `ship_7`–`ship_12` | damaged (torn sails) |
| 2 | `ship_13`–`ship_18` | heavily damaged |
| 3 | `ship_19`–`ship_24` | wreck (grey) — use for the sinking/destroyed moment |

Suggested mapping (record final choice in DECISIONS.md): player = blue or
white, Chaser = black (skull), Shooter = red. Damage stage by HP ratio
thresholds defined in config.

Also: `dinghy_large_1..3` (20×38), `dinghy_small_1..3` (16×26) — optional
decoration/debris.

**Retina ship/effect PNGs are the same pixel size as default** (no real 2×).
Only tiles and the UI atlas have true 2× versions.

## Ship parts — `assets/png/default/ship_parts/`

`cannon`, `cannon_mobile`, `cannon_loose`, **`cannon_ball` (projectile)**,
`crew_1..6`, `flag_1..6`, `hull_large_1..4`, `hull_small_1..4`,
`sail_large_1..24`, `sail_small_1..13`, `nest`, `pole`, `wood_1..4`
(debris for hit/explosion particles).

## Effects — `assets/png/default/effects/`

`explosion_1` (74×75), `explosion_2` (60×59), `explosion_3` (42×41) — use as a
3-frame explosion sequence (large→small or reversed) and small variants for
hits/muzzle. `fire_1`, `fire_2` — fire on damaged ships.

## Tiles — `assets/png/default/tiles/` (64×64; retina 128×128)

See `docs/reference/tiles_grid.png`. Key groups:

- `tile_73` — deep water (tileable).
- Sand island edges/corners/fills: 1–9, 17–21, 33–35, 52–57, 68, 69 (with grass
  transitions 7, 8, 22, 25, 36–38, 41, 52, 53, 55, 56; grass fill 23, 24, 39, 40).
- Shallow-water overlay tiles (rendered grey on dark bg, translucent light blue
  over water): 10–12, 26–28, 42–44, 58, 59, 74, 75 — use around islands.
- Rocks 49–51, mossy rocks 65–67; plants 70–72, 87, 88; beach props 81–86.
- Stone fort walls/towers/bridges/cannons: 13–16, 29–32, 45–48, 60–64, 76–80,
  89–96 (optional decoration on islands).

Islands must be built from these tiles on a grid. Collision shapes come from
the island layout data (tile grid → rectangles/polygons), never from pixels.

Atlases: `assets/tilesheet/tiles_sheet.png` / `tiles_sheet_retina.png`
(64×64 grid, no margin, per `tilesheets.txt`).

## Spritesheets — `assets/spritesheet/`

- `ui_sheet.json` + `ui_sheet.png` (1024², scale 1) and `ui_sheet_retina.json`
  + `ui_sheet_retina.png` (2048², scale 2). Pixi-compatible `frames`/`meta`
  format with 36 identical frame names in both. Extra `ui` metadata (logical 1×
  units, relative to sprite top-left):
  - `alpha_bounds` — visible area.
  - `layout.outer_rect`, `label_rect` (menu buttons), `icon_center` +
    `icon_render_size` (round buttons: icon 32×32 centered at 32,32),
    `content_rect` (panel).
  - `panel_menu` has `borders` (32/40/32/40) → 9-slice (`NineSliceSprite` in
    Pixi or CSS `border-image` in React).
  - `health_frame` has `layout.fill_rect` (30,15,196,20), `clip_axis: x`,
    `clip_origin: left`, draw order frame→fill: the fill is clipped
    horizontally by HP ratio. Enemy bars (`enemy_health_*`, 160×40) follow the
    same idea — check their metadata.
  - Frame names: `panel_menu`, `title_pirate_battle`,
    `button_primary_{normal,hover,pressed,disabled}`,
    `button_secondary_{normal,pressed}`, `button_round_{normal,hover,pressed}`,
    `counter_panel`, `health_frame`, `health_fill_{green,amber,red}`,
    `enemy_health_frame`, `enemy_health_fill_{green,red}`, icons
    (`close, fire_front, fire_left, fire_right, forward, heart, home, minus,
    pause, play, plus, restart, score, settings, time, turn_left, turn_right`).
  - Individual PNGs also exist in `assets/png/{default,retina}/ui/`.
- `ships_miscellaneous_sheet{,_retina}.{png,xml}` — **Starling/Sparrow XML**
  (`<TextureAtlas><SubTexture>`), not natively loaded by Pixi. Either convert to
  Pixi JSON with a small build-time script (allowed by the spec) or load the
  individual PNGs.

## Sounds — `assets/sounds/` (27 WAV, 5.8 MB)

| Purpose | Files |
|---|---|
| Front shot | `cannon_fire_1..3` (randomize) |
| Side volley | `cannon_broadside` |
| Projectile hits water/island | `cannonball_water_hit_1..2` |
| Ship hit | `ship_wood_hit_1..2` |
| Chaser ram | `ship_collision` |
| Destruction | `ship_explosion_1..2`, `ship_sinking` |
| Score | `score_point` |
| Low HP / time warning | `health_low`, `time_warning` |
| Match flow | `game_start`, `game_pause`, `game_resume`, `game_complete` (time up), `game_over` (defeat) |
| Loops | `ocean_ambience_loop`, `ship_sailing_loop` |
| UI | `ui_click`, `ui_hover`, `ui_open`, `ui_close`, `ui_back` |

Audio must start only after a user gesture (autoplay policy) and needs a mute
toggle. Converting to OGG/MP3 to reduce size is allowed (document it).

## Vector — `assets/vector/`

SVG/SWF sources of the Kenney pack. Not needed at runtime.
