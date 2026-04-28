import { NativeModule, requireNativeModule } from 'expo';

import { ExpoSmsReaderModuleEvents } from './ExpoSmsReader.types';

export type SmsMessage = {
  address: string;
  body: string;
  date: string;
};

declare class ExpoSmsReaderModule extends NativeModule<ExpoSmsReaderModuleEvents> {
  getMessages(limit: number): Promise<SmsMessage[]>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<ExpoSmsReaderModule>('ExpoSmsReader');
