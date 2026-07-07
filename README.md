# Starforge — Vertical Slice

En spelbar web-prototyp av **Project Starforge**: bygg ditt skepp, flyg genom asteroidkanjonen, besegra fiender och Hive Queen-bossen, samla loot och förbättra ditt skepp.

> Sky Force möter Diablo 3 och FTL — i webbläsaren.

## Spela

**Dubbelklicka `Start Starforge.bat`** — startar en lokal server och öppnar spelet i webbläsaren.

> Viktigt: Öppna inte `index.html` direkt. Webbläsare blockerar ES-moduler via `file://`, vilket ger en svart skärm.

Alternativ i PowerShell:

```powershell
cd c:\Users\jonas\Rymden
.\start-game.ps1
```

Öppna sedan http://localhost:8765

## Kontroller

| Tangent | Action |
|---------|--------|
| WASD | Rörelse |
| Mus | Sikta |
| Vänsterklick | Primärvapen |
| Högerklick | Sekundärvapen (missiler / EMP) |
| Space | Dash (kostar energi) |
| Höjdplattor ↑↓ | Byt mellan LÅG / MELLAN / HÖG |

## Kärnloop

**Hangar** → byt chassi, motor, vingar och vapen → **Uppdrag** → strid i kanjonen → **Hive Queen** → **Loot** → tillbaka till hangaren.

## Innehåll (MVP)

- 3 chassin: Interceptor, Fighter, Cruiser
- 3 motorer, 3 vingpar, 3 primärvapen, 2 sekundärvapen
- 5 fiendetyper + Hive Queen (3 faser)
- Höjdsystem med terrängskydd
- Loot: Vanlig / Ovanlig / Episk
- Sparning via localStorage

## Projektstruktur

```
Rymden/
├── index.html
├── css/style.css
├── js/
│   ├── main.js      # Entry point
│   ├── game.js      # Game loop & states
│   ├── data.js      # Modules, stats, loot
│   ├── player.js    # Player & projectiles
│   ├── enemies.js   # AI & boss
│   ├── terrain.js   # Canyon & collision
│   ├── render.js    # Neon graphics
│   ├── ui.js        # Hangar, HUD, loot
│   └── save.js      # localStorage
└── MD/              # Design docs
```

## Nästa steg (Unity)

Denna slice validerar kärnloopen i webben. När Unity 6 är installerat kan samma design porteras till den stack som beskrivs i `MD/mvp.md` (URP, Input System, Cinemachine).

## Design docs

- `MD/mvp.md` — MVP scope
- `MD/prd(2).md` — Product requirements
- `MD/systems.md` — Full systems vision
