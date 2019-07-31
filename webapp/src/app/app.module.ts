import { NgModule } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";
import { HighlightModule } from "ngx-highlightjs";

import scala from "highlight.js/lib/languages/scala";

export function hljsLanguages() {
    return [
        {name: "scala", func: scala},
    ];
}

import { FlexLayoutModule } from "@angular/flex-layout";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { MatDialogModule } from "@angular/material";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { DemoMaterialModule } from "../material-module";
import { AppRoutingModule } from "./app-routing.module";
import { AppComponent } from "./app.component";
import { AccountDialog, ArgDialog, InfoDialog, StainlessComponent } from "./stainless/stainless.component";

@NgModule({
    bootstrap: [AppComponent],
    declarations: [
        AppComponent,
        ArgDialog,
        InfoDialog,
        AccountDialog,
        StainlessComponent,
    ],
    entryComponents: [
        ArgDialog,
        InfoDialog,
        AccountDialog,
    ],
    imports: [
        BrowserModule,
        BrowserAnimationsModule,
        DemoMaterialModule,
        FormsModule,
        FlexLayoutModule,
        HighlightModule.forRoot({
            languages: hljsLanguages,
        }),
        ReactiveFormsModule,
        MatDialogModule,
        AppRoutingModule,
    ],
    providers: [],
})
export class AppModule {
}
