// @ts-ignore
import { Injectable } from '@angular/core';
import OpenSCAD, { OpenSCAD as OpenSCADType } from "../../openscad-wasm/build/openscad.js";

@Injectable({
  providedIn: 'root'
})
export class OpenscadService {
  private instance: Promise<OpenSCADType>;

  constructor() {
    this.instance = OpenSCAD({ noInitialRun: true });
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
