import { fetchIterator } from "./fetch-iterator";
import { vec3, quat, mat3 } from "gl-matrix";

type Properties = Record<string, { type: string; byteOffset: number }>;
type Attributes = Record<string, Float32Array>;
interface UpdateInfo {
  processedSplats: number;
  addedSplats: number;
  totalSplats: number;
  byteStart: number;
  byteEnd: number;
}

// struct Splat {
//   position: vec3f,
//   cov3d1: vec3f,
//   cov3d2: vec3f,
//   sh: array<vec3f, 16>
// }

const HEADER_END = "end_header";

export class Loader extends EventTarget {
  private url: string;
  private readonly decoder = new TextDecoder();
  private tmpBuffer = new Uint8Array(5e6);
  private tmpBufferIndex = 0;
  private bytesPerSplatIn = 0;
  readonly properties: Properties = {};
  readonly attributes: Attributes = {};
  readonly floatsPerSplatOut = 4 + 4 + 4 + 16 * 4; // watch out for webgpu buffer alignment pitfalls here
  splatCount = 0;
  processedSplats = 0;
  processedByteCount = 0;
  initTime = 0;

  constructor(url: string, initTime: number) {
    super();
    this.url = url;
    this.initTime = initTime;
  }

  load() {
    function handleUpdate(this: Loader, info: UpdateInfo) {
      this.dispatchEvent(
        new CustomEvent("update", {
          detail: {
            info,
            attributes: this.attributes,
          },
        })
      );
    }

    this.streamResponse(handleUpdate.bind(this)).then(() => {
      this.dispatchEvent(new CustomEvent("end"));
    });

    return {};
  }

  private async streamResponse(chunkCallback: (info: UpdateInfo) => void) {
    const streamIterator = fetchIterator(this.url);
    let headerText = "";
    let headerEndIndex = -1;

    for await (const chunk of streamIterator) {
      // copy chunk bytes into tmp buffer
      this.tmpBuffer.set(chunk, this.tmpBufferIndex);
      this.tmpBufferIndex += chunk.byteLength;

      // if end of header not yet found
      if (headerEndIndex < 0) {
        headerText += this.decoder.decode(chunk);
        headerEndIndex = headerText.indexOf(HEADER_END);
      }

      // if end of header was found and not already parsed
      if (headerEndIndex > 0 && this.splatCount === 0) {
        headerEndIndex += HEADER_END.length;
        this.parseHeader(headerText.slice(0, headerEndIndex));
        this.createEmptyArrays();

        // remove header bytes from beginning of tmp buffer
        this.moveTmpBuffer(headerEndIndex + 1, this.tmpBufferIndex);
      }

      this.processedByteCount += chunk.byteLength;

      // if header already parsed pull complete splats out of tmp buffer
      if (this.splatCount > 0) {
        const updateInfo = this.extractSplats();
        if (updateInfo.addedSplats > 0) {
          chunkCallback(updateInfo);
        }
      }
    }

    // free tmp buffer
    this.tmpBuffer = new Uint8Array(0);
    console.log("finished", this);
  }

  private parseHeader(text: string) {
    const lines = text.split("\n").map((l) => l.trim());

    // splats count
    const splatCountLine = lines.find((l) => l.includes("element vertex"))!;
    this.splatCount = parseInt(splatCountLine.match(/\d+/)![0] as string);

    // properties
    const attributelines = lines.filter((l) => l.includes("property"));

    for (let i = 0; i < attributelines.length; i++) {
      const match = attributelines[i].match(/(\w+)\s+(\w+)\s+(\w+)/);
      if (match && match.length > 3) {
        this.properties[match[3] as string] = {
          type: match[2],
          byteOffset: i * Float32Array.BYTES_PER_ELEMENT,
        };
      }
    }

    this.bytesPerSplatIn =
      Object.keys(this.properties).length * Float32Array.BYTES_PER_ELEMENT;
  }

  private createEmptyArrays() {
    this.attributes.splats = new Float32Array(
      this.splatCount * this.floatsPerSplatOut
    );
  }

