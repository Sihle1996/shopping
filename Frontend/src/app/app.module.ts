import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AdminRoutingModule } from './admin/admin-routing.module';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { SharedModule } from './shared/shared.module';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';
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
import { AdminDashboardModule } from './admin/admin-dashboard/admin-dashboard.module';
import { AuthInterceptor } from './authInterceptor/auth.interceptor';
import { LoaderInterceptor } from './shared/loaders/loader.interceptor';
import { DriverMapComponent } from './driver/driver-map/driver-map.component';
import { AdminFooterComponent } from './admin/admin-footer/admin-footer.component';
import { AdminDiagnosticsComponent } from './admin/admin-diagnostics/admin-diagnostics.component';
import { InventoryManagementComponent } from './admin/inventory-management/inventory-management.component';
import { ManagerDashboardComponent } from './manager/manager-dashboard/manager-dashboard.component';
import { PaginationComponent } from './components/pagination/pagination.component';
import { ManagerModule } from './manager/manager.module';


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
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    BrowserAnimationsModule,
    AdminDashboardModule,
    SharedModule,
    ManagerModule,
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
