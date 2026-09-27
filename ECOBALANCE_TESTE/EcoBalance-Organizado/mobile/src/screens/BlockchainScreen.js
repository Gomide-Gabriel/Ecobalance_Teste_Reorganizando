import React, { useEffect, useState } from "react";
import { ScrollView, Text, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card, Badge, SectionTitle, Metric } from "../components/UI";
import { colors } from "../theme";
import { TRANSACTIONS, CERTIFICACOES } from "../data";

export default function BlockchainScreen() {
  const [block, setBlock] = useState("7F8C8D");

  useEffect(() => {
    const t = setInterval(() => {
      setBlock(Math.floor(Math.random() * 16777215).toString(16).toUpperCase().padStart(6, "0"));
    }, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <SectionTitle
        kicker="Rastreabilidade"
        title="Blockchain Ledger Imutável"
        subtitle="Cada crédito de carbono e resíduo eletrônico registrado em rede distribuída com hash SHA-256 — auditoria digital automática conforme ISO."
      />

      <View style={styles.metricsRow}>
        <Metric valor="12" label="Nós Ativos" cor={colors.primary} />
        <Metric valor={`#${block}`} label="Bloco Atual" cor={colors.accent} />
        <Metric valor="2,3s" label="Tempo Médio" cor={colors.secondary} />
      </View>

      <Card accent={colors.accent}>
        <Text style={styles.cardTitle}>Transações Recentes</Text>
        {TRANSACTIONS.map((tx, i) => (
          <View key={i} style={styles.tx}>
            <View style={styles.txHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                <View style={styles.txIcon}>
                  <Ionicons name={tx.icon} size={16} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txTipo}>{tx.tipo}</Text>
                  <Text style={styles.txData}>{tx.data} • {tx.setor}</Text>
                </View>
              </View>
              <Text style={{ color: tx.valor > 0 ? colors.primary : colors.danger, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
                {tx.valor > 0 ? "+" : ""}{tx.valor} {tx.unidade}
              </Text>
            </View>
            <Text style={styles.hash}>Hash: {tx.hash}</Text>
            <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
              <Badge label={tx.norma} color={colors.primary} />
            </View>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Certificações Ativas</Text>
        {CERTIFICACOES.map((c, i) => (
          <View key={i} style={styles.certRow}>
            <Ionicons name="ribbon" size={16} color={colors.primary} />
            <Text style={styles.certText}>{c}</Text>
          </View>
        ))}
      </Card>

      <Card accent={colors.primary} style={{ alignItems: "center" }}>
        <Text style={{ color: colors.primary, fontSize: 32, fontWeight: "800" }}>100%</Text>
        <Text style={styles.smallMuted}>Dados Auditáveis — zero alterações não autorizadas desde 2015</Text>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Esquema MySQL 8.0 (artigo)</Text>
        <Text style={styles.code}>
{`logs_transacoes_blockchain(
  id_hash PK, timestamp_registro,
  id_indicador_gri, valor_calculado,
  hash_anterior, hash_verificacao SHA-256,
  status_auditoria ENUM('pendente','verificado','alerta')
)`}
        </Text>
        <Text style={styles.smallMuted}>
          Tabelas particionadas por série temporal (2015–2026) com gatilhos para geração de hashes encadeados.
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  metricsRow: { flexDirection: "row", backgroundColor: colors.card, borderRadius: 16, padding: 8, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  cardTitle: { color: colors.text, fontWeight: "700", fontSize: 15, marginBottom: 10 },
  tx: { backgroundColor: "#0f172a", borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: "#334155" },
  txHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  txIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(139,92,246,0.2)", alignItems: "center", justifyContent: "center" },
  txTipo: { color: colors.text, fontWeight: "600", fontSize: 13 },
  txData: { color: colors.muted, fontSize: 11 },
  hash: { color: colors.primary, fontSize: 10, fontFamily: "monospace", marginTop: 6 },
  certRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  certText: { color: "#d1fae5", fontSize: 13 },
  smallMuted: { color: colors.muted, fontSize: 12, textAlign: "center", marginTop: 4 },
  code: { color: "#6ee7b7", fontFamily: "monospace", fontSize: 11, lineHeight: 16, backgroundColor: "#0f172a", borderRadius: 8, padding: 10 },
});