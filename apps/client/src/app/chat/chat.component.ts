import { Component, ElementRef, EventEmitter, Input, Output, ViewChild, inject, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TrpcService } from '../services/trpc.service';
import { ProjectService } from '../services/project.service';
import { ChatStoreService, ChatMessage } from '../services/chat-store.service';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [FormsModule],
  providers: [TrpcService],
  templateUrl: './chat.component.html',
})
export class ChatComponent {
  @ViewChild('messagesEnd') private messagesEnd!: ElementRef;
  @Input() currentCode = '';
  @Output() codeReceived = new EventEmitter<string | undefined>();
  @Output() generating   = new EventEmitter<boolean>();

  private trpc       = inject(TrpcService);
  private projectSvc = inject(ProjectService);
  private chatStore  = inject(ChatStoreService);

  inputText    = '';
  isGenerating = signal(false);
  messages     = signal<ChatMessage[]>([]);

  constructor() {
    // Reload chat whenever the active project changes (or clears)
    effect(() => {
      const project = this.projectSvc.currentProject();
      if (project) {
        const msgs = this.parseChat(project.chat);
        this.messages.set(msgs);
        this.scrollToBottom();
      } else {
        this.chatStore.loadMessages().then(msgs => {
          this.messages.set(msgs);
          this.scrollToBottom();
        });
      }
    });
  }

  sendMessage(event: Event): void {
    event.preventDefault();
    if (!this.inputText.trim() || this.isGenerating()) return;

    const text = this.inputText.trim();
    this.inputText = '';
    this.isGenerating.set(true);
    this.generating.emit(true);

    const userMsg: ChatMessage = { role: 'user', text, timestamp: Date.now() };
    const pending: ChatMessage = { role: 'assistant', text: '', timestamp: Date.now(), isPending: true };
    this.messages.update(m => [...m, userMsg, pending]);
    this.scrollToBottom();

    this.trpc.ask(text, this.currentCode)
      .then(response => {
        const reply: ChatMessage = { role: 'assistant', text: response ?? '', timestamp: Date.now() };
        this.messages.update(m => [...m.slice(0, -1), reply]);
        this.codeReceived.emit(response);
        this.persist();
        this.scrollToBottom();
      })
      .catch((err: { message?: string }) => {
        const errMsg: ChatMessage = {
          role: 'assistant',
          text: err.message ?? 'Something went wrong.',
          timestamp: Date.now(),
          isError: true,
        };
        this.messages.update(m => [...m.slice(0, -1), errMsg]);
        this.persist();
        this.scrollToBottom();
      })
      .finally(() => {
        this.isGenerating.set(false);
        this.generating.emit(false);
      });
  }

  async clearChat(): Promise<void> {
    this.messages.set([]);
    await this.chatStore.clear();
    const project = this.projectSvc.currentProject();
    if (project) {
      await this.projectSvc.updateProject(project.id, { chat: '[]' });
    }
  }

  formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  private parseChat(raw: string | undefined | null): ChatMessage[] {
    try { return raw ? JSON.parse(raw) : []; } catch { return []; }
  }

  private async persist(): Promise<void> {
    const msgs = this.messages().filter(m => !m.isPending);
    await this.chatStore.saveMessages(msgs);
    const project = this.projectSvc.currentProject();
    if (project) {
      await this.projectSvc.updateProject(project.id, { chat: JSON.stringify(msgs) });
    }
  }

  private scrollToBottom(): void {
    setTimeout(() => this.messagesEnd?.nativeElement?.scrollIntoView({ behavior: 'smooth' }), 0);
  }
}
