import { Injectable } from '@angular/core';

declare var OpenScad: any; // Assuming OpenScad is globally available

@Injectable({
  providedIn: 'root'
})
export class OpenscadService {

  constructor() { }

  async generateStlFromScad(scadCode: string): Promise<string> {
    const instance = await OpenScad({ noInitialRun: true });
    return "";
  }
}
