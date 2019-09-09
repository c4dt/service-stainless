import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { StainlessComponent } from "./stainless/stainless.component";
import { TutorialComponent } from "./tutorial/tutorial.component";

const routes: Routes = [
  {path: "", component: StainlessComponent},
  {path: "help", component: TutorialComponent},
];

@NgModule({
  declarations: [],
  exports: [RouterModule],
  imports: [
    RouterModule.forRoot(routes),
    CommonModule,
  ],
})
export class AppRoutingModule {
}
