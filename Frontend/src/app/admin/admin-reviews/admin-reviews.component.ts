import { Component, OnInit } from '@angular/core';
import { ReviewService, ReviewDTO } from 'src/app/services/review.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-admin-reviews',
  templateUrl: './admin-reviews.component.html'
})
export class AdminReviewsComponent implements OnInit {
  reviews: ReviewDTO[] = [];
  loading = true;
  deletingId: string | null = null;

  constructor(private reviewService: ReviewService, private toastr: ToastrService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.reviewService.adminGetReviews().subscribe({
      next: (data) => { this.reviews = data; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  deleteReview(id: string): void {
    this.deletingId = id;
    this.reviewService.adminDeleteReview(id).subscribe({
      next: () => {
        this.reviews = this.reviews.filter(r => r.id !== id);
        this.deletingId = null;
        this.toastr.success('Review deleted');
      },
      error: () => {
        this.deletingId = null;
        this.toastr.error('Could not delete review');
      }
    });
  }

  stars(rating: number): number[] {
    return Array.from({ length: 5 }, (_, i) => i + 1);
  }
}
