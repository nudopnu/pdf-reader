export const debounced = (callback: (...args: any[]) => any, time: number) => {
    let lastFunc: ReturnType<typeof setTimeout> | undefined;

    return (...args: any[]) => {
        if (lastFunc) {
            clearTimeout(lastFunc);
        }
        lastFunc = setTimeout(() => callback(...args), time);
    }
}

export async function hashBytes(data: Uint8Array) {
    console.log(crypto.subtle);
    
    const hashBytes = await crypto.subtle.digest('SHA-256', data);
    const binString = String.fromCodePoint(...Array.from(new Uint8Array(hashBytes)));
    return btoa(binString)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}