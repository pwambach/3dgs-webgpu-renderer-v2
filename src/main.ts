// import debounce from "lodash.debounce";
import { Loader } from "./loader/index";
import { Renderer } from "./renderer/renderer";
import { vec3, mat4 } from "gl-matrix";
import { Splats } from "./splats";
import { Uniforms } from "./uniforms";
import { Sorter } from "./sorter/sorter";
import { Pane } from "./pane";

import { PerspectiveCamera, Ray, Vector3, WebGPUCoordinateSystem } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

let renderer: Renderer = new Renderer("canvas");
await renderer.init();
let uniforms: Uniforms = new Uniforms({
  device: renderer.device!,
  initTime: Date.now(),
});

// initial transform of the splats
const modelMatrix = mat4.fromTranslation(
  mat4.create(),
  vec3.fromValues(-2, 0, 0)
);
mat4.rotateX(modelMatrix, modelMatrix, -0.2);
// mat4.rotateZ(modelMatrix, modelMatrix, -0.6);
// mat4.translate(modelMatrix, modelMatrix, vec3.fromValues(0, 2, 0));
// mat4.rotateY(modelMatrix, modelMatrix, 0);
// mat4.rotateZ(modelMatrix, modelMatrix, 0);

// camera
const camera = new PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.coordinateSystem = WebGPUCoordinateSystem;
camera.position.set(-3, 0, -4);
camera.updateMatrixWorld();
camera.updateProjectionMatrix();

// controls
const controls = new OrbitControls(camera, document.getElementById("canvas")!);
controls.target.set(-3, 0, -1);
controls.autoRotate = false;
controls.autoRotateSpeed = -0.5;
controls.zoomSpeed = 0.25;
controls.update();
controls.listenToKeyEvents(window);

const loader = new Loader({ modelMatrix });
// const pane = new Pane(uniforms, camera);

let sorter: Sorter;
let splats: Splats | null = null;

async function start() {
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  uniforms.viewMatrix = camera.matrixWorldInverse.elements;
  uniforms.projectionMatrix = camera.projectionMatrix.elements;
  uniforms.cameraPos = camera.position.toArray();
  uniforms.numShDegrees = 3;

  let firstChunkLoaded = false;
  loader.load("/truck/point_cloud2.ply");
  loader.addEventListener("update", (e: CustomEventInit) => {
    if (!firstChunkLoaded) {
      onFirstChunk(e.detail);
      firstChunkLoaded = true;
    }

    if (!sorter) {
      sorter = new Sorter(loader.positions);

      sorter.addEventListener("sorted", () => {
        splats?.uploadSort(sorter.indices);
        requestAnimationFrame(() => {
          renderer.draw(loader.splatCount, loader.splatCount);
        });
      });

      const loop = () => {
        sorter.update(camera.position.toArray(), loader.processedSplats);
        requestAnimationFrame(loop);
      };
      loop();
    }

    splats!.uploadSplats(e.detail.info.byteStart, e.detail.info.byteEnd);
    renderer.draw(
      loader.splatCount,
      /*pane.params.splatLimit*/ loader.splatCount
    );
    uniforms.setTime();

    // if (!pane.params.splatCount) {
    //   pane.setSplatCount(loader.splatCount);
    // }
  });

  loader.addEventListener("end", async () => {
    // splats?.uploadSplats(0, 0);
    console.log(loader);

    // look at clicked splat
    document.getElementById("canvas")!.addEventListener("click", (e) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = (e.clientY / window.innerHeight) * 2 - 1;
      const hit = raycast(camera, [x, -y], loader.positions);
      controls.target.copy(hit);
      controls.update();
      camera.updateMatrixWorld();
      uniforms.viewMatrix = camera.matrixWorldInverse.elements;
      uniforms.projectionMatrix = camera.projectionMatrix.elements;
    });
  });

  controls.addEventListener("change", () => {
    camera.updateMatrixWorld();
    uniforms.viewMatrix = camera.matrixWorldInverse.elements;
    uniforms.projectionMatrix = camera.projectionMatrix.elements;
    uniforms.cameraPos = camera.position.toArray();
  });

  // render on uniforms change (camera, splatSize, etc.)
  uniforms.addEventListener("change", () => {
    renderer.draw(loader.splatCount, loader.splatCount);

    // make sure the last buffer upload is also rendered
    // (note: this won't render twice per frame because the renderer uses a draw queue)
    requestAnimationFrame(() => {
      renderer.draw(loader.splatCount, loader.splatCount);
    });
  });

  // window resize listener
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    uniforms.screen = [window.innerWidth, window.innerHeight];
    uniforms.projectionMatrix = camera.projectionMatrix.elements;
  });

  let i = 0;
  function loop() {
    if (i < 1000 || controls.autoRotate) {
      uniforms.setTime();
      controls.update();
    }
    requestAnimationFrame(loop);
    i++;
  }
  loop();
}

function onFirstChunk(detail: any) {
  if (!renderer) {
    throw new Error("no renderer");
  }

  if (!uniforms) {
    throw new Error("no uniforms");
  }

  uniforms.numSplats = loader.splatCount;

  splats = new Splats({
    device: renderer.device!,
    splats: detail.splats,
    numSplatFloats: loader.floatsPerSplatOut,
    numOutputFloats: 12,
  });

  renderer.setVertexBuffer(splats.vertexBuffer);
  renderer.createRenderPipeline();
  renderer.createBindGroupsData(
    splats.splatsBuffer,
    splats.outputBuffer,
    splats.sortBuffer
  );
  renderer.createBindGroupUniforms(uniforms.buffer!);
}

start();

function raycast(
  camera: PerspectiveCamera,
  screenCoords: [number, number],
  splatPositions: Float32Array
) {
  const origin = new Vector3().setFromMatrixPosition(camera.matrixWorld);
  const dir = new Vector3(screenCoords[0], screenCoords[1], 0.5)
    .unproject(camera)
    .sub(origin)
    .normalize();
  const ray = new Ray(origin, dir);

  let index = -1;
  let shortestDistance = Infinity;
  const p = new Vector3();
  // let n = new Vector3(0, 0, 0);
  // let o = origin.clone();
  // let lastangle = 0;

  for (let i = 0; i < splatPositions.length / 3; i += 3) {
    p.set(splatPositions[i + 0], splatPositions[i + 1], splatPositions[i + 2]);
    const d = ray.distanceSqToPoint(p);

    if (d < shortestDistance) {
      // n.set(
      //   splatPositions[index],
      //   splatPositions[index + 1],
      //   splatPositions[index + 2]
      // );

      // const angle = dir.angleTo(n.sub(o));
      // lastangle = angle;
      // console.log(angle);

      // if (angle < 0.3) {
      shortestDistance = d;
      index = i;
      // }
    }
  }
  // console.log(lastangle);

  return new Vector3(
    splatPositions[index],
    splatPositions[index + 1],
    splatPositions[index + 2]
  );

  // return new Vector3(3, 0, 0);
}
