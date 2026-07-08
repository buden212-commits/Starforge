# Multiplayer — driftsättning & spela tillsammans

Starforge har nu ett co-op-läge där du och en vän kan spela **standarduppdraget** tillsammans
över nätet, en av er som **värd** (kör hela spel-simuleringen) och en som **gäst** (skickar bara
input och tittar på värdens spel).

Det här dokumentet beskriver:

1. Hur du kör allt lokalt för att testa
2. Hur du deployar servern till [Render](https://render.com)
3. Hur ni faktiskt kopplar ihop er och spelar

---

## 1. Kör lokalt (för test/utveckling)

Multiplayer-delen kräver en riktig Node.js-server (till skillnad från den gamla
`start-game.ps1`, som bara serverar filer och inte kan hantera WebSockets).

### Installera Node.js

1. Ladda ner och installera **Node.js LTS** från [nodejs.org](https://nodejs.org/) (välj Windows-installeraren).
2. Starta om PowerShell efter installationen.
3. Verifiera att det fungerar:

   ```powershell
   node --version
   npm --version
   ```

### Installera beroenden och starta servern

```powershell
cd c:\Users\jonas\Rymden
npm install
npm start
```

Du bör se:

```
Starforge kör på http://localhost:8766  (WebSocket-relay på /ws)
```

Öppna `http://localhost:8766` i webbläsaren precis som tidigare. Den här servern gör **både**
det `start-game.ps1` gjorde (serverar spelet) **och** kör multiplayer-relayen — du behöver
alltså bara en av dem igång åt gången. `start-game.ps1` fungerar fortfarande fint om du bara
vill spela själv utan multiplayer.

**Testa co-op lokalt:** öppna spelet i två olika flikar/fönster, ange server-adressen
`localhost:8766` i båda, skapa ett rum i den ena och gå med i den andra med rumskoden.

---

## 2. Deploya till Render

[Render](https://render.com) kan köra hela `server.js` (statiska filer + WebSocket) som en enda
"Web Service", helt gratis i sin free-tier.

### Alternativ A — med `render.yaml` (Blueprint, snabbast)

Repot innehåller redan en `render.yaml`. Om du pushar koden till GitHub kan du:

1. Gå till [dashboard.render.com](https://dashboard.render.com/) → **New** → **Blueprint**.
2. Peka på ditt GitHub-repo. Render läser `render.yaml` och föreslår tjänsten automatiskt.
3. Klicka **Apply** / **Create**.

### Alternativ B — manuellt

1. Pusha koden till ett GitHub-repo (om det inte redan ligger där).
2. Gå till [dashboard.render.com](https://dashboard.render.com/) → **New** → **Web Service**.
3. Koppla ditt GitHub-repo.
4. Ställ in:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free
5. Klicka **Create Web Service**.

Render bygger och startar tjänsten. Efter någon minut får du en URL i stil med:

```
https://starforge-xxxx.onrender.com
```

Det är den adressen ni ska använda för att spela — både för att öppna spelet i webbläsaren
**och** som "server-adress" i multiplayer-menyn.

### Viktigt att veta om Render Free-planen

- Tjänsten **somnar** efter en stund utan trafik. Första anropet efter att den somnat tar
  ~30–60 sekunder innan den svarar (Render startar om servern). Öppna alltså sidan en gång och
  vänta innan ni börjar skapa rum, så är den varm.
- Free-planen har begränsad månadstid, men för ett par vänner som spelar då och då räcker den
  gott.
- Om ni vill undvika insomningen helt kan ni uppgradera till en betald plan, eller köra servern
  på egen dator + en tunnel (Cloudflare Tunnel/ngrok) istället.

---

## 3. Så spelar ni tillsammans

1. **Värden** (den som är hemma-server): gå till **Meny → Multiplayer (co-op)**.
   - Fyll i server-adressen (t.ex. `starforge-xxxx.onrender.com`, eller `localhost:8766` för
     lokalt test).
   - Klicka **Skapa spel (värd)**.
   - Du får en 4-teckens rumskod — skicka den och server-adressen till din vän (Discord, SMS, etc).
   - (Valfritt) Vill ni spela en **egen bana** istället för standarduppdraget: bygg och exportera
     banan i **Baneditor** (**Spara som fil**), gå sedan till lobbyn och klicka
     **Ladda upp egen bana…** och välj filen. Bannamnet visas i lobbyn hos både dig och gästen.
     Klicka **Använd standarduppdrag** för att växla tillbaka.
   - Vänta tills "✓ Medspelare ansluten!" visas, klicka sedan **Starta uppdrag tillsammans**.
2. **Gästen**: gå till **Meny → Multiplayer (co-op)**.
   - Fyll i samma server-adress som värden gav dig.
   - Fyll i rumskoden.
   - Klicka **Gå med**.
   - Vänta tills värden startar uppdraget.
3. Spela! Båda skeppen flyger i samma bana, samma fiender, samma boss. Kontrollerna är desamma
   som i solo-läget (WASD, Z/Space = skjut, X/Shift = missil, Enter/E = aktivera power).

### Kända begränsningar i den här versionen

- Co-op stöds nu även för **egna banor** byggda i Baneditor (se steg 1 ovan) — det är bara
  **värden** som behöver ha banfilen; den skickas automatiskt över till gästen när uppdraget
  startar, så gästen behöver inte ladda upp något själv.
- Det är alltid **värden** som väljer loot efter en boss och styr "Försök igen"/"Hangar" efter
  game over — gästen ser en enkel väntskärm under tiden och följer med automatiskt när värden
  går vidare.
- Om era fönster har mycket olika storlek kan grottans form se en aning olika ut för er (den
  genereras lokalt hos var och en utifrån fönsterhöjden), men det påverkar bara utseendet, inte
  vem som träffas av vad — det är alltid värdens simulering som gäller.
- Fiender med anpassade sprites (skapade i Fiendedesign) visas med standardutseende hos gästen.

### "Kunde inte ansluta till servern" trots att servern fungerar

Om ni öppnat spelet via en länk delad i **Facebook, Messenger, Instagram** eller liknande
appar (URL:en innehåller ofta `?fbclid=...`), körs sidan i appens **inbyggda webbläsare**
(en WebView), inte i er vanliga webbläsare. Dessa inbyggda webbläsare blockerar eller stör
ofta WebSocket-anslutningar, vilket gör att multiplayer aldrig lyckas ansluta — även om
servern är vaken och fungerar helt normalt.

**Lösning:** öppna sidan i en riktig webbläsare (Chrome, Safari, Edge) istället för att
klicka på länken direkt i appen. De flesta appar har en "…"-meny eller knapp längst upp med
texten "Öppna i webbläsare" eller liknande. Spelet visar numera själv en varning om det
upptäcker att det körs i en sådan inbyggd webbläsare.
