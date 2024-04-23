import { TextItem, TextMarkedContent } from "pdfjs-dist/types/src/display/api";

export function isTextItem(textItem: TextItem | TextMarkedContent): textItem is TextItem {
    return Object.hasOwn(textItem, 'transform');
};
