export class Input {
  constructor(dom) {
    this.dom = dom;
    this.keys = new Set();
    this.mouse = { 0: false, 2: false };
    this.dx = 0;
    this.dy = 0;
    this.locked = false;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.key.toLowerCase());
      if (e.key === ' ') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());

    dom.addEventListener('mousedown', (e) => { this.mouse[e.button] = true; });
    window.addEventListener('mouseup', (e) => { this.mouse[e.button] = false; });
    dom.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.dx += e.movementX;
      this.dy += e.movementY;
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === dom;
      if (!this.locked) { this.mouse[0] = false; this.mouse[2] = false; }
    });
  }

  requestLock() {
    if (!this.locked) this.dom.requestPointerLock();
  }

  releaseLock() {
    if (this.locked) document.exitPointerLock();
  }

  key(k) { return this.keys.has(k); }

  consumeMouse() {
    const r = { dx: this.dx, dy: this.dy };
    this.dx = 0;
    this.dy = 0;
    return r;
  }
}
