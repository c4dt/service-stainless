import { async, TestBed } from "@angular/core/testing";
import { AppComponent } from "./app.component";

import { AppRoutingModule } from "./app-routing.module";

import {
  AccountDialog,
  ArgDialog,
  InfoDialog,
  StainlessComponent,
  VerifDialog,
} from "./stainless/stainless.component";

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

import { LibModule } from "@c4dt/angular-components";

import { HighlightModule } from "ngx-highlightjs";
describe("AppComponent", () => {
  beforeEach(async(() => {
    return TestBed.configureTestingModule({
      declarations: [
        ArgDialog,
        InfoDialog,
        AccountDialog,
        VerifDialog,
        AppComponent,
        StainlessComponent,
      ],
      imports: [
        AppRoutingModule,
        BrowserAnimationsModule,
        FormsModule,
        HighlightModule,
        LibModule,
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
        ScrollDispatchModule,
      ],
    })
      .overrideModule(BrowserDynamicTestingModule, {
        set: {
          entryComponents: [ArgDialog, InfoDialog, AccountDialog, VerifDialog],
        },
      })
      .compileComponents();
  }));

  it("should create the app", () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.debugElement.componentInstance;
    expect(app).toBeTruthy();
  });
});
