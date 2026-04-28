import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View, useColorScheme } from 'react-native';
import changeNavigationBarColor from 'react-native-navigation-bar-color';
import PagerView from 'react-native-pager-view';
import { AppColors } from '../constants/theme';

import AnalyticsScreen from '../screens/AnalyticsScreen';
import HomeScreen from '../screens/HomeScreen';
import PinScreen from '../screens/PinScreen';
import PlanScreen from '../screens/PlanScreen';

const TABS = [
  { outline: 'home-outline', filled: 'home' },
  { outline: 'folder-outline', filled: 'folder' },
  { outline: 'chart-line', filled: 'chart-line' },
] as const;

const PIN_STORAGE_KEY = 'app_pin';
const PIN_ENABLED_KEY = 'pin_enabled';

type PinMode = 'verify' | 'setup' | null;

export default function RootPage() {
  const colorScheme = useColorScheme();
  const [activeIndex, setActiveIndex] = useState(0);
  const pagerRef = useRef<PagerView>(null);

  // PIN state
  const [pinMode, setPinMode] = useState<PinMode>(null);
  const [appUnlocked, setAppUnlocked] = useState(false);
  const [isCheckingPin, setIsCheckingPin] = useState(true); // true until we know the pin status

  useEffect(() => {
    changeNavigationBarColor('#f4f3f8', false, true);
    checkPinOnLaunch();
  }, []);

  const checkPinOnLaunch = async () => {
    try {
      const pinEnabled = await AsyncStorage.getItem(PIN_ENABLED_KEY);
      const pinExists = await AsyncStorage.getItem(PIN_STORAGE_KEY);

      if (pinEnabled === 'true' && pinExists) {
        // PIN is enabled and set — require verification
        setPinMode('verify');
      } else if (pinEnabled === 'true' && !pinExists) {
        // PIN enabled but not set yet — ask to setup
        setPinMode('setup');
      } else {
        // No PIN — unlock immediately
        setAppUnlocked(true);
      }
    } catch (e) {
      console.error('Failed to check PIN:', e);
      setAppUnlocked(true);
    } finally {
      setIsCheckingPin(false);
    }
  };

  const handleTabPress = (index: number) => {
    pagerRef.current?.setPage(index);
    setActiveIndex(index);
  };

  // While we're checking AsyncStorage, render splash screen
  if (isCheckingPin) {
    const splashBackground = colorScheme === 'dark' ? '#000000' : '#30FF1F';
    return <View style={[styles.root, { backgroundColor: splashBackground }]} />;
  }

  // Show PIN screen if not unlocked yet
  if (pinMode !== null && !appUnlocked) {
    return (
      <PinScreen
        mode={pinMode}
        onSuccess={() => {
          setAppUnlocked(true);
          setPinMode(null);
        }}
      />
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colorScheme === 'dark' ? '#121212' : '#f4f3f8' }]}>
      {/* Swipeable pages — native horizontal gesture */}
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={(e) => setActiveIndex(e.nativeEvent.position)}
        overdrag
      >
        <View key="0" style={styles.page}><HomeScreen /></View>
        <View key="1" style={styles.page}><PlanScreen /></View>
        <View key="2" style={styles.page}><AnalyticsScreen /></View>
      </PagerView>

      {/* Floating pill tab bar */}
      <LinearGradient
        colors={[AppColors.primaryGreenStart, AppColors.primaryGreenEnd]}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={styles.tabBar}
      >
        {TABS.map((tab, i) => {
          const active = activeIndex === i;
          return (
            <TouchableOpacity
              key={i}
              style={styles.tabItem}
              onPress={() => handleTabPress(i)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name={active ? tab.filled : tab.outline}
                size={28}
                color={active ? '#ffffff' : '#ffffff5e'}
              />
            </TouchableOpacity>
          );
        })}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  tabBar: {
    position: 'absolute',
    bottom: 50,
    left: 25,
    right: 25,
    height: 75,
    backgroundColor: '#26272c',
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
});
