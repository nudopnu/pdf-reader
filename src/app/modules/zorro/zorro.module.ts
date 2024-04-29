import { NgModule } from "@angular/core";
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { IconDefinition } from '@ant-design/icons-angular';
import { UserOutline, CaretRightFill, StepBackwardFill, StepForwardFill, PauseOutline, FolderOpenOutline, SettingOutline, BorderOuterOutline, FullscreenOutline } from '@ant-design/icons-angular/icons';
import { NzSliderModule } from 'ng-zorro-antd/slider';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzNotificationModule } from 'ng-zorro-antd/notification';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';

const icons: IconDefinition[] = [
  UserOutline,
  CaretRightFill,
  StepBackwardFill,
  StepForwardFill,
  PauseOutline,
  FolderOpenOutline,
  SettingOutline,
  BorderOuterOutline,
  FullscreenOutline,
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
    NzDropDownModule,
  ]
})
export class ZorroModule { }