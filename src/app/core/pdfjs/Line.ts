import { TextItem } from "pdfjs-dist/types/src/display/api";
import { BBox } from "./Bbox";

export class Line {

    bbox: BBox | undefined;
    textItems = [] as TextItem[];

    constructor(textItems?: TextItem[]) {
        if (textItems) {
            for (let i = 0; i < textItems.length; i++) {
                const textItem = textItems[i];
                this.add(textItem);
            }
        }
    }

    add(textItem: TextItem) {
        this.textItems.push(textItem);
        const x = textItem.transform[4];
        const y = textItem.transform[5];
        const { width, height } = textItem;
        if (!this.bbox) {
            this.bbox = { x, y, width, height };
        } else {
            let currentRight = this.bbox.x + this.bbox.width;
            let currentBottom = this.bbox.y + this.bbox.height;
            let right = x + width;
            let bottom = y + height;

            this.bbox.x = Math.min(this.bbox.x, x);
            this.bbox.y = Math.min(this.bbox.y, y);
            this.bbox.width = Math.max(currentRight, right) - this.bbox.x;
            this.bbox.height = Math.max(currentBottom, bottom) - this.bbox.y;
        }
    }
}