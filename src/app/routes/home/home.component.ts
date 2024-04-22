import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { PDFDocumentProxy, PDFPageProxy, PageViewport } from 'pdfjs-dist';
import { TextContent, TextItem, TextMarkedContent } from 'pdfjs-dist/types/src/display/api';

declare const pdfjsLib: any;

function isTextItem(textItem: TextItem | TextMarkedContent): textItem is TextItem {
  return Object.hasOwn(textItem, 'transform');
};

@Component({
  selector: 'pdf-home',
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {

  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('slider') sliderRef!: ElementRef<HTMLInputElement>;
  @Input() scale = 1;
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
    const pdfBytes = await this.readFile(file);

    await this.setPdfDocument(pdfBytes);
  }

  private async setPdfDocument(pdfBytes: unknown) {
    this.pdfDocument = await pdfjsLib.getDocument(pdfBytes).promise;
    this.sliderRef!.nativeElement.setAttribute('max', `${this.pdfDocument!.numPages}`);
    this.sliderRef!.nativeElement.setAttribute('min', "1");
    this.sliderRef!.nativeElement.setAttribute('value', "1");
    this.setPage(1);
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
      const textcontent = this.getReadableText2(textContent);
      console.log(textcontent);

      const viewport = page.getViewport({ scale: this.scale });
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
    this.scale = Math.min(xScale, yScale);
    // alert(this.scale)
    // const viewport = page.getViewport({ scale: this.scale });
    // Set the scale based on the window's inner height and the device pixel ratio
    // this.scale = (window.innerHeight * window.devicePixelRatio) / page.getViewport({ scale: 1 }).height;
    // const viewport = page.getViewport({ scale: this.scale });
    const viewport = page.getViewport({ scale: this.scale });

    // Support HiDPI-screens.
    const outputScale = window.devicePixelRatio || 1;

    const { nativeElement: canvas } = this.canvasRef;
    const context = canvas.getContext('2d');
    context!.imageSmoothingQuality = 'high';

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

  private getReadableText(textContent: TextContent) {

    // Initialize Markdown formatted text
    let improvedMarkdownText = "";

    // Variables to help with formatting
    let currentParagraph = "";
    let lastWasHeader = false;

    // Process each item in the items list
    textContent.items.forEach(item => {
      if (!isTextItem(item)) return;
      let text = item.str.trim();
      let fontName = item.fontName;
      let hasEOL = item.hasEOL;

      // Determine if the current text is a headline
      let isHeader = (fontName === 'g_d0_f5' || text.includes("Chapter") || text.includes("Section") || text.includes("Key Concepts"));

      // Handle headline formatting
      if (isHeader && text) {
        // If there is an existing paragraph, add it before the header
        if (currentParagraph) {
          improvedMarkdownText += currentParagraph + "\n\n";
          currentParagraph = "";
        }
        // Clean up the header to remove unwanted characters and format
        let cleanedHeader = text.replace("� ", "");  // Remove unwanted symbols
        // Format the header and add to markdown
        improvedMarkdownText += `${cleanedHeader}\n\n`;
        lastWasHeader = true;
      } else {
        // Continue building the paragraph
        if (currentParagraph) {
          // Add a space if it's a continuation of a paragraph
          currentParagraph += lastWasHeader ? text : " " + text;
        } else {
          currentParagraph = text;
        }
        lastWasHeader = false;

        // Add paragraph to markdown if end of line is reached
        if (hasEOL && currentParagraph) {
          improvedMarkdownText += currentParagraph + "\n";
          currentParagraph = "";
        }
      }
    });

    // Check if there's any remaining paragraph to add
    if (currentParagraph) {
      improvedMarkdownText += currentParagraph + "\n\n";
    }

    // Output the improved Markdown text
    console.log(improvedMarkdownText.trim()); // Strip any extra newlines at the end
  }

  getReadableText2(data: TextContent) {
    let textContent = [];
    let currentParagraph = "";
    let previousItem: TextItem;

    data.items.forEach(item => {
      if (!isTextItem(item)) return;
      const textStr = item.str;
      const isEndOfLine = item.hasEOL;

      // Improved heuristic to determine if consecutive lines should be combined
      if (previousItem) {
        const verticalDistance = Math.abs(item.transform[5] - previousItem.transform[5]) - previousItem.height;
        const fontSizeCurrent = item.transform[3];
        const fontSizePrevious = previousItem.transform[3];
        // Combining lines if they are close vertically and the font size does not change significantly
        const fontSizeDifference = Math.abs(fontSizeCurrent - fontSizePrevious);
        if (verticalDistance < previousItem.height && fontSizeDifference <= 2) {
          // Combine with a space if it seems like a continuation of a headline
          if (!currentParagraph.endsWith('-')) {
            if (currentParagraph !== "") {
              currentParagraph += " ";
            }
          } else {
            currentParagraph = currentParagraph.slice(0, currentParagraph.length - 1);
          }
          currentParagraph += textStr;
        } else {
          if (currentParagraph) {
            textContent.push(currentParagraph);
          }
          currentParagraph = textStr;
        }
      } else {
        currentParagraph = textStr;  // Initialize the first paragraph
      }

      previousItem = item;

      // At end of line, decide if it's a headline
      if (isEndOfLine && currentParagraph) {
        if (currentParagraph.endsWith('.') || item.str.split(' ').length < 5) {
          textContent.push(currentParagraph);
          currentParagraph = "";
        }
      }
    });

    if (currentParagraph) {  // Append the last paragraph if any
      textContent.push(currentParagraph);
    }

    return textContent;
  }

  private buildSVG(viewport: PageViewport, textContent: TextContent) {
    // Building SVG with size of the viewport (for simplicity)
    const svg = document.createElementNS(this.SVG_NS, "svg:svg");
    svg.setAttribute("width", viewport.width + "px");
    svg.setAttribute("height", viewport.height + "px");
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
    });
    return svg;
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
