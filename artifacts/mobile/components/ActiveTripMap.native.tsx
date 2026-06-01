import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import { useColors } from "@/hooks/useColors";

interface Props {
  positions: { lat: number; lon: number }[];
  livePos: { lat: number; lon: number } | null;
}

export default function ActiveTripMap({ positions, livePos }: Props) {
  const colors = useColors();
  const mapRef = useRef<MapView>(null);
  const pingAnim = useRef(new Animated.Value(0)).current;

  const allPositions = livePos ? [...positions, livePos] : positions;

  const polylineCoords = allPositions.map((p) => ({
    latitude: p.lat,
    longitude: p.lon,
  }));

  const currentPos = livePos ?? (positions.length > 0 ? positions[positions.length - 1] : null);

  useEffect(() => {
    if (!currentPos || !mapRef.current) return;
    mapRef.current.animateToRegion(
      {
        latitude: currentPos.lat,
        longitude: currentPos.lon,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      },
      600
    );
  }, [currentPos?.lat, currentPos?.lon]);

  useEffect(() => {
    if (!livePos) {
      pingAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pingAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(300),
        Animated.timing(pingAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [livePos !== null, pingAnim]);

  const pingScale = pingAnim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 2.2] });
  const pingOpacity = pingAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.7, 0.35, 0] });

  const initialRegion = currentPos
    ? {
        latitude: currentPos.lat,
        longitude: currentPos.lon,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      }
    : {
        latitude: 51.1657,
        longitude: 10.4515,
        latitudeDelta: 3,
        longitudeDelta: 3,
      };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={initialRegion}
        scrollEnabled
        zoomEnabled
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        {polylineCoords.length >= 2 && (
          <Polyline
            coordinates={polylineCoords}
            strokeColor={colors.primary}
            strokeWidth={4}
          />
        )}
        {positions.length > 0 && (
          <Marker
            coordinate={{
              latitude: positions[0].lat,
              longitude: positions[0].lon,
            }}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={1}
          >
            <View style={[styles.startPin, { backgroundColor: colors.primary }]}>
              <View style={styles.startPinInner} />
            </View>
          </Marker>
        )}
        {currentPos && (
          <Marker
            coordinate={{ latitude: currentPos.lat, longitude: currentPos.lon }}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={10}
          >
            <View style={styles.liveOuter}>
              <Animated.View
                style={[
                  styles.livePing,
                  {
                    borderColor: colors.primary,
                    transform: [{ scale: pingScale }],
                    opacity: pingOpacity,
                  },
                ]}
              />
              <View style={[styles.livePin, { backgroundColor: colors.primary }]} />
            </View>
          </Marker>
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: "hidden" },
  map: { flex: 1 },
  startPin: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2.5,
    borderColor: "white",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },
  startPinInner: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "white",
  },
  liveOuter: {
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
  },
  livePing: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2.5,
  },
  livePin: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: "white",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
});
