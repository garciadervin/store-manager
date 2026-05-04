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
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCreateDebt } from '../../../src/hooks/useDebts';
import { colors } from '../../../src/theme/colors';
import { spacing, borderRadius } from '../../../src/theme/spacing';

export default function NewDebtScreen() {
  const createDebt = useCreateDebt();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [notes, setNotes] = useState('');

  // ─── Validation ──────────────────────────────────────────────────

  const validate = (): boolean => {
    if (!customerName.trim()) {
      Alert.alert('Error', 'El nombre del cliente es obligatorio.');
      return false;
    }
    const amount = parseFloat(totalAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Ingresa un monto total válido (mayor a 0).');
      return false;
    }
    return true;
  };

  // ─── Save ────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!validate()) return;

    try {
      await createDebt.mutateAsync({
        customer_name: customerName.trim(),
        total_amount_usd: parseFloat(totalAmount),
        customer_phone: customerPhone.trim() || null,
        notes: notes.trim() || null,
      });
      router.back();
    } catch (err) {
      Alert.alert('Error', 'No se pudo crear el fiado.');
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
        {/* Customer name */}
        <Text style={styles.fieldLabel}>Nombre del cliente *</Text>
        <View style={styles.inputIconRow}>
          <Ionicons name="person-outline" size={20} color={colors.text.secondary} />
          <TextInput
            style={styles.inputWithIcon}
            value={customerName}
            onChangeText={setCustomerName}
            placeholder="Ej: Juan Pérez"
            placeholderTextColor={colors.text.secondary}
            autoCapitalize="words"
          />
        </View>

        {/* Customer phone */}
        <Text style={styles.fieldLabel}>Teléfono (opcional)</Text>
        <View style={styles.inputIconRow}>
          <Ionicons name="call-outline" size={20} color={colors.text.secondary} />
          <TextInput
            style={styles.inputWithIcon}
            value={customerPhone}
            onChangeText={setCustomerPhone}
            placeholder="Ej: +584141234567"
            placeholderTextColor={colors.text.secondary}
            keyboardType="phone-pad"
          />
        </View>

        {/* Total amount */}
        <Text style={styles.fieldLabel}>Monto total (USD) *</Text>
        <View style={styles.priceInputContainer}>
          <Text style={styles.pricePrefix}>$</Text>
          <TextInput
            style={[styles.input, styles.priceInput]}
            value={totalAmount}
            onChangeText={setTotalAmount}
            placeholder="0.00"
            placeholderTextColor={colors.text.secondary}
            keyboardType="decimal-pad"
          />
        </View>

        {/* Notes */}
        <Text style={styles.fieldLabel}>Notas (opcional)</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Notas adicionales..."
          placeholderTextColor={colors.text.secondary}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        {/* Create button */}
        <TouchableOpacity
          style={[styles.saveButton, createDebt.isPending && styles.buttonDisabled]}
          onPress={handleCreate}
          disabled={createDebt.isPending}
        >
          {createDebt.isPending ? (
            <ActivityIndicator size="small" color={colors.text.inverse} />
          ) : (
            <>
              <Ionicons name="receipt-outline" size={20} color={colors.text.inverse} />
              <Text style={styles.saveButtonText}>Crear Fiado</Text>
            </>
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

  // ─── Fields ─────────────────────────────────────────────────────
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
  inputIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface.light,
  },
  inputWithIcon: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  notesInput: {
    minHeight: 80,
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

  // ─── Buttons ────────────────────────────────────────────────────
  saveButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.md,
    marginTop: spacing.xl,
  },
  saveButtonText: {
    color: colors.text.inverse,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
