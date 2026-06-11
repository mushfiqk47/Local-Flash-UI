/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

export const extractBase64 = (dataUrl: string) => {
    const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
    if (matches?.length !== 3) return null;
    return { mimeType: matches[1], data: matches[2] };
};

export const sanitizeFilename = (text: string) => 
    text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').substring(0, 40);

export async function* parseJsonStream(responseStream: AsyncGenerator<{ text: string }>) {
    let buffer = '';
    for await (const chunk of responseStream) {
        const text = chunk.text;
        if (typeof text !== 'string') continue;
        buffer += text;
        let braceCount = 0;
        let start = buffer.indexOf('{');
        while (start !== -1) {
            braceCount = 0;
            let end = -1;
            for (let i = start; i < buffer.length; i++) {
                if (buffer[i] === '{') braceCount++;
                else if (buffer[i] === '}') braceCount--;
                if (braceCount === 0 && i > start) {
                    end = i;
                    break;
                }
            }
            if (end !== -1) {
                const jsonString = buffer.substring(start, end + 1);
                try {
                    yield JSON.parse(jsonString);
                    buffer = buffer.substring(end + 1);
                    start = buffer.indexOf('{');
                } catch (e) {
                    start = buffer.indexOf('{', start + 1);
                }
            } else {
                break; 
            }
        }
    }
}