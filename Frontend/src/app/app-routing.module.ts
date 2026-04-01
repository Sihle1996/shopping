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
import { SuperadminGuard } from './guards/superadmin.guard';
import { RegisterRestaurantComponent } from './pages/register-restaurant/register-restaurant.component';
import { StoreListComponent } from './pages/store-list/store-list.component';
import { StoreComponent } from './pages/store/store.component';
import { HomeComponent } from './pages/home/home.component';
import { TenantResolver } from './resolvers/tenant.resolver';
import { ForgotPasswordComponent } from './pages/forgot-password/forgot-password.component';
import { LandingComponent } from './pages/landing/landing.component';

const routes: Routes = [
  { path: '', component: LandingComponent },
  { path: 'stores', component: StoreListComponent },

  // Store-specific routes — all children of StoreComponent so tenant/brand
  // context (logo, color) is always loaded regardless of which page you land on
  {
    path: 'store/:slug',
    component: StoreComponent,
    resolve: { tenant: TenantResolver },
    children: [
      { path: '', component: HomeComponent },
      { path: 'product/:id', component: ProductComponent },
      { path: 'cart', component: CartComponent, canActivate: [UserGuard] },
      { path: 'checkout', component: CheckoutComponent, canActivate: [UserGuard] },
      { path: 'orders', component: HistoryordersComponent, canActivate: [UserGuard] },
      { path: 'thank-you', component: ThankYouComponent, canActivate: [UserGuard] },
    ]
  },

  // Legacy direct routes (for admin/driver who don't need store context)
  { path: 'product/:id', component: ProductComponent },
  { path: 'orders', component: HistoryordersComponent, canActivate: [UserGuard] },
  { path: 'thank-you', component: ThankYouComponent, canActivate: [UserGuard] },

  { path: 'login', component: LoginComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'register-restaurant', component: RegisterRestaurantComponent },

  { path: 'driver/dashboard', component: DriverDashboardComponent, canActivate: [DriverGuard] },

  {
    path: 'superadmin',
    loadChildren: () => import('./superadmin/superadmin.module').then(m => m.SuperadminModule),
    canActivate: [SuperadminGuard]
  },

  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
