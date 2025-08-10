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
    adminServiceSpy = jasmine.createSpyObj('AdminService', ['getDrivers', 'createDriver', 'deleteDriver']);
    adminServiceSpy.getDrivers.and.returnValue(of([]));
    adminServiceSpy.createDriver.and.returnValue(of({}));
    adminServiceSpy.deleteDriver.and.returnValue(of({}));

    TestBed.configureTestingModule({
      declarations: [AdminDriversComponent],
      imports: [FormsModule],
      providers: [{ provide: AdminService, useValue: adminServiceSpy }]
    });

    fixture = TestBed.createComponent(AdminDriversComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load drivers on init', () => {
    expect(adminServiceSpy.getDrivers).toHaveBeenCalled();
  });

  it('should call createDriver on addDriver', () => {
    component.newDriver = { email: 'test@example.com', password: '123456' };
    component.addDriver();
    expect(adminServiceSpy.createDriver).toHaveBeenCalledWith(component.newDriver);
  });

  it('should call deleteDriver when confirmed', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    component.deleteDriver(1);
    expect(adminServiceSpy.deleteDriver).toHaveBeenCalledWith(1);
  });
});

