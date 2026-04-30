import { Component } from '@angular/core';
import { OrderAssistantService, AssistantResponse } from 'src/app/services/order-assistant.service';
import { CartService } from 'src/app/services/cart.service';
import { AuthService } from 'src/app/services/auth.service';
import { ToastrService } from 'ngx-toastr';

export interface ChatMessage { role: 'user' | 'ai'; text: string; }

@Component({
  selector: 'app-order-assistant',
  templateUrl: './order-assistant.component.html',
  styleUrls: ['./order-assistant.component.scss']
})
export class OrderAssistantComponent {
  isOpen = false;
  mode: 'order' | 'chat' = 'order';

  // Order-for-me state
  prompt = '';
  loading = false;
  confirming = false;
  response: AssistantResponse | null = null;

  // Menu chat state
  chatInput = '';
  chatLoading = false;
  chatMessages: ChatMessage[] = [];

  readonly quickChips = [
    { label: '🍔 Something filling', prompt: 'something filling and satisfying' },
    { label: '💸 Keep it cheap',     prompt: 'cheap and budget-friendly' },
    { label: '🥗 Eating healthy',    prompt: 'healthy and light' },
    { label: '🎉 Treat myself',      prompt: 'something premium and indulgent to treat myself' },
  ];

  readonly chatSuggestions = [
    'Do you have anything vegan?',
    'What\'s the cheapest option?',
    'What\'s good for sharing?',
    'Do you have spicy food?',
  ];

  get isLoggedIn(): boolean { return this.authService.isLoggedIn(); }

  constructor(
    private assistantService: OrderAssistantService,
    private cartService: CartService,
    private authService: AuthService,
    private toastr: ToastrService
  ) {}

  open(): void { this.isOpen = true; }

  close(): void {
    this.isOpen = false;
    this.reset();
  }

  switchMode(m: 'order' | 'chat'): void { this.mode = m; }

  // ── Order for me ──────────────────────────────────────────────────────────

  useChip(p: string): void {
    this.prompt = p;
    this.submit();
  }

  submit(): void {
    if (!this.prompt.trim() || this.loading) return;
    this.loading = true;
    this.response = null;
    this.assistantService.interpret(this.prompt.trim()).subscribe({
      next: res => { this.response = res; this.loading = false; },
      error: () => { this.toastr.error('Could not process your request'); this.loading = false; }
    });
  }

  confirm(): void {
    if (!this.response?.suggestionToken || this.confirming) return;
    this.confirming = true;
    this.assistantService.confirm(this.response.suggestionToken).subscribe({
      next: () => {
        this.cartService.getCartItems().subscribe();
        this.toastr.success('Added to your cart!');
        this.close();
      },
      error: () => { this.toastr.error('Could not add to cart'); this.confirming = false; }
    });
  }

  retry(): void { this.response = null; this.prompt = ''; }

  // ── Menu chat ─────────────────────────────────────────────────────────────

  useChatSuggestion(q: string): void {
    this.chatInput = q;
    this.sendChat();
  }

  sendChat(): void {
    const q = this.chatInput.trim();
    if (!q || this.chatLoading) return;
    this.chatMessages.push({ role: 'user', text: q });
    this.chatInput = '';
    this.chatLoading = true;
    this.assistantService.menuChat(q).subscribe({
      next: res => {
        this.chatMessages.push({ role: 'ai', text: res.answer });
        this.chatLoading = false;
      },
      error: () => {
        this.chatMessages.push({ role: 'ai', text: 'Sorry, I couldn\'t answer that right now. Try browsing the menu!' });
        this.chatLoading = false;
      }
    });
  }

  onChatKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); this.sendChat(); }
  }

  private reset(): void {
    this.prompt = '';
    this.response = null;
    this.loading = false;
    this.confirming = false;
    this.chatInput = '';
    this.chatMessages = [];
    this.chatLoading = false;
    this.mode = 'order';
  }
}
