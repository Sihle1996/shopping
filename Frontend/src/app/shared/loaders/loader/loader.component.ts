import {
  Component, Input, Output, EventEmitter, ElementRef,
  AfterViewInit, OnChanges, OnDestroy, SimpleChanges
} from '@angular/core';
import { gsap } from 'gsap';

/**
 * Brand loader — the crave-it wordmark stays whole while a warm orange "signal" travels through it,
 * anchored to a progress streak (the hero motion). Premium SaaS feel (Stripe/Linear/Arc/Framer), never a
 * spinner. The wordmark never wipes or disappears: only light moves through "-it".
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
  private loadTl?: gsap.core.Timeline;
  private reduce = false;

  constructor(private host: ElementRef) {}

  ngAfterViewInit(): void {
    this.reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    this.startMessages();
    if (this.reduce) return;   // "-it" breathes via CSS (it-amb); nothing else moves
    this.playEntrance();
  }

  ngOnChanges(ch: SimpleChanges): void {
    if (ch['state'] && !ch['state'].firstChange) this.applyState();
    if ((ch['messages'] || ch['messagesMode']) && !ch['messages']?.firstChange) this.startMessages();
  }

  ngOnDestroy(): void {
    this.loadTl?.kill();
    if (this.msgTimer) clearInterval(this.msgTimer);
  }

  private q(sel: string): HTMLElement | null { return this.host.nativeElement.querySelector(sel); }

  /** Staggered entrance: wordmark → track → signal starts. */
  private playEntrance(): void {
    const wm = this.q('.ldr-logo'); const track = this.q('.ldr-track');
    gsap.set([wm, track], { opacity: 0 });
    gsap.timeline()
      .to(wm, { opacity: 1, duration: 0.4, ease: 'power1.out' }, 0.08)
      .to(track, { opacity: 1, duration: 0.4, ease: 'power1.out' }, 0.15)
      .add(() => { if (this.state === 'loading') this.startLoading(); }, 0.25);
  }

  /** One synced sweep drives the streak, the "-it" highlight, and the glow from a single progress value. */
  private startLoading(): void {
    this.loadTl?.kill();
    const streak = this.q('.ldr-streak'); const shine = this.q('.ldr-shine');
    const o = { p: 0 };
    this.loadTl = gsap.timeline({ repeat: -1, repeatDelay: 0.6 });
    this.loadTl.fromTo(o, { p: 0 }, {
      p: 1, duration: 1.0, ease: 'power1.inOut',
      onUpdate: () => {
        const p = o.p;
        if (streak) gsap.set(streak, { left: (-30 + p * 160) + '%' });          // off-left → off-right
        if (shine) gsap.set(shine, { backgroundPositionX: (120 - p * 200) + '%' }); // light sweeps the "-it"
      },
    });
  }

  private applyState(): void {
    if (this.state === 'success') this.applySuccess();
    else if (this.state === 'error') this.loadTl?.pause();
    else if (this.state === 'loading' && !this.reduce) this.startLoading();
  }

  private applySuccess(): void {
    this.loadTl?.kill();
    const root = this.q('.ldr-inner'); const logo = this.q('.ldr-img'); const fill = this.q('.ldr-fill');
    if (this.successMode === 'minimal' || this.reduce) {
      gsap.to(root, { opacity: 0, duration: 0.35, onComplete: () => this.finished.emit() });
      return;
    }
    // celebrate: complete the pass → fill the line → logo glows once → emit
    const streak = this.q('.ldr-streak');
    gsap.timeline({ onComplete: () => this.finished.emit() })
      .to(streak, { left: '100%', duration: 0.45, ease: 'power2.out' })
      .fromTo(fill, { scaleX: 0 }, { scaleX: 1, duration: 0.45, ease: 'power2.out' }, '<')
      .to(logo, { filter: 'drop-shadow(0 0 14px rgba(231,111,81,.5))', duration: 0.35 }, '-=0.2')
      .to(logo, { filter: 'drop-shadow(0 0 0 rgba(231,111,81,0))', duration: 0.6 })
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
