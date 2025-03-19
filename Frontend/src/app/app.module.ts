import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HomeComponent } from './pages/home/home.component';
import { CartComponent } from './pages/cart/cart.component';
import { OrdersComponent } from './pages/orders/orders.component';
import { ProductdetailsComponent } from './pages/productdetails/productdetails.component';
import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';
import { HttpClientModule } from '@angular/common/http'; // ✅ Added for HTTP requests
import { FormsModule, ReactiveFormsModule } from '@angular/forms'; // ✅ Added for forms

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    CartComponent,
    OrdersComponent,
    ProductdetailsComponent,
    LoginComponent,
    RegisterComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule, // ✅ Added
    FormsModule, // ✅ Added
    ReactiveFormsModule // ✅ Added
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
