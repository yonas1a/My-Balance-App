import { requireNativeView } from 'expo';
import * as React from 'react';

import { ExpoSmsReaderViewProps } from './ExpoSmsReader.types';

const NativeView: React.ComponentType<ExpoSmsReaderViewProps> =
  requireNativeView('ExpoSmsReader');

export default function ExpoSmsReaderView(props: ExpoSmsReaderViewProps) {
  return <NativeView {...props} />;
}
