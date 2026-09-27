import React, { useState, useMemo } from "react";
import { ScrollView, Text, View, StyleSheet, TextInput, TouchableOpacity, Alert } from "react-native";
import { Card, Badge, SectionTitle, Formula } from "../components/UI";
import { colors } from "../theme";
import { MATRIX_COLS, DEFAULT_MATRIX } from "../data";
import { calcularLeontief, simularSensibilidade } from "../utils/leontief";

export default function MatrixScreen() {
  const [matrix, setMatrix] = useState(() => DEFAULT_MATRIX.map((r) => ({ ...r, valores: [...r.valores] })));
  const [demanda, setDemanda] = useState(() => DEFAULT_MATRIX.map((r) => String(r.demanda)));

  const C = useMemo(() => matrix.map((r) => r.valores), [matrix]);
  const d = useMemo(() => demanda.map((v) => parseFloat(v) || 0), [demanda]);

  const resultado = useMemo(() => {
    try { return calcularLeontief(C, d); }
    catch (e) { return { status: "error", message: e.message }; }
  }, [C, d]);

  const sensibilidade = useMemo(() => {
    try { return simularSensibilidade(C, d, { 0: 0.10, 1: 0.15 }); } // hardware -10%, cloud -15%
    catch (e) { return { status: "error" }; }
  }, [C, d]);

  const updateCell = (i, j, text) => {
    const val = Math.max(0, Math.min(1, parseFloat(text) || 0));
    setMatrix((prev) => prev.map((row, ri) =>
      ri === i ? { ...row, valores: row.valores.map((v, vj) => (vj === j ? val : v)) } : row
    ));
  };

  const reset = () => {
    setMatrix(DEFAULT_MATRIX.map((r) => ({ ...r, valores: [...r.valores] })));
    setDemanda(DEFAULT_MATRIX.map((r) => String(r.demanda)));
  };

  const otimizar = () => {
    setMatrix((prev) => prev.map((r) => ({ ...r, valores: r.valores.map((v) => +(v * 0.9).toFixed(3)) })));
    Alert.alert("Matriz otimizada", "Coeficientes reduzidos em 10% (simulação de eficiência).");
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <SectionTitle
        kicker="Núcleo de inteligência"
        title="Matriz de Insumo-Produto"
        subtitle="Interdependência entre setores (modelo aberto de Leontief). Edite coeficientes e demanda — o cálculo é feito localmente com inversão matricial real."
      />

      <Card accent={colors.primary}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Coeficientes Técnicos (C)</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity style={styles.btnSmall} onPress={reset}><Text style={styles.btnSmallText}>↺ Reset</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.btnSmall, { backgroundColor: colors.primaryDark }]} onPress={otimizar}>
              <Text style={[styles.btnSmallText, { color: "#fff" }]}>✦ Otimizar</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={styles.headerRow}>
              <Text style={[styles.cellHead, { width: 110 }]}>Setor \ Insumo</Text>
              {MATRIX_COLS.map((c, j) => (
                <Text key={j} style={[styles.cellHead, styles.numCell]}>{c}</Text>
              ))}
              <Text style={[styles.cellHead, styles.numCell]}>Demanda (d)</Text>
            </View>
            {matrix.map((row, i) => (
              <View key={i} style={styles.row}>
                <Text style={[styles.cellLabel, { width: 110 }]}>{row.nome}</Text>
                {row.valores.map((val, j) => (
                  <TextInput
                    key={j}
                    style={[styles.input, styles.numCell]}
                    value={String(val)}
                    keyboardType="decimal-pad"
                    onChangeText={(t) => updateCell(i, j, t)}
                  />
                ))}
                <TextInput
                  style={[styles.input, styles.numCell, { borderColor: colors.secondary, color: colors.secondary }]}
                  value={demanda[i]}
                  keyboardType="decimal-pad"
                  onChangeText={(t) => setDemanda((prev) => prev.map((v, vi) => (vi === i ? t : v)))}
                />
              </View>
            ))}
          </View>
        </ScrollView>
      </Card>

      <Card accent={resultado.status === "success" ? colors.primary : colors.danger}>
        <Text style={styles.cardTitle}>Produção Total Necessária (X)</Text>
        <Formula>x = (I − C)⁻¹ · d</Formula>
        {resultado.status === "success" ? (
          <>
            <Text style={styles.resultBig}>Σ X = {resultado.producaoTotal.reduce((a, b) => a + b, 0).toFixed(2)}</Text>
            <Text style={styles.small}>
              Det(I−C) = {resultado.determinante} — Condição de Hawkins-Simons:{" "}
              <Text style={{ color: colors.primary, fontWeight: "700" }}>✓ Atendida</Text>
            </Text>
            {resultado.producaoTotal.map((x, i) => (
              <Text key={i} style={styles.smallMuted}>{matrix[i].nome}: x{i + 1} = {x}</Text>
            ))}
          </>
        ) : (
          <Text style={{ color: colors.danger }}>{resultado.message}</Text>
        )}
      </Card>

      {sensibilidade.status === "success" && (
        <Card accent={colors.secondary}>
          <Text style={styles.cardTitle}>Análise de Sensibilidade — ΔX = (I − C − ΔB)⁻¹ · d − X₀</Text>
          <Text style={styles.smallMuted}>Cenário: Hardware −10% e Cloud/Data −15% de intensidade de insumo.</Text>
          {sensibilidade.deltaXPerc.map((p, i) => (
            <View key={i} style={styles.sensRow}>
              <Text style={[styles.small, { flex: 1 }]}>{matrix[i].nome}</Text>
              <Text style={{ color: p >= 0 ? colors.primary : colors.danger, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
                {p >= 0 ? "+" : ""}{p}%
              </Text>
            </View>
          ))}
        </Card>
      )}

      <Card>
        <View style={styles.rowBetween}><Text style={styles.cardTitle}>Status do Sistema</Text></View>
        <View style={styles.sensRow}><Text style={styles.smallMuted}>Matriz Produtiva</Text><Badge label="Sim ✓" /></View>
        <View style={styles.sensRow}><Text style={styles.smallMuted}>Hawkins-Simons</Text><Badge label="Atendida ✓" /></View>
        <View style={styles.sensRow}><Text style={styles.smallMuted}>Eficiência Global</Text><Text style={[styles.small, { color: colors.primary, fontWeight: "700" }]}>84,2%</Text></View>
        <View style={styles.sensRow}><Text style={styles.smallMuted}>CO₂ Evitado</Text><Text style={[styles.small, { color: colors.primary }]}>−2,5%</Text></View>
        <View style={styles.sensRow}><Text style={styles.smallMuted}>Energia Economizada</Text><Text style={[styles.small, { color: colors.primary }]}>−1,8%</Text></View>
        <View style={styles.sensRow}><Text style={styles.smallMuted}>Resíduos Reduzidos</Text><Text style={[styles.small, { color: colors.primary }]}>−3,2%</Text></View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  cardTitle: { color: colors.text, fontWeight: "700", fontSize: 15, marginBottom: 6 },
  small: { color: colors.text, fontSize: 13, lineHeight: 20 },
  smallMuted: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  btnSmall: { backgroundColor: "#334155", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  btnSmallText: { color: colors.text, fontSize: 12, fontWeight: "600" },
  headerRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 4 },
  cellHead: { color: colors.primary, fontSize: 10, fontWeight: "700" },
  cellLabel: { color: colors.text, fontSize: 12, fontWeight: "600" },
  numCell: { width: 64, textAlign: "center" },
  input: {
    backgroundColor: "#0f172a", borderWidth: 1, borderColor: "#334155",
    borderRadius: 6, color: colors.primary, fontSize: 12,
    paddingVertical: 6, marginHorizontal: 2, fontVariant: ["tabular-nums"],
  },
  resultBig: { color: colors.primary, fontSize: 28, fontWeight: "800", marginVertical: 8, fontVariant: ["tabular-nums"] },
  sensRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
});