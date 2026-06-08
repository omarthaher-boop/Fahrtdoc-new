#import <React/RCTBridgeModule.h>
  #import <React/RCTEventEmitter.h>

  @interface RCT_EXTERN_MODULE(FahrtDocCarPlay, RCTEventEmitter)

  RCT_EXTERN_METHOD(updateTripState:(NSDictionary *)state)
  RCT_EXTERN_METHOD(addListener:(NSString *)eventName)
  RCT_EXTERN_METHOD(removeListeners:(double)count)

  @end
  