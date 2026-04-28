import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppColors } from '../constants/theme';

const PIN_LENGTH = 4;
const PIN_STORAGE_KEY = 'app_pin';

interface PinScreenProps {
  mode: 'setup' | 'verify';
  onSuccess: () => void;
  onCancel?: () => void;
}

export default function PinScreen({ mode, onSuccess, onCancel }: PinScreenProps) {
  const [pin, setPin] = useState<string[]>([]);
  const [confirmPin, setConfirmPin] = useState<string[]>([]);
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [errorMsg, setErrorMsg] = useState('');
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Always derive currentPin fresh from state — no stale closure
  const currentPin = step === 'enter' ? pin : confirmPin;

  const shake = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  useEffect(() => {
    if (currentPin.length === PIN_LENGTH) {
      handlePinComplete(currentPin);
    }
  }, [pin, confirmPin]);

  const handlePinComplete = async (resolvedPin: string[]) => {
    if (mode === 'verify') {
      const stored = await AsyncStorage.getItem(PIN_STORAGE_KEY);
      if (resolvedPin.join('') === stored) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onSuccess();
      } else {
        shake();
        setErrorMsg('Incorrect PIN. Try again.');
        setPin([]);
      }
    } else {
      // setup mode
      if (step === 'enter') {
        setStep('confirm');
        setErrorMsg('');
      } else {
        // confirm step — resolvedPin is confirmPin here
        if (pin.join('') === resolvedPin.join('')) {
          await AsyncStorage.setItem(PIN_STORAGE_KEY, pin.join(''));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onSuccess();
        } else {
          shake();
          setErrorMsg('PINs do not match. Try again.');
          setPin([]);
          setConfirmPin([]);
          setStep('enter');
        }
      }
    }
  };

  const handleKeyPress = (digit: string) => {
    if (currentPin.length < PIN_LENGTH) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (step === 'enter') {
        setPin(prev => [...prev, digit]);
      } else {
        setConfirmPin(prev => [...prev, digit]);
      }
      setErrorMsg('');
    }
  };

  const handleDelete = () => {
    if (step === 'enter') {
      setPin(prev => prev.slice(0, -1));
    } else {
      setConfirmPin(prev => prev.slice(0, -1));
    }
  };

  const getTitle = () => {
    if (mode === 'verify') return 'Enter PIN';
    return step === 'enter' ? 'Set Your PIN' : 'Confirm PIN';
  };

  const KEYS = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', 'del'],
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {onCancel && (
          <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
            <MaterialCommunityIcons name="close" size={24} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Lock icon */}
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons name="shield-lock-outline" size={60} color={AppColors.primaryGreenStart} />
      </View>

      <Text style={styles.title}>{getTitle()}</Text>
      {mode === 'setup' && step === 'confirm' && (
        <Text style={styles.subtitle}>Re-enter your PIN to confirm</Text>
      )}

      {/* Dots */}
      <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              currentPin.length > i ? styles.dotFilled : styles.dotEmpty,
            ]}
          />
        ))}
      </Animated.View>

      {/* Error */}
      {errorMsg ? <Text style={styles.errorMsg}>{errorMsg}</Text> : null}

      {/* Keypad */}
      <View style={styles.keypad}>
        {KEYS.map((row, rowIdx) => (
          <View key={rowIdx} style={styles.keyRow}>
            {row.map((key, keyIdx) => {
              if (key === '') return <View key={keyIdx} style={styles.keyPlaceholder} />;
              if (key === 'del') {
                return (
                  <TouchableOpacity key={keyIdx} style={styles.key} onPress={handleDelete}>
                    <MaterialCommunityIcons name="backspace-outline" size={26} color="#0c0d13" />
                  </TouchableOpacity>
                );
              }
              return (
                <TouchableOpacity key={keyIdx} style={styles.key} onPress={() => handleKeyPress(key)}>
                  <Text style={styles.keyText}>{key}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f3f8',
    alignItems: 'center',
    paddingTop: 130,
  },
  header: {
    position: 'absolute',
    top: 50,
    right: 24,
  },
  cancelBtn: {
    padding: 8,
  },
  iconWrap: {
    marginBottom: 20,
    backgroundColor: '#ecffd7ff',
    borderRadius: 50,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0c0d13',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 18,
    marginTop: 30,
    marginBottom: 12,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  dotEmpty: {
    backgroundColor: '#777777ff',
    borderWidth: 2,
    borderColor: '#989898ff',
  },
  dotFilled: {
    backgroundColor: AppColors.primaryGreenStart,
  },
  errorMsg: {
    color: '#EF4444',
    fontSize: 14,
    marginTop: 10,
    marginBottom: 4,
    fontWeight: '500',
  },
  keypad: {
    marginTop: 40,
    gap: 16,
  },
  keyRow: {
    flexDirection: 'row',
    gap: 24,
  },
  key: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ffffffff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  keyPlaceholder: {
    width: 80,
    height: 80,
  },
  keyText: {
    color: '#0c0d13',
    fontSize: 26,
    fontWeight: '600',
  },
});
