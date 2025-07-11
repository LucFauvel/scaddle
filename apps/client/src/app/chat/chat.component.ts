import { Component, ElementRef, EventEmitter, Output, ViewChild } from '@angular/core';
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
  @Output() codeReceived: EventEmitter<string | undefined> = new EventEmitter<string | undefined>();
  inputText: string = '';

  constructor(private trpc: TrpcService) {}

  sendMessage(message: Event): void {
    message.preventDefault();
    if (!this.inputText.trim()) {
      return;
    }

    const textToSend = this.inputText.trim();
    this.inputText = '';
    const outputElement = this.output.nativeElement;
    outputElement.innerHTML = 'Generating code...';

    this.trpc.ask(textToSend).then((response) => {
      const outputElement = this.output.nativeElement;
      outputElement.innerHTML = 'Code generated';
      this.inputText = '';
      outputElement.scrollTop = outputElement.scrollHeight; // Scroll to the bottom
      this.codeReceived.emit(response);
    }).catch((error) => {
      const outputElement = this.output.nativeElement;
      outputElement.innerHTML = `Error generating code: ${error.message}`;
      console.error('Error:', error);
    });
  }
}
