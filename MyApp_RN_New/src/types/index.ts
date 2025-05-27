// src/types/index.ts
import { NavigationProp, RouteProp } from '@react-navigation/native';

// Auth context type definitions
export type UserInfo = {
  id: string;
  email: string;
  name?: string;
  photo?: string;
};

export type AuthContextType = {
  user: UserInfo | null;
  isLoading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

// App context type definitions
export type AppContextType = {
  refreshFunction: (() => void) | null;
  setRefreshFunction: React.Dispatch<React.SetStateAction<(() => void) | null>>;
  triggerRefresh: () => void;
};

// Toast context type definitions
export type ToastContextType = { 
  show: (message: string, type?: string) => void;
};

export type ToastProps = { 
  visible: boolean; 
  message: string; 
  type?: string; 
  onDismiss: () => void; 
};

export type ToastProviderProps = { 
  children: React.ReactNode; 
};

// App data types
export type AppItem = { 
  id: string; 
  name: string; 
  icon: string; 
};

export type Review = { 
  date: string; 
  rawDate: Date;
  score: number; 
  content: string; 
  username: string; 
};

// Navigation types
export type RootStackParamList = {
  Login: undefined;
  AppList: {
    refreshTrigger?: number;
    extractedPackageId?: string;
    extractedAppName?: string;
    extractedAppIcon?: string;
    searchQuery?: string;
  };
  Help: undefined;
  Review: { appId: string; appName: string; appIcon: string; };
  AISummary: { appId: string; appName: string; sampledReviews?: any[]; };
  SamplingDemo: undefined;
};

export type LoginScreenProps = {
  navigation: NavigationProp<RootStackParamList, 'Login'>;
};

export type AppListScreenProps = {
  navigation: NavigationProp<RootStackParamList, 'AppList'>;
  route: RouteProp<RootStackParamList, 'AppList'>;
};

export type HelpScreenProps = {
  navigation: NavigationProp<RootStackParamList, 'Help'>;
};

export type ReviewScreenProps = {
  route: RouteProp<RootStackParamList, 'Review'>;
  navigation: NavigationProp<RootStackParamList>;
};

export type AISummaryScreenProps = {
  route: RouteProp<RootStackParamList, 'AISummary'>;
  navigation: NavigationProp<RootStackParamList, 'AISummary'>;
};

export type SamplingDemoScreenProps = {
  navigation: NavigationProp<RootStackParamList, 'SamplingDemo'>;
};