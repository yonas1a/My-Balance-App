import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, PermissionsAndroid, Platform, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AppColors } from '../constants/theme';
import ExpoSmsReaderModule from '../modules/expo-sms-reader';
import { buildHistoryFromSms, saveSnapshot } from '../utils/balanceHistory';
import { BankBalance, parseBankMessages } from '../utils/parser';
import PinScreen from './PinScreen';

const PIN_STORAGE_KEY = 'app_pin';
const PIN_ENABLED_KEY = 'pin_enabled';

export default function App() {
  const [balances, setBalances] = useState<BankBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false); // show inline PIN setup flow

  // Budget States
  // Budget States
  const [budgetAmount, setBudgetAmount] = useState<string>('');
  const [budgetStartDate, setBudgetStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [budgetBank, setBudgetBank] = useState<string>('All');
  const [isBudgetModalVisible, setIsBudgetModalVisible] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Cash on Hand States
  const [cashOnHand, setCashOnHand] = useState<string>('0');
  const [isCashModalVisible, setIsCashModalVisible] = useState(false);
  const [cashEntryAmount, setCashEntryAmount] = useState<string>('');

  const loadCash = async () => {
    try {
      const val = await AsyncStorage.getItem('cashOnHand');
      if (val) setCashOnHand(val);
    } catch (e) { }
  };

  const saveCash = async () => {
    try {
      await AsyncStorage.setItem('cashOnHand', cashEntryAmount);
      setCashOnHand(cashEntryAmount);
      setIsCashModalVisible(false);
    } catch (e) { }
  };

  const clearCash = async () => {
    try {
      await AsyncStorage.setItem('cashOnHand', '0');
      setCashOnHand('0');
    } catch (e) { }
  };


  useEffect(() => {
    requestPermissions();
    loadBudget();
    loadPinSettings();
    loadCash();
  }, []);

  const loadPinSettings = async () => {
    try {
      const enabled = await AsyncStorage.getItem(PIN_ENABLED_KEY);
      setPinEnabled(enabled === 'true');
    } catch (e) {
      console.error('Failed to load PIN settings:', e);
    }
  };

  const togglePinEnabled = async (value: boolean) => {
    if (value) {
      await AsyncStorage.setItem(PIN_ENABLED_KEY, 'true');
      setPinEnabled(true);
      setSettingsVisible(false); // close settings drawer
      setShowPinSetup(true);     // immediately show PIN setup screen
    } else {
      await AsyncStorage.setItem(PIN_ENABLED_KEY, 'false');
      await AsyncStorage.removeItem(PIN_STORAGE_KEY);
      setPinEnabled(false);
    }
  };

  const loadBudget = async () => {
    try {
      const bAmount = await AsyncStorage.getItem('budgetAmount');
      const bStartDate = await AsyncStorage.getItem('budgetStartDate');
      const bBank = await AsyncStorage.getItem('budgetBank');
      if (bAmount) setBudgetAmount(bAmount);
      if (bStartDate) {
        setBudgetStartDate(bStartDate);
      } else {
        setBudgetStartDate(new Date().toISOString().split('T')[0]);
      }
      if (bBank) setBudgetBank(bBank);
    } catch (e) {
      console.error('Failed to load budget:', e);
    }
  };

  const saveBudget = async () => {
    try {
      await AsyncStorage.setItem('budgetAmount', budgetAmount);
      await AsyncStorage.setItem('budgetStartDate', budgetStartDate);
      await AsyncStorage.setItem('budgetBank', budgetBank);
      setIsBudgetModalVisible(false);
    } catch (e) {
      console.error('Failed to save budget:', e);
    }
  };

  const requestPermissions = async () => {
    if (Platform.OS !== 'android') {
      setError('This app only works on Android.');
      return;
    }

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_SMS,
        {
          title: 'SMS Permission',
          message: 'My Balance App needs access to your SMS to securely read your bank balances.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        setPermissionGranted(true);
        fetchBalances();
      } else {
        setError('SMS Permission Denied. We cannot show your balances.');
      }

      // After SMS is handled, request Notification permission
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please enable notifications in your device settings to receive plan reminders.',
          [{ text: 'OK' }]
        );
      } else {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('income-reminders', {
            name: 'Income Reminders',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: AppColors.primaryGreenStart,
            sound: 'default.wav',
            enableVibrate: true,
            showBadge: true,
          });
        }
      }

    } catch (err) {
      setError('Failed to request permission.');
    }
  };

  const fetchBalances = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch a large number of messages to cover history for the graph
      const messages = await ExpoSmsReaderModule.getMessages(2000);

      const parsedBalances = parseBankMessages(messages);
      setBalances(parsedBalances);

      // 💾 Save today's balance snapshot
      const total = parsedBalances.reduce((acc, curr) => {
        const val = parseFloat(curr.balance.replace(/,/g, ''));
        return acc + (isNaN(val) ? 0 : val);
      }, 0);
      const banks: Record<string, number> = {};
      parsedBalances.forEach(b => {
        const val = parseFloat(b.balance.replace(/,/g, ''));
        if (!isNaN(val)) banks[b.bankName] = val;
      });
      await saveSnapshot(total, banks);

      // 📅 Build historical snapshots from all SMS (fills graph with past data)
      await buildHistoryFromSms(messages);
    } catch (err: any) {
      setError('Error fetching messages: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getBankColor = (bankName: string) => {
    const name = bankName.toLowerCase();
    if (name.includes('telebirr')) return '#00FF00'; // Neon Green
    if (name.includes('cbe bank')) return '#E11D48'; // Pink/Red
    if (name.includes('cbe birr')) return '#E11D48'; // Pink/Red
    if (name.includes('awash')) return '#F97316';    // Orange
    return AppColors.primaryPurple;
  };

  // Calculate total for the hero section
  const totalBalance = balances.reduce((acc, curr) => {
    const val = parseFloat(curr.balance.replace(/,/g, ''));
    return acc + (isNaN(val) ? 0 : val);
  }, 0) + (parseFloat(cashOnHand) || 0);

  // Budget Calculations
  let spentPercentage = 0;
  const parsedBudget = parseFloat(budgetAmount);
  if (!isNaN(parsedBudget) && parsedBudget > 0) {
    let currentBalance = 0;
    if (budgetBank === 'All') {
      currentBalance = totalBalance;
    } else {
      const bankItem = balances.find(b => b.bankName === budgetBank);
      if (bankItem) {
        currentBalance = parseFloat(bankItem.balance.replace(/,/g, ''));
      }
    }
    spentPercentage = Math.min((currentBalance / parsedBudget) * 100, 100);
  }
  const displayPercentage = Math.round(spentPercentage);

  // ─── Time elapsed in budget cycle ────────────────────────────────────────
  let timeElapsedPercentage = 0;
  let dayInCycle = 0;
  let totalCycleDays = 30;
  if (budgetStartDate) {
    const selectedDate = new Date(budgetStartDate);
    const now = new Date();
    if (!isNaN(selectedDate.getTime())) {
      const payday = selectedDate.getDate();

      // Start of today (midnight) for clean day comparison
      const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      let lastPayDate = new Date(now.getFullYear(), now.getMonth(), payday);

      // If this month's payday hasn't happened yet (still in the future), use last month's
      if (lastPayDate > todayMidnight) {
        lastPayDate = new Date(now.getFullYear(), now.getMonth() - 1, payday);
      }

      const diffMs = todayMidnight.getTime() - lastPayDate.getTime();
      dayInCycle = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

      const nextPayDate = new Date(lastPayDate.getFullYear(), lastPayDate.getMonth() + 1, payday);
      totalCycleDays = Math.max(1, Math.round(
        (nextPayDate.getTime() - lastPayDate.getTime()) / (1000 * 60 * 60 * 24)
      ));

      timeElapsedPercentage = Math.min((dayInCycle / totalCycleDays) * 100, 100);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={[AppColors.background, AppColors.background]}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={styles.container}
      >

        {/* Purple Hero Header */}
        <LinearGradient
          colors={[AppColors.primaryGreenStart, AppColors.primaryGreenEnd]}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={styles.heroCard}
        >
          <View style={styles.heroHeader}>
            <TouchableOpacity onPress={() => setSettingsVisible(true)}>
              <MaterialCommunityIcons name="menu" size={28} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.heroTitle}>Home</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
              <TouchableOpacity onPress={fetchBalances}>
                <MaterialCommunityIcons name="refresh" size={26} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setBalanceVisible(v => !v)}>
                <MaterialCommunityIcons
                  name={balanceVisible ? 'eye-outline' : 'eye-off-outline'}
                  size={26}
                  color="#FFF"
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.heroContent}>
            <Text style={styles.totalBalanceLabel}>Total Balance</Text>
            <Text style={styles.totalBalanceValue}>
              {balanceVisible
                ? (totalBalance > 0 ? totalBalance.toLocaleString('en-US') : '2,000,987')
                : '******'} ETB
            </Text>
          </View>
        </LinearGradient>
        <View style={styles.bar_background}>
          <View style={styles.bar_text}>
            <View>
              <Text style={styles.bar_text_title}>{displayPercentage}%  <Text style={styles.bar_text_desc}>of budget</Text></Text>
              {budgetStartDate ? (
                <Text style={styles.bar_day_label}>Day {dayInCycle} / {totalCycleDays}</Text>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.bar_text_desc}>This month</Text>
              <TouchableOpacity onPress={() => setIsBudgetModalVisible(true)} style={styles.addBudgetBtn}>
                <MaterialCommunityIcons name="plus" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.bar_con}>
            <View style={[styles.bar_green, { width: `${displayPercentage}%` }]}>
              <LinearGradient
                colors={[AppColors.primaryGreenStart, AppColors.primaryGreenEnd]}
                start={{ x: 0, y: 1 }}
                end={{ x: 1, y: 0 }}
                style={styles.container}
              ></LinearGradient>
            </View>
            {budgetStartDate ? (
              <View style={[styles.timelineMarker, { right: `${Math.min(timeElapsedPercentage, 97)}%` }]}>
                <View style={styles.timelineMarkerDot} />
              </View>
            ) : null}
          </View>
          {budgetStartDate ? (
            <View style={styles.bar_legend}>
              <View style={styles.bar_legend_item}>
                <View style={[styles.bar_legend_dot, { backgroundColor: AppColors.primaryGreenStart }]} />
                <Text style={styles.bar_legend_text}>Balance</Text>
              </View>
              <View style={styles.bar_legend_item}>
                <View style={[styles.bar_legend_dot, { backgroundColor: AppColors.primaryPurple }]} />
                <Text style={styles.bar_legend_text}>Time remaining</Text>
              </View>
            </View>
          ) : null}
        </View>

        <Modal
          visible={isBudgetModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setIsBudgetModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Set Budget</Text>

              <Text style={styles.inputLabel}>Budget Amount (ETB)</Text>
              <TextInput
                style={styles.input}
                value={budgetAmount}
                onChangeText={setBudgetAmount}
                keyboardType="numeric"
                placeholder="e.g. 15000"
                placeholderTextColor="#999"
              />

              <Text style={styles.inputLabel}>Budget Restarting Date</Text>
              <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.datePickerBtnText}>{budgetStartDate}</Text>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={budgetStartDate ? new Date(budgetStartDate) : new Date()}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false);
                    if (selectedDate) {
                      setBudgetStartDate(selectedDate.toISOString().split('T')[0]);
                    }
                  }}
                />
              )}

              <Text style={styles.inputLabel}>Select Bank</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bankChipContainer}>
                {['All', ...Array.from(new Set(balances.map(b => b.bankName)))].map(bank => (
                  <TouchableOpacity
                    key={bank}
                    style={[styles.bankChip, budgetBank === bank && styles.bankChipSelected]}
                    onPress={() => setBudgetBank(bank)}
                  >
                    <Text style={[styles.bankChipText, budgetBank === bank && styles.bankChipTextSelected]}>
                      {bank}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity onPress={() => setIsBudgetModalVisible(false)} style={styles.cancelBtn}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={saveBudget} style={styles.saveBtn}>
                  <Text style={styles.saveBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Settings Drawer Modal */}
        <Modal
          visible={settingsVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setSettingsVisible(false)}
        >
          <TouchableOpacity
            style={styles.settingsOverlay}
            activeOpacity={1}
            onPress={() => setSettingsVisible(false)}
          >
            <View style={styles.settingsDrawer} onStartShouldSetResponder={() => true}>
              <View style={styles.settingsHandle} />
              <Text style={styles.settingsTitle}>Settings</Text>

              {/* PIN Lock toggle */}
              <View style={styles.settingsRow}>
                <View style={styles.settingsRowLeft}>
                  <MaterialCommunityIcons name="shield-lock-outline" size={24} color={AppColors.primaryGreenStart} />
                  <View style={styles.settingsRowText}>
                    <Text style={styles.settingsRowLabel}>PIN Lock</Text>
                    <Text style={styles.settingsRowDesc}>Require PIN to open app</Text>
                  </View>
                </View>
                <Switch
                  value={pinEnabled}
                  onValueChange={togglePinEnabled}
                  trackColor={{ false: '#3F3F46', true: AppColors.primaryGreenStart }}
                  thumbColor={pinEnabled ? '#FFF' : AppColors.subText}
                />
              </View>

              <View style={styles.settingsDivider} />

              {/* Balance visibility toggle */}
              <View style={styles.settingsRow}>
                <View style={styles.settingsRowLeft}>
                  <MaterialCommunityIcons name={balanceVisible ? 'eye-outline' : 'eye-off-outline'} size={24} color="#90d547" />
                  <View style={styles.settingsRowText}>
                    <Text style={styles.settingsRowLabel}>Show Balance</Text>
                    <Text style={styles.settingsRowDesc}>Toggle balance visibility</Text>
                  </View>
                </View>
                <Switch
                  value={balanceVisible}
                  onValueChange={setBalanceVisible}
                  trackColor={{ false: '#3F3F46', true: AppColors.primaryGreenStart }}
                  thumbColor={balanceVisible ? '#FFF' : AppColors.subText}
                />
              </View>

              <TouchableOpacity style={styles.settingsCloseBtn} onPress={() => setSettingsVisible(false)}>
                <Text style={styles.settingsCloseBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* PIN Setup full-screen modal — shown immediately when user enables PIN */}
        <Modal
          visible={showPinSetup}
          animationType="slide"
          transparent={false}
          onRequestClose={() => {
            // If user cancels, disable PIN since no PIN was set
            setShowPinSetup(false);
            setPinEnabled(false);
            AsyncStorage.setItem(PIN_ENABLED_KEY, 'false');
          }}
        >
          <PinScreen
            mode="setup"
            onSuccess={() => setShowPinSetup(false)}
            onCancel={() => {
              setShowPinSetup(false);
              setPinEnabled(false);
              AsyncStorage.setItem(PIN_ENABLED_KEY, 'false');
            }}
          />
        </Modal>

        {/* Cash Modal */}
        <Modal
          visible={isCashModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setIsCashModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Update Cash</Text>
              <Text style={styles.inputLabel}>Amount (ETB)</Text>
              <TextInput
                style={styles.input}
                value={cashEntryAmount}
                onChangeText={setCashEntryAmount}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor={AppColors.subText}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity onPress={() => setIsCashModalVisible(false)} style={styles.cancelBtn}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={saveCash} style={styles.saveBtn}>
                  <Text style={styles.saveBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <View style={styles.listHeader}>
          <Text style={styles.listSectionTitle}>Accounts</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>See all</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          <View style={[styles.card, { borderColor: AppColors.border, backgroundColor: AppColors.card }]}>
            <View style={[styles.cardLeft, { backgroundColor: AppColors.background }]}>
              <MaterialCommunityIcons name="cash-multiple" size={30} color={AppColors.primaryGreenStart} />
            </View>
            <View style={styles.cardMid}>
              <Text style={styles.bankName}>Cash On Hand</Text>
              <Text style={styles.lastTransactionDate}>Manual Entry</Text>
            </View>
            <View style={styles.cardRight}>
              <Text style={styles.cardBalance}>
                {balanceVisible ? `${Number(cashOnHand).toLocaleString('en-US')} ETB` : '****** ETB'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 15 }}>
                <TouchableOpacity onPress={clearCash}>
                  <MaterialCommunityIcons name="trash-can-outline" size={24} color={AppColors.error} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setCashEntryAmount(cashOnHand); setIsCashModalVisible(true); }}>
                  <MaterialCommunityIcons name="plus" size={24} color={AppColors.primaryGreenStart} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              {!permissionGranted && (
                <TouchableOpacity style={styles.retryButton} onPress={requestPermissions}>
                  <Text style={styles.retryText}>Grant Permission</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={AppColors.primaryPurple} />
              <Text style={styles.loadingText}>Syncing balances...</Text>
            </View>
          ) : balances.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No balances found. Creating mock data for layout preview.</Text>
            </View>
          ) : (

            balances.map((item, index) => (
              <AccountCard
                key={index}
                name={item.bankName}
                balance={`${item.balance} ETB`}
                subBalance={item.type === 'received' ? '+ Recent' : ''}
                color={getBankColor(item.bankName)}
                subColor="#000000ff"
                balanceVisible={balanceVisible}
                date={item.date}
              />
            ))
          )}
        </ScrollView>

      </LinearGradient>
    </SafeAreaView>
  );
}

