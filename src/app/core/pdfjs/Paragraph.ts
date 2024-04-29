import { TextItem } from "pdfjs-dist/types/src/display/api";
import { BBox } from "./Bbox";
import { Line } from "./Line";


export class Paragraph {

    fullText: string = "";
    lines: Line[] = [];
    textItems: TextItem[] = [];
    bbox: BBox | undefined;

    constructor(
        line?: Line
    ) {
        if (!line) return;
        this.add(line);
    }

    add(line: Line) {
        if (!line.bbox) return;
        this.fullText += line.textItems.map(textItem => textItem.str).join(" ");
        this.lines.push(line);
        if (!this.bbox) {
            this.bbox = line.bbox;
        } else {
            const { x, y, width, height } = line.bbox;
            let currentRight = this.bbox.x + this.bbox.width;
            let currentBottom = this.bbox.y + this.bbox.height;
            let right = x + width;
            let bottom = y + height;

            this.bbox.x = Math.min(x, this.bbox.x);
            this.bbox.y = Math.max(y, this.bbox.y);
            this.bbox.width = Math.max(currentRight, right) - this.bbox.x;
            this.bbox.height = Math.min(currentBottom, bottom) - this.bbox.y;
        }
        this.textItems = this.textItems.concat(line.textItems);
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
