// Reexport the native module. On web, it will be resolved to ExpoSmsReaderModule.web.ts
// and on native platforms to ExpoSmsReaderModule.ts
export { default } from './src/ExpoSmsReaderModule';
export { default as ExpoSmsReaderView } from './src/ExpoSmsReaderView';
export * from  './src/ExpoSmsReader.types';
