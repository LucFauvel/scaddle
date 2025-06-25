/// <reference lib="webworker" />

import OpenSCAD from "../../openscad-wasm/build/openscad.wasm.js";
import { fs as browserFS } from "@zenfs/core";

var instance = OpenSCAD({ noInitialRun: true }).then((instance) => {
  instance.FS.readFile = (path: string, opts?: { encoding: "utf8" | "binary" }): string | Uint8Array => {
    return browserFS.readFileSync(path, opts || { encoding: 'utf8' });
  };

  instance.FS.writeFile = (path: string, data: string | ArrayBufferView): void => {
    browserFS.writeFile(path, data);
  };

  instance.rename = (oldpath: string, newpath: string): void => {
    browserFS.rename(oldpath, newpath);
  };

  instance.mkdir = (path: string): void => {
    browserFS.mkdir(path);
  };

  instance.stat = (path: string): void => {
    return browserFS.stat(path, () => {});
  };

  instance.unlink = (path: string): void => {
    browserFS.unlink(path);
  };

  return instance;
});

async function generateStlFromScad(scadCode: string): Promise<Uint8Array> {
  console.log('Generating STL from SCAD code:', scadCode);
  const awaitedInstance = await instance;

  awaitedInstance.FS.writeFile('input.scad', scadCode);
  const code = awaitedInstance.callMain(['input.scad', '-o', 'output.stl']);
  console.log(`STL generation completed, reading output file... ${code}`);
  return awaitedInstance.FS.readFile('output.stl') as Uint8Array;
}

addEventListener('message', async ({ data }) => {
  postMessage({ stlBytes: await generateStlFromScad(data.scadCode) });
});
