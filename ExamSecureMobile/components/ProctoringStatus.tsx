import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { proctoringService } from "../services/ProctoringService";
import { ProctoringEvent } from "../types/ProctoringEvent";
import { Colors } from "../constants/theme";

export const ProctoringStatus: React.FC = () => {
  const [currentEvent, setCurrentEvent] = useState<ProctoringEvent | null>(null);
  const [strikes, setStrikes] = useState<number>(0);

  useEffect(() => {
    const unsubscribe = proctoringService.addListener((event) => {
      setCurrentEvent(event);
      setStrikes(proctoringService.getStrikes());

      // Auto-revert healthy badge after 3.5s if not critical
      if (event.severity !== "CRITICAL") {
        const timer = setTimeout(() => {
          setCurrentEvent(null);
        }, 3500);
        return () => clearTimeout(timer);
      }
    });
    return unsubscribe;
  }, []);

  if (!currentEvent || currentEvent.type === "PROCTOR_HEALTHY") {
    return (
      <View style={[styles.badge, styles.badgeHealthy]}>
        <Ionicons name="shield-checkmark" size={13} color={Colors.primary} />
        <Text style={[styles.badgeText, { color: Colors.primary }]}>AI Proctor Active · Secure</Text>
      </View>
    );
  }

  const isCritical = currentEvent.severity === "CRITICAL" || currentEvent.type === "PHONE_DETECTED";

  const renderIcon = () => {
    switch (currentEvent.type) {
      case "PHONE_DETECTED":
        return <Ionicons name="phone-portrait-outline" size={13} color={Colors.error} />;
      case "MULTIPLE_FACES":
        return <Ionicons name="people-outline" size={13} color={Colors.error} />;
      case "GAZE_AWAY":
      case "HEAD_POSE_VIOLATION":
        return <Ionicons name="eye-outline" size={13} color={isCritical ? Colors.error : Colors.warning} />;
      default:
        return <Ionicons name="warning-outline" size={13} color={isCritical ? Colors.error : Colors.warning} />;
    }
  };

  return (
    <View style={[styles.badge, isCritical ? styles.badgeCritical : styles.badgeWarning]}>
      {renderIcon()}
      <Text
        style={[
          styles.badgeText,
          { color: isCritical ? Colors.errorText : Colors.warningText },
        ]}
        numberOfLines={1}
      >
        {currentEvent.message} {strikes > 0 ? `(${strikes} Strike${strikes > 1 ? "s" : ""})` : ""}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeHealthy: {
    backgroundColor: Colors.primaryPale,
    borderColor: Colors.primaryLight,
  },
  badgeWarning: {
    backgroundColor: Colors.warningLight,
    borderColor: Colors.warningBorder,
  },
  badgeCritical: {
    backgroundColor: Colors.errorLight,
    borderColor: Colors.errorBorder,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
