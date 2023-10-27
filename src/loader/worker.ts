import { PlyReader } from "./ply-reader";

type Attributes = Record<string, Float32Array>;
interface UpdateInfo {
  floatsPerSplatOut: number;
  processedSplats: number;
  addedSplats: number;
  totalSplats: number;
  byteStart: number;
  byteEnd: number;
}

const plyReader = new PlyReader();

plyReader.addEventListener("end", () => {
  self.postMessage(["end"]);
});

plyReader.addEventListener(
  "update",
  (event: CustomEventInit<{ info: UpdateInfo; attributes: Attributes }>) => {
    const { info, attributes } = event.detail!;

    const splatsSlice = new Float32Array(
      attributes.splats.buffer.slice(info.byteStart, info.byteEnd)
    );

    // we need an extra positions array for sorting
    const positionsSlice = new Float32Array(info.addedSplats * 3);

    for (let i = 0; i < info.addedSplats; i++) {
      positionsSlice[i * 3 + 0] = splatsSlice[i * info.floatsPerSplatOut + 0];
      positionsSlice[i * 3 + 1] = splatsSlice[i * info.floatsPerSplatOut + 1];
      positionsSlice[i * 3 + 2] = splatsSlice[i * info.floatsPerSplatOut + 2];
    }

    self.postMessage(
      ["update", info, splatsSlice, positionsSlice],
      //@ts-ignore
      [splatsSlice.buffer, positionsSlice.buffer]
    );
  }
);

self.onmessage = (event) => {
  const [url, modelMatrix] = event.data;
  plyReader.load(url, modelMatrix);
};
