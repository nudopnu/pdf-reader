import { NgModule } from "@angular/core";
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { IconDefinition } from '@ant-design/icons-angular';
import { UserOutline, CaretRightFill, StepBackwardFill, StepForwardFill, PauseOutline } from '@ant-design/icons-angular/icons';
import { NzSliderModule } from 'ng-zorro-antd/slider';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzNotificationModule } from 'ng-zorro-antd/notification';


const icons: IconDefinition[] = [
  UserOutline,
  CaretRightFill,
  StepBackwardFill,
  StepForwardFill,
  PauseOutline,
];

@NgModule({
  imports: [
    NzIconModule.forRoot(icons)
  ],
  exports: [
    NzButtonModule,
    NzIconModule,
    NzSliderModule,
    NzInputModule,
    NzInputNumberModule,
    NzNotificationModule,
  ]
})
export class ZorroModule { }