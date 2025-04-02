declare module 'react-native-cheerio' {
    export function load(html: string): CheerioAPI;

    interface CheerioAPI {
        (selector: string): Cheerio;
        attr(name: string): string | undefined;
        text(): string;
    }

    interface Cheerio {
        attr(name: string): string | undefined;
        text(): string;
    }
} 