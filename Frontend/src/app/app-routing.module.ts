import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CartComponent } from './pages/cart/cart.component';
import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';
import { ProductComponent } from './pages/product/product.component';
import { CheckoutComponent } from './pages/checkout/checkout.component';
import { ThankYouComponent } from './components/thank-you/thank-you.component';
import { HistoryordersComponent } from './pages/historyorders/historyorders.component';
import { UserGuard } from './guards/user.guard';
import { DriverDashboardComponent } from './driver/driver-dashboard/driver-dashboard.component';
import { DriverGuard } from './guards/driver.guard';
import { RegisterRestaurantComponent } from './pages/register-restaurant/register-restaurant.component';
import { StoreListComponent } from './pages/store-list/store-list.component';
import { StoreComponent } from './pages/store/store.component';

const routes: Routes = [
  // Landing — store listing
  { path: '', component: StoreListComponent },

  // Store-specific routes
  { path: 'store/:slug', component: StoreComponent },
  { path: 'store/:slug/product/:id', component: ProductComponent },
  { path: 'store/:slug/cart', component: CartComponent, canActivate: [UserGuard] },
  { path: 'store/:slug/checkout', component: CheckoutComponent, canActivate: [UserGuard] },
  { path: 'store/:slug/orders', component: HistoryordersComponent, canActivate: [UserGuard] },
  { path: 'store/:slug/thank-you', component: ThankYouComponent, canActivate: [UserGuard] },

  // Legacy direct routes (for admin/driver who don't need store context)
  { path: 'product/:id', component: ProductComponent },
  { path: 'cart', component: CartComponent, canActivate: [UserGuard] },
  { path: 'checkout', component: CheckoutComponent, canActivate: [UserGuard] },
  { path: 'orders', component: HistoryordersComponent, canActivate: [UserGuard] },
  { path: 'thank-you', component: ThankYouComponent, canActivate: [UserGuard] },

  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'register-restaurant', component: RegisterRestaurantComponent },

  { path: 'driver/dashboard', component: DriverDashboardComponent, canActivate: [DriverGuard] },

  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
