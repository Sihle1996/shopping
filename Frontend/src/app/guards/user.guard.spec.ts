import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { UserGuard } from './user.guard';
import { AuthService } from '../services/auth.service';

describe('UserGuard', () => {
  let guard: UserGuard;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj('AuthService', ['getUserRole']);
    TestBed.configureTestingModule({
      providers: [
        UserGuard,
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy }
      ]
    });
    guard = TestBed.inject(UserGuard);
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });
});
