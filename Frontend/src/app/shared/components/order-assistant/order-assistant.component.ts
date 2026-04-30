import { Component } from '@angular/core';
import { OrderAssistantService, AssistantResponse } from 'src/app/services/order-assistant.service';
import { CartService } from 'src/app/services/cart.service';
import { AuthService } from 'src/app/services/auth.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-order-assistant',
  templateUrl: './order-assistant.component.html',
  styleUrls: ['./order-assistant.component.scss']
})
export class OrderAssistantComponent {
  isOpen = false;
  prompt = '';
  loading = false;
  confirming = false;
  response: AssistantResponse | null = null;

  readonly quickChips = [
    { label: '🍔 Something filling', prompt: 'something filling and satisfying' },
    { label: '💸 Keep it cheap',     prompt: 'cheap and budget-friendly' },
    { label: '🥗 Eating healthy',    prompt: 'healthy and light' },
    { label: '🎉 Treat myself',      prompt: 'something premium and indulgent to treat myself' },
  ];

  get isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  constructor(
    private assistantService: OrderAssistantService,
    private cartService: CartService,
    private authService: AuthService,
    private toastr: ToastrService
  ) {}

  open(): void {
    this.isOpen = true;
  }

  close(): void {
    this.isOpen = false;
    this.reset();
  }

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

  retry(): void {
    this.response = null;
    this.prompt = '';
  }

  private reset(): void {
    this.prompt = '';
    this.response = null;
    this.loading = false;
    this.confirming = false;
  }
}
