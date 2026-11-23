/**
 * Safe Audio Wrapper for Expo
 * Gracefully guards against missing 'ExponentAV' native module in Expo Go,
 * web environments, or builds without expo-av native dependencies linked.
 */

let SafeAudio: any = null;
let isAudioAvailable = false;

try {
  // Dynamic require ensures failure in requireNativeModule('ExponentAV') is caught safely
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const av = require('expo-av');
  if (av && av.Audio) {
    SafeAudio = av.Audio;
    isAudioAvailable = true;
  }
} catch {
  // ExponentAV native module is missing in this runtime environment.
  // Audio monitoring will be safely disabled without crashing the app.
  SafeAudio = null;
  isAudioAvailable = false;
}

export { SafeAudio, isAudioAvailable };
