import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoadersModule } from '../../shared/loaders/loaders.module';
import { BiteLoaderComponent } from '../../shared/brand/bite-loader.component';

/** Dev preview so the brand loader can be seen steadily (it normally only flashes during API calls). */
@Component({
  selector: 'app-loader-demo',
  standalone: true,
  imports: [CommonModule, LoadersModule, BiteLoaderComponent],
  template: `
    <div class="demo">
      <h2>crave-it loader — only the “-it” animates</h2>

      <div class="card">
        <span class="lbl">Bite travels through the V</span>
        <app-bite-loader [size]="120"></app-bite-loader>
      </div>

      <div class="card">
        <span class="lbl">Loading (default)</span>
        <app-loader size="lg"></app-loader>
      </div>

      <div class="card">
        <span class="lbl">With rotating messages</span>
        <app-loader size="md" messagesMode="rotate" [messages]="msgs"></app-loader>
      </div>

      <div class="card on-dark">
        <span class="lbl light">On a dark surface</span>
        <app-loader size="lg"></app-loader>
      </div>

      <p class="hint">The orange “-it” carries a glow + a travelling light sweep. “crave” never moves.</p>
    </div>
  `,
  styles: [`
    .demo { min-height:100vh; background:#f1f5f9; display:flex; flex-direction:column; align-items:center;
            gap:26px; padding:48px 16px; font-family:Poppins, sans-serif; }
    h2 { color:#334155; font-weight:700; margin:0 0 6px; }
    .card { background:#fff; border-radius:16px; box-shadow:0 1px 3px rgba(0,0,0,.08);
            padding:40px 64px; display:flex; flex-direction:column; align-items:center; gap:16px; min-width:340px; }
    .card.on-dark { background:#0f172a; }
    .lbl { font-size:11px; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:.07em; }
    .lbl.light { color:#cbd5e1; }
    .hint { color:#64748b; font-size:13px; margin-top:4px; }
  `],
})
export class LoaderDemoComponent {
  msgs = ['Checking today\'s orders', 'Preparing menu data', 'Calculating store insights', 'Loading the AI copilot'];
}
