import { AfterViewInit, Component, ElementRef, HostListener, model } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

@Component({
  selector: 'app-renderer',
  imports: [],
  template: '',
})
export class RendererComponent implements AfterViewInit {
  scadCode = model('');
  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;
  renderer!: THREE.WebGLRenderer;
  controls!: OrbitControls;

  constructor(private elementRef: ElementRef) {}

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

    const geometry = new THREE.BoxGeometry( 1, 1, 1 );
    const material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
    const cube = new THREE.Mesh( geometry, material );
    this.scene.add(cube);
    this.renderer.setSize(this.elementRef.nativeElement.clientWidth, this.elementRef.nativeElement.clientHeight);
    this.camera.position.z = 5;
    this.camera.position.y = 1;
    this.controls.update();

    const animate = () => {
      cube.rotation.x += 0.01;
      cube.rotation.y += 0.01;
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };

    this.renderer.setAnimationLoop(animate);
  }

  @HostListener('window:resize', ['$event'])
  onResize(_event: Event) {
    this.renderer.setSize(this.elementRef.nativeElement.clientWidth, this.elementRef.nativeElement.clientHeight);
    this.camera.aspect = this.elementRef.nativeElement.clientWidth / this.elementRef.nativeElement.clientHeight;
    this.controls.update();
  }
}
