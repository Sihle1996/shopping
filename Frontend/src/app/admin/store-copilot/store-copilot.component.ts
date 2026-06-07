import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { AdminAiService, AiProposedAction } from 'src/app/services/admin-ai.service';
import { CopilotService } from 'src/app/services/copilot.service';
import { ToastrService } from 'ngx-toastr';

type ChatMessage = { role: 'user' | 'ai'; text: string; actions?: AiProposedAction[] };

@Component({
  selector: 'app-store-copilot',
  templateUrl: './store-copilot.component.html'
})
export class StoreCopilotComponent implements OnInit, OnDestroy {
  open = false;
  input = '';
  messages: ChatMessage[] = [];
  loading = false;
  applyingAction: AiProposedAction | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private adminAiService: AdminAiService,
    private copilotService: CopilotService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    // A page asked the copilot something in-context — open and run it.
    this.copilotService.asks$.pipe(takeUntil(this.destroy$)).subscribe(q => {
      this.open = true;
      this.input = q;
      this.send();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggle(): void { this.open = !this.open; }

  send(): void {
    const q = this.input.trim();
    if (!q || this.loading) return;
    this.messages.push({ role: 'user', text: q });
    this.input = '';
    this.loading = true;
    this.adminAiService.query(q).subscribe({
      next: (res) => {
        this.loading = false;
        this.messages.push({ role: 'ai', text: res.answer, actions: res.proposedActions || [] });
      },
      error: () => {
        this.loading = false;
        this.messages.push({ role: 'ai', text: 'Sorry, I could not process that. Please try again.' });
      }
    });
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  applyAction(msg: ChatMessage, action: AiProposedAction): void {
    if (this.applyingAction) return;
    this.applyingAction = action;
    this.adminAiService.act(action.action, action.params).subscribe({
      next: (res) => {
        this.applyingAction = null;
        if (msg.actions) msg.actions = msg.actions.filter(a => a !== action);
        this.messages.push({ role: 'ai', text: res.ok ? '✓ ' + res.message : '⚠️ ' + res.message });
        if (res.ok) this.toastr.success(res.message, 'Copilot');
      },
      error: () => {
        this.applyingAction = null;
        this.messages.push({ role: 'ai', text: '⚠️ Could not apply that action.' });
      }
    });
  }

  dismissAction(msg: ChatMessage, action: AiProposedAction): void {
    if (msg.actions) msg.actions = msg.actions.filter(a => a !== action);
  }
}
