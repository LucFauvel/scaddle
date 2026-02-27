import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  NgZone,
  OnDestroy,
  ViewChild,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { NgClass } from '@angular/common';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { MeshTransform } from '../models/mesh-transform';

// ─── Types ────────────────────────────────────────────────────────────────────

type ActiveTool = 'none' | 'translate' | 'rotate' | 'scale';
type ViewPresetId = 'perspective' | 'front' | 'right' | 'top';

interface ViewPreset {
  id: ViewPresetId;
  label: string;
  title: string;
}

// ─── Infinite adaptive grid shaders ───────────────────────────────────────────
// The grid is computed entirely in the fragment shader from world position.
// uGridScale is updated each frame based on camera distance, producing the
// "infinite adaptive grid" effect seen in Blender and Fusion 360.

const GRID_VERTEX = /* glsl */ `
  varying vec3 vWorldPos;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const GRID_FRAGMENT = /* glsl */ `
  varying vec3 vWorldPos;
  uniform float uGridScale;

  // Resolution-independent, anti-aliased grid lines using screen-space derivatives.
  float gridLine(vec2 pos, float spacing) {
    vec2 r = pos / spacing;
    vec2 grid = abs(fract(r - 0.5) - 0.5) / fwidth(r);
    return 1.0 - min(min(grid.x, grid.y), 1.0);
  }

  void main() {
    vec2 pos = vWorldPos.xz;

    float g1 = gridLine(pos, uGridScale) * 0.35;         // minor grid (thin)
    float g2 = gridLine(pos, uGridScale * 10.0) * 0.75;  // major grid (bold)

    // Axis lines: X axis = Z≈0 (red), Z axis = X≈0 (blue)
    float xAxis = 1.0 - min(abs(vWorldPos.z) / (fwidth(vWorldPos.z) * 1.5), 1.0);
    float zAxis = 1.0 - min(abs(vWorldPos.x) / (fwidth(vWorldPos.x) * 1.5), 1.0);

    // Radial fade so the plane edge is never visible
    float dist = length(pos);
    float fade = 1.0 - smoothstep(uGridScale * 28.0, uGridScale * 55.0, dist);

    float grid = max(g1, g2) * fade;
    // zinc-700 / zinc-600 equivalent tones for grid lines
    vec3 color = mix(vec3(0.247, 0.247, 0.275), vec3(0.322, 0.322, 0.357), g2);

    // Axis colours override grid line colour
    if (xAxis > 0.5) { color = vec3(0.85, 0.22, 0.22); grid = max(grid, xAxis * fade); }
    else if (zAxis > 0.5) { color = vec3(0.22, 0.55, 0.85); grid = max(grid, zAxis * fade); }

    gl_FragColor = vec4(color, grid);
    if (gl_FragColor.a < 0.01) discard;
  }
