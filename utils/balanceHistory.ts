import AsyncStorage from '@react-native-async-storage/async-storage';
import { SmsMessage } from '../modules/expo-sms-reader/src/ExpoSmsReaderModule';

const HISTORY_KEY = 'balance_history_v1';

export interface BalanceSnapshot {
  date: string;         // 'YYYY-MM-DD'
  total: number;
  banks: Record<string, number>; // bankName -> balance
}

/** Load the full history array from storage */
export async function loadHistory(): Promise<BalanceSnapshot[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as BalanceSnapshot[];
  } catch {
    return [];
  }
}

/** Save or update today's snapshot (upsert by date) */
export async function saveSnapshot(total: number, banks: Record<string, number>): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const history = await loadHistory();

    const existingIdx = history.findIndex(h => h.date === today);
    const snapshot: BalanceSnapshot = { date: today, total, banks };

    if (existingIdx >= 0) {
      history[existingIdx] = snapshot;
    } else {
      history.push(snapshot);
    }

    const trimmed = history
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-400);

    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error('Failed to save balance snapshot:', e);
  }
}

/**
 * Build historical snapshots by scanning ALL SMS messages by date.
 * For each day, we take the LATEST balance message per bank found on that day.
 * This gives us real historical chart data from past SMS.
 */
export async function buildHistoryFromSms(messages: SmsMessage[]): Promise<void> {
  try {
    // Group by date, then by bank
    const byDate: Record<string, Record<string, { balance: number; ts: number }>> = {};

    messages.forEach(msg => {
      const ts = typeof msg.date === 'number' ? msg.date : parseInt(msg.date, 10);
      if (isNaN(ts) || ts <= 0) return;

      const dateStr = new Date(ts).toISOString().split('T')[0];
      if (!byDate[dateStr]) byDate[dateStr] = {};

      const text = msg.body;
      const addr = msg.address?.toLowerCase() ?? '';

      // ── CBE Bank ─────────────────────────────────────────────────────────
      if (text.includes('CBE') || text.includes('Current Balance is ETB')) {
        const match = text.match(/Balance is ETB\s?([0-9,]+(?:\.[0-9]{1,2})?)/i);
        if (match) {
          const val = parseFloat(match[1].replace(/,/g, ''));
          if (!isNaN(val)) {
            const existing = byDate[dateStr]['CBE'];
            if (!existing || ts > existing.ts) {
              byDate[dateStr]['CBE'] = { balance: val, ts };
            }
          }
        }
      }

      // ── Telebirr ─────────────────────────────────────────────────────────
      if (text.toLowerCase().includes('telebirr')) {
        const match = text.match(/balance is ETB\s?([0-9,]+(?:\.[0-9]{1,2})?)/i);
        if (match) {
          const val = parseFloat(match[1].replace(/,/g, ''));
          if (!isNaN(val)) {
            const existing = byDate[dateStr]['Telebirr'];
            if (!existing || ts > existing.ts) {
              byDate[dateStr]['Telebirr'] = { balance: val, ts };
            }
          }
        }
      }

      // ── CBE Birr ──────────────────────────────────────────────────────────
      if (addr.includes('cbebirr') || text.toLowerCase().includes('cbe birr') || text.includes('Br.')) {
        const balanceMatch = text.match(/balance(?:\s.*?)?([0-9,]+(?:\.[0-9]{1,2})?)Br\./i);
        const receivedMatch = text.match(/received\s?([0-9,]+(?:\.[0-9]{1,2})?)Br\./i);
        const raw = balanceMatch?.[1] ?? receivedMatch?.[1];
        if (raw) {
          const val = parseFloat(raw.replace(/,/g, ''));
          if (!isNaN(val)) {
            const existing = byDate[dateStr]['CBE Birr'];
            if (!existing || ts > existing.ts) {
              byDate[dateStr]['CBE Birr'] = { balance: val, ts };
            }
          }
        }
      }

      // ── Awash Bank ────────────────────────────────────────────────────────
      if (text.toLowerCase().includes('awash')) {
        const match =
          text.match(/Your\s+Balance\s+is\s+ETB\s+([\d,]+(?:\.\d{1,2})?)/i) ??
          text.match(/Balance\s+is\s+ETB\s+([\d,]+(?:\.\d{1,2})?)/i);
        if (match) {
          const val = parseFloat(match[1].replace(/,/g, ''));
          if (!isNaN(val)) {
            const existing = byDate[dateStr]['Awash Bank'];
            if (!existing || ts > existing.ts) {
              byDate[dateStr]['Awash Bank'] = { balance: val, ts };
            }
          }
        }
      }
    });

    if (Object.keys(byDate).length === 0) return;

    // Merge with existing history (SMS data fills gaps, but stored snapshots take priority)
    const existing = await loadHistory();
    const existingMap: Record<string, BalanceSnapshot> = {};
    existing.forEach(s => { existingMap[s.date] = s; });

    Object.entries(byDate).forEach(([date, bankMap]) => {
      if (existingMap[date]) return; // already have a real snapshot for this day — don't overwrite

      const banks: Record<string, number> = {};
      Object.entries(bankMap).forEach(([bank, { balance }]) => { banks[bank] = balance; });
      const total = Object.values(banks).reduce((a, b) => a + b, 0);

      existingMap[date] = { date, total, banks };
    });

    const merged = Object.values(existingMap)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-400);

    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(merged));
  } catch (e) {
    console.error('Failed to build history from SMS:', e);
  }
}

/** Get daily data for chart — either total or a specific bank, for N days back */
export function filterHistory(
  history: BalanceSnapshot[],
  bankName: string,   // 'Total' or a bank name
  days: number
): { date: string; balance: number }[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  return history
    .filter(h => h.date >= cutoffStr)
    .map(h => ({
      date: formatDate(h.date),
      balance: bankName === 'Total' ? h.total : (h.banks[bankName] ?? 0),
    }))
    .filter(d => d.balance > 0); // drop days with no data for this bank
}

function formatDate(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  return `${parseInt(day)}/${parseInt(month)}`;
}
