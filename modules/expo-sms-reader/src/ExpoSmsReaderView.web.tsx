import * as React from 'react';

import { ExpoSmsReaderViewProps } from './ExpoSmsReader.types';

export default function ExpoSmsReaderView(props: ExpoSmsReaderViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
