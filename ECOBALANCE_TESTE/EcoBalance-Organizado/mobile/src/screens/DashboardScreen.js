import React, { useState } from "react";
import { ScrollView, Text, View, StyleSheet, Dimensions, Alert } from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Card, SectionTitle, PrimaryButton, ProgressBar, Badge } from "../components/UI";
import { colors } from "../theme";
import { KPIS, SERIE_ANUAL, RADAR_LABELS, RADAR_2015, RADAR_2025, CENARIOS_2030, LOCATIONS } from "../data";
import { LineChart, AreaChart } from "victory-native";

const METRICS = {
  co2: { label: "Emissões CO₂ (t)", data: SERIE_ANUAL.co2, color: "#10b981" },
  roi: { label: "ROI Sustentável (%)", data: SERIE_ANUAL.roi, color: "#0ea5e9" },
};

export default function DashboardScreen() {
  const [metric, setMetric] = useState("co2");
  const W = Dimensions.get("window").width - 64;
  const m = METRICS[metric];

  const exportReport = async () => {
    const html = `
      <html><body style="font-family: sans-serif; padding: 24px;">
        <h1>EcoBalance Ledger — Relatório ESG</h1>
        <h2>Período: 2015–2026</h2>
        <p>Conformidade: ISO 14001 | IFRS S2 | GRI 305</p>
        <ul>
          ${KPIS.map((k) => `<li><b>${k.label}:</b> ${k.valor}</li>`).join("")}
        </ul>
        <p>Emissões Escopo 2 reduzidas de 1.200 tCO₂e (2015) para 820 tCO₂e (2025/26).
        ROI Sustentável elevado de 4,2% para 14,2%. Ganho de produtividade tecnológica de 14,2%.</p>
        <p style="font-size: 11px; color: #666;">Documento gerado automaticamente — EcoBalance Ledger</p>
      </body></html>`;
    try {
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
      else Alert.alert("PDF gerado", uri);
    } catch (e) { Alert.alert("Erro", e.message); }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <SectionTitle
        kicker="Evolução decenal"
        title="Dashboard ESG 2015–2026"
        subtitle="Análise comparativa com decomposição estrutural e previsão de resiliência climática IFRS S2."
      />

      <View style={styles.kpiGrid}>
        {KPIS.map((k, i) => (
          <Card key={i} style={[styles.kpiCard, { borderColor: k.cor }]}>
            <Text style={[styles.kpiValor, { color: k.cor }]}>{k.valor}</Text>
            <Text style={styles.kpiLabel}>{k.label}</Text>
            <Text style={[styles.kpiTrend, { color: k.tendencia >= 0 ? colors.primary : colors.danger }]}>
              {k.tendencia >= 0 ? "▲" : "▼"} {Math.abs(k.tendencia)}% vs 2015
            </Text>
          </Card>
        ))}
      </View>

      <Card accent={colors.primary}>
        <View style={styles.metricTabs}>
          {Object.keys(METRICS).map((key) => (
            <Text key={key}
              onPress={() => setMetric(key)}
              style={[styles.tab, metric === key && styles.tabActive]}>
              {METRICS[key].label}
            </Text>
          ))}
        </View>
        <AreaChart
          data={m.data.map((y, i) => ({ x: SERIE_ANUAL.anos[i], y }))}
          width={W} height={220}
          style={{ data: { stroke: m.color, fill: m.color, fillOpacity: 0.15, strokeWidth: 2 } }}
        />
        <Text style={styles.chartCaption}>
          {metric === "co2"
            ? "Redução contínua: 200 t → 120 t (dashboard); Escopo 2: 1.200 → 820 tCO₂e (artigo)"
            : "ROI Sustentável: 4,2% (2015) → 14,2% (2025/26), conforme Tabela 1 do artigo"}
        </Text>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Comparativo 2015 vs 2025</Text>
        {RADAR_LABELS.map((label, i) => {
          const gain = RADAR_2025[i] - RADAR_2015[i];
          return (
            <View key={i} style={{ marginBottom: 8 }}>
              <View style={styles.kvRow}>
                <Text style={styles.smallMuted}>{label}</Text>
                <Text style={{ color: colors.primary, fontWeight: "700" }}>+{gain} pts</Text>
              </View>
              <ProgressBar value={RADAR_2015[i]} color="#6b7280" height={6} />
              <View style={{ height: 3 }} />
              <ProgressBar value={RADAR_2025[i]} color={colors.primary} height={6} />
            </View>
          );
        })}
        <Text style={styles.chartCaption}>Cinza: 2015 • Verde: 2025 • Ganho de eficiência global: +14,2%</Text>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Geolocalização de Ativos e Resíduos (IoT)</Text>
        <View style={styles.mapWrapper}>
          <MapView
            style={{ width: "100%", height: 280, borderRadius: 12 }}
            initialRegion={{ latitude: -23.55, longitude: -46.63, latitudeDelta: 8, longitudeDelta: 8 }}
          >
            {LOCATIONS.map((loc, i) => (
              <Marker key={i} coordinate={{ latitude: loc.lat, longitude: loc.lng }}
                pinColor={loc.cor} title={loc.title} description="Status: Ativo" />
            ))}
          </MapView>
        </View>
      </Card>

      <Card accent={colors.accent}>
        <Text style={styles.cardTitle}>Previsão de Resiliência Climática (IFRS S2) — 2030</Text>
        {CENARIOS_2030.map((c, i) => (
          <View key={i} style={{ marginBottom: 12 }}>
            <View style={styles.kvRow}>
              <Text style={styles.small}>{c.nome}</Text>
              <Text style={{ color: c.cor, fontWeight: "800", fontSize: 16 }}>{c.valor}%</Text>
            </View>
            <ProgressBar value={c.valor} color={c.cor} />
            <Text style={styles.chartCaption}>{c.desc}</Text>
          </View>
        ))}
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
          <Badge label="Docker Ready" /><Badge label="MySQL 8.0" color={colors.secondary} />
          <Badge label="SHA-256" color={colors.accent} /><Badge label="Twilio Alerts" color={colors.warning} />
        </View>
      </Card>

      <PrimaryButton title="Gerar Relatório ESG (PDF)" icon="📊" onPress={exportReport} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  cardTitle: { color: colors.text, fontWeight: "700", fontSize: 15, marginBottom: 10 },
  small: { color: colors.text, fontSize: 13 },
  smallMuted: { color: colors.muted, fontSize: 12 },
  kvRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 3 },
  chartCaption: { color: colors.muted, fontSize: 11, marginTop: 8, textAlign: "center" },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpiCard: { width: "47%", flex: 1, minWidth: 150, alignItems: "center" },
  kpiValor: { fontSize: 22, fontWeight: "800" },
  kpiLabel: { color: colors.muted, fontSize: 11, textAlign: "center", marginTop: 4 },
  kpiTrend: { fontSize: 11, marginTop: 4, fontWeight: "600" },
  metricTabs: { flexDirection: "row", gap: 8, marginBottom: 12 },
  tab: { color: colors.muted, fontSize: 12, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: "#0f172a" },
  tabActive: { color: "#fff", backgroundColor: colors.primaryDark, fontWeight: "700" },
  mapWrapper: { borderRadius: 12, overflow: "hidden" },
});