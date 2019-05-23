import { async, ComponentFixture, TestBed } from "@angular/core/testing";

import { StainlessComponent } from "./stainless.component";

describe("StainlessComponent", () => {
  let component: StainlessComponent;
  let fixture: ComponentFixture<StainlessComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ StainlessComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(StainlessComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
