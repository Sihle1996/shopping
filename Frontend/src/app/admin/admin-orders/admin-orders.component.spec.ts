import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';

import { AdminOrdersComponent } from './admin-orders.component';
import { AdminService } from 'src/app/services/admin.service';
import { PaginationComponent } from '../../components/pagination/pagination.component';

describe('AdminOrdersComponent', () => {
  let component: AdminOrdersComponent;
  let fixture: ComponentFixture<AdminOrdersComponent>;

  beforeEach(() => {
    const adminServiceStub = {
      getOrders: () => of({ content: [], totalPages: 0 }),
      updateOrderStatus: () => of(null),
      getAvailableDrivers: () => of([]),
      assignDriver: () => of(null)
    };

    TestBed.configureTestingModule({
      declarations: [AdminOrdersComponent, PaginationComponent],
      imports: [FormsModule],
      providers: [{ provide: AdminService, useValue: adminServiceStub }]
    });
    fixture = TestBed.createComponent(AdminOrdersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
