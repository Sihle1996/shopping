import { Component, OnInit } from '@angular/core';
import { CartService, CartItem } from 'src/app/services/cart.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-cart',
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.scss']
})
export class CartComponent implements OnInit {
  cartItems: CartItem[] = [];
  totalPrice: number = 0;

  constructor(private cartService: CartService, private router: Router) {}

  ngOnInit(): void {
    const userId = localStorage.getItem('userId');

    if (!userId || isNaN(Number(userId)) || Number(userId) <= 0) {
      console.error("User not logged in. Redirecting to login...");
      this.router.navigate(['/login']);
      return;
    }

    this.loadCart();
  }

  // ✅ Load cart items and ensure price & quantity are valid
  loadCart(): void {
    this.cartService.getCartItems().subscribe({
      next: (items) => {
        console.log("📦 Cart Items from API:", items); // ✅ Debugging line

        this.cartItems = items.map((item: any) => ({
          id: Number(item.id), // ✅ Ensure number conversion
          menuItemId: Number(item.menuItemId),
          menuItemName: String(item.menuItemName), // ✅ Convert to string
          menuItemPrice: Number(item.menuItemPrice), // ✅ Fix: Convert to number
          quantity: Number(item.quantity),
          totalPrice: Number(item.totalPrice), // ✅ Fix: Convert to number
          image: item.image || 'assets/default-food.jpg', // ✅ Default image
        }));

        this.updateTotalPrice(); // ✅ Call total price calculation
      },
      error: (err) => {
        console.error("❌ Error fetching cart items:", err);
      }
    });
}

  
  
  
  

  // ✅ Increase quantity
  increaseQuantity(item: CartItem): void {
    item.quantity++;
    this.updateTotalPrice();
  }

  // ✅ Decrease quantity (minimum of 1)
  decreaseQuantity(item: CartItem): void {
    if (item.quantity > 1) {
      item.quantity--;
      this.updateTotalPrice();
    }
  }

  // ✅ Remove item from cart
  removeItem(itemId: number): void {
    this.cartService.removeFromCart(itemId).subscribe({
      next: () => {
        this.cartItems = this.cartItems.filter(item => item.id !== itemId);
        this.updateTotalPrice();
      },
      error: (err) => console.error("Error removing item:", err)
    });
  }

  // ✅ Fix: Ensure total price updates correctly
  private updateTotalPrice(): void {
    const cartArray = this.cartItems; // ✅ Ensure `cartItems` is an array
    this.totalPrice = cartArray.reduce((sum: number, item: CartItem) => sum + (item.menuItemPrice * item.quantity), 0);
    console.log("💰 Updated Total Price:", this.totalPrice);
}


  // ✅ Checkout button
  checkout(): void {
    alert('Proceeding to checkout...');
  }
}
