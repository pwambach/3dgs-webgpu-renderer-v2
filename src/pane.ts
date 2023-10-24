import { Pane as TweakPane } from "tweakpane";
import { Uniforms } from "./uniforms";
import { OrbitCamera } from "./orbit-camera";

export class Pane {
  tp: TweakPane;
  bindings: Record<string, any> = {};
  params: Record<string, any>;

  constructor(uniforms: Uniforms, camera: OrbitCamera) {
    this.params = {
      splatSize: 1,
      autoRotateSpeed: 0,
      numShDegrees: 3,
      splatCount: 0,
      splatLimit: 0,
      screen: `${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio}`,
    };
    this.tp = new TweakPane();

    // prevent camera move when dragging sliders
    this.tp.element.addEventListener("mousedown", (e) => {
      e.stopPropagation();
    });

    // @ts-ignore
    this.bindings.splatSize = this.tp.addBinding(this.params, "splatSize", {
      min: 0,
      max: 1,
      step: 0.01,
    });

    this.bindings.splatSize.on("change", (e: any) => {
      uniforms.splatSize = e.value;
    });

    // @ts-ignore
    this.bindings.numShDegrees = this.tp.addBinding(
      this.params,
      "numShDegrees",
      {
        min: 0,
        max: 3,
        step: 1,
      }
    );

    this.bindings.numShDegrees.on("change", (e: any) => {
      uniforms.numShDegrees = e.value;
    });

    // @ts-ignore
    this.bindings.autoRotateSpeed = this.tp.addBinding(
      this.params,
      "autoRotateSpeed",
      {
        min: 0,
        max: 1,
        step: 0.01,
      }
    );

    this.bindings.autoRotateSpeed.on("change", (e: any) => {
      camera.autoRotateSpeed = e.value;
    });

    // @ts-ignore
    this.tp.addBinding(this.params, "screen", {
      readonly: true,
    });

    window.addEventListener("resize", () => {
      this.params.screen = `${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio}`;
    });

    this.bindings.autoRotateSpeed.on("change", (e: any) => {
      camera.autoRotateSpeed = e.value;
    });

    // @ts-ignore
    this.tp.addBinding(this.params, "splatCount", {
      format: (v: number) => (v / 1e6).toFixed(2) + "M",
      readonly: true,
    });
  }

  setSplatCount(v: number) {
    this.params.splatCount = v;
    this.params.splatLimit = v;

    // @ts-ignore
    this.bindings.splatLimit = this.tp.addBinding(this.params, "splatLimit", {
      min: 0,
      max: v,
      step: 1000,
      format: (v: number) => (v / 1e6).toFixed(2) + "M",
    });
  }
}
