// Fix for Google Sign-In library types
declare module '@react-native-google-signin/google-signin' {
    export interface User {
        id: string;
        name: string | null;
        email: string;
        photo: string | null;
        familyName: string | null;
        givenName: string | null;
    }

    export interface SignInSuccessResponse {
        user: User;
        idToken: string | null;
        serverAuthCode: string | null;
        scopes?: string[];
    }

    export type SignInResponse = SignInSuccessResponse;
} 