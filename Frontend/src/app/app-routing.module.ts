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
import { UserGuard } from './guards/user.guard';
import { DriverDashboardComponent } from './driver/driver-dashboard/driver-dashboard.component';
import { DriverGuard } from './guards/driver.guard';
import { ManagerDashboardComponent } from './manager/manager-dashboard/manager-dashboard.component';
import { ManagerGuard } from './guards/manager.guard';

const routes: Routes = [
  // 🌐 User Routes
  { path: '', component: HomeComponent},
  { path: 'cart', component: CartComponent, canActivate: [UserGuard] },
  { path: 'product/:id', component: ProductComponent },
  { path: 'checkout', component: CheckoutComponent, canActivate: [UserGuard] },
  { path: 'orders', component: HistoryordersComponent, canActivate: [UserGuard] },
  { path: 'thank-you', component: ThankYouComponent, canActivate: [UserGuard] },

  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },

  // 🧭 Manager Routes
  {
    path: 'manager',
    canActivate: [ManagerGuard],
    children: [
      { path: 'dashboard', component: ManagerDashboardComponent },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },

  // 🚚 Driver Route
  {
    path: 'driver/dashboard',
    component: DriverDashboardComponent,
    canActivate: [DriverGuard]
  },

  // Fallback
  { path: '**', redirectTo: '' },
];


@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
