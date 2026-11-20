/**
 * Capacitor Configuration
 *
 * Scaffolds native mobile deployment for Android & iOS while sharing the PWA web build.
 *
 * Future Mobile Native Activation Steps:
 * 1. npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
 * 2. npm run build
 * 3. npx cap add android (or ios)
 * 4. npx cap open android
 */

export interface CapacitorConfig {
  appId: string;
  appName: string;
  webDir: string;
  bundledWebRuntime?: boolean;
  server?: {
    androidScheme?: string;
    cleartext?: boolean;
    url?: string;
  };
  plugins?: Record<string, Record<string, unknown>>;
}

const config: CapacitorConfig = {
  appId: "com.aistudio.mobile",
  appName: "Helm",
  webDir: "dist",
  bundledWebRuntime: false,
  server: {
    androidScheme: "https",
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#131314",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#131314",
    },
  },
};

export default config;
