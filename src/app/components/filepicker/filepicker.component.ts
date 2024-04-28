import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'pdf-filepicker',
  templateUrl: './filepicker.component.html',
  styleUrl: './filepicker.component.scss'
})
export class FilepickerComponent {
  
  @Output() fileReceived = new EventEmitter<File>();

  onFileChage(event: Event) {
    const fileList = (event.target! as HTMLInputElement).files;
    if (!fileList) return;
    const file = fileList[0];
    if (!file) return;
    this.fileReceived.emit(file);
  }
}
