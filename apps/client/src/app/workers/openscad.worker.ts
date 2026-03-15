/// <reference lib="webworker" />

import OpenSCAD from "../../openscad-wasm/openscad.js";
import { addFonts } from "../../openscad-wasm/openscad.fonts.js";


async function compileScad(scadCode: string): Promise<{ offData: Uint8Array | null; stlBytes: Uint8Array | null }> {
  const instance = await OpenSCAD({ noInitialRun: true });
  addFonts(instance);
  instance.FS.writeFile('input.scad', scadCode);

  // Try OFF first — carries per-face color data
  try {
    const offCode = instance.callMain(['input.scad', '-o', 'output.off']);
    console.log(`OFF export code: ${offCode}`);
    if (offCode === 0) {
      const offData = instance.FS.readFile('output.off') as Uint8Array;
      if (offData.length > 4) {
        console.log(`OFF export succeeded (${offData.length} bytes)`);
        return { offData, stlBytes: null };
      }
    }
  } catch (e) {
    console.warn('OFF export failed, falling back to STL:', e);
  }

  // Fallback: STL (no color, but always works)
  const stlCode = instance.callMain(['input.scad', '-o', 'output.stl']);
  console.log(`STL export code: ${stlCode}`);
  const stlBytes = instance.FS.readFile('output.stl') as Uint8Array;
  return { offData: null, stlBytes };
}

addEventListener('message', async ({ data }) => {
  try {
    postMessage(await compileScad(data.scadCode));
  } catch (e) {
    console.error('Compilation failed:', e);
    postMessage({ offData: null, stlBytes: null });
  }
});
