import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { CartComponent } from './pages/cart/cart.component';
import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';
import { ProductComponent } from './pages/product/product.component';
import { CheckoutComponent } from './pages/checkout/checkout.component';
import { ThankYouComponent } from './components/thank-you/thank-you.component';
import { HistoryordersComponent } from './pages/historyorders/historyorders.component';

// 🛠️ Admin
import { AdminDashboardComponent } from './admin/admin-dashboard/admin-dashboard.component';
import { AdminOrdersComponent } from './admin/admin-orders/admin-orders.component';
import { AdminMenuComponent } from './admin/admin-menu/admin-menu.component';
import { AdminGuard } from './guards/admin.guard';
import { UserGuard } from './guards/user.guard';

const routes: Routes = [
  { path: '', component: HomeComponent, canActivate: [UserGuard] },
  { path: 'cart', component: CartComponent, canActivate: [UserGuard] },
  { path: 'product/:id', component: ProductComponent, canActivate: [UserGuard] },
  { path: 'checkout', component: CheckoutComponent, canActivate: [UserGuard] },
  { path: 'orders', component: HistoryordersComponent, canActivate: [UserGuard] },
  { path: 'thank-you', component: ThankYouComponent, canActivate: [UserGuard] },

  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },

  // ✅ Admin routes
  {
    path: 'admin',
    canActivate: [AdminGuard],
    children: [
      { path: 'dashboard', component: AdminDashboardComponent },
      { path: 'orders', component: AdminOrdersComponent },
      { path: 'menu', component: AdminMenuComponent },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },

  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
