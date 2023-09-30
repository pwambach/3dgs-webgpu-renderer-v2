import { fetchIterator } from "./fetch-iterator";

type Properties = Record<string, { type: string; byteOffset: number }>;
type Attributes = Record<string, Float32Array>;
interface UpdateInfo {
  processedSplats: number;
  addedSplats: number;
  totalSplats: number;
  byteStart: number;
  byteEnd: number;
}

const HEADER_END = "end_header";

export class Loader extends EventTarget {
  private url: string;
  private readonly decoder = new TextDecoder();
  private tmpBuffer = new Uint8Array(5e6);
  private tmpBufferIndex = 0;
  private bytesPerSplatIn = 0;
  readonly properties: Properties = {};
  readonly attributes: Attributes = {};
  readonly floatsPerSplatOut = 4 + 3 + 1 + 4 + 4; //.watch out for webgpu buffer alignment pitfalls here
  splatCount = 0;
  processedSplats = 0;
  processedByteCount = 0;

  constructor(url: string) {
    super();
    this.url = url;
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

    for (let i = 0; i < numSplatsToExtract; i++) {
      const vIndex = (this.processedSplats + i) * this.floatsPerSplatOut;
      // prettier-ignore
      {
        splats[vIndex + 0] = this.readValue(dataView, i, "rot_0"),
        splats[vIndex + 1] = this.readValue(dataView, i, "rot_1"),
        splats[vIndex + 2] = this.readValue(dataView, i, "rot_2"),
        splats[vIndex + 3] = this.readValue(dataView, i, "rot_3"),

        splats[vIndex + 4] = this.readValue(dataView, i, "x"),
        splats[vIndex + 5] = this.readValue(dataView, i, "y") * -1, // we have y-up
        splats[vIndex + 6] = this.readValue(dataView, i, "z"),
        splats[vIndex + 7] = this.readValue(dataView, i, "opacity"),

        splats[vIndex + 8] = this.readValue(dataView, i, "scale_0"),
        splats[vIndex + 9] = this.readValue(dataView, i, "scale_1"),
        splats[vIndex + 10] = this.readValue(dataView, i, "scale_2"),
        splats[vIndex + 11] = 0

        splats[vIndex + 12] = this.readValue(dataView, i, "f_dc_0")
        splats[vIndex + 13] = this.readValue(dataView, i, "f_dc_1")
        splats[vIndex + 14] = this.readValue(dataView, i, "f_dc_2")
        splats[vIndex + 15] = 0
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
