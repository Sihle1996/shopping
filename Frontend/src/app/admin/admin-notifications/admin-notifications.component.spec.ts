import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminNotificationsComponent } from './admin-notifications.component';
import { NotificationService } from '../../services/notification.service';
import { of } from 'rxjs';

class MockNotificationService {
  notifications = of([]);
}

describe('AdminNotificationsComponent', () => {
  let component: AdminNotificationsComponent;
  let fixture: ComponentFixture<AdminNotificationsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AdminNotificationsComponent],
      providers: [
        { provide: NotificationService, useClass: MockNotificationService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminNotificationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
