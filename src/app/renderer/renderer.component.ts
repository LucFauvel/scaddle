import { AfterViewInit, Component, effect, ElementRef, HostListener, input } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

@Component({
  selector: 'app-renderer',
  imports: [],
  template: '',
})
export class RendererComponent implements AfterViewInit {
  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;
  renderer!: THREE.WebGLRenderer;
  controls!: OrbitControls;
  stlBytes = input<Uint8Array | null>();

  constructor(private elementRef: ElementRef) {
    effect(() => {
      const stlBytes = this.stlBytes();
      console.log('STL Bytes:', stlBytes);
      if (stlBytes) {
        const blob = new Blob([stlBytes], { type: 'application/sla' });
        const url = URL.createObjectURL(blob);
        const loader = new STLLoader();
        loader.load(url, (geometry) => {
          const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
          const mesh = new THREE.Mesh(geometry, material);
          this.scene.add(mesh);
          this.controls.update();
          URL.revokeObjectURL(url); // Clean up the URL after loading
        });
      }
    });
  }

  ngAfterViewInit(): void {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, this.elementRef.nativeElement.clientWidth / this.elementRef.nativeElement.clientHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer();
    this.elementRef.nativeElement.appendChild(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    const size = 10;
    const divisions = 10;

    const gridHelper = new THREE.GridHelper(size, divisions);
    this.scene.add(gridHelper);

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
