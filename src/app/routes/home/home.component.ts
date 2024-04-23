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
  textItemToBBox = new Map<TextItem, { x: number, y: number, width: number, height: number, rect: SVGRectElement }>();
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
    this.setDocument(pdfDocument);
    this.setPage(1);
  }

  private setDocument(pdfDocument: PDFDocumentProxy) {
    pdfDocument.getMetadata().then(console.log);
    this.updateSlider(pdfDocument.numPages);
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
      this.textItemToBBox.clear();
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
    const svg = document.createElementNS(this.SVG_NS, "svg:svg") as SVGElement;
    svg.setAttribute("width", `${viewport.width}px`);
    svg.setAttribute("height", `${viewport.height}px`);
    svg.style.zIndex = "1";
    svg.style.fill = "transparent";

    // items are transformed to have 1px font size
    svg.setAttribute("font-size", "1");

    // processing all items
    textContent.items.forEach((textItem: TextItem | TextMarkedContent) => {
      if (!isTextItem(textItem)) return;
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

      const { width, height } = textItem;
      const [scaleX, skewX, skewY, scaleY, x, y] = textItem.transform;
      const inv_resolution_factor = 1 / this.resolution_factor;
      const scale = this.scale * dpr * inv_resolution_factor;

      let bbox = {
        height: height * scale,
        width: width * scale,
        x: x * scale,
        y: Math.floor(viewport.height) - ((y + height) * scale),
      };
      const isVertical = textItem.transform[0] === 0;
      if (isVertical) {
        bbox = this.flipBBox(bbox);
      }
      const rect = this.createRect(bbox);
      rect.setAttribute("fill", "none");
      // rect.style.outline = "1px solid red";
      rect.style.cursor = "pointer";
      rect.style.pointerEvents = "all";
      this.textItemToBBox.set(textItem, { ...bbox, rect });
      svg.append(rect);

      setTimeout(() => {
        const clientRect = text.getBoundingClientRect();
        const currentWidth = clientRect.width;
        const currentHeight = clientRect.height;
        const targetWidth = bbox.width;
        const targetHeight = bbox.height;
        let scaleX = (targetWidth / currentWidth);
        let scaleY = (targetHeight / currentHeight);
        if (!scaleX || !scaleY || !isFinite(scaleX) || !isFinite(scaleY)) return;
        if (isVertical) {
          console.log(textItem, rect);
          // rect.setAttribute("y", `${x * scale}`);
          // rect.setAttribute("x", `${Math.floor(viewport.height) - ((y + height) * scale)}`);
          // return;
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

  private flipBBox(bbox: { x: number, y: number, width: number, height: number }) {
    let { x, y, width, height } = bbox;
    y -= width - height;
    x -= height;
    const tmpHeight = height;
    height = width;
    width = tmpHeight;
    return { x, y, width, height };
  }

  private createRect(bbox: { x: number, y: number, width: number, height: number }) {
    const rect = document.createElementNS(this.SVG_NS, "svg:rect") as SVGRectElement;
    let { x, y, width, height } = bbox;
    rect.setAttribute("fill", "none");
    rect.setAttribute("width", `${width}`);
    rect.setAttribute("height", `${height}`);
    rect.setAttribute("x", `${x}`);
    rect.setAttribute("y", `${y}`);
    return rect;
  }

}
