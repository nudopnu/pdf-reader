import { PDFDocumentProxy } from "pdfjs-dist";
import { TextItem } from "pdfjs-dist/types/src/display/api";
import { Line } from "./Line";
import { Paragraph } from "./Paragraph";
import { isTextItem } from "./Utils";

export function getParagraphs2(textItems: TextItem[], preFilter: (textItem: TextItem) => boolean): Paragraph[] {

    // Detect lines first
    const lines = [] as Line[];
    let currentLine: Line = new Line();
    let previousItem: TextItem | undefined;
    for (let i = 0; i < textItems.length; i++) {
        const currentItem = textItems[i];

        if (currentItem.str.trim() === "" || !preFilter(currentItem)) continue;
        if (previousItem) {
            const deltaY = Math.abs(previousItem.transform[5] - currentItem.transform[5]);
            const areOnSameLine = deltaY <= 5;
            if (areOnSameLine) {
                currentLine.add(currentItem);
            } else {
                lines.push(currentLine);
                currentLine = new Line([currentItem]);
            }
        } else {
            currentLine.add(currentItem);
        }
        previousItem = currentItem;
    }
    lines.push(currentLine);

    // Group lines into paragraphs
    const paragraphs = [] as Paragraph[];
    let currentParagraph: Paragraph = new Paragraph();
    let previousLine: Line | undefined;

    for (let i = 0; i < lines.length; i++) {
        const currentLine = lines[i];
        if (previousLine) {
            const distanceToPreviousLine = Math.abs(previousLine.bbox!.y - currentLine.bbox!.y);
            const widthFactor = previousLine.bbox!.width / currentLine.bbox!.width;
            if (distanceToPreviousLine <= 1.5 * currentLine.bbox!.height && widthFactor > 0.8) {
                // Combine hyphenated words, otherwise append with space
                if (currentParagraph.endsWith('-')) {
                    currentParagraph.updateText(fullText => fullText.slice(0, fullText.length - 1));
                } else if (!currentParagraph.isEmpty()) {
                    currentParagraph.updateText(fullText => fullText + " ");
                }
                currentParagraph.add(currentLine);
            } else {
                paragraphs.push(currentParagraph);
                currentParagraph = new Paragraph(currentLine);
            }
        } else {
            currentParagraph.add(currentLine);
        }
        previousLine = currentLine;
    }
    paragraphs.push(currentParagraph);

    return paragraphs;
}

// export async function getPrefilter(document: PDFDocumentProxy) {
//     const limit = Math.min(document.numPages, 10);
//     const allTextItems = [] as TextItem[];
//     const coordMap = new Map<string, number[]>();

//     let id = 0;
//     for (let i = 1; i < limit; i++) {
//         const page = await document.getPage(i);
//         const textContent = await page.getTextContent();
//         const items = textContent.items.filter(item => isTextItem(item)) as TextItem[];
//         for (let j = 0; j < items.length; j++) {
//             const item = items[j];
//             if (!isTextItem(item) || item.str.trim() === "" || item.transform[0] === 0) continue;
//             if (/^[0-9]+$/.test(item.str.trim())) {
//                 allTextItems.push(item)
//             }
//         }
//     }
//     console.log(allTextItems.map(i => [i.str, i.transform[5]]));


//     return (textItem: TextItem) => true;
// }
export async function getPreFilter(document: PDFDocumentProxy) {
    const limit = Math.min(document.numPages, 10);
    const allTextItems = [] as TextItem[];
    const allPageNumberItems = new Map<string, TextItem[]>();
    const coordMap = new Map<string, number[]>();
    let maxY = 0;

    let id = 0;
    for (let i = 1; i < limit; i++) {
        const page = await document.getPage(i + Math.round(document.numPages / 4));
        const textContent = await page.getTextContent();
        const items = textContent.items.filter(item => isTextItem(item)) as TextItem[];

        for (let j = 0; j < items.length; j++) {
            const item = items[j];
            if (!isTextItem(item) || item.str.trim() === "" || item.transform[0] === 0) continue;
            if (/^([0-9]+)$/.test(item.str.trim())) {
                const key = Math.round(item.transform[5]) + "";
                if (!allPageNumberItems.has(key)) {
                    allPageNumberItems.set(key, [item]);
                } else {
                    const oldValue = allPageNumberItems.get(key)!;
                    allPageNumberItems.set(key, [...oldValue, item]);
                }
            }
            allTextItems.push(item);
            let { width, height, transform } = item;
            let [scaleX, skewX, skewY, scaleY, x, y] = transform;
            if (y > maxY) maxY = y;
            [x, y, width, height] = [x, y, width, height].map(x => Math.round(Math.round(x * 100) / 10000));
            const key = Math.round(Math.round(item.height * 100) / 100) + "";
            if (coordMap.has(key)) {
                coordMap.set(key, [...coordMap.get(key)!, id++]);
            } else {
                coordMap.set(key, [id++]);
            }

        }
    }


    // console.log(allPageNumberItems);
    let pageNumberItems = [...allPageNumberItems.entries()].sort((a, b) => b[1].length - a[0].length);
    pageNumberItems = pageNumberItems.filter(([a, b]) => b.length > 5)

    if (pageNumberItems.length > 0) {
        const limit = parseInt(pageNumberItems[0][0]);
        // return (textItem: TextItem) => Math.round(Math.round(textItem.transform[5] * 100) / 100) !== limit;
        if (limit < maxY / 2) {
            return (textItem: TextItem) => Math.round(Math.round(textItem.transform[5] * 100) / 100) > limit;
        } else {
            return (textItem: TextItem) => Math.round(Math.round(textItem.transform[5] * 100) / 100) < limit;
        }
    }
    return (textItem: TextItem) => true;

    // return (textItem: TextItem) => Math.round(Math.round(textItem.height * 100) / 100) == mostOccuringHeight;
}