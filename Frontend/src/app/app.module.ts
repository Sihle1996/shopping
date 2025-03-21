import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { HttpClientModule } from '@angular/common/http'; // ✅ Added for HTTP requests
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

// ✅ Import Lucide Icons & Module
import { LucideAngularModule } from 'lucide-angular';
import { CheckoutComponent } from './pages/checkout/checkout.component';
import { ThankYouComponent } from './components/thank-you/thank-you.component';
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
    AppRoutingModule,
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule,
    LucideAngularModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
