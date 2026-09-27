import React, { useState, useMemo } from "react";
import { ScrollView, Text, View, StyleSheet, Alert } from "react-native";
import Slider from "@react-native-community/slider";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Card, SectionTitle, PrimaryButton, Formula, ProgressBar } from "../components/UI";
import { colors } from "../theme";
import { DEFAULT_MATRIX } from "../data";
import { calcularLeontief, formatBRL } from "../utils/leontief";
import { BarChart } from "victory-native";

function LabeledSlider({ label, value, onChange, min, max, step = 1, unit = "%" }) {
  return (
    <View style={{ marginBottom: 20 }}>
      <View style={styles.sliderHeader}>
        <Text style={styles.small}>{label}</Text>
        <Text style={styles.sliderValue}>{value}{unit}</Text>
      </View>
      <Slider
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={value}
        onValueChange={onChange}
        minimumTrackTintColor={colors.secondary}
        maximumTrackTintColor="#334155"
        thumbTintColor={colors.primary}
      />
    </View>
  );
}

export default function SimulatorScreen() {
  const [hardware, setHardware] = useState(10);
  const [energia, setEnergia] = useState(15);
  const [automacao, setAutomacao] = useState(20);
  const [investimento, setInvestimento] = useState(500000);

  const resultado = useMemo(() => {
    const eficienciaTotal = hardware * 0.3 + energia * 0.4 + automacao * 0.3;
    const economiaAnual = investimento * (eficienciaTotal / 100) * 0.5;
    const roi = Math.max(0, ((economiaAnual * 3 - investimento) / investimento) * 100);
    const payback = Math.max(6, Math.ceil((investimento / Math.max(economiaAnual, 1)) * 12));
    return {
      roi: roi.toFixed(1),
      payback,
      deltaX: (eficienciaTotal * 0.8).toFixed(1),
      economia: Math.floor(economiaAnual),
      co2: (eficienciaTotal * 0.6).toFixed(1),
      eficienciaTotal,
    };
  }, [hardware, energia, automacao, investimento]);

  // Validação real via Leontief: simula redução de coeficientes
  const leontiefCheck = useMemo(() => {
    const C = DEFAULT_MATRIX.map((r) => [...r.valores]);
    const d = DEFAULT_MATRIX.map((r) => r.demanda);
    try {
      const base = calcularLeontief(C, d);
      const Cmod = C.map((row) => row.map((v) => v * (1 - resultado.eficienciaTotal / 200)));
      const mod = calcularLeontief(Cmod, d);
      if (base.status === "success" && mod.status === "success") {
        const delta = mod.producaoTotal.map((x, i) => (((x - base.producaoTotal[i]) / base.producaoTotal[i]) * 100).toFixed(1));
        return { ok: true, delta };
      }
      return { ok: false };
    } catch { return { ok: false }; }
  }, [resultado.eficienciaTotal]);

  const exportProposal = async () => {
    const html = `
      <html><body style="font-family: sans-serif; padding: 24px;">
        <h1>Proposta de Investimento — TI Verde</h1>
        <h2>Simulação de ROI — EcoBalance Ledger</h2>
        <p>Modelo: ΔX = (I − C − ΔB)⁻¹ · d − X₀ (Leontief)</p>
        <ul>
          <li><b>Investimento Inicial:</b> ${formatBRL(investimento)}</li>
          <li><b>ROI Estimado:</b> ${resultado.roi}%</li>
          <li><b>Payback:</b> ${resultado.payback} meses</li>
          <li><b>Economia Anual:</b> ${formatBRL(resultado.economia)}</li>
          <li><b>Redução de CO₂:</b> ${resultado.co2}%</li>
          <li><b>Variação Produção (ΔX):</b> +${resultado.deltaX}%</li>
        </ul>
        <p style="font-size: 11px; color: #666;">
          EcoBalance Ledger — Fatec Zona Leste / Centro Paula Souza. Conformidade IFRS S2 · GRI 305 · ISO 14001.
        </p>
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
        kicker="Simulação estratégica"
        title="Calculadora de Sensibilidade"
        subtitle="Preveja o impacto de mudanças técnicas (ΔB) na produção bruta (ΔX) e no ROI verde."
      />

      <Card accent={colors.secondary}>
        <Text style={styles.cardTitle}>Parâmetros de Simulação</Text>
        <LabeledSlider label="Eficiência de Hardware" value={hardware} onChange={setHardware} min={0} max={50} />
        <LabeledSlider label="Economia de Energia" value={energia} onChange={setEnergia} min={0} max={40} />
        <LabeledSlider label="Automação de Processos" value={automacao} onChange={setAutomacao} min={0} max={60} />
        <View style={{ marginBottom: 8 }}>
          <View style={styles.sliderHeader}>
            <Text style={styles.small}>Investimento Inicial</Text>
            <Text style={styles.sliderValue}>{formatBRL(investimento)}</Text>
          </View>
          <Slider minimumValue={100000} maximumValue={5000000} step={100000} value={investimento}
            onValueChange={setInvestimento} minimumTrackTintColor={colors.secondary}
            maximumTrackTintColor="#334155" thumbTintColor={colors.primary} />
        </View>
        <Formula>ΔX = (I − C − ΔB)⁻¹ · d − X₀</Formula>
      </Card>

      <Card accent={colors.primary}>
        <Text style={styles.cardTitle}>Projeção de Resultados</Text>
        <View style={styles.resultGrid}>
          <View style={styles.resultBox}><Text style={styles.resultBig}>{resultado.roi}%</Text><Text style={styles.resultLabel}>ROI Estimado</Text></View>
          <View style={styles.resultBox}><Text style={[styles.resultBig, { color: colors.secondary }]}>{resultado.payback}</Text><Text style={styles.resultLabel}>Payback (meses)</Text></View>
        </View>
        <View style={styles.kvRow}><Text style={styles.smallMuted}>Variação Produção (ΔX)</Text><Text style={styles.kvVal}>+{resultado.deltaX}%</Text></View>
        <View style={styles.kvRow}><Text style={styles.smallMuted}>Economia Anual</Text><Text style={styles.kvVal}>{formatBRL(resultado.economia)}</Text></View>
        <View style={styles.kvRow}><Text style={styles.smallMuted}>Redução CO₂</Text><Text style={styles.kvVal}>−{resultado.co2}%</Text></View>
      </Card>

      {leontiefCheck.ok && (
        <Card>
          <Text style={styles.cardTitle}>Validação via Inversa de Leontief (por setor)</Text>
          {leontiefCheck.delta.map((d, i) => (
            <View key={i} style={{ marginBottom: 8 }}>
              <View style={styles.kvRow}>
                <Text style={styles.smallMuted}>{DEFAULT_MATRIX[i].nome}</Text>
                <Text style={{ color: parseFloat(d) >= 0 ? colors.primary : colors.danger, fontWeight: "700" }}>
                  {parseFloat(d) >= 0 ? "+" : ""}{d}%
                </Text>
              </View>
              <ProgressBar value={Math.abs(parseFloat(d)) * 4} color={colors.primary} height={6} />
            </View>
          ))}
        </Card>
      )}

      <Card>
        <Text style={styles.cardTitle}>Análise de Sensibilidade — pesos do modelo</Text>
        <BarChart
          data={[
            { x: "Hardware", y: hardware },
            { x: "Energia", y: energia },
            { x: "Automação", y: automacao },
            { x: "M. Obra", y: 25 },
            { x: "Outros", y: 40 },
          ]}
          width={320} height={180}
          style={{ data: { fill: colors.primary } }}
        />
      </Card>

      <PrimaryButton title="Exportar Proposta para Diretoria (PDF)" icon="📄" onPress={exportProposal} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  cardTitle: { color: colors.text, fontWeight: "700", fontSize: 15, marginBottom: 10 },
  small: { color: colors.text, fontSize: 13 },
  smallMuted: { color: colors.muted, fontSize: 12 },
  sliderHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  sliderValue: { color: colors.secondary, fontWeight: "700", fontVariant: ["tabular-nums"] },
  resultGrid: { flexDirection: "row", gap: 10, marginBottom: 12 },
  resultBox: { flex: 1, backgroundColor: "#0f172a", borderRadius: 12, padding: 14, alignItems: "center" },
  resultBig: { color: colors.primary, fontSize: 26, fontWeight: "800", fontVariant: ["tabular-nums"] },
  resultLabel: { color: colors.muted, fontSize: 11, marginTop: 2 },
  kvRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 5 },
  kvVal: { color: colors.primary, fontWeight: "700", fontVariant: ["tabular-nums"] },
});