  private extractSplats() {
    const numSplatsToExtract = Math.floor(
      this.tmpBufferIndex / this.bytesPerSplatIn
    );

    const dataView = new DataView(this.tmpBuffer.buffer);
    const splats = this.attributes.splats;

    const bytesPerSplatIn = this.bytesPerSplatIn;
    // perf optimization
    const fcRestByteOffsets = Object.keys(this.properties)
      .filter((key) => key.startsWith("f_rest"))
      .map((key) => this.properties[key].byteOffset);

    const vecPosition = vec3.create();
    const quatRotation = quat.create();
    const matRotateExtra = mat3.fromValues(1, 0, 0, 0, -1, 0, 0, 0, -1);
    const matScale = mat3.create();
    const matRotate = mat3.create();
    const matCov3d = mat3.create();

    for (let i = 0; i < numSplatsToExtract; i++) {
      const vIndex =
        (this.splatCount - this.processedSplats + i) * this.floatsPerSplatOut;

      // create position vec3
      vec3.set(
        vecPosition,
        this.readValue(dataView, i, "x"),
        this.readValue(dataView, i, "y"),
        this.readValue(dataView, i, "z")
      );
      // rotate all points 180 deg around x (we want +y up)
      vec3.rotateX(vecPosition, vecPosition, [0, 0, 0], Math.PI);

      // scale
      const scaleX = Math.exp(this.readValue(dataView, i, "scale_0"));
      const scaleY = Math.exp(this.readValue(dataView, i, "scale_1"));
      const scaleZ = Math.exp(this.readValue(dataView, i, "scale_2"));
      mat3.set(matScale, scaleX, 0, 0, 0, scaleY, 0, 0, 0, scaleZ);

      // calculate cov3d from scale and rotation
      // note that "rot_0" in data is w and "rot_1" is x
      quat.set(
        quatRotation,
        this.readValue(dataView, i, "rot_1"),
        this.readValue(dataView, i, "rot_2"),
        this.readValue(dataView, i, "rot_3"),
        this.readValue(dataView, i, "rot_0")
      );
      quat.normalize(quatRotation, quatRotation);
      mat3.fromQuat(matRotate, quatRotation);
      mat3.mul(matCov3d, matRotateExtra, matRotate);
      mat3.mul(matCov3d, matCov3d, matScale);
      mat3.transpose(matRotate, matCov3d);
      mat3.mul(matCov3d, matCov3d, matRotate);

      // prettier-ignore
      {
        // position
        splats[vIndex + 0] = vecPosition[0];
        splats[vIndex + 1] = vecPosition[1];
        splats[vIndex + 2] = vecPosition[2];
        splats[vIndex + 3] = sigmoid(this.readValue(dataView, i, "opacity"));
        
        // cov3d
        splats[vIndex + 4] = matCov3d[0]; // m00
        splats[vIndex + 5] = matCov3d[4]; // m11
        splats[vIndex + 6] = matCov3d[8]; // m22
        splats[vIndex + 7] = Date.now() - this.initTime; // time for initial animation
        splats[vIndex + 8] = matCov3d[3]; // m10
        splats[vIndex + 9] = matCov3d[6]; // m20
        splats[vIndex + 10] = matCov3d[7]; // m21
        splats[vIndex + 11] = 0;
        
        // sh coefficients
        splats[vIndex + 12] = this.readValue(dataView, i, "f_dc_0")
        splats[vIndex + 13] = this.readValue(dataView, i, "f_dc_1")
        splats[vIndex + 14] = this.readValue(dataView, i, "f_dc_2")
        splats[vIndex + 15] = 0

        for (let j = 0; j < 15; j++) {
          const k = i * bytesPerSplatIn
          splats[vIndex + 16 + j * 4] = dataView.getFloat32(k + fcRestByteOffsets[j], true);
          splats[vIndex + 17 + j * 4] = dataView.getFloat32(k + fcRestByteOffsets[j + 15], true);
          splats[vIndex + 18 + j * 4] = dataView.getFloat32(k + fcRestByteOffsets[j + 30],true);
        }
      }
    }

    this.processedSplats += numSplatsToExtract;

    this.moveTmpBuffer(
      numSplatsToExtract * this.bytesPerSplatIn,
      this.tmpBufferIndex
    );

    const byteStart =
      (this.processedSplats - numSplatsToExtract) *
      this.floatsPerSplatOut *
      Float32Array.BYTES_PER_ELEMENT;
    const byteEnd =
      this.processedSplats *
      this.floatsPerSplatOut *
      Float32Array.BYTES_PER_ELEMENT;

    return {
      processedSplats: this.processedSplats,
      addedSplats: numSplatsToExtract,
      totalSplats: this.splatCount,
      byteStart,
      byteEnd,
    };
  }

  private moveTmpBuffer(startOffset: number, endOffset: number) {
    this.tmpBuffer.copyWithin(0, startOffset, endOffset);
    this.tmpBufferIndex -= startOffset;
  }

  private readValue(dataView: DataView, splatNumber: number, key: string) {
    return dataView.getFloat32(
      splatNumber * this.bytesPerSplatIn + this.properties[key].byteOffset,
      true
    );
  }
}

function sigmoid(x: number) {
  return 1.0 / (1.0 + Math.exp(-x));
}
