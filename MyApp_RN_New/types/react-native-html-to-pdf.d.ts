declare module 'react-native-html-to-pdf' {
    interface Options {
        html: string;
        fileName: string;
        directory: string;
    }

    interface Result {
        filePath: string;
    }

    export default {
        convert(options: Options): Promise<Result>;
    };
} 