`;

// ─── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-renderer',
  standalone: true,
  imports: [NgClass],
  templateUrl: './renderer.component.html',
})
export class RendererComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer') private canvasContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('gizmoCanvas')     private gizmoCanvas!: ElementRef<HTMLCanvasElement>;

  // ── Inputs ────────────────────────────────────────────────────────────────
  stlBytes = input<Uint8Array | null>();

  // ── Outputs ───────────────────────────────────────────────────────────────
  /** Fires when the user finishes a transform drag. Values are in OpenSCAD units/degrees. */
  readonly transformApplied = output<MeshTransform>();

  // ── Template-readable state ───────────────────────────────────────────────
  activeTool = signal<ActiveTool>('none');
  activeView = signal<ViewPresetId>('perspective');

  readonly viewPresets: ViewPreset[] = [
    { id: 'perspective', label: 'PERSP', title: 'Perspective  ·  Numpad 5' },
    { id: 'front',       label: 'FRONT', title: 'Front view   ·  Numpad 1' },
    { id: 'right',       label: 'RIGHT', title: 'Right view   ·  Numpad 3' },
    { id: 'top',         label: 'TOP',   title: 'Top view     ·  Numpad 7' },
  ];

  // ── Three.js objects ──────────────────────────────────────────────────────
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private threeRenderer!: THREE.WebGLRenderer;
  private orbitControls!: OrbitControls;
  private tfControls!: TransformControls;
  private gridMesh!: THREE.Mesh;

  // Axis orientation gizmo — separate renderer on a dedicated small canvas
  private gizmoRenderer!: THREE.WebGLRenderer;
  private gizmoScene!: THREE.Scene;
  private gizmoCamera!: THREE.PerspectiveCamera;

  private currentMesh?: THREE.Mesh;

  // Gates keyboard shortcuts to only fire when the mouse is over the viewport
  private viewportHovered = false;

  constructor(private ngZone: NgZone) {
    // React to new STL bytes arriving from the compile worker
    effect(() => {
      const bytes = this.stlBytes();
      if (!bytes || !this.scene) return;

      const blob = new Blob([bytes.slice().buffer], { type: 'application/sla' });
      const url  = URL.createObjectURL(blob);

      new STLLoader().load(url, (geometry) => {
        const material = new THREE.MeshStandardMaterial({
          color:     0x8888aa,
          metalness: 0.3,
          roughness: 0.6,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.scale.set(0.1, 0.1, 0.1);
        mesh.castShadow    = true;
        mesh.receiveShadow = true;

        if (this.currentMesh) {
          this.scene.remove(this.currentMesh);
          this.tfControls?.detach();
        }

        this.scene.add(mesh);
        this.currentMesh = mesh;

        // Re-attach transform controls if a transform tool is already active
        const tool = this.activeTool();
        if (tool !== 'none' && this.tfControls) {
          this.tfControls.attach(mesh);
          this.tfControls.setMode(tool);
        }

        // Auto-frame the newly loaded mesh
        this.frameObject();
        URL.revokeObjectURL(url);
      });
    });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngAfterViewInit(): void {
    this.setupMainScene();
    this.setupInfiniteGrid();
    this.setupOrbitControls();
    this.setupTransformControls();
    this.setupAxisGizmo();

    // Run the animation loop outside Angular's zone.
    // Three.js fires at 60 fps — we don't want change detection on every frame.
    this.ngZone.runOutsideAngular(() => {
      this.threeRenderer.setAnimationLoop(() => this.animate());
    });
  }

  ngOnDestroy(): void {
    this.threeRenderer.setAnimationLoop(null);
    this.threeRenderer.dispose();
    this.gizmoRenderer.dispose();
    this.tfControls.dispose();
    this.orbitControls.dispose();
    (this.gridMesh.material as THREE.ShaderMaterial).dispose();
  }

  // ── Scene setup ───────────────────────────────────────────────────────────

  private setupMainScene(): void {
    const container = this.canvasContainer.nativeElement;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x09090b); // zinc-950

    this.camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.01,
      10000,
    );
    this.camera.position.set(4, 3, 6);

    this.threeRenderer = new THREE.WebGLRenderer({ antialias: true });
    this.threeRenderer.setPixelRatio(window.devicePixelRatio);
    this.threeRenderer.setSize(container.clientWidth, container.clientHeight);
    this.threeRenderer.shadowMap.enabled = true;
    this.threeRenderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    container.appendChild(this.threeRenderer.domElement);

    // Key light with soft shadow
    const key = new THREE.DirectionalLight(0xffffff, 3.5);
    key.position.set(10, 15, 10);
    key.castShadow            = true;
    key.shadow.mapSize.width  = 1024;
    key.shadow.mapSize.height = 1024;

    // Fill light (no shadow, just fills dark areas)
    const fill = new THREE.DirectionalLight(0xffffff, 1.5);
    fill.position.set(-10, -8, -10);

    // Ambient so deep shadows aren't pure black
    const ambient = new THREE.AmbientLight(0x8899aa, 0.6);

    this.scene.add(key, fill, ambient);
  }

  private setupInfiniteGrid(): void {
    // A very large quad — the shader fades the grid before the edge is visible
    const geometry = new THREE.PlaneGeometry(20000, 20000);
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.ShaderMaterial({
      vertexShader:   GRID_VERTEX,
      fragmentShader: GRID_FRAGMENT,
      transparent:    true,
      depthWrite:     false,
      side:           THREE.DoubleSide,
      uniforms: { uGridScale: { value: 1.0 } },
    });

    this.gridMesh = new THREE.Mesh(geometry, material);
    this.gridMesh.position.y = -0.001; // fractionally below Y=0 to prevent z-fighting
    this.scene.add(this.gridMesh);
  }

  private setupOrbitControls(): void {
    this.orbitControls = new OrbitControls(this.camera, this.threeRenderer.domElement);
    this.orbitControls.enableDamping      = true;
    this.orbitControls.dampingFactor      = 0.08;
    this.orbitControls.screenSpacePanning = true;
    this.orbitControls.minDistance        = 0.1;
    this.orbitControls.maxDistance        = 5000;
    this.orbitControls.update();
  }

  private setupTransformControls(): void {
    this.tfControls = new TransformControls(this.camera, this.threeRenderer.domElement);
    this.tfControls.setSize(0.8);

    // Disable orbit while the user is dragging a transform handle
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.tfControls.addEventListener('dragging-changed', (event: any) => {
      this.orbitControls.enabled = !event.value;
    });

    // Emit the mesh's new transform (in OpenSCAD units) when the drag ends.
    // Must re-enter Angular's zone because the Three.js event loop runs outside it.
    this.tfControls.addEventListener('mouseUp', () => {
      if (!this.currentMesh) return;

      const m             = this.currentMesh;
      const DISPLAY_SCALE = 0.1; // 1 OpenSCAD unit = 0.1 Three.js units
      const RAD_TO_DEG    = 180 / Math.PI;

      const transform: MeshTransform = {
        translate: [
          m.position.x / DISPLAY_SCALE,
          m.position.y / DISPLAY_SCALE,
          m.position.z / DISPLAY_SCALE,
        ],
        rotate: [
          m.rotation.x * RAD_TO_DEG,
          m.rotation.y * RAD_TO_DEG,
          m.rotation.z * RAD_TO_DEG,
        ],
        scale: [
          m.scale.x / DISPLAY_SCALE,
          m.scale.y / DISPLAY_SCALE,
          m.scale.z / DISPLAY_SCALE,
        ],
      };

      this.ngZone.run(() => this.transformApplied.emit(transform));
    });

    this.scene.add(this.tfControls.getHelper());
  }

  private setupAxisGizmo(): void {
    const canvas = this.gizmoCanvas.nativeElement;

    this.gizmoRenderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.gizmoRenderer.setPixelRatio(window.devicePixelRatio);
    this.gizmoRenderer.setSize(80, 80);

    this.gizmoScene  = new THREE.Scene();
    this.gizmoCamera = new THREE.PerspectiveCamera(50, 1, 0.01, 10);

    const arrow = (dir: THREE.Vector3, color: number) =>
      new THREE.ArrowHelper(dir.normalize(), new THREE.Vector3(), 0.75, color, 0.22, 0.09);

    this.gizmoScene.add(
      arrow(new THREE.Vector3(1, 0, 0),  0xe74c3c), // X — red
      arrow(new THREE.Vector3(0, 1, 0),  0x27ae60), // Y — green
      arrow(new THREE.Vector3(0, 0, 1),  0x3498db), // Z — blue
      new THREE.AmbientLight(0xffffff, 1),
    );
  }

  // ── Animation loop ────────────────────────────────────────────────────────

  private animate(): void {
    this.orbitControls.update();

    // Adaptive grid: cell size tracks camera distance logarithmically
    const dist     = this.camera.position.distanceTo(this.orbitControls.target);
    const exp      = Math.floor(Math.log10(Math.max(dist * 0.5, 0.0001)));
    const scale    = Math.pow(10, exp - 1);
    (this.gridMesh.material as THREE.ShaderMaterial).uniforms['uGridScale'].value = scale;

    this.threeRenderer.render(this.scene, this.camera);

    // Axis gizmo: mirror main camera rotation
    this.gizmoCamera.quaternion.copy(this.camera.quaternion);
    this.gizmoRenderer.render(this.gizmoScene, this.gizmoCamera);
  }

  // ── Tool API (called by template) ─────────────────────────────────────────

  setActiveTool(tool: ActiveTool): void {
    this.activeTool.set(tool);

    if (tool === 'none') {
      this.tfControls.detach();
    } else if (this.currentMesh) {
      this.tfControls.attach(this.currentMesh);
      this.tfControls.setMode(tool);
    }
  }

  frameObject(): void {
    if (!this.currentMesh) {
      // No mesh loaded — reset to default view
      this.orbitControls.target.set(0, 0, 0);
      this.camera.position.set(4, 3, 6);
      this.orbitControls.update();
      return;
    }

    const box    = new THREE.Box3().setFromObject(this.currentMesh);
    const center = new THREE.Vector3();
    const size   = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);

    const maxDim  = Math.max(size.x, size.y, size.z, 0.001);
    const fov     = this.camera.fov * (Math.PI / 180);
    const dist    = (maxDim / (2 * Math.tan(fov / 2))) * 1.8;

    this.orbitControls.target.copy(center);

    // Preserve current orbital angle, just update the radius
    const dir = this.camera.position.clone()
      .sub(this.orbitControls.target)
      .normalize()
      .multiplyScalar(dist);
    this.camera.position.copy(center).add(dir);
    this.orbitControls.update();
  }

  setView(preset: ViewPresetId): void {
    this.activeView.set(preset);

    const target = this.orbitControls.target.clone();
    const dist   = this.camera.position.distanceTo(target);

    switch (preset) {
      case 'perspective':
        this.camera.position.set(
          target.x + dist * 0.45,
          target.y + dist * 0.4,
          target.z + dist * 0.8,
        );
        break;
      case 'front':
        this.camera.position.set(target.x, target.y, target.z + dist);
        break;
      case 'right':
        this.camera.position.set(target.x + dist, target.y, target.z);
        break;
      case 'top':
        // Tiny Z offset prevents exact gimbal lock when camera.up = (0,1,0)
        this.camera.position.set(target.x, target.y + dist, target.z + 0.0001);
        break;
    }

    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(target);
    this.orbitControls.update();
  }

  // ── Hover tracking ────────────────────────────────────────────────────────

  @HostListener('mouseenter')
  onMouseEnter(): void { this.viewportHovered = true; }

  @HostListener('mouseleave')
  onMouseLeave(): void { this.viewportHovered = false; }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  // Only active when the mouse cursor is over the 3D viewport.
  // This prevents intercepting keystrokes in the Monaco editor or chat input.

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.viewportHovered) return;

    switch (event.code) {
      case 'KeyG':    this.setActiveTool('translate'); break;
      case 'KeyR':    this.setActiveTool('rotate');    break;
      case 'KeyS':    this.setActiveTool('scale');     break;
      case 'Escape':  this.setActiveTool('none');      break;
      case 'KeyF':    this.frameObject();               break;
      case 'Numpad1': this.setView('front');            break;
      case 'Numpad3': this.setView('right');            break;
      case 'Numpad7': this.setView('top');              break;
      case 'Numpad5': this.setView('perspective');      break;
    }
  }

  // ── Resize ────────────────────────────────────────────────────────────────

  @HostListener('window:resize')
  onResize(): void {
    const el = this.canvasContainer.nativeElement;
    const w  = el.clientWidth;
    const h  = el.clientHeight;

    this.threeRenderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.orbitControls.update();
  }
}
