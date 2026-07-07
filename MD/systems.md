# Project Starforge - Systems Design Document
Version: 1.0
Status: Concept

# Vision

Starforge ska vara ett spel där spelaren ständigt experimenterar.

Varje uppdrag ska väcka tanken:

"Tänk om jag bygger om skeppet helt?"

Spelets kärna är inte att hitta det bästa skeppet.
Spelets kärna är att upptäcka nya kombinationer.

---

# Designpelare

1. Build Crazy Stuff
2. Experimentation Rewards
3. Terrain Matters
4. Every Run Tells a Story
5. Readable Chaos

---

# Kärnloop

Hangar
↓
Bygg skepp
↓
Uppdrag
↓
Strid
↓
Loot
↓
Nya idéer
↓
Tillbaka till hangaren

---

# Skeppssystem

Ship
├── Chassis
├── Reactor
├── Engine
├── Left Wing
├── Right Wing
├── Utility Slot
├── Utility Slot
├── Weapon Mount
└── Weapon Mount

---

# Chassi

## Interceptor
- Låg vikt
- Hög hastighet
- +25 % dash-regenerering

## Frigate
- Balanserat
- +10 % all skada

## Cruiser
- Mycket liv
- Långsamt
- Genererar sköld var tionde sekund

## Experimental Frame
- Slumpmässiga stats varje uppdrag

---

# Viktsystem

Alla moduler väger.
Övervikt ger:
- Lägre acceleration
- Långsammare dash
- Högre energiförbrukning

---

# Energisystem

Energi används av:
- Lasrar
- Sköldar
- Drönare
- Dash
- Specialvapen

---

# Vapenkategorier

## Kinetiska
- Machine Gun
- Railgun

Fördel: Ingen energi.
Nackdel: Genererar värme.

## Energivapen
- Laser
- Plasma

Fördel: Hög precision.
Nackdel: Hög energiförbrukning.

## Missilsystem
- Homing Missiles
- Cluster Missiles

---

# Värmesystem

100 % värme:
- Eldhastigheten halveras
- Dash stängs av
- Varningslarm aktiveras

---

# Reaktorer

## Fusion Reactor
Balanserad.

## Overclock Reactor
Mer energi, mer värme.

## Dark Matter Reactor
Varje dödad fiende återställer energi.

## Bio Reactor
Producerar energi när spelaren tar skada.

---

# Utility-moduler

- Shield Generator
- Drone Bay
- Repair Nanites
- Teleport Beacon
- Gravity Projector

---

# Affix-system

Exempel:
Ancient Railgun of Echoes

Effekt:
Var femte skott avfyras igen.

---

# Synergisystem

Plasma + Gravity
→ Kulor böjs mot fiender.

Missiler + Drönare
→ Drönare skjuter missiler.

Railgun + Överhettning
→ Mer värme ger mer skada.

Sköld + Bio Reactor
→ Sköld regenererar snabbare vid låg hälsa.

---

# Teknologier under uppdrag

Spelaren väljer 1 av 3:
- Frenzy
- Adaptive Armor
- Chain Lightning
- Orbital Cannon

---

# Vertikal terräng

Tre höjdnivåer:
LOW
MID
HIGH

Påverkar:
- Projektilbanor
- Synfält
- Fiendetyper
- Vägar
- Loot-rum

---

# Händelser

- Distress Signal
- Hive Nest
- Derelict Station
- Black Market Drone

---

# Mutationer

Bossmodifierare:
- Burning
- Shielded
- Frenzied
- Quantum

Exempel:
Quantum Frenzied Hive Queen

---

# Fraktioner

## The Forge
Militär teknik.

## The Collective
AI och drönare.

## The Nomads
Skrot och experimentella delar.

## The Mycelium
Biomekaniska organismer.

---

# Levande moduler

## Parasite Cannon
Växer när fiender dödas.

## Symbiotic Reactor
Producerar energi men förbrukar hälsa.

---

# Relics

## Red Sun
Dubbla skott, halverat liv.

## Event Horizon
Drar fiender mot spelaren.

## Infinite Magazine
Ingen ammunition, dubbel värme.

## Hive Heart
Exploderande fiender skapar mindre fiender.

---

# Endgame Vision

Målet är att spelaren ska kunna skapa absurda byggen:
- Ett långsamt slagskepp med 30 drönare.
- Ett självläkande biomonster.
- Ett 1 HP-bygge med enorm skada.
- Ett gravitationsskepp som kontrollerar hela slagfältet.

---

# North Star

När en spelare säger:

"Du kommer aldrig tro vad den här kombinationen gör..."

då har Starforge blivit det spel det var tänkt att vara.
