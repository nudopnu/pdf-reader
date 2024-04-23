import { TextContent, TextItem } from "pdfjs-dist/types/src/display/api";
import { isTextItem } from "./Utils";

export class Paragraph {

    fullText: string = "";
    textItems: TextItem[] = [];

    constructor(
        textItem?: TextItem,
    ) {
        if (!textItem) return;
        this.append(textItem);
    }

    append(textItem: TextItem) {
        this.fullText += textItem.str;
        this.textItems.push(textItem);
    }

    isEmpty() {
        return this.fullText === "";
    }

    endsWith(searchString: string, endPosition?: number | undefined) {
        return this.fullText.endsWith(searchString, endPosition);
    }

    matches(regex: RegExp) {
        return regex.test(this.fullText);
    }

    updateText(update: (fullText: string) => string) {
        this.fullText = update(this.fullText);
    }

    trim() {
        this.fullText.trim();
    }
};

export function getParagraphs2(data: TextContent): Paragraph[] {
    const paragraphs = [] as Paragraph[];
    let currentParagraph = new Paragraph();
    let previousItem: TextItem;

    data.items.forEach(item => {
        if (!isTextItem(item) || item.str.trim() === "") return;
        const itemText = item.str;
        const isEndOfLine = item.hasEOL;

        // Improved heuristic to determine if consecutive lines should be combined
        if (previousItem) {
            const verticalDistance = Math.abs(item.transform[5] - previousItem.transform[5]) - previousItem.height;
            const fontSizeCurrent = item.height;
            const fontSizePrevious = previousItem.height;

            // Combining lines if they are close vertically and the font size does not change significantly
            const fontSizeDifference = Math.abs(fontSizeCurrent - fontSizePrevious);
            const linesAreClose = verticalDistance < previousItem.height;
            if (linesAreClose && fontSizeDifference < 1) {
                // Combine hyphenated words
                if (currentParagraph.endsWith('-')) {
                    currentParagraph.updateText(fullText => fullText.slice(0, fullText.length - 1));
                } else if (!currentParagraph.isEmpty()) {
                    currentParagraph.updateText(fullText => fullText + " ");
                }
                currentParagraph.append(item);
            } else {
                currentParagraph.trim();
                if (!currentParagraph.isEmpty()) {
                    paragraphs.push(currentParagraph);
                }
                currentParagraph = new Paragraph(item);
            }
        } else {
            currentParagraph = new Paragraph(item);
        }

        previousItem = item;

        // At end of line, decide if it's a headline
        if (isEndOfLine && currentParagraph) {
            if (itemText.split(' ').length < 5) {
                currentParagraph.trim();
                paragraphs.push(currentParagraph);
                currentParagraph = new Paragraph();
            }
        }
    });

    if (currentParagraph && !currentParagraph.isEmpty()) {  // Append the last paragraph if any
        currentParagraph.trim();
        paragraphs.push(currentParagraph);
    }

    return paragraphs;
}