import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { DriverGuard } from './driver.guard';
import { AuthService } from '../services/auth.service';

describe('DriverGuard', () => {
  let guard: DriverGuard;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj('AuthService', ['getUserRole']);
    TestBed.configureTestingModule({
      providers: [
        DriverGuard,
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy }
      ]
    });
    guard = TestBed.inject(DriverGuard);
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });
});
