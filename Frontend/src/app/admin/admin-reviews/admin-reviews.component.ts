import { Component, OnInit } from '@angular/core';
import { ReviewService, ReviewDTO } from 'src/app/services/review.service';
import { AdminAiService, AiReviewDigestResponse } from 'src/app/services/admin-ai.service';
import { ToastrService } from 'ngx-toastr';
import { ConfirmService } from 'src/app/shared/services/confirm.service';

@Component({
  selector: 'app-admin-reviews',
  templateUrl: './admin-reviews.component.html'
})
export class AdminReviewsComponent implements OnInit {
  reviews: ReviewDTO[] = [];
  loading = true;
  deletingId: string | null = null;

  digest: AiReviewDigestResponse | null = null;
  digestLoading = false;
  digestError: string | null = null;

  // Per-review AI replies
  replies: { [id: string]: string } = {};
  replyingId: string | null = null;

  constructor(private reviewService: ReviewService, private adminAiService: AdminAiService,
              private toastr: ToastrService, private confirm: ConfirmService) {}

  ngOnInit(): void {
    this.load();
  }

  loadDigest(): void {
    this.digestLoading = true;
    this.digestError = null;
    this.adminAiService.reviewDigest().subscribe({
      next: (res) => { this.digest = res; this.digestLoading = false; },
      error: () => {
        this.digestLoading = false;
        this.digestError = 'AI digest is unavailable right now.';
      }
    });
  }

  get sentimentColor(): string {
    if (!this.digest) return 'text-textMuted';
    const s = this.digest.sentimentScore;
    if (s >= 7) return 'text-green-600';
    if (s >= 4) return 'text-amber-500';
    return 'text-red-500';
  }

  get sentimentBg(): string {
    if (!this.digest) return 'bg-gray-100';
    const s = this.digest.sentimentScore;
    if (s >= 7) return 'bg-green-50 border-green-200';
    if (s >= 4) return 'bg-amber-50 border-amber-200';
    return 'bg-red-50 border-red-200';
  }

  load(): void {
    this.loading = true;
    this.reviewService.adminGetReviews().subscribe({
      next: (data) => { this.reviews = data; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  deleteReview(id: string): void {
    this.confirm.ask({
      title: 'Delete review?',
      message: 'This review will be permanently removed.',
      confirmLabel: 'Delete',
    }).subscribe(ok => {
      if (!ok) return;
      this.performDeleteReview(id);
    });
  }

  private performDeleteReview(id: string): void {
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

  /** Ask the AI to draft a short public reply to this review. */
  draftReply(r: ReviewDTO): void {
    if (this.replyingId) return;
    this.replyingId = r.id;
    this.adminAiService.draftReviewReply(r.rating, r.comment || '').subscribe({
      next: (res) => { this.replies[r.id] = res.reply; this.replyingId = null; },
      error: () => { this.replyingId = null; this.toastr.error('AI reply is unavailable right now'); }
    });
  }

  copyReply(id: string): void {
    const text = this.replies[id];
    if (!text) return;
    navigator.clipboard?.writeText(text).then(
      () => this.toastr.success('Reply copied'),
      () => this.toastr.error('Could not copy')
    );
  }
}
