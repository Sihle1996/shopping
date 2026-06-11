import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * THROWAWAY visual-exploration lab for the "Vision eyes" mythology. Renders the comparison matrix
 * (geometry × shape, bite-as-source, colour, states, size cutoff, timing, discovery) so we can pick a
 * direction BEFORE wiring eyes into production brand-mark. No production code is touched by this file.
 */
@Component({
  selector: 'app-vision-exploration',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './vision-exploration.component.html',
  styleUrls: ['./vision-exploration.component.scss'],
})
export class VisionExplorationComponent {
  positions = ['inside', 'below', 'centered'] as const;
  shapes = ['slit', 'sharp', 'oval'] as const;
  states = ['dormant', 'awakening', 'seeing', 'insight'] as const;
  sizes = [16, 20, 24, 26, 32, 40, 64];
  preds = [
    { label: 'Round', shape: 'pred-round' },
    { label: 'Cat-eye', shape: 'pred-cat' },
    { label: 'Slit', shape: 'pred-slit' },
    { label: 'Pinpoint', shape: 'pred-pin' },
    { label: 'Hot core', shape: 'pred-hot' },
    { label: 'Deep ember', shape: 'pred-deep' },
  ];
}
