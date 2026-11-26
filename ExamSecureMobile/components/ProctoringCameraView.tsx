import React from 'react';
import {
  NativeModules,
  Platform,
  requireNativeComponent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { CameraView } from 'expo-camera';

interface ProctoringCameraViewProps {
  style?: StyleProp<ViewStyle>;
  cameraKey?: string | number;
}

const hasNativeProctoringView =
  Platform.OS === 'android' && Boolean(NativeModules.ProctoringModule);

const NativeProctoringCameraView = hasNativeProctoringView
  ? requireNativeComponent<{ style?: StyleProp<ViewStyle> }>('ProctoringCameraView')
  : null;

/**
 * Renders the single shared CameraX PreviewView when Android native proctoring
 * is active (preventing dual-camera conflicts with expo-camera), and falls back
 * to expo-camera's CameraView on iOS and Expo Go.
 */
export const ProctoringCameraView: React.FC<ProctoringCameraViewProps> = ({
  style,
  cameraKey,
}) => {
  if (NativeProctoringCameraView) {
    return <NativeProctoringCameraView key={cameraKey} style={style} />;
  }

  return <CameraView key={cameraKey} style={style} facing="front" />;
};
