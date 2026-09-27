import React from "react";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";

import HomeScreen from "./src/screens/HomeScreen";
import MatrixScreen from "./src/screens/MatrixScreen";
import BlockchainScreen from "./src/screens/BlockchainScreen";
import SimulatorScreen from "./src/screens/SimulatorScreen";
import DashboardScreen from "./src/screens/DashboardScreen";

import { colors } from "./src/theme";

const Tab = createBottomTabNavigator();

const ICONS = {
  Home: "home",
  Matriz: "grid",
  Blockchain: "link",
  ROI: "calculator",
  ESG: "bar-chart",
};

export default function App() {
  return (
    <NavigationContainer
      theme={{
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: colors.bg,
          card: colors.card,
          primary: colors.primary,
          text: colors.text,
        },
      }}
    >
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerStyle: { backgroundColor: colors.card },
          headerTitleStyle: { color: colors.text, fontWeight: "700" },
          headerTintColor: colors.primary,
          tabBarStyle: {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.muted,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={ICONS[route.name]} size={size} color={color} />
          ),
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} options={{ title: "EcoBalance Ledger" }} />
        <Tab.Screen name="Matriz" component={MatrixScreen} options={{ title: "Matriz de Leontief" }} />
        <Tab.Screen name="Blockchain" component={BlockchainScreen} options={{ title: "Blockchain Ledger" }} />
        <Tab.Screen name="ROI" component={SimulatorScreen} options={{ title: "Simulador ROI" }} />
        <Tab.Screen name="ESG" component={DashboardScreen} options={{ title: "Dashboard ESG" }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}