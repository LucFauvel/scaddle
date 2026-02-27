import { AfterViewInit, Component, effect, ElementRef, HostListener, input } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

@Component({
  selector: 'app-renderer',
  imports: [],
  template: '',
  standalone: true
})
export class RendererComponent implements AfterViewInit {
  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;
  renderer!: THREE.WebGLRenderer;
  controls!: OrbitControls;
  stlBytes = input<Uint8Array | null>();
  currentMesh?: THREE.Mesh;

  constructor(private elementRef: ElementRef) {
    effect(() => {
      const stlBytes = this.stlBytes();
      console.log('STL Bytes:', stlBytes);
      if (stlBytes) {
        const blob = new Blob([stlBytes.slice().buffer], { type: 'application/sla' });
        const url = URL.createObjectURL(blob);
        const loader = new STLLoader();
        loader.load(url, (geometry) => {
          const material = new THREE.MeshStandardMaterial({ color: 0x8888aa, metalness: 0.3, roughness: 0.6 });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.scale.set(0.1, 0.1, 0.1);
          if (this.currentMesh) {
            this.scene.remove(this.currentMesh);
          }
          this.scene.add(mesh);
          this.currentMesh = mesh;
          this.controls.update();
          URL.revokeObjectURL(url); // Clean up the URL after loading
        });
      }
    });
  }

  private createLabel(text: string, position: THREE.Vector3): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Failed to get 2D context');
    }
    const fontSize = 10; // Reduced font size for better readability
    context.font = `bold ${fontSize}px Arial`;
    const textMetrics = context.measureText(text);
    canvas.width = textMetrics.width;
    canvas.height = fontSize;

    // It's important to set the font again after resizing the canvas
    context.font = `bold ${fontSize}px Arial`;
    context.fillStyle = 'rgba(255, 255, 255, 0.9)';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
    });
    const sprite = new THREE.Sprite(material);
    // Adjust the scale of the sprite
    sprite.scale.set(0.07 * fontSize, 0.035 * fontSize, 1.0);
    sprite.position.copy(position);

    return sprite;
  }


  ngAfterViewInit(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x09090b); // zinc-950
    this.camera = new THREE.PerspectiveCamera(75, this.elementRef.nativeElement.clientWidth / this.elementRef.nativeElement.clientHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.elementRef.nativeElement.appendChild(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    const size = 10;
    const divisions = 10;

    // Muted grid: center line in zinc-700, grid lines in zinc-800
    const gridHelper = new THREE.GridHelper(size, divisions, 0x3f3f46, 0x27272a);
    this.scene.add(gridHelper);

    // Add labels to the grid edges
    const halfSize = size / 2;
    const step = size / divisions;
    const labelYOffset = 0.1; // To lift labels slightly above the grid
    const labelEdgeOffset = 0.2; // To place labels just outside the grid

    // Labels for X-axis, placed along the Z = -halfSize edge
    for (let i = -halfSize; i <= halfSize; i++) {
        const pos = i * step;
        this.scene.add(this.createLabel((pos * 10).toString(), new THREE.Vector3(pos, labelYOffset, -halfSize - labelEdgeOffset)));
    }

    // Labels for Z-axis, placed along the X = -halfSize edge
    for (let i = -halfSize + 1; i <= halfSize; i++) { // Start from -halfSize + 1 to avoid duplicating the corner label
        const pos = i * step;
        this.scene.add(this.createLabel((pos * 10).toString(), new THREE.Vector3(-halfSize - labelEdgeOffset, labelYOffset, pos)));
    }

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 3);
    directionalLight1.position.set(10, 10, 10); // position the light
    this.scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 3);
    directionalLight2.position.set(-10, -10, -10); // position the light
    this.scene.add(directionalLight2);

    this.renderer.setSize(this.elementRef.nativeElement.clientWidth, this.elementRef.nativeElement.clientHeight);
    this.camera.position.z = 5;
    this.camera.position.y = 1;
    this.controls.update();

    const animate = () => {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };

    this.renderer.setAnimationLoop(animate);
  }

  @HostListener('window:resize', ['$event'])
  onResize(_event: Event) {
    this.renderer.setSize(this.elementRef.nativeElement.clientWidth, this.elementRef.nativeElement.clientHeight);
    this.camera.aspect = this.elementRef.nativeElement.clientWidth / this.elementRef.nativeElement.clientHeight;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }
}
