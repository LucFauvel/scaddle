import { Component } from '@angular/core';
import { TrpcService } from '../services/trpc.service';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [],
  providers: [TrpcService],
  templateUrl: './chat.component.html',
})
export class ChatComponent {
  constructor(private trpc: TrpcService) {}

  sendMessage(message: Event): void {
  }
}
