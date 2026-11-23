import React from 'react';
import {
  Image,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
  type ImageStyle,
} from 'react-native';

export type KalpanaaaLogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'hero' | 'fill';

interface KalpanaaaLogoProps {
  size?: KalpanaaaLogoSize;
  style?: StyleProp<ImageStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  maxWidthPercent?: number; // e.g. 0.85 for 85% of screen width
}

// Exact aspect ratio of the 1024x253 official PNG logo
const LOGO_ASPECT_RATIO = 1024 / 253; // 4.04743

export default function KalpanaaaLogo({
  size = 'md',
  style,
  containerStyle,
  maxWidthPercent,
}: KalpanaaaLogoProps) {
  const { width: windowWidth } = useWindowDimensions();

  // Determine ideal width based on size preset and screen boundary
  let baseWidth: number;
  let maxScreenRatio: number;

  switch (size) {
    case 'xs':
      baseWidth = 110;
      maxScreenRatio = 0.34;
      break;
    case 'sm':
      baseWidth = 145;
      maxScreenRatio = 0.44;
      break;
    case 'md':
      baseWidth = 190;
      maxScreenRatio = 0.60;
      break;
    case 'lg':
      baseWidth = 240;
      maxScreenRatio = 0.74;
      break;
    case 'hero':
      baseWidth = 290;
      maxScreenRatio = 0.84;
      break;
    case 'fill':
      baseWidth = 340;
      maxScreenRatio = 0.92;
      break;
    default:
      baseWidth = 190;
      maxScreenRatio = 0.60;
  }

  const effectiveMaxRatio = maxWidthPercent ?? maxScreenRatio;
  const targetWidth = Math.min(baseWidth, Math.round(windowWidth * effectiveMaxRatio));
  const targetHeight = Math.round(targetWidth / LOGO_ASPECT_RATIO);

  return (
    <View style={[styles.container, containerStyle]}>
      <Image
        source={require('../assets/kalpanaa_logo.png')}
        style={[
          {
            width: targetWidth,
            height: targetHeight,
            aspectRatio: LOGO_ASPECT_RATIO,
          },
          styles.image,
          style,
        ]}
        resizeMode="contain"
        accessible={true}
        accessibilityLabel="Kalpanaaa Software Solutions Pvt Ltd"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    maxWidth: '100%',
  },
});
