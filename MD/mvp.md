# Project Starforge - MVP
Version: 1.0
Status: Pre-production

# Syfte

Bygg en spelbar vertical slice som bevisar att kärnloopen:

Hangar → Bana → Boss → Loot → Tillbaka till Hangar

är rolig och har hög återspelningsgrad.

MVP:n ska inte vara ett färdigt spel. Den ska validera de viktigaste spelmekanikerna innan fler system utvecklas.

---

# Mål

Spelaren ska kunna:

1. Bygga ett eget skepp
2. Flyga genom en bana med vertikal terräng
3. Besegra fiender
4. Döda en boss
5. Få loot
6. Uppgradera sitt skepp
7. Starta nästa uppdrag

Om detta känns beroendeframkallande är projektet redo för nästa fas.

---

# Plattform

- PC
- Steam
- Windows

---

# Teknisk Stack

- Unity 6
- Universal Render Pipeline (URP)
- C#
- Input System
- Cinemachine
- Addressables
- DOTween

---

# Kärnfunktioner

## Hangar

Spelaren kan:

- Visa sitt skepp
- Byta moduler
- Se statistik
- Starta uppdrag

Ingen crafting.
Ingen teknikträd.
Ingen handel.

---

## Skeppsbyggare

### Chassin

- Interceptor
- Fighter
- Cruiser

### Moduler

- Motor
- Vänster vinge
- Höger vinge
- Primärvapen
- Sekundärvapen

### Statistik

- Liv
- Hastighet
- Energi
- Skada
- Eldhastighet

---

# Vapen

## Primärvapen

- Machine Gun
- Laser
- Railgun

## Sekundärvapen

- Missiler
- EMP

---

# Bana

## Miljö

Asteroidkanjon.

Innehåller:

- Klippväggar
- Tunnlar
- Smala passager
- Höjdskillnader
- Förstörbara objekt

---

# Höjdsystem

Tre nivåer:

Låg:
- Skydd bakom terräng

Mellan:
- Standardstrid

Hög:
- Färre hinder
- Fler fiender

---

# Fiender

## Scout
Enkel fiende.

## Swarm Drone
Anfaller i grupper.

## Heavy Beetle
Tålig fiende.

## Kamikaze
Försöker kollidera.

## Turret Ship
Stationärt försvar.

Totalt:
5 fiendetyper.

---

# Boss

## The Hive Queen

Fas 1:
- Projektilmönster

Fas 2:
- Kallar in fiender

Fas 3:
- Aggressivt slutskede

Belöning:
Minst en unik modul.

---

# Loot

Kvalitetsnivåer:

- Vanlig
- Ovanlig
- Episk

Ingen legendarisk loot i MVP.

Loot kan ge:

- Mer skada
- Mer energi
- Högre hastighet
- Kortare cooldown

---

# Progression

Efter varje bana:

- Samla moduler
- Byt utrustning
- Försök skapa bättre byggen

Ingen permanent leveling.
Ingen grind.
Ingen valuta.

---

# Sparsystem

Sparar:

- Inventarie
- Skeppsbyggen
- Inställningar
- Statistik

---

# UI

## Meny
- Start
- Inställningar
- Avsluta

## Hangar
- Modulplatser
- Statistikpanel
- Starta uppdrag

## In-game
- Liv
- Energi
- Radar
- Bosshälsa

---

# Ljud

Tillfälliga:

- Vapenljud
- Explosioner
- Ambient musik
- Bossmusik

---

# Grafisk Stil

- Styliserad science fiction
- Neon och glöd
- Tydliga projektiler
- Hög läsbarhet

---

# Prestandamål

- 60 FPS
- Minst 100 fiender
- Minst 500 projektiler
- Laddtid under 5 sekunder

---

# Scope Begränsningar

Får INTE innehålla:

- Multiplayer
- Procedurgenererade banor
- Flera områden
- Crafting
- Teknikträd
- Dagliga uppdrag
- Endgame-system
- Flera bossar
- Story-kampanj

---

# Acceptance Criteria

MVP:n är godkänd om:

- Spelaren kan bygga flera olika skepp
- Striderna känns tydliga och responsiva
- Loot leder till intressanta val
- Bossen känns utmanande
- Minst tio spelomgångar känns roliga

---

# Föreslagen Utvecklingsplan

Vecka 1-2
- Projektsetup
- Kamerasystem
- Rörelse
- Skjutsystem

Vecka 3-4
- Fiender
- Kollisioner
- Höjdsystem

Vecka 5-6
- Skeppsbyggare
- Loot
- Hangar

Vecka 7
- Boss
- UI
- Sparning

Vecka 8
- Polish
- Balansering
- Playtesting

---

# Definition of Done

En ny spelare ska kunna:

Starta spelet →
Bygga sitt första skepp →
Spela en bana →
Besegra en boss →
Få loot →
Byta moduler →
Vilja spela igen.
