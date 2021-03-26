import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { StainlessComponent } from "./stainless/stainless.component";

const routes: Routes = [{ path: "", component: StainlessComponent }];

@NgModule({
  declarations: [],
  exports: [RouterModule],
  imports: [RouterModule.forRoot(routes), CommonModule],
})
export class AppRoutingModule {}
