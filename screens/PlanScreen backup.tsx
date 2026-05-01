import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Modal from 'react-native-modal';
import { AppColors } from '../constants/theme';

interface PlanItem {
  id: string;
  name: string;
  amount: string;
  period: string;
  from: string;
  isDone: boolean;
  category: 'expense' | 'income';
  note?: string;
  date?: string;
  notificationId?: string;
  repeatingNotificationId?: string;
}

const DUMMY_PLANS: PlanItem[] = [
  { id: '2', name: 'Saving', amount: '10,000 ETB', period: 'monthly', from: 'Cbe Birr', isDone: false, category: 'expense', note: 'Savings goal', date: new Date().toISOString() },
  { id: '3', name: 'Allowance', amount: '15,000 ETB', period: 'monthly', from: 'Cbe Birr', isDone: false, category: 'income', note: 'Monthly allowance', date: new Date().toISOString() },
];

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const PLANS_STORAGE_KEY = 'app_plans';

export default function PlanScreen() {
  const [plans, setPlans] = useState<PlanItem[]>(DUMMY_PLANS);
  const [isModalVisible, setModalVisible] = useState(false);
  const [planCategory, setPlanCategory] = useState<'expense' | 'income'>('expense');
  const [planType, setPlanType] = useState('Rent');
  const [amount, setAmount] = useState('');
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please enable notifications in your device settings to receive plan reminders.',
          [{ text: 'OK' }]
        );
        return;
      }
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('income-reminders', {
          name: 'Income Reminders',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: AppColors.primaryGreenStart,
          enableVibrate: true,
          showBadge: true,
        });
      }
    })();
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const stored = await AsyncStorage.getItem(PLANS_STORAGE_KEY);
      if (stored) {
        setPlans(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load plans:', e);
    }
  };

  const savePlans = async (newPlans: PlanItem[]) => {
    try {
      await AsyncStorage.setItem(PLANS_STORAGE_KEY, JSON.stringify(newPlans));
    } catch (e) {
      console.error('Failed to save plans:', e);
    }
  };

  const toggleModal = () => {
    setModalVisible(!isModalVisible);
    if (!isModalVisible) {
      setDate(new Date());
      setNote('');
    }
  };

  const handleSave = async () => {
    if (!amount) return;

    const newPlanId = Date.now().toString();
    let notificationId: string | undefined;
    let repeatingNotificationId: string | undefined;

    const now = Date.now();
    const scheduleTime = date.getTime();
    const secondsUntilFirst = Math.floor((scheduleTime - now) / 1000);

    if (secondsUntilFirst > 0) {

      // --- Notification 1: One-time, fires exactly at the selected date/time ---
      notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: `📅 ${planType} Reminder`,
          body: `Your ${planCategory === 'expense' ? 'budget' : 'income'} plan of ${amount} ETB is due.`,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: secondsUntilFirst,
          repeats: false,
          ...(Platform.OS === 'android' && { channelId: 'income-reminders' }),
        },
      });

      // --- Notification 2: Repeating, starts one full cycle after the selected time ---
      const cycleSeconds: Record<string, number> = {
        weekly: 7 * 24 * 60 * 60,
        monthly: 30 * 24 * 60 * 60,
        yearly: 365 * 24 * 60 * 60,
      };

      const intervalSeconds = cycleSeconds[billingCycle];

      if (billingCycle !== 'once' && intervalSeconds) {
        // First repeat fires one full cycle after the one-time ping
        const secondsUntilFirstRepeat = secondsUntilFirst + intervalSeconds;

        repeatingNotificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: `🔁 ${planType} Reminder`,
            body: `Recurring ${billingCycle} reminder: ${amount} ETB.`,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: secondsUntilFirstRepeat,
            repeats: true,
            ...(Platform.OS === 'android' && { channelId: 'income-reminders' }),
          },
        });
      }

      console.log('One-time notification ID:', notificationId);
      console.log('Repeating notification ID:', repeatingNotificationId);

      Alert.alert(
        '✅ Reminders Set',
        billingCycle !== 'once'
          ? `First reminder: ${date.toLocaleString()}\nThen repeats every ${billingCycle}.`
          : `One-time reminder set for ${date.toLocaleString()}`
      );

    } else {
      Alert.alert('⚠️ Invalid Time', 'Please pick a future date and time for your reminder.');
      return;
    }

    const newPlan: PlanItem = {
      id: newPlanId,
      name: planType,
      amount: `${amount} ETB`,
      period: billingCycle,
      from: 'Self',
      isDone: false,
      category: planCategory,
      note: note,
      date: date.toISOString(),
      notificationId: notificationId,
      repeatingNotificationId: repeatingNotificationId,
    };

    const updatedPlans = [...plans, newPlan];
    setPlans(updatedPlans);
    savePlans(updatedPlans);

    setPlanType('Rent');
    setAmount('');
    setBillingCycle('monthly');
    setNote('');
    setDate(new Date());
    toggleModal();
  };

  const handleDelete = async (id: string) => {
    const planToDelete = plans.find(plan => plan.id === id);
    if (planToDelete) {
      try {
        if (planToDelete.notificationId) {
          await Notifications.cancelScheduledNotificationAsync(planToDelete.notificationId);
          console.log(`Cancelled one-time notification for plan ${id}`);
        }
        if (planToDelete.repeatingNotificationId) {
          await Notifications.cancelScheduledNotificationAsync(planToDelete.repeatingNotificationId);
          console.log(`Cancelled repeating notification for plan ${id}`);
        }
      } catch (err) {
        console.error('Failed to cancel notifications:', err);
      }
    }
    const updated = plans.filter(plan => plan.id !== id);
    setPlans(updated);
    savePlans(updated);
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const newDate = new Date(date);
      newDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      setDate(newDate);
    }
  };

  const onTimeChange = (event: any, selectedDate?: Date) => {
    setShowTimePicker(false);
    if (selectedDate) {
      const newDate = new Date(date);
      newDate.setHours(selectedDate.getHours(), selectedDate.getMinutes());
      setDate(newDate);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Plan</Text>
          <View style={{ width: 28 }} />
        </View>

        <View style={styles.noteContainer}>
          <Text style={styles.noteText}>
            monthly plan reset on <Text style={styles.noteTextBold}>30</Text>
          </Text>
          <Text style={styles.noteText}>based on ethiopian calendar</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {plans.map((item) => (
            <View key={item.id} style={styles.listItemWrapper}>
              <View style={[styles.listItem, item.isDone && styles.listItemDoneShrink, { borderLeftWidth: 8, borderLeftColor: item.category === 'expense' ? AppColors.primaryGreenStart : '#EF4444' }]}>
                {/* Delete Button */}
                <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteButton}>
                  <MaterialCommunityIcons name="checkbox-outline" size={35} color="#434343ff" />
                </TouchableOpacity>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  {item.date && (
                    <Text style={styles.itemDateText}>
                      {new Date(item.date).toLocaleDateString()} {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  )}
                  {item.note && <Text style={styles.itemNoteText}>{item.note}</Text>}
                  {/* Notification badge indicators */}
                  <View style={styles.badgeRow}>
                    {item.notificationId && (
                      <View style={styles.badge}>
                        <MaterialCommunityIcons name="bell-outline" size={11} color="#FFF" />
                        <Text style={styles.badgeText}>Once</Text>
                      </View>
                    )}
                    {item.repeatingNotificationId && (
                      <View style={[styles.badge, styles.badgeRepeat]}>
                        <MaterialCommunityIcons name="bell-ring-outline" size={11} color="#FFF" />
                        <Text style={styles.badgeText}>{item.period}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.amountContainer}>
                  <Text style={[styles.itemAmount, { color: item.category === 'expense' ? AppColors.primaryGreenStart : '#EF4444' }]}>{item.amount}</Text>
                  <Text style={styles.itemFrom}>
                    From  <Text style={styles.itemFromBold}>{item.from}</Text>
                  </Text>
                  <Text style={styles.itemPeriod}>{item.period}</Text>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* FAB */}
        <TouchableOpacity style={styles.fab} onPress={toggleModal}>
          <MaterialCommunityIcons name="plus" size={32} color="#FFF" />
        </TouchableOpacity>

        {/* Add Plan Modal */}
        <Modal
          isVisible={isModalVisible}
          onBackdropPress={toggleModal}
          onSwipeComplete={toggleModal}
          swipeDirection="down"
          style={styles.modal}
          avoidKeyboard
        >
          <ScrollView style={styles.modalScroll}>
            <View style={styles.modalContent}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Create New Plan</Text>

              <Text style={styles.inputLabel}>Category</Text>
              <View style={styles.optionsContainer}>
                <TouchableOpacity
                  style={[styles.optionButton, planCategory === 'expense' && styles.optionButtonActive]}
                  onPress={() => setPlanCategory('expense')}
                >
                  <Text style={[styles.optionText, planCategory === 'expense' && styles.optionTextActive]}>Budget</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.optionButton, planCategory === 'income' && styles.optionButtonActive]}
                  onPress={() => setPlanCategory('income')}
                >
                  <Text style={[styles.optionText, planCategory === 'income' && styles.optionTextActive]}>Income</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Plan Type</Text>
              <View style={styles.optionsContainer}>
                {['Rent', 'Saving', 'Allowance', 'Loan', 'Other'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.optionButton, planType === type && styles.optionButtonActive]}
                    onPress={() => setPlanType(type)}
                  >
                    <Text style={[styles.optionText, planType === type && styles.optionTextActive]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Amount (ETB)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., 5000"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />

              <Text style={styles.inputLabel}>Note</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Add a note (optional)"
                placeholderTextColor="#9CA3AF"
                value={note}
                onChangeText={setNote}
              />

              <Text style={styles.inputLabel}>Remind Me On</Text>
              <View style={styles.datePickerContainer}>
                <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
                  <MaterialCommunityIcons name="calendar" size={20} color={AppColors.primaryGreenStart} />
                  <Text style={styles.dateButtonText}>{date.toLocaleDateString()}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dateButton} onPress={() => setShowTimePicker(true)}>
                  <MaterialCommunityIcons name="clock-outline" size={20} color={AppColors.primaryGreenStart} />
                  <Text style={styles.dateButtonText}>{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </TouchableOpacity>
              </View>

              {showDatePicker && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="default"
                  onChange={onDateChange}
                />
              )}
              {showTimePicker && (
                <DateTimePicker
                  value={date}
                  mode="time"
                  display="default"
                  onChange={onTimeChange}
                />
              )}

              <Text style={styles.inputLabel}>Billing Cycle</Text>
              <View style={styles.optionsContainer}>
                {['once', 'weekly', 'monthly', 'yearly'].map((cycle) => (
                  <TouchableOpacity
                    key={cycle}
                    style={[styles.optionButton, billingCycle === cycle && styles.optionButtonActive]}
                    onPress={() => setBillingCycle(cycle)}
                  >
                    <Text style={[styles.optionText, billingCycle === cycle && styles.optionTextActive]}>
                      {cycle.charAt(0).toUpperCase() + cycle.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Info box explaining the two notifications */}
              <View style={styles.infoBox}>
                <MaterialCommunityIcons name="information-outline" size={16} color={AppColors.primaryGreenStart} />
                <Text style={styles.infoText}>
                  {billingCycle === 'once'
                    ? 'A single reminder will fire at your chosen time.'
                    : `Two reminders will be set:\n• 📅 Once at your chosen time\n• 🔁 Then repeating every ${billingCycle} after that`}
                </Text>
              </View>

              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>Save Plan</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Modal>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: 35,
    backgroundColor: '#f4f3f8',
  },
  container: {
    flex: 1,
    backgroundColor: '#f4f3f8',
  },
  noteContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  noteText: {
    color: AppColors.subText,
    fontSize: 13,
  },
  noteTextBold: {
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: 0.5,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 120,
  },
  listItemWrapper: {
    position: 'relative',
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#ffffffff',
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffffff',
    padding: 15,
    borderRadius: 12,
    zIndex: 2,
  },
  listItemDoneShrink: {
    width: '82%',
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  itemInfo: {
    flex: 1,
  },
  doneBlock: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '20%',
    backgroundColor: AppColors.primaryGreenStart,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    zIndex: 1,
  },
  doneText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 16,
    transform: [{ rotate: '270deg' }],
    width: 60,
    textAlign: 'center',
  },
  itemName: {
    color: '#2F3034',
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 4,
  },
  itemFrom: {
    color: '#2f303486',
    fontSize: 14,
    marginBottom: 4,
  },
  itemFromBold: {
    color: '#2F3034',
    fontWeight: 'bold',
  },
  itemDateText: {
    color: '#2f303486',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 0,
  },
  itemNoteText: {
    color: '#2F3034',
    fontSize: 13,
    marginTop: 6,
    fontStyle: 'italic',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: AppColors.primaryGreenStart,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeRepeat: {
    backgroundColor: '#6366F1',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  itemAmount: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  itemPeriod: {
    color: '#2f303486',
    fontSize: 14,
    fontWeight: '500',
    marginTop: -4,
  },
  deleteButton: {
    marginLeft: 0,
    paddingRight: 10,
  },
  fab: {
    position: 'absolute',
    bottom: 140,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: AppColors.primaryGreenStart,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  modalScroll: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: AppColors.card,
  },
  modalContent: {
    backgroundColor: AppColors.card,
    padding: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: 500,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: AppColors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: AppColors.text,
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.subText,
    marginBottom: 10,
    marginTop: 16,
  },
  textInput: {
    backgroundColor: AppColors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: AppColors.text,
    borderWidth: 1,
    borderColor: AppColors.border,
    marginBottom: 8,
  },
  datePickerContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.background,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
    gap: 8,
  },
  dateButtonText: {
    color: AppColors.text,
    fontSize: 14,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionButton: {
    backgroundColor: AppColors.background,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  optionButtonActive: {
    backgroundColor: AppColors.primaryGreenStart,
    borderColor: AppColors.primaryGreenStart,
  },
  optionText: {
    color: '#D4D4D8',
    fontWeight: '500',
  },
  optionTextActive: {
    color: AppColors.text,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: AppColors.background,
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  infoText: {
    flex: 1,
    color: AppColors.subText,
    fontSize: 13,
    lineHeight: 20,
  },
  saveButton: {
    backgroundColor: AppColors.primaryGreenStart,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 10,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});