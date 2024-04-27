import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { PDFDocumentProxy, PDFPageProxy, PageViewport, updateTextLayer } from 'pdfjs-dist';
import { TextContent, TextItem, TextMarkedContent } from 'pdfjs-dist/types/src/display/api';
import { getParagraphs2, getPreFilter } from '../../core/pdfjs/ParagraphDetection';
import { OPS, isTextItem } from '../../core/pdfjs/Utils';
import { Book, PersistenceService } from '../../services/persistence.service';
import { toObservable } from "@angular/core/rxjs-interop";
import { filter } from 'rxjs';
import { debounced, hashBytes } from '../../core/Utils';
import { TextToSpeechService } from '../../services/text-to-speech.service';
import { Paragraph } from '../../core/pdfjs/Paragraph';

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

  book?: Book | undefined;
  pdfDocument?: PDFDocumentProxy;
  textItemToBBox = new Map<TextItem, { x: number, y: number, width: number, height: number, rect: SVGRectElement }>();
  debounceTimeout?: NodeJS.Timeout;
  currentPage = 1;
  SVG_NS = "http://www.w3.org/2000/svg";
  svgElement?: SVGElement;
  debouncedPageupdate: (...args: any[]) => void;
  prefilter: ((textItem: TextItem) => boolean) | undefined;
  paragraphs: Paragraph[] = [];

  constructor(
    private persistenceService: PersistenceService,
    private tts: TextToSpeechService,
  ) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdfjs/pdf.worker.min.mjs';
    toObservable(persistenceService.books).pipe(
      filter(books => books.length > 0)
    ).subscribe(async (books) => {
      this.book = books[0];
      const { currentPage, currentTextItem } = await persistenceService.getProgress(this.book.hash);
      this.documentFromBytes(this.book.file, this.book.title, currentPage);
      this.setPage(currentPage);
    });

    this.debouncedPageupdate = debounced((book: Book, newPageNumber: number) => {
      persistenceService.updateProgress({ bookHash: book.hash, currentPage: newPageNumber, currentTextItem: 0 });
    }, 1000);
  }

  async setProgress(currentPage: number, currentTextItem: number, start = false) {
    if (currentTextItem === this.paragraphs.length) {
      currentPage++;
      currentTextItem = 0;
      await this.setPage(currentPage);
    }
    await this.persistenceService.updateProgress({ bookHash: this.book!.hash, currentPage, currentTextItem });
    let i = 0;
    for (; i <= currentTextItem; i++) {
      const paragraph = this.paragraphs[i];
      paragraph.textItems.forEach(textItem => {
        const { rect } = this.textItemToBBox.get(textItem)!;
        rect.style.fill = "rgb(42 185 213 / 10%)";
      });
      if (i == currentTextItem && start) {
        const paragraph = this.paragraphs[i];
        this.tts.speak(paragraph.fullText, () => this.setProgress(currentPage, currentTextItem + 1, true));
      }
    }
  }

  async onFileInputChange(event: Event) {
    const fileList = (event.target! as HTMLInputElement).files;
    if (!fileList) return;
    const file = fileList[0];
    if (!file) return;
    await this.onFileReceived(file);
  }

  async onFileReceived(file: File) {
    const pdfBytes = await this.readFile(file);
    this.book = await this.documentFromBytes(pdfBytes, file.name);
    this.persistenceService.addBook(this.book);
    this.setPage(1);
  }

  private async documentFromBytes(pdfBytes: Uint8Array, filename: string, currentPage = 1) {
    const hash = await hashBytes(pdfBytes);
    const pdfDocument = (await pdfjsLib.getDocument(pdfBytes).promise) as PDFDocumentProxy;
    const metadata = await pdfDocument.getMetadata();
    const title = (metadata.info as any).Title || filename;
    const book = {
      hash,
      numPages: pdfDocument.numPages,
      file: (await pdfDocument.getData()),
      title: title,
    } as Book;
    this.updateSlider(pdfDocument.numPages, currentPage);
    this.pdfDocument = pdfDocument;
    this.prefilter = await getPreFilter(this.pdfDocument!);
    return book;
  }

  private updateSlider(numPages: number, value = 1) {
    this.sliderRef!.nativeElement.setAttribute('max', `${numPages}`);
    this.sliderRef!.nativeElement.setAttribute('min', "1");
    this.sliderRef!.nativeElement.setAttribute('value', `${value}`);
  }

  async onSliderChange(event: Event) {
    const pageNumber = parseInt((event.target! as HTMLInputElement).value);
    this.setPage(pageNumber);
  }

  private setPage(pageNumber: number) {
    if (this.debounceTimeout) clearTimeout(this.debounceTimeout);
    this.debounceTimeout = setTimeout(async () => {
      this.debouncedPageupdate(this.book, pageNumber);
      this.currentPage = pageNumber;
      this.textItemToBBox.clear();
      const page = await this.pdfDocument!.getPage(pageNumber);
      await this.renderPage(page);

      const textContent = await page.getTextContent();
      this.paragraphs = getParagraphs2(textContent, this.prefilter!);

      const dpr = window.devicePixelRatio || 1;
      const inv_resolution_factor = 1 / this.resolution_factor;
      const viewport = page.getViewport({ scale: this.scale * dpr * inv_resolution_factor });
      if (this.svgElement) this.svgElement.remove();
      this.svgElement = this.buildSVG(viewport, textContent) as SVGElement;

      this.paragraphs.forEach((paragraph, idx) => {
        paragraph.textItems.forEach(textItem => {
          const { rect } = this.textItemToBBox.get(textItem)!;
          rect.addEventListener('click', () => {
            this.setProgress(this.currentPage, idx, true);
          })
        });
      })

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

    canvas.width = viewport.width * outputScale;
    canvas.height = viewport.height * outputScale;
    canvas.style.margin = "auto";
    canvas.style.width = canvas.width * inv_resolution_factor + 'px';
    canvas.style.height = 'unset';

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
