import { View, Text, StyleSheet } from 'react-native';

export default function DebtsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Fiados</Text>
      <Text style={styles.subtitle}>Gestión de créditos</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666' },
});
