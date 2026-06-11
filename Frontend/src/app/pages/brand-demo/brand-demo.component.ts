import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrandMarkComponent } from '../../shared/brand/brand-mark.component';

/** Showcase of the bitten-V motif across product surfaces. Dev preview — safe to remove. */
@Component({
  selector: 'app-brand-demo',
  standalone: true,
  imports: [CommonModule, BrandMarkComponent],
  template: `
    <div class="wrap">
      <h1>The bite — one motif, many places</h1>
      <p class="sub">The bitten “v” as a standalone signal. Hover/watch each tile.</p>

      <div class="grid">
        <div class="tile">
          <span class="lbl">The mark (idle)</span>
          <app-brand-mark [size]="92" mode="idle"></app-brand-mark>
          <span class="cap">Empty bite — matches the logo</span>
        </div>

        <div class="tile">
          <span class="lbl">Hidden creature</span>
          <app-brand-mark [size]="92" mode="idle" face="hidden"></app-brand-mark>
          <span class="cap">Eyes emerge from the negative space</span>
        </div>

        <div class="tile">
          <span class="lbl">Beast mode</span>
          <app-brand-mark [size]="92" mode="idle" face="beast"></app-brand-mark>
          <span class="cap">Eyes + brow — the horns own it</span>
        </div>

        <div class="tile dark">
          <span class="lbl light">Creature on dark</span>
          <app-brand-mark [size]="92" mode="idle" face="hidden" [dark]="false"></app-brand-mark>
          <span class="cap light">Eyes invert for contrast</span>
        </div>

        <div class="tile">
          <span class="lbl">Loader</span>
          <app-brand-mark [size]="92" mode="loading"></app-brand-mark>
          <span class="cap">Bite pulses as the signal</span>
        </div>

        <div class="tile">
          <span class="lbl">AI copilot — thinking</span>
          <app-brand-mark [size]="92" mode="thinking"></app-brand-mark>
          <span class="cap">Aperture filling + glow</span>
        </div>

        <div class="tile">
          <span class="lbl">Notification badge</span>
          <div class="bell">
            <i class="bi bi-bell"></i>
            <app-brand-mark class="badge" [size]="26" mode="success"></app-brand-mark>
          </div>
          <span class="cap">Bite instead of a red dot</span>
        </div>

        <div class="tile">
          <span class="lbl">Floating assistant</span>
          <button class="fab"><app-brand-mark [size]="34" mode="thinking" [dark]="false"></app-brand-mark></button>
          <span class="cap">Idle → thinking → suggestion</span>
        </div>

        <div class="tile">
          <span class="lbl">Empty state</span>
          <app-brand-mark [size]="64" mode="idle"></app-brand-mark>
          <span class="empty">No orders yet today</span>
          <span class="cap">Branded, not a grey circle</span>
        </div>

        <div class="tile success-tile">
          <span class="lbl">Success</span>
          <app-brand-mark [size]="92" mode="success"></app-brand-mark>
          <span class="cap">Bite pops + holds</span>
        </div>

        <div class="tile dark">
          <span class="lbl light">On dark</span>
          <app-brand-mark [size]="92" mode="thinking" [dark]="false"></app-brand-mark>
          <span class="cap light">White v, orange bite</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .wrap { min-height:100vh; background:#f1f5f9; padding:48px 24px; font-family:Poppins,sans-serif; text-align:center; }
    h1 { color:#1f2937; font-weight:800; margin:0 0 6px; }
    .sub { color:#64748b; margin:0 0 32px; }
    .grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(220px,1fr)); gap:20px; max-width:1100px; margin:0 auto; }
    .tile { background:#fff; border-radius:18px; box-shadow:0 1px 3px rgba(0,0,0,.08); padding:28px 20px;
            display:flex; flex-direction:column; align-items:center; gap:14px; min-height:210px; justify-content:center; }
    .tile.dark { background:#0f172a; }
    .lbl { font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:.07em; }
    .lbl.light { color:#cbd5e1; }
    .cap { font-size:12px; color:#94a3b8; margin-top:2px; }
    .cap.light { color:#64748b; }
    .empty { color:#475569; font-weight:600; }
    /* badge */
    .bell { position:relative; font-size:46px; color:#334155; line-height:1; }
    .bell .badge { position:absolute; top:-6px; right:-10px; }
    /* fab */
    .fab { width:60px; height:60px; border-radius:50%; border:none; cursor:pointer;
           background:#E76F51; box-shadow:0 8px 20px rgba(231,111,81,.4);
           display:flex; align-items:center; justify-content:center; }
  `],
})
export class BrandDemoComponent {}
