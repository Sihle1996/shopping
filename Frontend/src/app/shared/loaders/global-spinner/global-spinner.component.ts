import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { LoaderService } from '../loader.service';

@Component({
  selector: 'app-global-spinner',
  templateUrl: './global-spinner.component.html',
  styleUrls: ['./global-spinner.component.scss']
})
export class GlobalSpinnerComponent implements OnInit, OnDestroy {
  visible = false;
  leaving = false;
  private sub?: Subscription;
  private hideTimer?: any;

  constructor(private loaderService: LoaderService) {}

  ngOnInit(): void {
    this.sub = this.loaderService.loading$.subscribe(loading => {
      if (loading) {
        clearTimeout(this.hideTimer);
        this.leaving = false;
        this.visible = true;
      } else if (this.visible) {
        // keep it mounted briefly so the frosted overlay can fade out instead of snapping away
        this.leaving = true;
        this.hideTimer = setTimeout(() => { this.visible = false; this.leaving = false; }, 280);
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    clearTimeout(this.hideTimer);
  }
}
