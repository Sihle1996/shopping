import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SharedModule } from '../../shared/shared.module';
import { of } from 'rxjs';

import { AdminOrdersComponent } from './admin-orders.component';
import { AdminService } from 'src/app/services/admin.service';

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
      declarations: [AdminOrdersComponent],
      imports: [SharedModule],
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
