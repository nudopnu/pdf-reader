import { TextItem } from "pdfjs-dist/types/src/display/api";


export class Paragraph {

    fullText: string = "";
    textItems: TextItem[] = [];

    constructor(
        textItems?: TextItem[]
    ) {
        if (!textItems) return;
        this.append(textItems);
    }

    append(textItems: TextItem[]) {
        for (let i = 0; i < textItems.length; i++) {
            const textItem = textItems[i];
            this.add(textItem);
        }
    }

    add(textItem: TextItem) {
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
}
