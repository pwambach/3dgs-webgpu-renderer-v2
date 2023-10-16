import { Pane as TweakPane } from "tweakpane";
import { Uniforms } from "./uniforms";
import { OrbitCamera } from "./orbit-camera";

export class Pane {
  tp: TweakPane;
  bindings: Record<string, any> = {};

  constructor(uniforms: Uniforms, camera: OrbitCamera) {
    const params = { splatSize: 1, autoRotateSpeed: 0, numShDegrees: 0 };
    this.tp = new TweakPane();

    // prevent camera move when dragging sliders
    this.tp.element.addEventListener("mousedown", (e) => {
      e.stopPropagation();
    });

    // @ts-ignore
    this.bindings.splatSize = this.tp.addBinding(params, "splatSize", {
      min: 0,
      max: 1,
      step: 0.01,
    });

    this.bindings.splatSize.on("change", (e: any) => {
      uniforms.splatSize = e.value;
    });

    // @ts-ignore
    this.bindings.numShDegrees = this.tp.addBinding(params, "numShDegrees", {
      min: 0,
      max: 3,
      step: 1,
    });

    this.bindings.numShDegrees.on("change", (e: any) => {
      uniforms.numShDegrees = e.value;
    });

    // @ts-ignore
    this.bindings.autoRotateSpeed = this.tp.addBinding(
      params,
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
  }
}
