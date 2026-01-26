/// <reference lib="webworker" />

import OpenSCAD from "../../openscad-wasm/openscad.js";


async function generateStlFromScad(scadCode: string): Promise<Uint8Array> {
  console.log('Generating STL from SCAD code:', scadCode);
  const awaitedInstance = await OpenSCAD({ noInitialRun: true });

  awaitedInstance.FS.writeFile('input.scad', scadCode);
  const code = awaitedInstance.callMain(['input.scad', '-o', 'output.stl']);
  console.log(`STL generation completed, reading output file... ${code}`);
  return awaitedInstance.FS.readFile('output.stl') as Uint8Array;
}

addEventListener('message', async ({ data }) => {
  postMessage({ stlBytes: await generateStlFromScad(data.scadCode) });
});
