import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { AdminService } from 'src/app/services/admin.service';
import { AdminDriversComponent } from './admin-drivers.component';

describe('AdminDriversComponent', () => {
    let component: AdminDriversComponent;
    let fixture: ComponentFixture<AdminDriversComponent>;
    let adminServiceSpy: jasmine.SpyObj<AdminService>;

    beforeEach(() => {
      adminServiceSpy = jasmine.createSpyObj('AdminService', ['createDriver']);
      adminServiceSpy.createDriver.and.returnValue(of({}));

      TestBed.configureTestingModule({
        declarations: [AdminDriversComponent],
        imports: [FormsModule],
        providers: [{ provide: AdminService, useValue: adminServiceSpy }]
      });

      fixture = TestBed.createComponent(AdminDriversComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('should call createDriver on addDriver', () => {
      component.newDriver = { email: 'test@example.com', password: '123456' };
      component.addDriver();
      expect(adminServiceSpy.createDriver).toHaveBeenCalledWith(component.newDriver);
    });
  });

