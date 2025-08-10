import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ToastrModule } from 'ngx-toastr';

import { AppComponent } from './app.component';
import { HomeComponent } from './pages/home/home.component';
import { CartComponent } from './pages/cart/cart.component';
import { OrdersComponent } from './pages/orders/orders.component';
import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';
import { NavbarComponent } from './components/navbar/navbar.component';
import { FooterComponent } from './components/footer/footer.component';
import { ProductComponent } from './pages/product/product.component';
import { CheckoutComponent } from './pages/checkout/checkout.component';
import { ThankYouComponent } from './components/thank-you/thank-you.component';
import { HistoryordersComponent } from './pages/historyorders/historyorders.component';
import { AdminDashboardComponent } from './admin/admin-dashboard/admin-dashboard.component';
import { AdminOrdersComponent } from './admin/admin-orders/admin-orders.component';
import { AdminMenuComponent } from './admin/admin-menu/admin-menu.component';
import { AdminDriversComponent } from './admin/admin-drivers/admin-drivers.component';
import { DriverDashboardComponent } from './driver/driver-dashboard/driver-dashboard.component';
import { AuthInterceptor } from './authInterceptor/auth.interceptor';
import { DriverMapComponent } from './driver/driver-map/driver-map.component';
import { AdminNotificationsComponent } from './admin/admin-notifications/admin-notifications.component';
import { AdminFooterComponent } from './admin/admin-footer/admin-footer.component';
import { AdminDiagnosticsComponent } from './admin/admin-diagnostics/admin-diagnostics.component';
import { InventoryManagementComponent } from './admin/inventory-management/inventory-management.component';
import { LoadersModule } from './shared/loaders/loaders.module';
import { LoaderInterceptor } from './shared/loaders/loader.interceptor';
import { PaginationComponent } from './components/pagination/pagination.component';
import { ManagerDashboardComponent } from './manager/manager-dashboard/manager-dashboard.component';


@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    CartComponent,
    OrdersComponent,
    LoginComponent,
    RegisterComponent,
    NavbarComponent,
    FooterComponent,
    ProductComponent,
    CheckoutComponent,
    ThankYouComponent,
    HistoryordersComponent,
    AdminDashboardComponent,
    AdminOrdersComponent,
    AdminMenuComponent,
    AdminDriversComponent,
    AdminNotificationsComponent,
    AdminFooterComponent,
    AdminDiagnosticsComponent,
    DriverDashboardComponent,
    DriverMapComponent,
    InventoryManagementComponent,
    PaginationComponent,
    ManagerDashboardComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule,
    BrowserAnimationsModule,
    LoadersModule,
    ToastrModule.forRoot({
      positionClass: 'toast-bottom-right',
      timeOut: 4000,
      closeButton: true,
      progressBar: true
    })
  ],
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: LoaderInterceptor,
      multi: true
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
