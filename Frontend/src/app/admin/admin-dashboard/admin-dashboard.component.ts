import { Component, OnInit } from '@angular/core';
import { Chart } from 'chart.js/auto';
import { AnalyticsService } from './analytics.service';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit {
  startDate!: string;
  endDate!: string;

  salesChart?: Chart;
  productsChart?: Chart;
  topProducts: any[] = [];
  aov = 0;
  onTime = 0;
  cancellations = 0;

  constructor(private analyticsService: AnalyticsService) {}

  ngOnInit(): void {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    this.startDate = start.toISOString().substring(0,10);
    this.endDate = now.toISOString().substring(0,10);
    this.loadAnalytics();
  }

  loadAnalytics() {
    const start = new Date(this.startDate).toISOString();
    const end = new Date(this.endDate).toISOString();

    this.analyticsService.getSalesTrends(start, end).subscribe(data => {
      const labels = data.map(d => d.date);
      const values = data.map(d => d.total);
      if (this.salesChart) this.salesChart.destroy();
      this.salesChart = new Chart('salesChart', {
        type: 'line',
        data: { labels, datasets: [{ label: 'Sales', data: values, borderColor: '#4f46e5' }] }
      });
    });

    this.analyticsService.getTopProducts(start, end).subscribe(data => {
      this.topProducts = data;
      const labels = data.map(d => d.name);
      const values = data.map(d => d.quantity);
      if (this.productsChart) this.productsChart.destroy();
      this.productsChart = new Chart('productsChart', {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Top Products', data: values, backgroundColor: '#10b981' }] }
      });
    });

    this.analyticsService.getAverageOrderValue(start, end).subscribe(v => this.aov = v);
    this.analyticsService.getOnTimePercentage(start, end).subscribe(v => this.onTime = v);
    this.analyticsService.getCancellationRate(start, end).subscribe(v => this.cancellations = v);
  }
}
