import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  useDebt,
  useUpdateDebt,
  useAddDebtPayment,
} from '../../../src/hooks/useDebts';
import { usePaymentMethods } from '../../../src/hooks/usePaymentMethods';
import { getByDebtId } from '../../../src/db/repositories/debt-payments';
import { sendWhatsApp, formatDebtReminder } from '../../../src/services/whatsapp';
import { formatUSD, formatDateTime } from '../../../src/utils/format';
import { colors } from '../../../src/theme/colors';
import { spacing, borderRadius } from '../../../src/theme/spacing';
import type { Debt, DebtPayment, PaymentMethod } from '../../../src/utils/types';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: colors.danger + '20', text: colors.danger },
  partial: { bg: colors.warning + '20', text: colors.warning },
  settled: { bg: colors.success + '20', text: colors.success },
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  partial: 'Parcial',
  settled: 'Pagado',
};

export default function DebtDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const debtId = Number(id);

  const { data: debt, isLoading, isError, error, refetch } = useDebt(debtId);
  const { data: paymentMethods } = usePaymentMethods();
  const updateDebt = useUpdateDebt();
  const addPayment = useAddDebtPayment();

  // ─── Payment form state ──────────────────────────────────────────
  const [paymentAmount, setPaymentAmount] = useState('');
  const [selectedMethodId, setSelectedMethodId] = useState<number | null>(null);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Set default payment method
  useEffect(() => {
    if (!selectedMethodId && paymentMethods) {
      const methods = paymentMethods as PaymentMethod[];
      if (methods.length > 0) {
        setSelectedMethodId(methods[0].id);
      }
    }
  }, [paymentMethods, selectedMethodId]);

  // ─── Fetch payments ──────────────────────────────────────────────

  const { data: debtPayments, isLoading: paymentsLoading } = useQuery({
    queryKey: ['debt-payments', debtId],
    queryFn: () => getByDebtId(debtId),
    enabled: !!debtId,
  });

  // ─── Helpers ─────────────────────────────────────────────────────

  const d = debt as Debt | undefined;

  const getStatusStyle = (status: string) =>
    STATUS_COLORS[status] ?? { bg: colors.surface.light, text: colors.text.secondary };

  const getMethodName = useCallback(
    (methodId: number | null): string => {
      if (!methodId || !paymentMethods) return '—';
      const method = (paymentMethods as PaymentMethod[]).find(
        (m) => m.id === methodId,
      );
      return method?.label ?? '—';
    },
    [paymentMethods],
  );

  // ─── Add payment ─────────────────────────────────────────────────

  const handleAddPayment = useCallback(async () => {
    if (!d) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Ingresa un monto de pago válido (mayor a 0).');
      return;
    }
    if (amount > d.balance_due_usd) {
      Alert.alert(
        'Monto excede el saldo',
        `El saldo pendiente es ${formatUSD(d.balance_due_usd)}. Ingresa un monto menor o igual.`,
      );
      return;
    }

    setIsSubmittingPayment(true);
    try {
      await addPayment.mutateAsync({
        debt_id: debtId,
        amount_usd: amount,
        method_id: selectedMethodId,
      });
      setPaymentAmount('');
      await refetch();
      Alert.alert('Pago registrado', `Pago de ${formatUSD(amount)} registrado exitosamente.`);
    } catch (err) {
      Alert.alert('Error', 'No se pudo registrar el pago.');
    } finally {
      setIsSubmittingPayment(false);
    }
  }, [d, paymentAmount, selectedMethodId, debtId, addPayment, refetch]);

  // ─── WhatsApp reminder ───────────────────────────────────────────

  const handleWhatsAppReminder = useCallback(async () => {
    if (!d || !d.customer_phone) return;

    const methods = (paymentMethods as PaymentMethod[] | undefined) ?? [];
    const message = formatDebtReminder(d, methods);

    try {
      await sendWhatsApp(d.customer_phone, message);
    } catch {
      Alert.alert('Error', 'No se pudo abrir WhatsApp. Verifica que esté instalado.');
    }
  }, [d, paymentMethods]);

  // ─── Mark as settled ─────────────────────────────────────────────

  const handleMarkSettled = useCallback(() => {
    if (!d) return;

    Alert.alert(
      'Marcar como pagado',
      `¿Estás seguro de marcar este fiado de ${formatUSD(d.balance_due_usd)} como pagado?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Marcar pagado',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateDebt.mutateAsync({
                id: debtId,
                data: {
                  balance_due_usd: 0,
                  status: 'settled',
                },
              });
              await refetch();
              Alert.alert('Completado', 'El fiado ha sido marcado como pagado.');
            } catch {
              Alert.alert('Error', 'No se pudo actualizar el fiado.');
            }
          },
        },
      ],
    );
  }, [d, debtId, updateDebt, refetch]);

  // ─── Loading / Error ─────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isError || !d) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
        <Text style={styles.errorText}>
          {error?.message ?? 'Fiado no encontrado'}
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusStyle = getStatusStyle(d.status);
  const isSettled = d.status === 'settled';
  const hasPhone = !!d.customer_phone;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* ─── Customer info section ──────────────────────────────── */}
        <View style={styles.customerCard}>
          <View style={styles.customerHeader}>
            <View style={styles.customerAvatar}>
              <Ionicons name="person" size={28} color={colors.primary} />
            </View>
            <View style={styles.customerInfo}>
              <Text style={styles.customerName}>{d.customer_name}</Text>
              {d.customer_phone ? (
                <Text style={styles.customerPhone}>{d.customer_phone}</Text>
              ) : null}
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.statusText, { color: statusStyle.text }]}>
                {STATUS_LABELS[d.status] ?? d.status}
              </Text>
            </View>
          </View>

          <View style={styles.amountsRow}>
            <View style={styles.amountItem}>
              <Text style={styles.amountLabel}>Monto original</Text>
              <Text style={styles.amountValue}>{formatUSD(d.total_amount_usd)}</Text>
            </View>
            <View style={styles.amountDivider} />
            <View style={styles.amountItem}>
              <Text style={styles.amountLabel}>Saldo pendiente</Text>
              <Text
                style={[
                  styles.amountValue,
                  isSettled && styles.amountValueSettled,
                ]}
              >
                {formatUSD(d.balance_due_usd)}
              </Text>
            </View>
          </View>

          {d.notes ? (
            <View style={styles.notesSection}>
              <Ionicons name="document-text-outline" size={14} color={colors.text.secondary} />
              <Text style={styles.notesText}>{d.notes}</Text>
            </View>
          ) : null}
        </View>

        {/* ─── Payment history ────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Historial de pagos</Text>
        <View style={styles.card}>
          {paymentsLoading ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ paddingVertical: spacing.md }} />
          ) : debtPayments && (debtPayments as DebtPayment[]).length > 0 ? (
            (debtPayments as DebtPayment[]).map((payment) => (
              <View key={payment.id} style={styles.paymentRow}>
                <View style={styles.paymentInfo}>
                  <Text style={styles.paymentAmount}>
                    {formatUSD(payment.amount_usd)}
                  </Text>
                  <Text style={styles.paymentDate}>
                    {formatDateTime(payment.payment_date)}
                  </Text>
                </View>
                <Text style={styles.paymentMethod}>
                  {getMethodName(payment.method_id)}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>Sin pagos registrados</Text>
          )}
        </View>

        {/* ─── Add payment form (only if not settled) ─────────────── */}
        {!isSettled && (
          <>
            <Text style={styles.sectionTitle}>Registrar pago</Text>
            <View style={styles.paymentFormCard}>
              {/* Amount input */}
              <Text style={styles.formLabel}>Monto (USD)</Text>
              <View style={styles.priceInputContainer}>
                <Text style={styles.pricePrefix}>$</Text>
                <TextInput
                  style={[styles.input, styles.priceInput]}
                  value={paymentAmount}
                  onChangeText={setPaymentAmount}
                  placeholder="0.00"
                  placeholderTextColor={colors.text.secondary}
                  keyboardType="decimal-pad"
                />
              </View>

              {/* Payment method picker */}
              <Text style={styles.formLabel}>Método de pago</Text>
              <View style={styles.methodPicker}>
                {(paymentMethods as PaymentMethod[] | undefined)?.map((method) => (
                  <TouchableOpacity
                    key={method.id}
                    style={[
                      styles.methodChip,
                      selectedMethodId === method.id && styles.methodChipActive,
                    ]}
                    onPress={() => setSelectedMethodId(method.id)}
                  >
                    <Text
                      style={[
                        styles.methodChipText,
                        selectedMethodId === method.id && styles.methodChipTextActive,
                      ]}
                    >
                      {method.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Submit button */}
              <TouchableOpacity
                style={[
                  styles.addPaymentButton,
                  (isSubmittingPayment || addPayment.isPending) && styles.buttonDisabled,
                ]}
                onPress={handleAddPayment}
                disabled={isSubmittingPayment || addPayment.isPending}
              >
                {isSubmittingPayment || addPayment.isPending ? (
                  <ActivityIndicator size="small" color={colors.text.inverse} />
                ) : (
                  <>
                    <Ionicons name="cash-outline" size={18} color={colors.text.inverse} />
                    <Text style={styles.addPaymentButtonText}>Registrar Pago</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ─── Actions ─────────────────────────────────────────────── */}
        <View style={styles.actions}>
          {/* WhatsApp reminder */}
          <TouchableOpacity
            style={[styles.actionButton, styles.whatsappButton, !hasPhone && styles.buttonDisabled]}
            onPress={handleWhatsAppReminder}
            disabled={!hasPhone}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-whatsapp" size={20} color={colors.success} />
            <Text style={styles.whatsappButtonText}>Recordar por WhatsApp</Text>
          </TouchableOpacity>

          {/* Mark as settled */}
          {!isSettled && (
            <TouchableOpacity
              style={[styles.actionButton, styles.settleButton, updateDebt.isPending && styles.buttonDisabled]}
              onPress={handleMarkSettled}
              disabled={updateDebt.isPending}
              activeOpacity={0.8}
            >
              {updateDebt.isPending ? (
                <ActivityIndicator size="small" color={colors.success} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color={colors.success} />
                  <Text style={styles.settleButtonText}>Marcar como pagado</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.light,
    padding: spacing.lg,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },

  // ─── Customer card ──────────────────────────────────────────────
  customerCard: {
    backgroundColor: colors.surface.light,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  customerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  customerPhone: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // ─── Amounts ────────────────────────────────────────────────────
  amountsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  amountItem: {
    flex: 1,
  },
  amountLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  amountValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  amountValueSettled: {
    color: colors.success,
  },
  amountDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.divider,
    marginHorizontal: spacing.md,
  },

  // ─── Notes ──────────────────────────────────────────────────────
  notesSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  notesText: {
    fontSize: 13,
    color: colors.text.secondary,
    marginLeft: spacing.sm,
    flex: 1,
    lineHeight: 18,
  },

  // ─── Section title ──────────────────────────────────────────────
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ─── Card ───────────────────────────────────────────────────────
  card: {
    backgroundColor: colors.surface.light,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },

  // ─── Payment rows ───────────────────────────────────────────────
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  paymentDate: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  paymentMethod: {
    fontSize: 13,
    color: colors.text.secondary,
    marginLeft: spacing.sm,
  },

  // ─── Empty ──────────────────────────────────────────────────────
  emptyText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },

  // ─── Payment form ───────────────────────────────────────────────
  paymentFormCard: {
    backgroundColor: colors.surface.light,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text.primary,
    backgroundColor: colors.background.light,
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

  // ─── Method picker ──────────────────────────────────────────────
  methodPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  methodChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background.light,
    borderWidth: 1,
    borderColor: colors.border,
  },
  methodChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  methodChipText: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  methodChipTextActive: {
    color: colors.text.inverse,
  },

  // ─── Add payment button ─────────────────────────────────────────
  addPaymentButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  addPaymentButtonText: {
    color: colors.text.inverse,
    fontSize: 15,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },

  // ─── Actions ────────────────────────────────────────────────────
  actions: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.md,
  },
  whatsappButton: {
    backgroundColor: colors.success + '15',
  },
  whatsappButtonText: {
    color: colors.success,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  settleButton: {
    borderWidth: 1,
    borderColor: colors.success,
  },
  settleButtonText: {
    color: colors.success,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.5,
  },

  // ─── Error / Back ───────────────────────────────────────────────
  errorText: {
    fontSize: 15,
    color: colors.danger,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  backButton: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
  },
  backButtonText: {
    color: colors.text.inverse,
    fontSize: 15,
    fontWeight: '600',
  },
});
