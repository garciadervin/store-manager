import { View, Text, StyleSheet } from 'react-native';

export default function ExchangeRateScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tasa de Cambio</Text>
      <Text style={styles.subtitle}>Configurar fuente de tasa</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666' },
});
