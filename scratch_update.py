import re

home_path = r"c:\Users\VICTUS\Documents\Code\My Balance App\screens\HomeScreen.tsx"

with open(home_path, "r", encoding="utf-8") as f:
    home_content = f.read()

# 1. Add state variables for Cash on Hand
state_vars = """
  // Cash on Hand States
  const [cashOnHand, setCashOnHand] = useState<string>('0');
  const [isCashModalVisible, setIsCashModalVisible] = useState(false);
  const [cashEntryAmount, setCashEntryAmount] = useState<string>('');

  const loadCash = async () => {
    try {
      const val = await AsyncStorage.getItem('cashOnHand');
      if (val) setCashOnHand(val);
    } catch (e) {}
  };

  const saveCash = async () => {
    try {
      await AsyncStorage.setItem('cashOnHand', cashEntryAmount);
      setCashOnHand(cashEntryAmount);
      setIsCashModalVisible(false);
    } catch (e) {}
  };

  const clearCash = async () => {
    try {
      await AsyncStorage.setItem('cashOnHand', '0');
      setCashOnHand('0');
    } catch (e) {}
  };
"""
home_content = re.sub(r'(const \[budgetBank, setBudgetBank\] = useState<string>\(\'All\'\);\n  const \[isBudgetModalVisible, setIsBudgetModalVisible\] = useState\(false\);\n  const \[showDatePicker, setShowDatePicker\] = useState\(false\);)', r'\1' + '\n' + state_vars, home_content)

# 2. Add loadCash to useEffect
home_content = re.sub(r'(loadBudget\(\);\n\s+loadPinSettings\(\);)', r'\1\n    loadCash();', home_content)

# 3. Add totalBalance with cashOnHand
total_balance_replacement = """
  // Calculate total for the hero section
  const totalBalance = balances.reduce((acc, curr) => {
    const val = parseFloat(curr.balance.replace(/,/g, ''));
    return acc + (isNaN(val) ? 0 : val);
  }, 0) + (parseFloat(cashOnHand) || 0);
"""
home_content = re.sub(r'  // Calculate total for the hero section[\s\S]*?\}, 0\);', total_balance_replacement.strip(), home_content)

# 4. Insert Cash on Hand UI
cash_ui = """
        {/* Cash on Hand Section */}
        <View style={styles.listHeader}>
          <Text style={styles.listSectionTitle}>Cash on Hand</Text>
          <View style={{ flexDirection: 'row', gap: 15 }}>
            <TouchableOpacity onPress={clearCash}>
              <MaterialCommunityIcons name="trash-can-outline" size={24} color={AppColors.error} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setCashEntryAmount(cashOnHand); setIsCashModalVisible(true); }}>
              <MaterialCommunityIcons name="plus" size={24} color={AppColors.primaryGreenStart} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={{ paddingHorizontal: 24, marginBottom: 20 }}>
          <View style={[styles.card, { borderColor: AppColors.border, backgroundColor: AppColors.card }]}>
            <View style={[styles.cardLeft, {backgroundColor: AppColors.background}]}>
              <MaterialCommunityIcons name="cash-multiple" size={30} color={AppColors.primaryGreenStart} />
            </View>
            <View style={styles.cardMid}>
              <Text style={styles.bankName}>Wallet</Text>
              <Text style={styles.lastTransactionDate}>Manual Entry</Text>
            </View>
            <View style={styles.cardRight}>
              <Text style={styles.cardBalance}>
                {balanceVisible ? `${Number(cashOnHand).toLocaleString('en-US')} ETB` : '****** ETB'}
              </Text>
            </View>
          </View>
        </View>
        
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
"""
home_content = re.sub(r'        <View style=\{styles\.listHeader\}>\s+<Text style=\{styles\.listSectionTitle\}>Accounts</Text>', cash_ui + r'          <Text style={styles.listSectionTitle}>Accounts</Text>', home_content)

# 5. Dynamic date updates in AccountCard
home_content = re.sub(r'function AccountCard\(\{ name, balance, subBalance, color, subColor, balanceVisible \}: \{ name: string, balance: string, subBalance: string, color: string, subColor: string, balanceVisible: boolean \}\) \{', 
                 r'function AccountCard({ name, balance, subBalance, color, subColor, balanceVisible, date }: { name: string, balance: string, subBalance: string, color: string, subColor: string, balanceVisible: boolean, date?: string }) {', home_content)

home_content = re.sub(r'<Text style=\{styles\.lastTransactionDate\}>10 JAN 2026</Text>', 
                 r'<Text style={styles.lastTransactionDate}>{date ? new Date(Number(date)).toLocaleDateString(\'en-GB\', { day: \'2-digit\', month: \'short\', year: \'numeric\' }).toUpperCase() : \'Unknown Date\'}</Text>', home_content)

home_content = re.sub(r'balanceVisible=\{balanceVisible\}\s+/>', 
                 r'balanceVisible={balanceVisible}\n                date={item.date}\n              />', home_content)

with open(home_path, "w", encoding="utf-8") as f:
    f.write(home_content)

# Now PlanScreen.tsx
plan_path = r"c:\Users\VICTUS\Documents\Code\My Balance App\screens\PlanScreen.tsx"

with open(plan_path, "r", encoding="utf-8") as f:
    plan_content = f.read()

# Billing cycle add 'once'
plan_content = re.sub(r"\['weekly', 'monthly', 'yearly'\]\.map\(\(cycle\)", r"['once', 'weekly', 'monthly', 'yearly'].map((cycle)", plan_content)

# Theme correction in PlanScreen modal
plan_content = re.sub(r'backgroundColor: \'#1C1C1E\'', r'backgroundColor: AppColors.card', plan_content)
plan_content = re.sub(r'backgroundColor: \'#27272A\'', r'backgroundColor: AppColors.background', plan_content)
plan_content = re.sub(r'borderColor: \'#3F3F46\'', r'borderColor: AppColors.border', plan_content)
plan_content = re.sub(r'color: \'#FFFFFF\'', r'color: AppColors.text', plan_content)
plan_content = re.sub(r'color: \'#9CA3AF\'', r'color: AppColors.subText', plan_content)
plan_content = re.sub(r'backgroundColor: \'#3F3F46\'', r'backgroundColor: AppColors.border', plan_content)

# Replace the icon colors in modal explicitly
plan_content = re.sub(r'color="#8B5CF6"', r'color={AppColors.primaryGreenStart}', plan_content)

# Specific fixes for text colors inside date buttons if needed
plan_content = re.sub(r'color: \'#FFF\',\s*fontSize: 14', r'color: AppColors.text,\n    fontSize: 14', plan_content)

# Option text active color fix
plan_content = re.sub(r'optionButtonActive: \{\s*backgroundColor: AppColors.background,', r'optionButtonActive: {\n    backgroundColor: AppColors.primaryGreenStart,', plan_content)

# Wait, original optionButtonActive in PlanScreen is:
# optionButtonActive: {
#   backgroundColor: '#8B5CF6',
#   borderColor: '#8B5CF6',
# }
# Since I didn't replace #8B5CF6 globally in PlanScreen, let's do it:
plan_content = re.sub(r"'#8B5CF6'", r"AppColors.primaryGreenStart", plan_content)

with open(plan_path, "w", encoding="utf-8") as f:
    f.write(plan_content)

print("Updates applied")
