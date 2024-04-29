export interface BBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

export function doOverlap(a: BBox, b: BBox) {
    const xOverlap = a.x + a.width >= b.x || b.x + b.width >= a.x;
    const yOverlap = a.y + a.height >= b.y || b.y + b.height >= a.y;
    return xOverlap && yOverlap;
}