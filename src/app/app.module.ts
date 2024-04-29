import { ErrorHandler, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HomeComponent } from './routes/home/home.component';
import { DroppableDirective } from './directives/droppable.directive';
import { NZ_I18N } from 'ng-zorro-antd/i18n';
import { en_US } from 'ng-zorro-antd/i18n';
import { CommonModule, registerLocaleData } from '@angular/common';
import en from '@angular/common/locales/en';
import { FormsModule } from '@angular/forms';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient } from '@angular/common/http';
import { ZorroModule } from './modules/zorro/zorro.module';
import { SliderComponent } from './components/slider/slider.component';
import { PlaycontrolsComponent } from './components/playcontrols/playcontrols.component';
import { ErrorHandlerService } from './services/error-handler.service';
import { FilepickerComponent } from './components/filepicker/filepicker.component';
import { ControlsComponent } from './components/controls/controls.component';

registerLocaleData(en);

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    DroppableDirective,
    SliderComponent,
    PlaycontrolsComponent,
    FilepickerComponent,
    ControlsComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    ZorroModule,
    CommonModule,
  ],
  providers: [
    { provide: NZ_I18N, useValue: en_US },
    { provide: ErrorHandler, useClass: ErrorHandlerService },
    provideAnimationsAsync(),
    provideHttpClient(),
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
