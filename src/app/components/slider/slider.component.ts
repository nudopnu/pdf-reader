import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';

@Component({
  selector: 'pdf-slider',
  templateUrl: './slider.component.html',
  styleUrl: './slider.component.scss'
})
export class SliderComponent {

  @Input() value = 1;
  @Input() min = 1;
  @Input() max = 10;

  @Output() onSliderChange = new EventEmitter<number>();

  onChange(newValue: number): void {
    this.value = newValue;
    this.onSliderChange.emit(this.value);
  }
}
