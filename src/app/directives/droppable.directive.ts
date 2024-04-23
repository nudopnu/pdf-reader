import { Directive, EventEmitter, HostListener, Output } from '@angular/core';

@Directive({
  selector: '[droppable]'
})
export class DroppableDirective {

  @Output() onFileDrop = new EventEmitter<File>();

  @HostListener('dragenter', ['$event'])
  onDrageEnter(event: Event) {
    event.stopPropagation();
    event.preventDefault();
  }

  @HostListener('dragover', ['$event'])
  onDragOver(event: Event) {
    event.stopPropagation();
    event.preventDefault();
    console.log(event);

  }

  @HostListener('drop', ['$event'])
  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    const dataTransfer = event.dataTransfer;
    if (dataTransfer?.files) {
      this.onFileDrop.emit(dataTransfer.files[0]);
      console.log(dataTransfer.files[0]);
    }
  }

}
