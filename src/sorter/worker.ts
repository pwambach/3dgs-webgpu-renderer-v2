self.onmessage = (e: Event) => {
  // @ts-ignore
  const [indices, output, splats, p, stride] = e.data;

  const [px, py, pz] = p;
  const splatLength = indices.length;

  let t = Date.now();

  for (let i = 0; i < splatLength; i++) {
    const j = i * stride + 4;
    const x = splats[j];
    const y = splats[j + 1];
    const z = splats[j + 2];
    output[i] = (x - px) * (x - px) + (y - py) * (y - py) + (z - pz) * (z - pz);
  }

  console.log("1 fill", Date.now() - t);
  t = Date.now();

  indices.sort((a: number, b: number) => output[a] - output[b]);

  //   console.log("2 sort ", Date.now() - t);
  t = Date.now();

  for (let i = 0; i < splatLength; i++) {
    const v = indices[i];
    output[i * 6 + 0] = v;
    output[i * 6 + 1] = v + splatLength;
    output[i * 6 + 2] = v + splatLength * 2;
    output[i * 6 + 3] = v + splatLength * 3;
    output[i * 6 + 4] = v + splatLength * 4;
    output[i * 6 + 5] = v + splatLength * 5;
  }

  //   console.log("3 fill 2", Date.now() - t);

  self.postMessage(
    [indices, output, splats],
    // @ts-ignore
    [indices.buffer, output.buffer, splats.buffer]
  );
};
