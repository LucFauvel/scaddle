import { Component } from '@angular/core';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [],
  templateUrl: './chat.component.html',
})
export class ChatComponent {

  sendMessage(message: Event): void {
  }
}
