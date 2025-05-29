import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import * as monaco from 'monaco-editor';

@Component({
  selector: 'app-editor',
  imports: [],
  templateUrl: './editor.component.html',
})
export class EditorComponent implements OnInit {
  editor!: monaco.editor.IStandaloneCodeEditor;
  @ViewChild('editorContainer', { static: true }) _editorContainer!: ElementRef;

  ngOnInit() {
    this.editor = monaco.editor.create(this._editorContainer.nativeElement, {
      value: '// Type your code here',
      automaticLayout: true,
    });
  }
}
