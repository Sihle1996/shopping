import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { Tenant, TenantService } from 'src/app/services/tenant.service';
import { applyStoreBranding } from 'src/app/shared/utils/brand-theme.util';

@Component({
  selector: 'app-store',
  templateUrl: './store.component.html',
  styleUrls: ['./store.component.scss']
})
export class StoreComponent implements OnInit, OnDestroy {
  tenant: Tenant | null = null;
  isLoading = false;
  notFound = false;

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private tenantService: TenantService,
    private title: Title,
    private meta: Meta
  ) {}

  ngOnInit(): void {
    const tenant: Tenant | null = this.route.snapshot.data['tenant'];
    if (!tenant) {
      this.notFound = true;
      this.title.setTitle('Store not found — CraveIt');
      return;
    }
    this.tenant = tenant;
    applyStoreBranding(tenant);
    this.applySeo(tenant);
  }

  ngOnDestroy(): void {
    this.resetBranding();
    this.resetSeo();
  }

  // Per-store SEO: dynamic <title> + OpenGraph/Twitter tags so store links index in
  // search and render rich previews when shared. Reset on destroy so other pages keep
  // the default app title.
  private applySeo(t: Tenant): void {
    const name = t.name?.trim() || 'Restaurant';
    const cuisine = t.cuisineType?.trim();
    const where = t.address?.trim();
    const pageTitle = `${name} — Order online${cuisine ? ` · ${cuisine}` : ''} | CraveIt`;
    const description =
      `Order from ${name} on CraveIt${cuisine ? `, ${cuisine}` : ''}.` +
      `${where ? ` ${where}.` : ''} Fast local delivery, pay securely, track your order live.`;
    const image = t.logoUrl || '';
    const url = `${window.location.origin}/store/${t.slug}`;

    this.title.setTitle(pageTitle);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:type', content: 'restaurant.restaurant' });
    this.meta.updateTag({ property: 'og:title', content: pageTitle });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ name: 'twitter:card', content: image ? 'summary_large_image' : 'summary' });
    this.meta.updateTag({ name: 'twitter:title', content: pageTitle });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    if (image) {
      this.meta.updateTag({ property: 'og:image', content: image });
      this.meta.updateTag({ name: 'twitter:image', content: image });
    } else {
      this.meta.removeTag("property='og:image'");
      this.meta.removeTag("name='twitter:image'");
    }
  }

  private resetSeo(): void {
    this.title.setTitle('CraveIt — Food Delivery');
    this.meta.removeTag("name='description'");
    ['og:type', 'og:title', 'og:description', 'og:url', 'og:image'].forEach(p =>
      this.meta.removeTag(`property='${p}'`));
    ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'].forEach(n =>
      this.meta.removeTag(`name='${n}'`));
  }

  private resetBranding(): void {
    this.tenantService.clearTenant();
    // localStorage store context (storeSlug, storeName, tenantId, brandPrimary) is kept
    // so profile/address/support pages retain the store context and can navigate back.
    // These keys are cleared on logout (auth.service) and on landing page (navbar).
  }

}