// Maps bank name to its local logo asset
const bankLogoMap: Record<string, any> = {
  telebirr: require('../assets/images/banks/telebirr.png'),
  'cbe': require('../assets/images/banks/cbe_bank.png'),
  'cbe birr': require('../assets/images/banks/cbe_birr.png'),
  awash: require('../assets/images/banks/awash.png'),
};

function getBankLogo(name: string) {
  // Sort keys longest-first so 'cbe birr' is matched before 'cbe'
  const key = Object.keys(bankLogoMap)
    .sort((a, b) => b.length - a.length)
    .find(k => name.toLowerCase().includes(k));
  return key ? bankLogoMap[key] : null;
}

// Sub-component for the accounts card
function AccountCard({ name, balance, subBalance, color, subColor, balanceVisible, date }: { name: string, balance: string, subBalance: string, color: string, subColor: string, balanceVisible: boolean, date?: string }) {
  const logo = getBankLogo(name);
  return (
    <View style={[styles.card, { borderColor: color }]}>
      <View style={styles.cardLeft}>
        {logo && (
          <Image
            source={logo}
            style={styles.bankLogo}
            resizeMode="contain"
          />
        )}
      </View>
      <View style={styles.cardMid}>
        <Text style={styles.bankName}>{name}</Text>
        <Text style={styles.lastTransactionDate}>{date ? new Date(Number(date)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase() : 'Unknown Date'}</Text>
      </View>
      <View style={styles.cardRight}>
        <Text style={styles.cardBalance}>
          {balanceVisible ? balance : '****** ETB'}
        </Text>
        <Text style={[styles.cardSubBalance, { color: subColor }]}>
          {balanceVisible ? subBalance : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    paddingTop: 0,
    flex: 1,
    backgroundColor: '#000000',
  },
  container: {
    flex: 1,
  },
  heroCard: {
    backgroundColor: AppColors.primaryPurple,
    borderBottomRightRadius: 30,
    borderBottomLeftRadius: 30,
    paddingTop: 50,
    paddingBottom: 40,
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  heroTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '500',
  },
  heroContent: {
    paddingTop: 10,
  },
  totalBalanceLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    marginBottom: 8,
  },
  totalBalanceValue: {
    color: '#FFF',
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  listSectionTitle: {
    color: AppColors.text,
    fontSize: 18,
    fontWeight: '500',
  },
  seeAllText: {
    color: AppColors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 130, // Increased to avoid floating tab bar
  },
  card: {
    backgroundColor: AppColors.card,
    borderRadius: 16,
    padding: 10,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardLeft: {
    width: 55,
    height: 55,
    borderRadius: 8,
    backgroundColor: '#ffffff22',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardMid: {
    flex: 1,
    paddingLeft: 10,
  },
  lastTransactionDate: {
    color: '#b4b4b4',
    fontSize: 12,
    fontWeight: '500',
  },
  bankLogo: {
    width: 60,
    height: 60,
  },
  bankName: {
    color: AppColors.text,
    fontSize: 15,
    fontWeight: 'bold',
    paddingBottom: 4,
  },
  cardRight: {
    alignItems: 'flex-end',
  },
  cardBalance: {
    color: AppColors.text,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    marginRight: 5,
  },
  cardSubBalance: {
    fontSize: 14,
    fontWeight: '500',
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.subText,
  },
  errorBox: {
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
  },
  errorText: {
    color: AppColors.error,
    fontWeight: '600',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  emptyText: {
    color: AppColors.subText,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  bar_con: {
    backgroundColor: '#ebebeb',
    borderRadius: 10,
    marginHorizontal: 20,
    marginBottom: 8,
    height: 12,
    position: 'relative',
    overflow: 'visible',
  },
  bar_green: {
    height: 12,
    backgroundColor: '#00ce0aff',
    borderRadius: 20,
    overflow: 'hidden',
  },
  bar_background: {
    backgroundColor: AppColors.card,
    paddingTop: 15,
    paddingBottom: 12,
    paddingHorizontal: 5,
    borderRadius: 20,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  bar_text: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  bar_text_title: {
    color: AppColors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  bar_text_desc: {
    color: AppColors.subText,
    fontSize: 13,
    fontWeight: '500',
  },
  bar_day_label: {
    color: AppColors.primaryPurple,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  addBudgetBtn: {
    backgroundColor: AppColors.primaryGreenStart,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  timelineMarker: {
    position: 'absolute',
    top: -4,
    width: 4,
    height: 20,
    backgroundColor: AppColors.primaryPurple,
    borderRadius: 2,
    zIndex: 20,
    alignItems: 'center',
  },
  timelineMarkerDot: {
    position: 'absolute',
    top: -5,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: AppColors.primaryPurple,
    borderWidth: 2,
    borderColor: '#fff',
  },
  bar_legend: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 20,
    marginTop: 10,
  },
  bar_legend_item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  bar_legend_dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bar_legend_text: {
    color: AppColors.subText,
    fontSize: 11,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFF',
    width: '85%',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: AppColors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 6,
  },
  input: {
    backgroundColor: AppColors.background,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: AppColors.text,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: AppColors.background,
    paddingVertical: 12,
    borderRadius: 10,
    marginRight: 8,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#555',
    fontSize: 16,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
    backgroundColor: AppColors.primaryGreenStart,
    paddingVertical: 12,
    borderRadius: 10,
    marginLeft: 8,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  datePickerBtn: {
    backgroundColor: AppColors.background,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  datePickerBtnText: {
    fontSize: 16,
    color: AppColors.text,
  },
  bankChipContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  bankChip: {
    backgroundColor: AppColors.background,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
  },
  bankChipSelected: {
    backgroundColor: AppColors.primaryPurple,
  },
  bankChipText: {
    color: '#555',
    fontWeight: '600',
  },
  bankChipTextSelected: {
    color: '#FFF',
  },
  settingsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  settingsDrawer: {
    backgroundColor: AppColors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
  },
  settingsHandle: {
    width: 70,
    height: 7,
    backgroundColor: '#c5c5c5ff',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  settingsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 24,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  settingsRowText: {
    flex: 1,
  },
  settingsRowLabel: {
    color: '#000107',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  settingsRowDesc: {
    color: AppColors.subText,
    fontSize: 12,
  },
  settingsDivider: {
    height: 1,
    backgroundColor: '#27272A',
    marginVertical: 4,
  },
  settingsCloseBtn: {
    backgroundColor: AppColors.primaryGreenStart,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 32,
  },
  settingsCloseBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
