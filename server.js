// Starforge — kombinerad statisk webbserver + multiplayer-relay.
// Kör: node server.js  (eller "npm start")
// Servern gör två saker:
//   1. Serverar spelets statiska filer (index.html, js/, css/, assets/)
//   2. Kör en enkel WebSocket-relay på /ws som kopplar ihop två spelare
//      i samma "rum" (room code) och vidarebefordrar meddelanden mellan dem.
//      Servern förstår ingen spellogik — den bara skickar vidare paket.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 8766;
const ROOT = __dirname;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
};

function serveStatic(req, res) {
  let relative = decodeURIComponent(req.url.split("?")[0]);
  if (relative === "/" || relative === "") relative = "/index.html";
  const filePath = path.join(ROOT, relative);

  // Säkerhet: stanna inom projektmappen.
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("403 Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer(serveStatic);

// --- Multiplayer-relay ---------------------------------------------------
// Rum: { code -> { host: ws|null, guest: ws|null } }
const rooms = new Map();

function makeRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // undviker förvirrande tecken (0/O, 1/I)
  let code;
  do {
    code = Array.from({ length: 4 }, () => chars[(Math.random() * chars.length) | 0]).join("");
  } while (rooms.has(code));
  return code;
}

function peerOf(room, ws) {
  if (room.host === ws) return room.guest;
  if (room.guest === ws) return room.host;
  return null;
}

function send(ws, msg) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function cleanupSocket(ws) {
  const room = ws.roomCode ? rooms.get(ws.roomCode) : null;
  if (!room) return;
  const peer = peerOf(room, ws);
  if (room.host === ws) room.host = null;
  if (room.guest === ws) room.guest = null;
  send(peer, { t: "peer-left" });
  if (!room.host && !room.guest) rooms.delete(ws.roomCode);
}

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.t === "create") {
      const code = makeRoomCode();
      rooms.set(code, { host: ws, guest: null });
      ws.roomCode = code;
      ws.role = "host";
      send(ws, { t: "created", d: { code } });
      return;
    }

    if (msg.t === "join") {
      const code = String(msg.d?.code || "").toUpperCase();
      const room = rooms.get(code);
      if (!room || room.guest) {
        send(ws, { t: "join-error", d: { reason: !room ? "not-found" : "full" } });
        return;
      }
      room.guest = ws;
      ws.roomCode = code;
      ws.role = "guest";
      send(ws, { t: "joined", d: { code } });
      send(room.host, { t: "peer-joined" });
      return;
    }

    // Alla andra meddelanden: vidarebefordra rakt av till motparten i rummet.
    const room = ws.roomCode ? rooms.get(ws.roomCode) : null;
    if (!room) return;
    const peer = peerOf(room, ws);
    if (peer) send(peer, msg);
  });

  ws.on("close", () => cleanupSocket(ws));
  ws.on("error", () => cleanupSocket(ws));
});

// Håll anslutningar vid liv och städa döda sockets (viktigt på plattformar som Render).
const pingInterval = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

server.on("close", () => clearInterval(pingInterval));

server.listen(PORT, () => {
  console.log(`Starforge kör på http://localhost:${PORT}  (WebSocket-relay på /ws)`);
});
