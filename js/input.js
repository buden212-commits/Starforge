export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, worldX: 0, worldY: 0, down: false, rightDown: false };
    this._bind(canvas);
  }

  _bind(canvas) {
    window.addEventListener("keydown", (e) => {
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (["Space", "Tab", "Enter"].includes(e.code)) e.preventDefault();
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));

    canvas.addEventListener("mousemove", (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;
    });
    canvas.addEventListener("mousedown", (e) => {
      if (e.button === 0) this.mouse.down = true;
      if (e.button === 2) this.mouse.rightDown = true;
    });
    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.mouse.rightDown = false;
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  isDown(...codes) {
    return codes.some((c) => this.keys.has(c));
  }

  wasPressed(...codes) {
    return codes.some((c) => this.pressed.has(c));
  }

  endFrame() {
    this.pressed.clear();
  }

  updateWorldMouse(camera) {
    this.mouse.worldX = this.mouse.x + camera.x - this.canvas.width / 2;
    this.mouse.worldY = this.mouse.y + camera.y - this.canvas.height / 2;
  }
}
