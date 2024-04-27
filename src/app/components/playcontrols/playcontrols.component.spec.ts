import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlaycontrolsComponent } from './playcontrols.component';

describe('PlaycontrolsComponent', () => {
  let component: PlaycontrolsComponent;
  let fixture: ComponentFixture<PlaycontrolsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PlaycontrolsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PlaycontrolsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
