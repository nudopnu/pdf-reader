import { Component, ElementRef, Input, ViewChild, signal } from '@angular/core';
import { toObservable } from "@angular/core/rxjs-interop";
import { PDFPageProxy } from 'pdfjs-dist';
import { filter } from 'rxjs';
import { ControlsComponent } from '../../components/controls/controls.component';
import { SliderComponent } from '../../components/slider/slider.component';
import { debounced } from '../../core/Utils';
import { Paragraph } from '../../core/pdfjs/Paragraph';
import { getParagraphs2 } from '../../core/pdfjs/ParagraphDetection';
import { isTextItem } from '../../core/pdfjs/Utils';
import { PdfService } from '../../services/pdf.service';
import { Book, PersistenceService } from '../../services/persistence.service';
import { TextToSpeechService } from '../../services/text-to-speech.service';

@Component({
  selector: 'pdf-home',
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {

  @ViewChild(ControlsComponent) controls!: ControlsComponent;
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild(SliderComponent) sliderRef!: SliderComponent;
  scale = signal(1);
  @Input() resolution_factor = 2;

  book?: Book | undefined;
  currentPage = 1;
  paragraphs: Paragraph[] = [];

  debounceTimeout?: NodeJS.Timeout;
  svgElement?: SVGElement;
  debouncedPageupdate: (...args: any[]) => void;

  constructor(
    private persistenceService: PersistenceService,
    private tts: TextToSpeechService,
    private pdfService: PdfService,
  ) {
    this.subscribeToBooks();
    this.debouncedPageupdate = debounced((book: Book, newPageNumber: number) => {
      persistenceService.updateProgress({ bookHash: book.hash, currentPage: newPageNumber, currentTextItem: 0 });
    }, 1000);
  }

  onNextPageRequest() {
    this.setPageNumber(Math.min(this.book!.numPages, this.currentPage + 1));
  }

  onPreviousPageRequest() {
    this.setPageNumber(Math.max(1, this.currentPage - 1));
  }

  private updateSlider(numPages: number, value = 1) {
    this.sliderRef.max = numPages;
    this.sliderRef.min = 1;
    this.sliderRef.value = value;
  }

  async onSliderChange(newValue: number) {
    const pageNumber = newValue;
    this.setPageNumber(pageNumber);
  }

  async changeResolution(resolution: number) {
    this.resolution_factor = resolution;
    await this.pdfService.renderPage(this.canvasRef.nativeElement as HTMLCanvasElement, this.currentPage, this.resolution_factor);
  }

  async onFileInputChange(event: Event) {
    const fileList = (event.target! as HTMLInputElement).files;
    if (!fileList) return;
    const file = fileList[0];
    if (!file) return;
    await this.onFileReceived(file);
  }

  async onFileReceived(file: File) {
    this.book = await this.pdfService.createBookFromFile(file);
    await this.persistenceService.addBook(this.book);
    this.updateSlider(this.book.numPages, 1);

    const { scale, page } = await this.pdfService.renderPage(this.canvasRef.nativeElement as HTMLCanvasElement, 1, this.resolution_factor);
    this.scale.set(scale);

    this.svgElement = await this.createOverlay(page);
    document.getElementById("page-container")!.append(this.svgElement);
  }

  resetZoom() {
    this.controls.reset();
    this.changeResolution(2);
  }

  private subscribeToBooks() {
    toObservable(this.persistenceService.books).pipe(
      filter(books => books.length > 0)
    ).subscribe(async (books) => {
      this.book = books[0];
      const progress = await this.persistenceService.getProgress(this.book.hash);
      this.currentPage = progress.currentPage;
      await this.pdfService.loadBook(this.book);

      this.updateSlider(this.book.numPages, this.currentPage);

      if (this.svgElement) this.svgElement.remove();
      const { scale, page } = await this.pdfService.renderPage(this.canvasRef.nativeElement as HTMLCanvasElement, this.currentPage, this.resolution_factor);
      this.scale.set(scale);
      this.svgElement = await this.createOverlay(page);
      document.getElementById("page-container")!.append(this.svgElement);
    });
  }

  private async createOverlay(page: PDFPageProxy) {
    const textContent = await page.getTextContent();
    const textItems = textContent.items.filter(isTextItem);
    this.paragraphs = getParagraphs2(textItems, this.pdfService.prefilter!);

    const dpr = window.devicePixelRatio || 1;
    const inv_resolution_factor = 1 / this.resolution_factor;
    const viewport = page.getViewport({ scale: this.scale() * dpr * inv_resolution_factor });
    if (this.svgElement) this.svgElement.remove();
    this.svgElement = this.pdfService.buildSVG(viewport, textContent, this.resolution_factor, this.scale()) as SVGElement;

    this.paragraphs.forEach((paragraph, idx) => {
      // const randomColor = `rgba(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255}, 0.3)`;
      paragraph.textItems.forEach(textItem => {
        const { rect } = this.pdfService.textItemToBBox.get(textItem)!;
        // rect.style.fill = randomColor;
        rect.addEventListener('click', () => {
          this.setProgress(this.currentPage, idx, true);
          console.log(paragraph.bbox);
        });
      });
    });
    return this.svgElement;
  }

  async setProgress(currentPage: number, currentTextItem: number, start = false) {
    if (currentTextItem === this.paragraphs.length) {
      currentPage++;
      currentTextItem = 0;
      await this.setPage(currentPage, this.resolution_factor);
    }
    let i = 0;
    for (; i < this.paragraphs.length; i++) {
      const paragraph = this.paragraphs[i];
      if (i <= currentTextItem) {
        paragraph.textItems.forEach(textItem => {
          const { rect } = this.pdfService.textItemToBBox.get(textItem)!;
          rect.style.fill = "rgb(42 185 213 / 10%)";
        });
      } else {
        paragraph.textItems.forEach(textItem => {
          const { rect } = this.pdfService.textItemToBBox.get(textItem)!;
          rect.style.fill = "none";
        });
      }
      if (i == currentTextItem && start) {
        const paragraph = this.paragraphs[i];
        this.tts.speak(paragraph.fullText, () => this.setProgress(currentPage, currentTextItem + 1, true));
      }
    }
    await this.persistenceService.updateProgress({ bookHash: this.book!.hash, currentPage, currentTextItem });
  }

  private setPageNumber(page: number) {
    return this.setPage(page, this.resolution_factor);
  }

  private setPage(pageNumber: number, resolution_factor: number) {
    if (this.debounceTimeout) clearTimeout(this.debounceTimeout);
    this.debounceTimeout = setTimeout(async () => {

      if (this.svgElement) this.svgElement.remove();
      const { scale, page } = await this.pdfService.renderPage(this.canvasRef.nativeElement as HTMLCanvasElement, pageNumber, this.resolution_factor);
      this.scale.set(scale);
      this.svgElement = await this.createOverlay(page);
      document.getElementById("page-container")!.append(this.svgElement);

      this.currentPage = pageNumber;
      this.updateSlider(this.book!.numPages, this.currentPage);

    }, 10);
  }

}
