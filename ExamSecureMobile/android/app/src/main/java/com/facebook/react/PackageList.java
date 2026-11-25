package com.facebook.react;

import android.app.Application;
import com.facebook.react.ReactPackage;
import com.facebook.react.shell.MainPackageConfig;
import com.facebook.react.shell.MainReactPackage;
import java.util.Arrays;
import java.util.ArrayList;

@SuppressWarnings("deprecation")
public class PackageList {
  private Application application;
  private ReactNativeHost reactNativeHost;
  private MainPackageConfig mConfig;

  public PackageList(ReactNativeHost reactNativeHost) {
    this(reactNativeHost, null);
  }

  public PackageList(Application application) {
    this(application, null);
  }

  public PackageList(ReactNativeHost reactNativeHost, MainPackageConfig config) {
    this.reactNativeHost = reactNativeHost;
    mConfig = config;
  }

  public PackageList(Application application, MainPackageConfig config) {
    this.reactNativeHost = null;
    this.application = application;
    mConfig = config;
  }

  public ArrayList<ReactPackage> getPackages() {
    return new ArrayList<>(Arrays.<ReactPackage>asList(
      new MainReactPackage(mConfig),
      // Expo modules — provides all expo-* native modules
      new expo.modules.ExpoModulesPackage(),
      // React Native community packages
      new com.reactnativecommunity.asyncstorage.AsyncStoragePackage(),
      new com.th3rdwave.safeareacontext.SafeAreaContextPackage(),
      new com.swmansion.rnscreens.RNScreensPackage(),
      new com.swmansion.gesturehandler.RNGestureHandlerPackage(),
      new com.swmansion.reanimated.ReanimatedPackage(),
      new com.swmansion.worklets.WorkletsPackage()
    ));
  }
}
