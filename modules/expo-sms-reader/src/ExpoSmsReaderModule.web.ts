import { registerWebModule, NativeModule } from 'expo';

import { ChangeEventPayload } from './ExpoSmsReader.types';

type ExpoSmsReaderModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
}

class ExpoSmsReaderModule extends NativeModule<ExpoSmsReaderModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
};

export default registerWebModule(ExpoSmsReaderModule, 'ExpoSmsReaderModule');
