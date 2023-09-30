import { Pane } from "tweakpane";

export function createPane(PARAMS: Record<string, any>) {
  const pane = new Pane();
  let oldState = null;
  let oldParams = null;

  try {
    const oldPaneString = localStorage.getItem("3dgs_pane");
    const oldParamsString = localStorage.getItem("3dgs_params");
    if (!oldPaneString || !oldParamsString) {
      throw new Error("no old stuff");
    }

    oldState = JSON.parse(oldPaneString);
    oldParams = JSON.parse(oldParamsString);
  } catch (e: unknown) {}

  if (oldState) {
    Object.assign(PARAMS, oldParams);
    // @ts-ignore
    pane.importState(oldState);
  }

  const resetCameraBtn = pane.addButton({
    title: "Reset Camera",
  });

  resetCameraBtn.on("click", () => {
    // @ts-ignore
    window.camera.reset();
  });

  // @ts-ignore
  pane.addBinding(PARAMS, "splatSize", { min: 0, max: 1, step: 0.01 });
  // @ts-ignore
  pane.addBinding(PARAMS, "modelRotate", {
    min: -3,
    max: 3,
    step: 0.01,
  });
  // @ts-ignore
  pane.addBinding(PARAMS, "modelTranslate", {
    min: -100,
    max: 100,
    step: 2,
  });
  // @ts-ignore
  pane.addBinding(PARAMS, "minBounds", { min: -10, max: 10, step: 0.2 });
  // @ts-ignore
  pane.addBinding(PARAMS, "maxBounds", { min: -10, max: 10, step: 0.2 });
  // @ts-ignore
  pane.addBinding(PARAMS, "camera");
  // @ts-ignore
  pane.addBinding(PARAMS, "rotate");
  // @ts-ignore
  pane.addBinding(PARAMS, "cameraRoll", { min: -90, max: 90, step: 1 });

  // @ts-ignore
  pane.on("change", (ev) => {
    // @ts-ignore
    const state = pane.exportState();
    localStorage.setItem("3dgs_pane", JSON.stringify(state));
    localStorage.setItem("3dgs_params", JSON.stringify(PARAMS));
  });

  const btn = pane.addButton({
    title: "Sort",
  });

  btn.on("click", () => {
    // @ts-ignore
    window.runCpuSort();
  });

  return pane;
}
