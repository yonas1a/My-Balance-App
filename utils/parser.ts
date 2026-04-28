import { SmsMessage } from '../modules/expo-sms-reader/src/ExpoSmsReaderModule';

export type BankBalance = {
  bankName: string;
  balance: string;
  type: 'balance' | 'received';
  date: string;
  originalText: string;
};

export const parseBankMessages = (messages: SmsMessage[]): BankBalance[] => {
  const latestBalances: Record<string, BankBalance> = {};

  messages.forEach((msg) => {
    const text = msg.body;
    const date = msg.date;

    // CBE (Commercial Bank of Ethiopia)
    if (text.includes('CBE') || text.includes('Current Balance is ETB')) {
      if (!latestBalances['CBE']) {
        const match = text.match(/Balance is ETB\s?([0-9,]+(?:\.[0-9]{1,2})?)/i);
        if (match) {
          latestBalances['CBE'] = {
            bankName: 'CBE',
            balance: match[1],
            type: 'balance',
            date,
            originalText: text,
          };
        }
      }
    }

    // Telebirr
    if (text.toLowerCase().includes('telebirr')) {
      if (!latestBalances['telebirr']) {
        const match = text.match(/balance is ETB\s?([0-9,]+(?:\.[0-9]{1,2})?)/i);
        if (match) {
          latestBalances['telebirr'] = {
            bankName: 'Telebirr',
            balance: match[1],
            type: 'balance',
            date,
            originalText: text,
          };
        }
      }
    }

    // CBE Birr (Sometimes shows received amount instead of balance)
    if (msg.address.toLowerCase().includes('cbebirr') || text.toLowerCase().includes('cbe birr') || text.includes('Br.')) {
      if (!latestBalances['cbebirr']) {
        // Find amount received
        const receivedMatch = text.match(/received\s?([0-9,]+(?:\.[0-9]{1,2})?)Br\./i);
        // Find general balance if exists
        const balanceMatch = text.match(/balance(?:\s.*?)?([0-9,]+(?:\.[0-9]{1,2})?)Br\./i);

        if (balanceMatch) {
            latestBalances['cbebirr'] = {
                bankName: 'CBE Birr',
                balance: balanceMatch[1],
                type: 'balance',
                date,
                originalText: text,
            };
        } else if (receivedMatch) {
            latestBalances['cbebirr'] = {
                bankName: 'CBE Birr',
                balance: receivedMatch[1],
                type: 'received', // Indicate it's an incoming transaction amount
                date,
                originalText: text,
            };
        }
      }
    }

    // Awash Bank
    // Sample: "Your Balance  is ETB 100,047.63. Receipt Link: ..."
    if (text.toLowerCase().includes('awash')) {
      if (!latestBalances['awash']) {
        // Primary: match "Your Balance is ETB <amount>" (handles extra spaces)
        const primaryMatch = text.match(/Your\s+Balance\s+is\s+ETB\s+([\d,]+(?:\.\d{1,2})?)/i);
        // Fallback: match "Balance is ETB <amount>"
        const fallbackMatch = text.match(/Balance\s+is\s+ETB\s+([\d,]+(?:\.\d{1,2})?)/i);
        const match = primaryMatch || fallbackMatch;
        if (match) {
          latestBalances['awash'] = {
            bankName: 'Awash Bank',
            balance: match[1],
            type: 'balance',
            date,
            originalText: text,
          };
        }
      }
    }
  });

  return Object.values(latestBalances);
};
