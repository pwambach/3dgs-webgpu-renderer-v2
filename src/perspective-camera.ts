import { vec3, mat4 } from "gl-matrix";

export class PerspectiveCamera extends EventTarget {
  position: vec3;
  private viewMatrix: mat4 = mat4.create();
  private projectionMatrix: mat4 = mat4.create();
  private lookAt: vec3;
  private up = vec3.fromValues(0, 1, 0);
  private keys: Record<string, boolean> = {};
  private fov: number = (45 * Math.PI) / 180;
  private roll: number = 0;

  constructor({ position, lookAt }: { position: vec3; lookAt: vec3 }) {
    super();
    this.position = position;
    this.lookAt = lookAt;
    this.addKeyListeners();
    this.getProjectionMatrix();
  }

  addKeyListeners() {
    window.addEventListener("keydown", (event: KeyboardEvent) => {
      const k = event.key.toLowerCase();
      this.keys[k] = true;
    });

    window.addEventListener("keyup", (event: KeyboardEvent) => {
      const k = event.key.toLowerCase();
      this.keys[k] = false;
    });

    const loop = () => {
      const speed = this.keys["shift"] ? 8 : 1;
      if (this.keys["a"]) this.rotateY(-0.4 * speed);
      if (this.keys["d"]) this.rotateY(0.4 * speed);
      if (this.keys["e"]) this.moveInOut(-0.1 * speed);
      if (this.keys["q"]) this.moveInOut(0.1 * speed);
      if (this.keys["w"]) this.moveUpDown(0.05 * speed);
      if (this.keys["s"]) this.moveUpDown(-0.05 * speed);
      requestAnimationFrame(loop);
    };

    loop();
  }

  setRoll(deg: number) {
    this.roll = deg;
    this.dispatchUpdate();
  }

  setFovY(deg: number) {
    this.fov = (deg * Math.PI) / 180;

    this.dispatchUpdate();
  }

  rotateY(deg: number) {
    vec3.rotateY(
      this.position,
      this.position,
      this.lookAt,
      (deg * Math.PI) / 180
    );

    this.dispatchUpdate();
  }

  moveInOut(v: number) {
    const dir = vec3.sub(vec3.create(), this.position, this.lookAt);
    vec3.normalize(dir, dir);

    vec3.add(this.position, this.position, vec3.scale(dir, dir, v));

    this.dispatchUpdate();
  }

  moveUpDown(v: number) {
    vec3.add(
      this.position,
      this.position,
      vec3.scale(vec3.create(), this.up, v)
    );

    this.dispatchUpdate();
  }

  reset() {
    this.position = [0, 1, 10];
    this.dispatchUpdate();
  }

  dispatchUpdate() {
    this.dispatchEvent(new Event("change"));
  }

  private getRollMatrix() {
    const dir = vec3.create();
    vec3.normalize(dir, vec3.sub(dir, this.position, this.lookAt));

    const rotmat = mat4.create();
    return mat4.fromRotation(rotmat, (this.roll * Math.PI) / 180, dir);
  }

  getViewMatrix() {
    mat4.lookAt(this.viewMatrix, this.position, this.lookAt, this.up);
    return mat4.mul(this.viewMatrix, this.viewMatrix, this.getRollMatrix());
  }

  getProjectionMatrix() {
    const aspect = window.innerWidth / window.innerHeight;
    const near = 0.1;
    const far = 200;
    return mat4.perspective(this.projectionMatrix, this.fov, aspect, near, far);
  }
}
