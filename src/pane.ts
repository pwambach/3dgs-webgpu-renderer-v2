import { Pane as TweakPane } from "tweakpane";
import { Uniforms } from "./uniforms";
import { OrbitCamera } from "./orbit-camera";

export class Pane {
  tp: TweakPane;
  bindings: Record<string, any> = {};

  constructor(uniforms: Uniforms, camera: OrbitCamera) {
    const params = { splatSize: 1, autoRotateSpeed: 0 };
    this.tp = new TweakPane();

    // prevent camera move when dragging sliders
    this.tp.element.addEventListener("mousedown", (e) => e.stopPropagation());

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

// let oldState = null;
// let oldParams = null;

// try {
//   const oldPaneString = localStorage.getItem("3dgs_pane");
//   const oldParamsString = localStorage.getItem("3dgs_params");
//   if (!oldPaneString || !oldParamsString) {
//     throw new Error("no old stuff");
//   }

//   oldState = JSON.parse(oldPaneString);
//   oldParams = JSON.parse(oldParamsString);
// } catch (e: unknown) {}

// if (oldState) {
//   Object.assign(PARAMS, oldParams);
//   // @ts-ignore
//   pane.importState(oldState);
// }

// const resetCameraBtn = pane.addButton({
//   title: "Reset Camera",
// });

// resetCameraBtn.on("click", () => {
//   // @ts-ignore
//   window.camera.reset();
// });

// @ts-ignore
// pane.addBinding(PARAMS, "splatSize", { min: 0, max: 1, step: 0.01 });

// // @ts-ignore
// pane.addBinding(PARAMS, "modelRotate", {
//   min: -3,
//   max: 3,
//   step: 0.01,
// });
// // @ts-ignore
// pane.addBinding(PARAMS, "modelTranslate", {
//   min: -100,
//   max: 100,
//   step: 2,
// });
// // @ts-ignore
// pane.addBinding(PARAMS, "minBounds", { min: -10, max: 10, step: 0.2 });
// // @ts-ignore
// pane.addBinding(PARAMS, "maxBounds", { min: -10, max: 10, step: 0.2 });
// // @ts-ignore
// pane.addBinding(PARAMS, "camera");
// // @ts-ignore
// pane.addBinding(PARAMS, "rotate");
// // @ts-ignore
// pane.addBinding(PARAMS, "cameraRoll", { min: -90, max: 90, step: 1 });

// // @ts-ignore
// pane.on("change", (ev) => {
//   // @ts-ignore
//   const state = pane.exportState();
//   localStorage.setItem("3dgs_pane", JSON.stringify(state));
//   localStorage.setItem("3dgs_params", JSON.stringify(PARAMS));
// });

// const btn = pane.addButton({
//   title: "Sort",
// });

// btn.on("click", () => {
//   // @ts-ignore
//   window.runCpuSort();
// });

//   return pane;
// }
