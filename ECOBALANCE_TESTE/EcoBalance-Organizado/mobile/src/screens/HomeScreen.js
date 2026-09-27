import React from "react";
import { ScrollView, Text, View, StyleSheet, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card, Badge, Metric, SectionTitle, PrimaryButton, Formula } from "../components/UI";
import { colors } from "../theme";
import { EVOLUCAO_DECENAL, INTENSIDADE_SETORES, CONTATO, STACK, CERTIFICACOES } from "../data";

const BEFORE = [
  "Dados fragmentados e não auditáveis",
  "Greenwashing sem comprovação matemática",
  "Falta de rastreabilidade na cadeia produtiva",
  "Não conformidade com IFRS S2",
];
const AFTER = [
  "Matriz de Leontief com validação matemática",
  "Blockchain imutável (SHA-256) para auditoria",
  "Rastreabilidade completa GRI 305",
  "Conformidade IFRS S2 & ISO 14001",
];

export default function HomeScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.heroBadge}>
        <View style={styles.dot} />
        <Text style={styles.heroBadgeText}>ISO 14001 | IFRS S2 | GRI 305 | TI Verde</Text>
      </View>

      <Text style={styles.h1}>
        A <Text style={styles.grad}>Matemática</Text> da{"\n"}
        <Text style={{ color: colors.primary }}>Sustentabilidade</Text>
      </Text>
      <Text style={styles.lead}>
        Governança ESG através do Modelo de Insumo-Produto de Leontief. Transforme custos de
        ineficiência em oportunidades de sustentabilidade com transparência blockchain.
      </Text>

      <View style={styles.metricsRow}>
        <Metric valor="2015–26" label="Análise Decenal" />
        <Metric valor="+14,2%" label="Ganho Produtividade" cor={colors.secondary} />
        <Metric valor="Zero" label="Greenwashing" cor={colors.accent} />
      </View>

      <Card accent={colors.primary}>
        <Text style={styles.cardTitle}>Matriz de Leontief — Núcleo de Inteligência</Text>
        <Formula>x = (I − C)⁻¹ · d</Formula>
        <Text style={styles.small}>
          Validado pela Condição de Hawkins-Simons: Det(I − C) &gt; 0. Motor equivalente ao
          módulo Python/NumPy do artigo, portado para React Native.
        </Text>
      </Card>

      <SectionTitle
        kicker="Problema vs Solução"
        title="De relatórios caóticos para governança estruturada"
      />
      <Card accent={colors.danger}>
        <Text style={[styles.cardTitle, { color: colors.danger }]}>✗ Antes: Excel & Planilhas</Text>
        {BEFORE.map((item, i) => (
          <Text key={i} style={styles.listItem}>✗  {item}</Text>
        ))}
      </Card>
      <Card accent={colors.primary}>
        <Text style={[styles.cardTitle, { color: colors.primary }]}>✓ Depois: EcoBalance Ledger</Text>
        {AFTER.map((item, i) => (
          <Text key={i} style={styles.listItemOk}>✓  {item}</Text>
        ))}
      </Card>

      <SectionTitle
        kicker="Tabela 1 — Artigo"
        title="Evolução decenal dos indicadores"
        subtitle="Eficiência energética, emissões Escopo 2, ROI Sustentável e conformidade normativa."
      />
      {EVOLUCAO_DECENAL.map((row, i) => (
        <Card key={i}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>{row.ano}</Text>
            <Badge label={row.conformidade} color={row.conformidade.includes("Não") ? colors.danger : colors.primary} />
          </View>
          <Text style={styles.small}>Eficiência (PUE): {row.pue}  •  CO₂: {row.co2} tCO₂e  •  ROI: {row.roi}%</Text>
          <Text style={styles.smallMuted}>Blockchain: {row.blockchain}</Text>
        </Card>
      ))}

      <SectionTitle
        kicker="Tabela 2 — Artigo"
        title="Intensidade de insumos (2015 vs 2026)"
        subtitle="Decomposição estrutural do modelo de Leontief por setor."
      />
      {INTENSIDADE_SETORES.map((s, i) => {
        const variacao = (((s.c2026 - s.c2015) / s.c2015) * 100).toFixed(1);
        return (
          <Card key={i}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>{s.setor}</Text>
              <Text style={{ color: colors.primary, fontWeight: "800" }}>{variacao}%</Text>
            </View>
            <Text style={styles.small}>cᵢⱼ: {s.c2015.toFixed(3)} → {s.c2026.toFixed(3)}</Text>
            <Text style={styles.smallMuted}>{s.impacto}</Text>
          </Card>
        );
      })}

      <SectionTitle kicker="Compliance" title="Certificações ativas" />
      <View style={styles.chips}>
        {CERTIFICACOES.map((c, i) => <Badge key={i} label={c} />)}
      </View>

      <SectionTitle kicker="Stack" title="Arquitetura multiplataforma" />
      <Card>
        {STACK.map((t, i) => (
          <Text key={i} style={styles.listItemOk}>▸  {t}</Text>
        ))}
        <Text style={styles.smallMuted} marginTop={8}>
          Dockerizado — pronto para Desktop (Windows/Linux/macOS), Web, Mobile e Tablet,
          conforme objetivos específicos do artigo.
        </Text>
      </Card>

      <SectionTitle kicker="Contato" title="EcoBalance Ledger" />
      <Card>
        <Text style={styles.small}>Adriano Rodrigues de Araujo, Gabriel Gomide, Pedro Henrique da Silva</Text>
        <Text style={styles.smallMuted}>Fatec Zona Leste — Centro Paula Souza</Text>
        <Text style={styles.small} onPress={() => Linking.openURL(`mailto:${CONTATO.email}`)}>✉  {CONTATO.email}</Text>
        <Text style={styles.small}>☎  {CONTATO.telefone}</Text>
        <Text style={styles.smallMuted}>📍  {CONTATO.cidade}  •  {CONTATO.versao}</Text>
        <PrimaryButton title="Abrir repositório" icon="⬇" onPress={() => Linking.openURL("https://" + CONTATO.repositorio)} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  heroBadge: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(16,185,129,0.1)", borderWidth: 1,
    borderColor: "rgba(16,185,129,0.3)", borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6, alignSelf: "flex-start", marginBottom: 16,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  heroBadgeText: { color: colors.primary, fontSize: 12, fontWeight: "600" },
  h1: { color: colors.text, fontSize: 34, fontWeight: "800", lineHeight: 40 },
  grad: { color: colors.secondary },
  lead: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 12, marginBottom: 16 },
  metricsRow: { flexDirection: "row", backgroundColor: colors.card, borderRadius: 16, padding: 8, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  cardTitle: { color: colors.text, fontWeight: "700", fontSize: 15, marginBottom: 6 },
  small: { color: colors.text, fontSize: 13, lineHeight: 20 },
  smallMuted: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  listItem: { color: colors.muted, fontSize: 13, lineHeight: 24 },
  listItemOk: { color: "#d1fae5", fontSize: 13, lineHeight: 24 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
});