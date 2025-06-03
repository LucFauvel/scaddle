import { Component, ElementRef, model, OnInit } from '@angular/core';
import * as THREE from 'three';

@Component({
  selector: 'app-renderer',
  imports: [],
  templateUrl: './renderer.component.html',
})
export class RendererComponent implements OnInit {
  scadCode = model('');
  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;
  renderer!: THREE.WebGLRenderer;

  constructor(private elementRef: ElementRef) {}

  ngOnInit() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, this.elementRef.nativeElement.innerWidth / this.elementRef.nativeElement.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer();
    this.elementRef.nativeElement.appendChild(this.renderer.domElement);
  }
}
