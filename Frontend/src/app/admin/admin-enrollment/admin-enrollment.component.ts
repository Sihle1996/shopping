import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from 'src/app/services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { environment } from 'src/environments/environment';

interface StoreDocument {
  id: string;
  documentType: 'CIPC' | 'COA' | 'BANK_DETAILS' | 'STOREFRONT_PHOTO';
  fileUrl: string;
  fileName: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  reviewNotes: string;
  uploadedAt: string;
}

interface EnrollmentState {
  approvalStatus: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  rejectionReason: string;
  documents: StoreDocument[];
}

@Component({
  selector: 'app-admin-enrollment',
  templateUrl: './admin-enrollment.component.html',
  styleUrls: ['./admin-enrollment.component.scss']
})
export class AdminEnrollmentComponent implements OnInit {
  state: EnrollmentState = { approvalStatus: 'DRAFT', rejectionReason: '', documents: [] };
  loading = true;
  submitting = false;

  uploading: Record<string, boolean> = {};

  readonly DOC_TYPES: { type: StoreDocument['documentType']; label: string; required: boolean; hint: string }[] = [
    { type: 'CIPC', label: 'CIPC Registration Certificate', required: true, hint: 'Company registration from CIPC, or SA ID for sole traders' },
    { type: 'COA', label: 'Certificate of Acceptability', required: true, hint: 'Food safety certificate issued by your municipality' },
    { type: 'BANK_DETAILS', label: 'Bank Account / EFT Details', required: true, hint: 'Bank statement or official letter showing account details for payouts' },
    { type: 'STOREFRONT_PHOTO', label: 'Storefront Photo', required: false, hint: 'Optional — a photo of your restaurant or kitchen' },
  ];

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.loadState();
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.authService.getToken()}` });
  }

  loadState(): void {
    this.loading = true;
    this.http.get<EnrollmentState>(`${environment.apiUrl}/api/admin/enrollment`, { headers: this.headers() })
      .subscribe({
        next: s => { this.state = s; this.loading = false; },
        error: () => { this.loading = false; this.toastr.error('Failed to load enrollment status'); }
      });
  }

  getDoc(type: StoreDocument['documentType']): StoreDocument | undefined {
    return this.state.documents.find(d => d.documentType === type);
  }

  canEdit(): boolean {
    return this.state.approvalStatus === 'DRAFT' || this.state.approvalStatus === 'REJECTED';
  }

  uploadFile(event: Event, docType: StoreDocument['documentType']): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploading[docType] = true;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('documentType', docType);
    this.http.post<StoreDocument>(`${environment.apiUrl}/api/admin/enrollment/upload`, fd, {
      headers: new HttpHeaders({ Authorization: `Bearer ${this.authService.getToken()}` })
    }).subscribe({
      next: saved => {
        const idx = this.state.documents.findIndex(d => d.documentType === docType);
        if (idx >= 0) this.state.documents[idx] = saved;
        else this.state.documents.push(saved);
        this.uploading[docType] = false;
        this.toastr.success('Document uploaded');
      },
      error: () => { this.uploading[docType] = false; this.toastr.error('Upload failed'); }
    });
  }

  removeDoc(doc: StoreDocument): void {
    this.http.delete(`${environment.apiUrl}/api/admin/enrollment/${doc.id}`, { headers: this.headers() })
      .subscribe({
        next: () => {
          this.state.documents = this.state.documents.filter(d => d.id !== doc.id);
          this.toastr.success('Document removed');
        },
        error: () => this.toastr.error('Could not remove document')
      });
  }

  canSubmit(): boolean {
    const required = this.DOC_TYPES.filter(t => t.required).map(t => t.type);
    return required.every(type => this.state.documents.some(d => d.documentType === type));
  }

  docLabel(type: string): string {
    return this.DOC_TYPES.find(t => t.type === type)?.label ?? type;
  }

  submit(): void {
    if (!this.canSubmit()) return;
    this.submitting = true;
    this.http.post<any>(`${environment.apiUrl}/api/admin/enrollment/submit`, {}, { headers: this.headers() })
      .subscribe({
        next: () => {
          this.state.approvalStatus = 'PENDING_REVIEW';
          this.submitting = false;
          this.toastr.success('Application submitted for review');
        },
        error: err => {
          this.submitting = false;
          this.toastr.error(err?.error?.error || 'Submission failed');
        }
      });
  }
}
