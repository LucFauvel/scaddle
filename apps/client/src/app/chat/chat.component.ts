import { Component, ElementRef, ViewChild } from '@angular/core';
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
  inputText: string = '';

  constructor(private trpc: TrpcService) {}

  sendMessage(message: Event): void {
    message.preventDefault();
    if (!this.inputText.trim()) {
      return;
    }

    this.inputText = '';

    this.trpc.ask(this.inputText).then((response) => {
      const outputElement = this.output.nativeElement;
      outputElement.innerHTML += `<p><strong>You:</strong> ${this.inputText}</p>`;
      outputElement.innerHTML += `<p><strong>Bot:</strong> ${response}</p>`;
      this.inputText = '';
      outputElement.scrollTop = outputElement.scrollHeight; // Scroll to the bottom
    }).catch((error) => {
      console.error('Error:', error);
    });
  }
}
