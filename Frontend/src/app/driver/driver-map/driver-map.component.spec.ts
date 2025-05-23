import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DriverMapComponent } from './driver-map.component';

describe('DriverMapComponent', () => {
  let component: DriverMapComponent;
  let fixture: ComponentFixture<DriverMapComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [DriverMapComponent]
    });
    fixture = TestBed.createComponent(DriverMapComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
