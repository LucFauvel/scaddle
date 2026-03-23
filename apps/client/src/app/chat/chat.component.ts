import { Component, ElementRef, EventEmitter, Input, Output, ViewChild, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TrpcService } from '../services/trpc.service';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [FormsModule],
  providers: [TrpcService],
  templateUrl: './chat.component.html',
})
export class ChatComponent {
  @ViewChild('output') output!: ElementRef;
  @Input() currentCode = '';
  @Output() codeReceived = new EventEmitter<string | undefined>();
  @Output() generating   = new EventEmitter<boolean>();

  inputText = '';
  isGenerating = signal(false);

  constructor(private trpc: TrpcService) {}

  sendMessage(message: Event): void {
    message.preventDefault();
    if (!this.inputText.trim() || this.isGenerating()) return;

    const textToSend = this.inputText.trim();
    this.inputText = '';
    this.isGenerating.set(true);
    this.generating.emit(true);
    this.output.nativeElement.innerHTML = 'Generating code…';

    this.trpc.ask(textToSend, this.currentCode)
      .then((response) => {
        this.output.nativeElement.innerHTML = 'Code generated.';
        this.codeReceived.emit(response);
      })
      .catch((error) => {
        this.output.nativeElement.innerHTML = `Error: ${error.message}`;
        console.error('Error:', error);
      })
      .finally(() => {
        this.isGenerating.set(false);
        this.generating.emit(false);
      });
  }
}
