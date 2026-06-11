import {
  Component, Input, Output, EventEmitter, ElementRef,
  AfterViewInit, OnChanges, OnDestroy, SimpleChanges
} from '@angular/core';
import { gsap } from 'gsap';

/**
 * Brand loader — the crave-it logo with ONLY the orange "-it" animating: it slides back and forth while
 * "crave" stays perfectly static. Premium, restrained, never a spinner. The "-it" motion is pure CSS;
 * GSAP only handles the entrance fade, the optional message cross-fade, and the success beat.
 */
@Component({
  selector: 'app-loader',
  templateUrl: './loader.component.html',
  styleUrls: ['./loader.component.scss'],
})
export class LoaderComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() overlay = false;
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() label?: string;
  @Input() state: 'loading' | 'success' | 'error' = 'loading';
  @Input() messagesMode: 'none' | 'rotate' = 'none';
  @Input() messages?: string[];
  @Input() successMode: 'minimal' | 'celebrate' = 'minimal';
  @Output() finished = new EventEmitter<void>();

  currentMessage = '';
  private msgIndex = 0;
  private msgTimer?: any;
  private reduce = false;

  constructor(private host: ElementRef) {}

  ngAfterViewInit(): void {
    this.reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    this.startMessages();
    if (!this.reduce) {
      gsap.from(this.q('.ldr-logo'), { opacity: 0, duration: 0.4, ease: 'power1.out', delay: 0.08 });
    }
  }

  ngOnChanges(ch: SimpleChanges): void {
    if (ch['state'] && !ch['state'].firstChange && this.state === 'success') this.applySuccess();
    if ((ch['messages'] || ch['messagesMode']) && !ch['messages']?.firstChange) this.startMessages();
  }

  ngOnDestroy(): void {
    if (this.msgTimer) clearInterval(this.msgTimer);
  }

  private q(sel: string): HTMLElement | null { return this.host.nativeElement.querySelector(sel); }

  /** Completion: minimal = quick fade; celebrate = glow the "-it" once, then fade. */
  private applySuccess(): void {
    const root = this.q('.ldr-inner'); const it = this.q('.ldr-it');
    if (this.successMode === 'minimal' || this.reduce) {
      gsap.to(root, { opacity: 0, duration: 0.35, onComplete: () => this.finished.emit() });
      return;
    }
    gsap.timeline({ onComplete: () => this.finished.emit() })
      .to(it, { filter: 'drop-shadow(0 0 14px rgba(231,111,81,.5))', duration: 0.35 })
      .to(it, { filter: 'drop-shadow(0 0 0 rgba(231,111,81,0))', duration: 0.6 })
      .to(root, { opacity: 0, duration: 0.4 }, '-=0.1');
  }

  private startMessages(): void {
    if (this.msgTimer) clearInterval(this.msgTimer);
    if (this.messagesMode !== 'rotate' || !this.messages?.length) { this.currentMessage = this.label ?? ''; return; }
    this.msgIndex = 0; this.currentMessage = this.messages[0];
    this.msgTimer = setInterval(() => {
      this.msgIndex = (this.msgIndex + 1) % this.messages!.length;
      this.currentMessage = this.messages![this.msgIndex];
      const el = this.q('.ldr-msg');
      if (el && !this.reduce) gsap.fromTo(el, { opacity: 0, y: 3 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power1.out' });
    }, 2200);
  }
}
