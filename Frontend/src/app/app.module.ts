import { NgApexchartsModule } from 'ng-apexcharts';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';
import { ToastrModule } from 'ngx-toastr';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
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
import { HistoryordersComponent } from './pages/historyorders/historyorders.component';
import { RegisterRestaurantComponent } from './pages/register-restaurant/register-restaurant.component';
import { StoreListComponent } from './pages/store-list/store-list.component';
import { StoreComponent } from './pages/store/store.component';
import { ForgotPasswordComponent } from './pages/forgot-password/forgot-password.component';
import { LandingComponent } from './pages/landing/landing.component';
import { AddressBookComponent } from './pages/address-book/address-book.component';
import { UserProfileComponent } from './pages/user-profile/user-profile.component';
import { TrackOrderComponent } from './pages/track-order/track-order.component';

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
    RegisterRestaurantComponent,
    StoreListComponent,
    StoreComponent,
    ForgotPasswordComponent,
    LandingComponent,
    AddressBookComponent,
    UserProfileComponent,
    TrackOrderComponent,
  ],
  imports: [
    BrowserModule,
    RouterModule,
    HttpClientModule,
    BrowserAnimationsModule,
    FormsModule,
    ReactiveFormsModule,
    NgApexchartsModule,
    AdminDashboardModule,
    SharedModule,
    AppRoutingModule,
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
