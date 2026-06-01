#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

/**
 * ObjC bridge header — required for React Native to discover the Swift NativeModule.
 * The module name "FahrtDocCarPlay" must match NativeModules.FahrtDocCarPlay in JS.
 */
RCT_EXTERN_MODULE(FahrtDocCarPlay, RCTEventEmitter)

RCT_EXTERN_METHOD(updateTripState:(NSDictionary *)state)

RCT_EXTERN_METHOD(addListener:(NSString *)eventName)
RCT_EXTERN_METHOD(removeListeners:(double)count)
