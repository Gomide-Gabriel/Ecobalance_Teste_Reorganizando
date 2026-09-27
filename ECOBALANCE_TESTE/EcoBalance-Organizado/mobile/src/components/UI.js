import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { colors } from "../theme";

export function Card({ children, style, accent }) {
  return (
    <View style={[styles.card, accent && { borderColor: accent }, style]}>{children}</View>
  );
}

export function Badge({ label, color = colors.primary }) {
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export function Metric({ valor, label, cor = colors.primary, sub }) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValor, { color: cor }]}>{valor}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      {sub && <Text style={styles.metricSub}>{sub}</Text>}
    </View>
  );
}

export function SectionTitle({ kicker, title, subtitle }) {
  return (
    <View style={{ marginBottom: 16 }}>
      {kicker && <Text style={styles.kicker}>{kicker}</Text>}
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

export function PrimaryButton({ title, onPress, icon }) {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.buttonText}>{icon ? icon + "  " : ""}{title}</Text>
    </TouchableOpacity>
  );
}

export function ProgressBar({ value, color = colors.primary, height = 8 }) {
  return (
    <View style={{ height, backgroundColor: "#334155", borderRadius: height / 2, overflow: "hidden" }}>
      <View style={{ width: `${Math.min(100, value)}%`, height: "100%", backgroundColor: color, borderRadius: height / 2 }} />
    </View>
  );
}

export function Formula({ children }) {
  return (
    <View style={styles.formula}>
      <Text style={styles.formulaText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  badgeText: { fontSize: 11, fontWeight: "600" },
  metric: { alignItems: "center", paddingVertical: 8, paddingHorizontal: 4, flex: 1 },
  metricValor: { fontSize: 22, fontWeight: "800" },
  metricLabel: { fontSize: 11, color: colors.muted, textAlign: "center", marginTop: 2 },
  metricSub: { fontSize: 10, color: colors.muted, marginTop: 2 },
  kicker: { color: colors.primary, fontSize: 12, letterSpacing: 2, fontWeight: "700", textTransform: "uppercase" },
  title: { color: colors.text, fontSize: 24, fontWeight: "800", marginTop: 4 },
  subtitle: { color: colors.muted, fontSize: 14, marginTop: 6, lineHeight: 20 },
  button: {
    backgroundColor: colors.primaryDark,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  formula: {
    backgroundColor: "rgba(16,185,129,0.1)",
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  formulaText: { fontFamily: "monospace", color: "#6ee7b7", fontSize: 14 },
});