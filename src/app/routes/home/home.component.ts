import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

declare const pdfjsLib: any;

@Component({
  selector: 'pdf-home',
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {

  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('slider') sliderRef!: ElementRef<HTMLInputElement>;
  @Input() scale = 2;
  proxyDoc?: PDFDocumentProxy;
  debounceTimeout?: NodeJS.Timeout;
  currentPage = 1;

  constructor() {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdfjs/pdf.worker.min.mjs';
  }

  async onFileChange(event: Event) {
    const fileList = (event.target! as HTMLInputElement).files;
    if (!fileList) return;

    const file = fileList[0];
    const pdfBytes = await this.readFile(file);

    await this.setPdfDocument(pdfBytes);
  }

  private async setPdfDocument(pdfBytes: unknown) {
    this.proxyDoc = await pdfjsLib.getDocument(pdfBytes).promise;
    this.sliderRef!.nativeElement.setAttribute('max', `${this.proxyDoc!.numPages}`);
    this.sliderRef!.nativeElement.setAttribute('min', "1");
    this.sliderRef!.nativeElement.setAttribute('value', "1");
    const firstPage = await this.proxyDoc!.getPage(1);
    this.renderPage(firstPage);
  }

  async onSliderChange(event: Event) {
    const pageNumber = parseInt((event.target! as HTMLInputElement).value);
    this.setPageNumber(pageNumber);
  }

  private setPageNumber(pageNumber: number) {
    if (this.debounceTimeout) clearTimeout(this.debounceTimeout);
    this.debounceTimeout = setTimeout(async () => {
      const page = await this.proxyDoc!.getPage(pageNumber);
      await this.renderPage(page);
    }, 10);
  }

  private renderPage(page: PDFPageProxy) {
    const viewport = page.getViewport({ scale: this.scale });

    // Support HiDPI-screens.
    const outputScale = window.devicePixelRatio || 1;

    const { nativeElement: canvas } = this.canvasRef;
    const context = canvas.getContext('2d');

    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.margin = "auto";
    canvas.style.width = "auto";

    const transform = outputScale !== 1
      ? [outputScale, 0, 0, outputScale, 0, 0]
      : null;

    const renderContext = {
      canvasContext: context!,
      transform: transform!,
      viewport: viewport
    };
    page.render(renderContext);
  }

  private readFile(file: File) {
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader();
      fileReader.onload = () => {
        const bytes = new Uint8Array(fileReader.result as ArrayBuffer);
        resolve(bytes);
      }
      fileReader.onerror = reject;
      fileReader.readAsArrayBuffer(file);
    });
  }

}
