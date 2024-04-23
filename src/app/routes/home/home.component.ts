import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { PDFDocumentProxy, PDFPageProxy, PageViewport } from 'pdfjs-dist';
import { TextContent, TextItem, TextMarkedContent } from 'pdfjs-dist/types/src/display/api';
import { getParagraphs2 } from '../../core/pdfjs/ParagraphDetection';
import { isTextItem } from '../../core/pdfjs/Utils';

declare const pdfjsLib: any;

@Component({
  selector: 'pdf-home',
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {

  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('slider') sliderRef!: ElementRef<HTMLInputElement>;
  @Input() scale = 1;
  @Input() resolution_factor = 2;

  pdfDocument?: PDFDocumentProxy;
  debounceTimeout?: NodeJS.Timeout;
  currentPage = 1;
  SVG_NS = "http://www.w3.org/2000/svg";
  svgElement?: SVGElement;

  constructor() {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdfjs/pdf.worker.min.mjs';
  }

  async onFileChange(event: Event) {
    const fileList = (event.target! as HTMLInputElement).files;
    if (!fileList) return;
    const file = fileList[0];
    if (!file) return;
    const pdfBytes = await this.readFile(file);
    const pdfDocument = (await pdfjsLib.getDocument(pdfBytes).promise) as PDFDocumentProxy;
    this.updateSlider(pdfDocument.numPages);
    this.setPage(1);
    this.pdfDocument = pdfDocument;
  }

  private updateSlider(numPages: number) {
    this.sliderRef!.nativeElement.setAttribute('max', `${numPages}`);
    this.sliderRef!.nativeElement.setAttribute('min', "1");
    this.sliderRef!.nativeElement.setAttribute('value', "1");
  }

  async onSliderChange(event: Event) {
    const pageNumber = parseInt((event.target! as HTMLInputElement).value);
    this.setPage(pageNumber);
  }

  private setPage(pageNumber: number) {
    if (this.debounceTimeout) clearTimeout(this.debounceTimeout);
    this.debounceTimeout = setTimeout(async () => {
      const page = await this.pdfDocument!.getPage(pageNumber);
      await this.renderPage(page);
      const textContent = await page.getTextContent();
      console.log(textContent);
      const paragraphs = getParagraphs2(textContent);
      console.log(paragraphs);

      const dpr = window.devicePixelRatio || 1;
      const inv_resolution_factor = 1 / this.resolution_factor;
      const viewport = page.getViewport({ scale: this.scale * dpr * inv_resolution_factor });
      if (this.svgElement) this.svgElement.remove();
      this.svgElement = this.buildSVG(viewport, textContent) as SVGElement;
      this.svgElement.style.zIndex = "1";
      this.svgElement.style.fill = "transparent";
      document.getElementById("page-container")!.append(this.svgElement);
    }, 10);
  }

  private renderPage(page: PDFPageProxy) {
    const dpr = window.devicePixelRatio || 1;
    const yScale = document.body.getBoundingClientRect().height / page.getViewport({ scale: 1 }).height / dpr;
    const xScale = document.body.getBoundingClientRect().width / page.getViewport({ scale: 1 }).width / dpr;
    const inv_resolution_factor = 1 / this.resolution_factor;
    this.scale = this.resolution_factor * Math.min(xScale, yScale);
    const viewport = page.getViewport({ scale: this.scale });

    // Support HiDPI-screens.
    const outputScale = window.devicePixelRatio || 1;

    const { nativeElement: canvas } = this.canvasRef;
    const context = canvas.getContext('2d');
    context!.imageSmoothingQuality = 'high';

    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.margin = "auto";
    canvas.style.width = canvas.width * inv_resolution_factor + 'px';

    const transform = [outputScale, 0, 0, outputScale, 0, 0];

    const renderContext = {
      canvasContext: context!,
      transform: transform!,
      viewport: viewport,
    };
    page.render(renderContext);
  }

  private buildSVG(viewport: PageViewport, textContent: TextContent) {
    const dpr = window.devicePixelRatio || 1;
    // Building SVG with size of the viewport (for simplicity)
    const svg = document.createElementNS(this.SVG_NS, "svg:svg");
    svg.setAttribute("width", `${viewport.width}px`);
    svg.setAttribute("height", `${viewport.height}px`);

    // items are transformed to have 1px font size
    svg.setAttribute("font-size", "1");

    // processing all items
    textContent.items.forEach((textItem: TextItem | TextMarkedContent) => {
      if (!isTextItem(textItem) || textItem.transform[0] === 0) return;
      // we have to take in account viewport transform, which includes scale,
      // rotation and Y-axis flip, and not forgetting to flip text.
      const tx = pdfjsLib.Util.transform(
        pdfjsLib.Util.transform(viewport.transform, textItem.transform),
        [1, 0, 0, -1, 0, 0]
      );
      const style = textContent.styles[textItem.fontName];

      // adding text element
      const text = document.createElementNS(this.SVG_NS, "svg:text");
      text.setAttribute("transform", "matrix(" + tx.join(" ") + ")");
      text.setAttribute("font-family", style.fontFamily);
      text.textContent = textItem.str;
      svg.append(text);

      const transform = textItem.transform;
      const x = transform[4];
      const y = transform[5];
      const width = textItem.width;
      const height = textItem.height;
      const inv_resolution_factor = 1 / this.resolution_factor;
      const scale = this.scale * dpr * inv_resolution_factor;
      const m = [x * scale, this.canvasRef.nativeElement.height - ((y + height) * scale), width * scale, height * scale];

      const ctx = this.canvasRef.nativeElement.getContext("2d")!;
      ctx.strokeRect(x * scale, this.canvasRef.nativeElement.height - ((y + height) * scale), width * scale, height * scale);

      const box = document.createElementNS(this.SVG_NS, "svg:rect");
      box.setAttribute("fill", "none");
      box.setAttribute("width", `${width * scale}`);
      box.setAttribute("height", `${height * scale}`);
      box.setAttribute("x", `${x * scale}`);
      box.setAttribute("y", `${Math.floor(viewport.height) - ((y + height) * scale)}`);
      // (box as SVGRectElement).style.outline = "1px solid red";
      (box as SVGRectElement).style.cursor = "pointer";
      (box as SVGRectElement).style.pointerEvents = "all";

      svg.append(box);

      setTimeout(() => {
        const clientRect = text.getBoundingClientRect();
        const currentWidth = clientRect.width;
        const currentHeight = clientRect.height;
        const targetWidth = textItem.width * scale;
        const targetHeight = textItem.height * scale;
        const alpha = 1;
        let scaleX = (targetWidth / currentWidth) * alpha + (1 - alpha);
        let scaleY = (targetHeight / currentHeight) * alpha + (1 - alpha);
        if (!scaleX || !scaleY || !isFinite(scaleX) || !isFinite(scaleY)) return;
        if (currentHeight > currentWidth && textItem.str.length > 3) {
          console.log(textItem);
          box.setAttribute("y", `${x * scale}`);
          box.setAttribute("x", `${Math.floor(viewport.height) - ((y + height) * scale)}`);
          return;
        }
        const scaledTransform = [tx[0] * scaleX, tx[1] * scaleY, tx[2], tx[3], tx[4], tx[5]];
        text.setAttribute("transform", "matrix(" + scaledTransform.join(" ") + ")");
      }, 100);
    });
    return svg;
  }

  private readFile(file: File) {
    return new Promise<Uint8Array>((resolve, reject) => {
      const fileReader = new FileReader();
      fileReader.onload = () => resolve(new Uint8Array(fileReader.result as ArrayBuffer));
      fileReader.onerror = reject;
      fileReader.readAsArrayBuffer(file);
    });
  }

}
