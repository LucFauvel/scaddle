// @ts-ignore
import { Injectable } from '@angular/core';
import OpenSCAD, { OpenSCAD as OpenSCADType, FS } from "../../openscad-wasm/build/openscad.js";
import { fs } from "@zenfs/core";

@Injectable({
  providedIn: 'root'
})
export class OpenscadService {
  private instance: Promise<OpenSCADType>;

  constructor() {
    this.instance = OpenSCAD({ noInitialRun: true }).then((instance) => {
      instance.FS = new ZenFS() as FS;
      return instance;
    });
  }

  async generateStlFromScad(scadCode: string): Promise<Uint8Array> {
    console.log('Generating STL from SCAD code:', scadCode);
    const awaitedInstance = await this.instance;

    awaitedInstance.FS.writeFile('/input.scad', scadCode);
    const code = awaitedInstance.callMain(['/input.scad', '-o', 'output.stl']);
    console.log(`STL generation completed, reading output file... ${code}`);
    return awaitedInstance.FS.readFile('/output.stl') as Uint8Array;
  }
}

export class ZenFS implements FS {
  mkdir(path: string): void {
    fs.mkdir(path);
  }
  rename(oldpath: string, newpath: string): void {
    fs.rename(oldpath, newpath);
  }
  rmdir(path: string): void {
    fs.rmdir(path);
  }
  stat(path: string): void {
    return fs.stat(path, () => {});
  }
  readFile(path: string): string | Uint8Array;
  readFile(path: string, opts: { encoding: "utf8" }): string;
  readFile(path: string, opts: { encoding: "binary" }): Uint8Array;
  readFile(path: string, opts?: { encoding: "utf8" | "binary" }): string | Uint8Array {
    return fs.readFileSync(path, opts || { encoding: 'utf8' });
  }
  writeFile(path: string, data: string | ArrayBufferView): void {
    fs.writeFile(path, data);
  }
  unlink(path: string): void {
    fs.unlink(path);
  }
}
