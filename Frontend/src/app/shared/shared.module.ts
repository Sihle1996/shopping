import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { LoadersModule } from './loaders/loaders.module';
import { PaginationComponent } from '../components/pagination/pagination.component';

@NgModule({
  declarations: [PaginationComponent],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, LoadersModule],
  exports: [CommonModule, FormsModule, ReactiveFormsModule, LoadersModule, PaginationComponent]
})
export class SharedModule {}
