/// <reference lib="webworker" />

import OpenSCAD from "../../openscad-wasm/openscad.js";
import { addFonts } from "../../openscad-wasm/openscad.fonts.js";


async function generateStlFromScad(scadCode: string): Promise<Uint8Array> {
  const instance = await OpenSCAD({ noInitialRun: true });
  addFonts(instance);
  instance.FS.writeFile('input.scad', scadCode);
  const code = instance.callMain(['input.scad', '-o', 'output.stl']);
  console.log(`STL generation completed with code ${code}`);
  return instance.FS.readFile('output.stl') as Uint8Array;
}

addEventListener('message', async ({ data }) => {
  postMessage({ stlBytes: await generateStlFromScad(data.scadCode) });
});
