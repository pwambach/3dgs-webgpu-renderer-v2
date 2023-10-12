import { vec3, mat4 } from "gl-matrix";
import orbitControls from "orbit-controls";

export class OrbitCamera extends EventTarget {
  private viewMatrix: mat4 = mat4.create();
  private projectionMatrix: mat4 = mat4.create();
  private up = vec3.fromValues(0, 1, 0);
  private keys: Record<string, boolean> = {};
  private fov: number = (45 * Math.PI) / 180;
  private roll: number = 0;
  private delayedFrames = 0;
  autoRotateSpeed: number;
  controls: any;

  constructor({
    position,
    lookAt,
    autoRotateSpeed = 0.1,
  }: {
    position: vec3;
    lookAt: vec3;
    autoRotateSpeed?: number;
  }) {
    super();

    this.controls = orbitControls({
      position,
      target: lookAt,
      damping: 0.12,
      rotateSpeed: 0.1,
      zoomSpeed: 0.0015,
      distanceBounds: [0.1, 100],
      pinch: false,
      phiBounds: [0, 1],
    });

    this.controls.position = position;
    this.controls.target = lookAt;
    this.controls.phiBounds = [0, Math.PI / 2 - 0.1];

    this.autoRotateSpeed = autoRotateSpeed;

    this.addKeyListeners();
    this.getProjectionMatrix();

    const loop = () => {
      if (this.delayedFrames > 0) {
        this.delayedFrames--;

        this.dispatchUpdate();
      } else {
        this.delayedFrames = 0;
      }
      requestAnimationFrame(loop);

      if (this.autoRotateSpeed > 0) {
        this.rotateY(this.autoRotateSpeed);
      }
    };
    loop();
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

    window.addEventListener("pointermove", () => {
      if (this.controls.dragging) {
        this.dispatchUpdate();
        this.delayedFrames = 100;
      }
    });

    window.addEventListener("wheel", () => {
      this.dispatchUpdate();
    });

    const loop = () => {
      const speed = this.keys["shift"] ? 8 : 1;
      if (this.keys["w"]) this.moveInOut(-0.02 * speed);
      if (this.keys["s"]) this.moveInOut(0.02 * speed);
      if (this.keys["a"]) this.moveLeftRight(-0.02 * speed);
      if (this.keys["d"]) this.moveLeftRight(0.02 * speed);
      if (this.keys["e"]) this.moveUpDown(0.02 * speed);
      if (this.keys["q"]) this.moveUpDown(-0.02 * speed);
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
      this.controls.position,
      this.controls.position,
      this.controls.target,
      (deg * Math.PI) / 180
    );

    this.dispatchUpdate();
  }

  moveInOut(v: number) {
    const dir = vec3.sub(
      vec3.create(),
      this.controls.position,
      this.controls.target
    );
    vec3.normalize(dir, dir);

    const vs = vec3.scale(dir, dir, v);

    vec3.add(this.controls.position, this.controls.position, vs);
    vec3.add(this.controls.target, this.controls.target, vs);

    this.dispatchUpdate();
  }

  moveLeftRight(v: number) {
    const lookDir = vec3.sub(
      vec3.create(),
      this.controls.position,
      this.controls.target
    );
    const dir = vec3.cross(vec3.create(), this.up, lookDir);

    vec3.normalize(dir, dir);
    vec3.scale(dir, dir, v);
    vec3.add(this.controls.position, this.controls.position, dir);
    vec3.add(this.controls.target, this.controls.target, dir);

    this.dispatchUpdate();
  }

  moveUpDown(v: number) {
    const vs = vec3.scale(vec3.create(), this.up, v);
    vec3.add(this.controls.position, this.controls.position, vs);
    vec3.add(this.controls.target, this.controls.target, vs);

    this.dispatchUpdate();
  }

  reset() {
    this.controls.position = [0, 1, 10];
    this.dispatchUpdate();
  }

  dispatchUpdate() {
    this.controls.update();
    this.dispatchEvent(new Event("change"));
  }

  private getRollMatrix() {
    const dir = vec3.create();
    vec3.normalize(
      dir,
      vec3.sub(dir, this.controls.position, this.controls.target)
    );

    const rotmat = mat4.create();
    return mat4.fromRotation(rotmat, (this.roll * Math.PI) / 180, dir);
  }

  getViewMatrix() {
    mat4.lookAt(
      this.viewMatrix,
      this.controls.position,
      this.controls.target,
      this.up
    );
    return mat4.mul(this.viewMatrix, this.viewMatrix, this.getRollMatrix());
  }

  getProjectionMatrix() {
    const aspect = window.innerWidth / window.innerHeight;
    const near = 0.1;
    const far = 200;
    return mat4.perspective(this.projectionMatrix, this.fov, aspect, near, far);
  }
}
