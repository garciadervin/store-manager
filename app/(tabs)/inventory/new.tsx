import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useCreateProduct } from '../../../src/hooks/useProducts';
import { colors } from '../../../src/theme/colors';
import { spacing, borderRadius } from '../../../src/theme/spacing';

export default function NewProductScreen() {
  const createMutation = useCreateProduct();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [priceUsd, setPriceUsd] = useState('');
  const [stockQty, setStockQty] = useState('');
  const [unitType, setUnitType] = useState('unit');

  // ─── Validation ──────────────────────────────────────────────────

  const validate = (): boolean => {
    if (!name.trim()) {
      Alert.alert('Error', 'El nombre del producto es obligatorio.');
      return false;
    }
    const price = parseFloat(priceUsd);
    if (isNaN(price) || price < 0) {
      Alert.alert('Error', 'Ingresa un precio válido (mayor o igual a 0).');
      return false;
    }
    const stock = parseInt(stockQty, 10);
    if (isNaN(stock) || stock < 0) {
      Alert.alert('Error', 'Ingresa una cantidad de stock válida (mayor o igual a 0).');
      return false;
    }
    return true;
  };

  // ─── Save ────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!validate()) return;

    try {
      await createMutation.mutateAsync({
        name: name.trim(),
        price_usd: parseFloat(priceUsd),
        stock_qty: parseInt(stockQty, 10),
      });
      router.back();
    } catch (err) {
      Alert.alert('Error', 'No se pudo crear el producto.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Name */}
        <Text style={styles.fieldLabel}>Nombre *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Nombre del producto"
          placeholderTextColor={colors.text.secondary}
        />

        {/* Category */}
        <Text style={styles.fieldLabel}>Categoría</Text>
        <TextInput
          style={styles.input}
          value={category}
          onChangeText={setCategory}
          placeholder="Ej: Bebidas, Lacteos, etc."
          placeholderTextColor={colors.text.secondary}
        />

        {/* Price */}
        <Text style={styles.fieldLabel}>Precio (USD) *</Text>
        <View style={styles.priceInputContainer}>
          <Text style={styles.pricePrefix}>$</Text>
          <TextInput
            style={[styles.input, styles.priceInput]}
            value={priceUsd}
            onChangeText={setPriceUsd}
            placeholder="0.00"
            placeholderTextColor={colors.text.secondary}
            keyboardType="decimal-pad"
          />
        </View>

        {/* Stock */}
        <Text style={styles.fieldLabel}>Cantidad en stock *</Text>
        <TextInput
          style={styles.input}
          value={stockQty}
          onChangeText={setStockQty}
          placeholder="0"
          placeholderTextColor={colors.text.secondary}
          keyboardType="number-pad"
        />

        {/* Unit type */}
        <Text style={styles.fieldLabel}>Tipo de unidad</Text>
        <TextInput
          style={styles.input}
          value={unitType}
          onChangeText={setUnitType}
          placeholder="unit"
          placeholderTextColor={colors.text.secondary}
        />

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveButton, createMutation.isPending && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? (
            <ActivityIndicator size="small" color={colors.text.inverse} />
          ) : (
            <Text style={styles.saveButtonText}>Crear producto</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.light,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text.primary,
    backgroundColor: colors.surface.light,
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pricePrefix: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.secondary,
    marginRight: spacing.sm,
  },
  priceInput: {
    flex: 1,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  saveButtonText: {
    color: colors.text.inverse,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
