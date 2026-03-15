/**
 * Converts an OpenSCAD OFF/COFF byte array to a binary STL Uint8Array.
 * Fan-triangulates n-gon faces and computes per-triangle normals.
 * The original OpenSCAD coordinate space is preserved (no scaling).
 */
export function offToStlBytes(bytes: Uint8Array): Uint8Array {
  const lines = new TextDecoder()
    .decode(bytes)
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('#'));

  let i = 0;

  const headerParts = lines[i++].toUpperCase().split(/\s+/);
  if (!headerParts[0].startsWith('OFF') && !headerParts[0].startsWith('COFF')) {
    throw new Error(`Not an OFF file: ${headerParts[0]}`);
  }

  let nV: number, nF: number;
  if (headerParts.length >= 3 && !isNaN(Number(headerParts[1]))) {
    nV = Number(headerParts[1]);
    nF = Number(headerParts[2]);
  } else {
    [nV, nF] = lines[i++].split(/\s+/).map(Number);
  }

  const verts: number[] = [];
  for (let v = 0; v < nV; v++) {
    const [x, y, z] = lines[i++].split(/\s+/).map(parseFloat);
    verts.push(x, y, z);
  }

  // Collect flat triangle vertex data (9 floats per triangle)
  type Tri = [number, number, number, number, number, number, number, number, number];
  const tris: Tri[] = [];

  for (let f = 0; f < nF; f++) {
    const parts = lines[i++].split(/\s+/).map(Number);
    const n    = parts[0];
    const idxs = parts.slice(1, 1 + n);

    for (let t = 1; t < n - 1; t++) {
      const [v0, v1, v2] = [idxs[0], idxs[t], idxs[t + 1]];
      tris.push([
        verts[v0 * 3], verts[v0 * 3 + 1], verts[v0 * 3 + 2],
        verts[v1 * 3], verts[v1 * 3 + 1], verts[v1 * 3 + 2],
        verts[v2 * 3], verts[v2 * 3 + 1], verts[v2 * 3 + 2],
      ]);
    }
  }

  // Binary STL layout: 80-byte header + 4-byte count + N × 50-byte triangles
  const buf  = new ArrayBuffer(80 + 4 + tris.length * 50);
  const view = new DataView(buf);

  view.setUint32(80, tris.length, true);

  let off = 84;
  for (const [ax, ay, az, bx, by, bz, cx, cy, cz] of tris) {
    // Face normal
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const wx = cx - ax, wy = cy - ay, wz = cz - az;
    const nx = uy * wz - uz * wy;
    const ny = uz * wx - ux * wz;
    const nz = ux * wy - uy * wx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;

    view.setFloat32(off,      nx / len, true); off += 4;
    view.setFloat32(off,      ny / len, true); off += 4;
    view.setFloat32(off,      nz / len, true); off += 4;
    view.setFloat32(off, ax,  true); off += 4;
    view.setFloat32(off, ay,  true); off += 4;
    view.setFloat32(off, az,  true); off += 4;
    view.setFloat32(off, bx,  true); off += 4;
    view.setFloat32(off, by,  true); off += 4;
    view.setFloat32(off, bz,  true); off += 4;
    view.setFloat32(off, cx,  true); off += 4;
    view.setFloat32(off, cy,  true); off += 4;
    view.setFloat32(off, cz,  true); off += 4;
    view.setUint16(off, 0,    true); off += 2;
  }

  return new Uint8Array(buf);
}
