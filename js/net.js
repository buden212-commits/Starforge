// Multiplayer-nätverkslager: ansluter till relay-servern (server.js), skapar/går med i rum,
// och ger en enkel pub/sub-API för att skicka/ta emot spelmeddelanden mellan värd och gäst.

export class NetClient {
  constructor() {
    this.ws = null;
    this.role = null; // "host" | "guest"
    this.roomCode = null;
    this.connected = false;
    this.peerConnected = false;
    this.handlers = {};
  }

  on(type, fn) {
    this.handlers[type] = fn;
  }

  _emit(type, data) {
    this.handlers[type]?.(data);
  }

  /** Ansluter till relay-servern. serverUrl t.ex. "wss://mitt-rum.onrender.com" eller "ws://localhost:8766". */
  _open(serverUrl) {
    return new Promise((resolve, reject) => {
      let url = serverUrl.trim();
      if (!/^wss?:\/\//i.test(url)) {
        // Tillåt att man bara klistrar in "minapp.onrender.com" utan protokoll.
        const isLocal = /localhost|127\.0\.0\.1/.test(url);
        url = (isLocal ? "ws://" : "wss://") + url;
      }
      url = url.replace(/\/$/, "") + "/ws";

      const ws = new WebSocket(url);
      this.ws = ws;

      const onOpenError = () => reject(new Error("Kunde inte ansluta till servern."));
      ws.addEventListener("error", onOpenError, { once: true });

      ws.addEventListener("open", () => {
        ws.removeEventListener("error", onOpenError);
        this.connected = true;
        resolve(ws);
      }, { once: true });

      ws.addEventListener("message", (ev) => {
        let msg;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (msg.t === "peer-joined") {
          this.peerConnected = true;
          this._emit("peer-joined");
        } else if (msg.t === "peer-left") {
          this.peerConnected = false;
          this._emit("peer-left");
        } else {
          this._emit(msg.t, msg.d);
        }
      });

      ws.addEventListener("close", () => {
        this.connected = false;
        this.peerConnected = false;
        this._emit("disconnected");
      });
    });
  }

  async createRoom(serverUrl) {
    await this._open(serverUrl);
    this.role = "host";
    this.ws.send(JSON.stringify({ t: "create" }));
    return new Promise((resolve, reject) => {
      this.on("created", (d) => {
        this.roomCode = d.code;
        resolve(d.code);
      });
      setTimeout(() => reject(new Error("Timeout vid skapande av rum.")), 8000);
    });
  }

  async joinRoom(serverUrl, code) {
    await this._open(serverUrl);
    this.role = "guest";
    this.ws.send(JSON.stringify({ t: "join", d: { code } }));
    return new Promise((resolve, reject) => {
      this.on("joined", (d) => {
        this.roomCode = d.code;
        this.peerConnected = true;
        resolve(d.code);
      });
      this.on("join-error", (d) => {
        reject(new Error(d.reason === "not-found" ? "Rumskoden hittades inte." : "Rummet är fullt."));
      });
      setTimeout(() => reject(new Error("Timeout vid anslutning.")), 8000);
    });
  }

  send(type, data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ t: type, d: data }));
    }
  }

  close() {
    this.ws?.close();
    this.ws = null;
    this.connected = false;
    this.peerConnected = false;
    this.role = null;
    this.roomCode = null;
  }
}

/**
 * Ger ett gränssnitt som ser ut som js/input.js Input-klassen (isDown/wasPressed),
 * men styrs av nätverkspaket istället för riktiga tangenttryckningar.
 * Används på värden för att applicera gästens input på spelare 2.
 */
export class RemoteInput {
  constructor() {
    this.state = { up: false, down: false, left: false, right: false, fire: false, secondary: false, activate: false };
    this._pressedActivate = false;
    this.mouse = { down: false, rightDown: false };
  }

  applyPacket(packet) {
    const prevActivate = this.state.activate;
    this.state = { ...this.state, ...packet };
    if (this.state.activate && !prevActivate) this._pressedActivate = true;
  }

  isDown(...codes) {
    if (codes.includes("KeyW") || codes.includes("ArrowUp")) return this.state.up;
    if (codes.includes("KeyS") || codes.includes("ArrowDown")) return this.state.down;
    if (codes.includes("KeyA") || codes.includes("ArrowLeft")) return this.state.left;
    if (codes.includes("KeyD") || codes.includes("ArrowRight")) return this.state.right;
    if (codes.includes("Space") || codes.includes("KeyZ")) return this.state.fire;
    if (codes.includes("KeyX") || codes.includes("ShiftLeft")) return this.state.secondary;
    return false;
  }

  wasPressed(...codes) {
    if (codes.includes("Enter") || codes.includes("KeyE")) {
      if (this._pressedActivate) {
        this._pressedActivate = false;
        return true;
      }
    }
    return false;
  }

  endFrame() {
    // Ingenting att nollställa — "pressed" hanteras via _pressedActivate ovan.
  }
}

/** Läser lokal input och paketerar den för nätverket (används på gästen). */
export function readInputPacket(input) {
  return {
    up: input.isDown("KeyW", "ArrowUp"),
    down: input.isDown("KeyS", "ArrowDown"),
    left: input.isDown("KeyA", "ArrowLeft"),
    right: input.isDown("KeyD", "ArrowRight"),
    fire: input.isDown("Space", "KeyZ") || input.mouse.down,
    secondary: input.isDown("KeyX", "ShiftLeft"),
    activate: input.wasPressed("Enter", "KeyE"),
  };
}
