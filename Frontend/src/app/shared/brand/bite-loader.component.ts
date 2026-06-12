import { Component, Input, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { gsap } from 'gsap';

/**
 * Loader: animate the BITE, not the logo. The real bitten-V stays perfectly still; a surface-coloured
 * "bite" cutout travels along the V's inner edges (right arm → vertex → left arm) and back, turning the
 * production mark into a mirrored bitten-V and home again. A soft orange glow trails the bite. The original
 * notch is filled so the only moving thing is the bite. No spin/scale/morph. ~2s, power2.inOut.
 */
@Component({
  selector: 'app-bite-loader',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bl" [style.--bg]="bg">
      <div class="bl-stage">
        <img class="bl-v" src="assets/craveit-v-complete.png" [style.height.px]="size" alt="" aria-hidden="true" />
        <span class="bl-glow"></span>
        <span class="bl-bite"></span>
      </div>
    </div>
  `,
  styleUrls: ['./bite-loader.component.scss'],
})
export class BiteLoaderComponent implements AfterViewInit, OnDestroy {
  @Input() size = 110;
  @Input() bg = '#ffffff';          // surface colour the cutout is painted in
  private tl?: gsap.core.Timeline;

  constructor(private host: ElementRef) {}

  ngAfterViewInit(): void {
    const q = (s: string) => this.host.nativeElement.querySelector(s) as HTMLElement;
    const bite = q('.bl-bite'), glow = q('.bl-glow');
    // bite path along the V's inner edges: right-arm bite → bottom vertex → left-arm bite
    const RIGHT = { left: '62%', top: '43%' }, VERTEX = { left: '48%', top: '80%' }, LEFT = { left: '36%', top: '43%' };
    gsap.set([bite, glow], RIGHT);

    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; // stays = production logo

    gsap.set(glow, { opacity: 0.5 });   // a soft orange halo that simply follows the bite
    this.tl = gsap.timeline({ repeat: -1, yoyo: true, repeatDelay: 0.35 });
    this.tl
      .to([bite, glow], { ...VERTEX, duration: 0.6, ease: 'power2.inOut' })   // right arm → vertex
      .to([bite, glow], { ...LEFT,   duration: 0.6, ease: 'power2.inOut' })   // vertex → left arm
      .to({}, { duration: 0.4 });                                            // brief hold (mirrored bitten-V)
  }

  ngOnDestroy(): void { this.tl?.kill(); }
}
