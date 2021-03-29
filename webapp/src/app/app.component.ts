import { Component } from "@angular/core";

import Log from "@dedis/cothority/log";

import { BreadCrumb } from "@c4dt/angular-components";

@Component({
  selector: "app-root",
  styleUrls: ["./app.component.css"],
  templateUrl: "./app.component.html",
})
export class AppComponent {
  title = "angular-material-tab-router";
  navLinks: any[];
  activeLinkIndex = -1;

  readonly showcaseBreadCrumb: BreadCrumb = {
    label: "Stainless",
    link: new URL("https://incubator.c4dt.org/stainless.html"),
  };

  constructor() {
    Log.lvl1("app component constructor");
  }

  ngOnInit(): void {
    Log.lvl3("init app");
  }
}
