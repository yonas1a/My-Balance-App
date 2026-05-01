import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import AnimatedSplash from '../components/AnimatedSplash';

// Keep native splash visible until we're ready
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(false);

  const [fontsLoaded] = useFonts({
    // add your custom fonts here if any, else leave empty
  });

  useEffect(() => {
    async function prepare() {
      // Do any async prep here (fonts, assets, etc.)
      // Once ready, hide native splash and show our animated one
      await SplashScreen.hideAsync();
      setShowAnimatedSplash(true);
    }
    prepare();
  }, []);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="light" />
      {showAnimatedSplash && (
        <AnimatedSplash onFinished={() => setShowAnimatedSplash(false)} />
      )}
    </>
  );
}