/**
 * A transform captured from the Three.js viewport, already converted to
 * OpenSCAD units and degrees so consumers don't need to know the display scale.
 *
 * Coordinate mapping from Three.js to OpenSCAD:
 *   translate: mesh.position  / DISPLAY_SCALE  (0.1)
 *   rotate:    mesh.rotation  * (180 / π)      (radians → degrees, Euler XYZ)
 *   scale:     mesh.scale     / DISPLAY_SCALE  (0.1)
 */
export interface MeshTransform {
  translate: [number, number, number];
  rotate:    [number, number, number]; // degrees, Euler XYZ
  scale:     [number, number, number]; // ratio (1.0 = no change)
}
