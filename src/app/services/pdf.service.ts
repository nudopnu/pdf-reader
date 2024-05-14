import { Injectable } from '@angular/core';
import { Book } from './persistence.service';
import { hashBytes } from '../core/Utils';
import { PDFDocumentProxy, PageViewport } from 'pdfjs-dist';
import { TextContent, TextItem, TextMarkedContent } from 'pdfjs-dist/types/src/display/api';
import { BBox } from '../core/pdfjs/Bbox';
import { isTextItem } from '../core/pdfjs/Utils';
import { getPreFilter } from '../core/pdfjs/ParagraphDetection';

declare const pdfjsLib: any;

@Injectable({
  providedIn: 'root'
})
export class PdfService {

  SVG_NS = "http://www.w3.org/2000/svg";
  pdfDocument: PDFDocumentProxy | undefined;
  textItemToBBox = new Map<TextItem, BBox & { rect: SVGRectElement }>();

  prefilter: ((textItem: TextItem) => boolean) | undefined;

  constructor() {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdfjs/pdf.worker.min.mjs';
  }

  async loadBook(book: Book) {
    const pdfBytes = book.file;
    this.pdfDocument = (await pdfjsLib.getDocument(pdfBytes).promise) as PDFDocumentProxy;
    this.prefilter = await getPreFilter(this.pdfDocument);
    return this.pdfDocument;
  }

  async createBookFromFile(file: File) {
    const pdfBytes = await this.readFile(file);
    const hash = await hashBytes(pdfBytes);
    const pdfDocument = (await pdfjsLib.getDocument(pdfBytes).promise) as PDFDocumentProxy;
    this.prefilter = await getPreFilter(pdfDocument);
    const metadata = await pdfDocument.getMetadata();
    const title = (metadata.info as any).Title || file.name;
    this.pdfDocument = pdfDocument;
    return {
      hash,
      numPages: pdfDocument.numPages,
      file: (await pdfDocument.getData()),
      title: title,
    } as Book;
  }

  private readFile(file: File) {
    return new Promise<Uint8Array>((resolve, reject) => {
      const fileReader = new FileReader();
      fileReader.onload = () => resolve(new Uint8Array(fileReader.result as ArrayBuffer));
      fileReader.onerror = reject;
      fileReader.readAsArrayBuffer(file);
    });
  }

  async renderPage(canvas: HTMLCanvasElement, pageNumber: number, resolutionFactor: number) {
    if (!this.pdfDocument) throw new Error("No document loaded");
    const page = await this.pdfDocument.getPage(pageNumber);
    const dpr = window.devicePixelRatio || 1;
    const unscaledViewport = page.getViewport({ scale: 1 });
    const yScale = document.body.getBoundingClientRect().height / unscaledViewport.height / dpr;
    const xScale = document.body.getBoundingClientRect().width / unscaledViewport.width / dpr;
    const inv_resolutionFactor = 1 / resolutionFactor;
    const scale = resolutionFactor * Math.min(xScale, yScale);
    const viewport = page.getViewport({ scale });

    // Support HiDPI-screens.
    const outputScale = window.devicePixelRatio || 1;

    const context = canvas.getContext('2d');
    context!.imageSmoothingQuality = 'high';

    canvas.width = viewport.width * outputScale;
    canvas.height = viewport.height * outputScale;
    canvas.style.margin = "auto";
    canvas.style.width = canvas.width * inv_resolutionFactor + 'px';
    canvas.style.height = 'unset';

    const transform = [outputScale, 0, 0, outputScale, 0, 0];

    const renderContext = {
      canvasContext: context!,
      transform: transform!,
      viewport: viewport,
    };
    page.render(renderContext);
    return { scale, page };
  }

  buildSVG(viewport: PageViewport, textContent: TextContent, resolution_factor: number, tscale: number) {
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
      const inv_resolution_factor = 1 / resolution_factor;
      const scale = tscale * dpr * inv_resolution_factor;

      let bbox = {
        height: height * scale,
        width: width * scale,
        x: x * scale,
        y: viewport.height - ((y + height) * scale),
      };
      const isVertical = textItem.transform[0] === 0;
      if (isVertical) {
        bbox = this.flipBBox(bbox);
      }
      const rect = this.createRect(bbox);
      rect.setAttribute("fill", "none");
      if ((this.prefilter && this.prefilter(textItem))) {
        // rect.style.outline = "1px solid red";
      }
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
        }
        const scaledTransform = [tx[0] * scaleX, tx[1] * scaleY, tx[2], tx[3], tx[4], tx[5]];
        text.setAttribute("transform", "matrix(" + scaledTransform.join(" ") + ")");
      }, 100);
    });
    return svg;
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
