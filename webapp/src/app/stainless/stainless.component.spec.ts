import { async, ComponentFixture, TestBed } from "@angular/core/testing";

import { AccountDialog, ArgDialog, InfoDialog, StainlessComponent, VerifDialog } from "./stainless.component";

import { ScrollDispatchModule } from "@angular/cdk/scrolling";
import { FormsModule } from "@angular/forms";
import {
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSidenavModule,
    MatStepperModule,
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
      declarations: [ ArgDialog, InfoDialog, AccountDialog, StainlessComponent, VerifDialog ],
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
          MatIconModule,
          MatSelectModule,
          MatSidenavModule,
          MatStepperModule,
          MatTableModule,
          MatTabsModule,
          ScrollDispatchModule,
      ],
    }).overrideModule(BrowserDynamicTestingModule, {
        set: {
            entryComponents: [ ArgDialog, InfoDialog, AccountDialog, VerifDialog ],
        },
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(StainlessComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  xit("should create", () => {
    expect(component).toBeTruthy();
  });
});
