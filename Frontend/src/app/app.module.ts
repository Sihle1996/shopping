import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
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
import { AdminDashboardModule } from './admin/admin-dashboard/admin-dashboard.module';
import { AuthInterceptor } from './authInterceptor/auth.interceptor';
import { LoaderInterceptor } from './shared/loaders/loader.interceptor';
import { SharedModule } from './shared/shared.module';
import { ManagerModule } from './manager/manager.module';
import { HistoryordersComponent } from './pages/historyorders/historyorders.component';



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
    RouterModule,
    HttpClientModule,
    BrowserAnimationsModule,
    // Register feature modules with their forChild routes BEFORE AppRoutingModule
    AdminDashboardModule,
    ManagerModule,
    // Root routes with wildcard should come last
    AppRoutingModule,
    SharedModule,
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
