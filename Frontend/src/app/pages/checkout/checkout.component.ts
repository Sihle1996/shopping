import { Component, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';

declare var paypal: any;

@Component({
  selector: 'app-checkout',
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss']
})
export class CheckoutComponent implements AfterViewInit {
  constructor(private router: Router) {}

  ngAfterViewInit(): void {
    paypal.Buttons({
      createOrder: (data: any, actions: any) => {
        return actions.order.create({
          purchase_units: [{
            amount: {
              value: '29.99' // 💰 Hardcoded total, later get from cart
            }
          }]
        });
      },
      onApprove: async (data: any, actions: any) => {
        const details = await actions.order.capture();
        console.log('✅ Payment successful!', details);

        // Redirect or call your backend endpoint to create order
        this.router.navigate(['/orders']);
      },
      onError: (err: any) => {
        console.error('❌ Payment error', err);
      }
    }).render('#paypal-button-container');
  }
}
