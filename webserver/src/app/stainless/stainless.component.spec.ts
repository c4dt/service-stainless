import { async, ComponentFixture, TestBed } from "@angular/core/testing";

import { ArgDialog, InfoDialog, StainlessComponent } from "./stainless.component";

import { ScrollDispatchModule } from "@angular/cdk/scrolling";
import { FormsModule } from "@angular/forms";
import {
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatDividerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    MatTabsModule,
} from "@angular/material";
import { BrowserDynamicTestingModule } from "@angular/platform-browser-dynamic/testing";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";

import { HighlightModule } from "ngx-highlightjs";

describe("StainlessComponent", () => {
  let component: StainlessComponent;
  let fixture: ComponentFixture<StainlessComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ArgDialog, InfoDialog, StainlessComponent ],
      imports: [
          BrowserAnimationsModule,
          FormsModule,
          HighlightModule,
          MatButtonModule,
          MatCardModule,
          MatDialogModule,
          MatDividerModule,
          MatFormFieldModule,
          MatInputModule,
          MatSelectModule,
          MatTableModule,
          MatTabsModule,
          ScrollDispatchModule,
      ],
    }).overrideModule(BrowserDynamicTestingModule, {
        set: {
            entryComponents: [ ArgDialog, InfoDialog ],
        },
    }).compileComponents();
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
