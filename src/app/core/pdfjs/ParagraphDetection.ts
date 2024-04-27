import { PDFDocumentProxy } from "pdfjs-dist";
import { TextContent, TextItem } from "pdfjs-dist/types/src/display/api";
import { Paragraph } from "./Paragraph";
import { OPS, isTextItem } from "./Utils";

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
        // const page = await document.getPage(i);
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