import { ChangeDetectorRef, Component, ContentChild, ElementRef, Host, HostListener, ViewChild, viewChild } from '@angular/core';
import { BBox } from '../../core/pdfjs/Bbox';

@Component({
  selector: 'pdf-controls',
  templateUrl: './controls.component.html',
  styleUrl: './controls.component.scss'
})
export class ControlsComponent {

  @ViewChild('content') content!: ElementRef;
  transform = "";

  private scale = 1;
  private translateY = 0;

  constructor(private cdr: ChangeDetectorRef) { }

  @HostListener('mousewheel', ['$event'])
  onZoom(event: WheelEvent) {
    const delta = Math.sign(event.deltaY);
    if (event.ctrlKey) {
      event.preventDefault();
      if (delta < 0) {
        this.scale *= 1.1;
      } else {
        this.scale /= 1.1;
      }
    } else {
      this.translateY -= delta * 10;
    }
    this.transform = `scale(${this.scale}) translateY(${this.translateY}px)`;
    this.cdr.detectChanges();
    console.log(this.transform);
  }

  reset() {
    this.scale = 1;
    this.translateY = 0;
    this.transform = `scale(${this.scale}) translateY(${this.translateY}px)`;
    this.cdr.detectChanges();
  }

  zoomTo(bbox: BBox, padding = 0) {
    this.scale = this.content.nativeElement.getBoundingClientRect().width / bbox.width;
    this.transform = `scale(${this.scale})`;
  }

}
