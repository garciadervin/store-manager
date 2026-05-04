import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useProducts } from '../../../src/hooks/useProducts';
import { usePaymentMethods } from '../../../src/hooks/usePaymentMethods';
import { useCreateSale } from '../../../src/hooks/useSales';
import { getAllRates } from '../../../src/services/exchange-rate';
import { formatUSD, formatVES, calculateSubtotal, convertToVES } from '../../../src/utils/format';
import { RATE_SOURCES } from '../../../src/utils/constants';
import { colors } from '../../../src/theme/colors';
import { spacing, borderRadius } from '../../../src/theme/spacing';
import type { Product, PaymentMethod, SaleFormItem, SaleFormPayment, DollarRate } from '../../../src/utils/types';

type Step = 1 | 2 | 3;

const RATE_SOURCE_LABELS: Record<string, string> = {
  [RATE_SOURCES.BCV]: 'BCV',
  [RATE_SOURCES.PARALLEL]: 'Paralelo',
  [RATE_SOURCES.BINANCE]: 'Binance',
};

export default function NewSaleScreen() {
  const { data: products, isLoading: productsLoading } = useProducts();
  const { data: paymentMethods, isLoading: methodsLoading } = usePaymentMethods();
  const createSale = useCreateSale();

  // ─── Step state ─────────────────────────────────────────────────
  const [step, setStep] = useState<Step>(1);

  // Step 1: Selected items
  const [selectedItems, setSelectedItems] = useState<SaleFormItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Step 2: Payment splits
  const [payments, setPayments] = useState<SaleFormPayment[]>([]);
  const [rateSource, setRateSource] = useState<string>(RATE_SOURCES.BCV);
  const [rates, setRates] = useState<DollarRate[]>([]);
  const [ratesLoading, setRatesLoading] = useState(false);

  // Step 3: Credit toggle
  const [isCredit, setIsCredit] = useState(false);
  const [customerName, setCustomerName] = useState('');

  // ─── Derived ────────────────────────────────────────────────────
  const totalUsd = useMemo(
    () =>
      selectedItems.reduce(
        (sum, item) => sum + calculateSubtotal(item.quantity, item.unit_price_usd),
        0,
      ),
    [selectedItems],
  );

  const totalPayments = useMemo(
    () => payments.reduce((sum, p) => sum + p.amount_usd, 0),
    [payments],
  );

  const paymentBalanceOk = Math.abs(totalPayments - totalUsd) < 0.01;

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    const all = products as Product[];
    if (!searchQuery.trim()) return all;
    const q = searchQuery.toLowerCase();
    return all.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q)),
    );
  }, [products, searchQuery]);

  const selectedProductIds = useMemo(
    () => new Set(selectedItems.map((i) => i.product_id)),
    [selectedItems],
  );

  // ─── Rate helpers ───────────────────────────────────────────────
  const fetchRates = useCallback(async () => {
    setRatesLoading(true);
    try {
      const data = await getAllRates();
      setRates(data);
    } catch {
      Alert.alert('Error', 'No se pudieron obtener las tasas de cambio.');
    } finally {
      setRatesLoading(false);
    }
  }, []);

  const currentRate = useMemo(() => {
    const casaMap: Record<string, string> = {
      [RATE_SOURCES.BCV]: 'oficial',
      [RATE_SOURCES.PARALLEL]: 'paralelo',
      [RATE_SOURCES.BINANCE]: 'binance',
    };
    const casa = casaMap[rateSource];
    return rates.find((r) => r.casa === casa) ?? null;
  }, [rates, rateSource]);

  // ─── Item handlers ──────────────────────────────────────────────
  const toggleProduct = useCallback(
    (product: Product) => {
      if (selectedProductIds.has(product.id)) {
        setSelectedItems((prev) =>
          prev.filter((i) => i.product_id !== product.id),
        );
      } else {
        setSelectedItems((prev) => [
          ...prev,
          {
            product_id: product.id,
            product_name: product.name,
            quantity: 1,
            unit_price_usd: product.price_usd,
          },
        ]);
      }
    },
    [selectedProductIds],
  );

  const updateQuantity = useCallback(
    (productId: number, quantity: number) => {
      if (quantity < 1) return;
      setSelectedItems((prev) =>
        prev.map((item) =>
          item.product_id === productId ? { ...item, quantity } : item,
        ),
      );
    },
    [],
  );

  // ─── Payment handlers ───────────────────────────────────────────
  const addPayment = useCallback(() => {
    if (!paymentMethods || (paymentMethods as PaymentMethod[]).length === 0) {
      Alert.alert('Error', 'No hay métodos de pago configurados.');
      return;
    }
    setPayments((prev) => [
      ...prev,
      { method_id: (paymentMethods as PaymentMethod[])[0].id, amount_usd: 0 },
    ]);
  }, [paymentMethods]);

  const updatePayment = useCallback(
    (index: number, field: 'method_id' | 'amount_usd', value: number) => {
      setPayments((prev) =>
        prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)),
      );
    },
    [],
  );

  const removePayment = useCallback((index: number) => {
    setPayments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ─── Step navigation ────────────────────────────────────────────
  const canGoNextFromStep1 = selectedItems.length > 0;

  const canGoNextFromStep2 =
    payments.length > 0 && paymentBalanceOk && rateSource !== '';

  const handleNext = useCallback(() => {
    if (step === 1) {
      if (!canGoNextFromStep1) {
        Alert.alert('Selecciona productos', 'Debes agregar al menos un producto.');
        return;
      }
      setStep(2);
      fetchRates();
    } else if (step === 2) {
      if (!canGoNextFromStep2) {
        Alert.alert(
          'Verifica los pagos',
          'Los pagos deben cubrir el total de la venta.',
        );
        return;
      }
      setStep(3);
    }
  }, [step, canGoNextFromStep1, canGoNextFromStep2, fetchRates]);

  const handleBack = useCallback(() => {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
    else router.back();
  }, [step]);

  // ─── Confirm sale ───────────────────────────────────────────────
  const handleConfirm = useCallback(async () => {
    try {
      const saleId = await createSale.mutateAsync({
        items: selectedItems,
        payments,
        rateSource,
        notes: isCredit && customerName.trim()
          ? `Fiado: ${customerName.trim()}`
          : null,
      });
      router.replace(`/(tabs)/sales/${saleId}`);
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'No se pudo registrar la venta.',
      );
    }
  }, [selectedItems, payments, rateSource, isCredit, customerName, createSale]);

  // ─── Render helpers ─────────────────────────────────────────────

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {([1, 2, 3] as Step[]).map((s) => (
        <View key={s} style={styles.stepRow}>
          <View
            style={[
              styles.stepDot,
              step === s && styles.stepDotActive,
              step > s && styles.stepDotDone,
            ]}
          >
            <Text
              style={[
                styles.stepDotText,
                (step === s || step > s) && styles.stepDotTextActive,
              ]}
            >
              {step > s ? '✓' : s}
            </Text>
          </View>
          {s < 3 && (
            <View
              style={[
                styles.stepLine,
                step > s && styles.stepLineDone,
              ]}
            />
          )}
        </View>
      ))}
    </View>
  );

  const renderStepLabel = () => {
    const labels: Record<Step, string> = {
      1: 'Seleccionar productos',
      2: 'Dividir pago',
      3: 'Revisar y confirmar',
    };
    return (
      <Text style={styles.stepLabel}>{labels[step]}</Text>
    );
  };

  // ─── Step 1: Select items ───────────────────────────────────────
  const renderStep1 = () => (
    <View style={styles.stepContent}>
      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color={colors.text.secondary} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Buscar productos..."
          placeholderTextColor={colors.text.secondary}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={colors.text.secondary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Selected items summary */}
      {selectedItems.length > 0 && (
        <View style={styles.selectedSummary}>
          <Text style={styles.selectedSummaryText}>
            {selectedItems.length} producto{selectedItems.length !== 1 ? 's' : ''} seleccionado
            {selectedItems.length !== 1 ? 's' : ''} — Total: {formatUSD(totalUsd)}
          </Text>
        </View>
      )}

      {/* Product list */}
      {productsLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.productList}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={48} color={colors.text.secondary} />
              <Text style={styles.emptyTitle}>Sin resultados</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isSelected = selectedProductIds.has(item.id);
            const selectedItem = selectedItems.find(
              (si) => si.product_id === item.id,
            );
            return (
              <TouchableOpacity
                style={[
                  styles.productItem,
                  isSelected && styles.productItemSelected,
                ]}
                onPress={() => toggleProduct(item)}
                activeOpacity={0.7}
              >
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{item.name}</Text>
                  <Text style={styles.productPrice}>
                    {formatUSD(item.price_usd)}
                  </Text>
                </View>
                {isSelected && selectedItem ? (
                  <View style={styles.qtyControl}>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() =>
                        updateQuantity(item.id, selectedItem.quantity - 1)
                      }
                    >
                      <Ionicons name="remove" size={18} color={colors.primary} />
                    </TouchableOpacity>
                    <Text style={styles.qtyValue}>{selectedItem.quantity}</Text>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() =>
                        updateQuantity(item.id, selectedItem.quantity + 1)
                      }
                    >
                      <Ionicons name="add" size={18} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Ionicons
                    name="add-circle-outline"
                    size={24}
                    color={colors.text.secondary}
                  />
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );

  // ─── Step 2: Payment split ──────────────────────────────────────
  const renderStep2 = () => (
    <ScrollView
      style={styles.stepContent}
      contentContainerStyle={styles.stepScrollContent}
      keyboardShouldPersistTaps="handled"
    >
      {/* Total to collect */}
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total a cobrar</Text>
        <Text style={styles.totalValue}>{formatUSD(totalUsd)}</Text>
      </View>

      {/* Exchange rate selector */}
      <Text style={styles.sectionTitle}>Tasa de cambio</Text>
      <View style={styles.rateSelector}>
        {Object.entries(RATE_SOURCE_LABELS).map(([key, label]) => {
          const casaMap: Record<string, string> = {
            [RATE_SOURCES.BCV]: 'oficial',
            [RATE_SOURCES.PARALLEL]: 'paralelo',
            [RATE_SOURCES.BINANCE]: 'binance',
          };
          const rate = rates.find((r) => r.casa === casaMap[key]);
          return (
            <TouchableOpacity
              key={key}
              style={[
                styles.rateOption,
                rateSource === key && styles.rateOptionActive,
              ]}
              onPress={() => setRateSource(key)}
            >
              <Text
                style={[
                  styles.rateOptionLabel,
                  rateSource === key && styles.rateOptionLabelActive,
                ]}
              >
                {label}
              </Text>
              {ratesLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : rate ? (
                <Text
                  style={[
                    styles.rateOptionValue,
                    rateSource === key && styles.rateOptionValueActive,
                  ]}
                >
                  Bs. {rate.venta.toFixed(2)}
                </Text>
              ) : (
                <Text style={styles.rateOptionValue}>—</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Payment splits */}
      <Text style={styles.sectionTitle}>Métodos de pago</Text>
      {payments.map((payment, index) => {
        const method = (paymentMethods as PaymentMethod[] | undefined)?.find(
          (m) => m.id === payment.method_id,
        );
        return (
          <View key={index} style={styles.paymentRow}>
            <View style={styles.paymentMethodPicker}>
              {(paymentMethods as PaymentMethod[] | undefined)?.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[
                    styles.methodChip,
                    payment.method_id === m.id && styles.methodChipActive,
                  ]}
                  onPress={() => updatePayment(index, 'method_id', m.id)}
                >
                  <Text
                    style={[
                      styles.methodChipText,
                      payment.method_id === m.id && styles.methodChipTextActive,
                    ]}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.paymentAmountRow}>
              <Text style={styles.paymentCurrency}>$</Text>
              <TextInput
                style={styles.paymentInput}
                value={payment.amount_usd > 0 ? String(payment.amount_usd) : ''}
                onChangeText={(text) => {
                  const val = parseFloat(text) || 0;
                  updatePayment(index, 'amount_usd', val);
                }}
                placeholder="0.00"
                placeholderTextColor={colors.text.secondary}
                keyboardType="decimal-pad"
              />
              <TouchableOpacity
                style={styles.removePaymentBtn}
                onPress={() => removePayment(index)}
              >
                <Ionicons name="close-circle" size={22} color={colors.danger} />
              </TouchableOpacity>
            </View>
            {method && (
              <Text style={styles.paymentMethodLabel}>{method.label}</Text>
            )}
          </View>
        );
      })}

      <TouchableOpacity style={styles.addPaymentBtn} onPress={addPayment}>
        <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
        <Text style={styles.addPaymentText}>Agregar método de pago</Text>
      </TouchableOpacity>

      {/* Balance indicator */}
      {payments.length > 0 && (
        <View
          style={[
            styles.balanceCard,
            paymentBalanceOk
              ? styles.balanceCardOk
              : styles.balanceCardError,
          ]}
        >
          <Ionicons
            name={paymentBalanceOk ? 'checkmark-circle' : 'alert-circle'}
            size={20}
            color={paymentBalanceOk ? colors.success : colors.danger}
          />
          <Text
            style={[
              styles.balanceText,
              { color: paymentBalanceOk ? colors.success : colors.danger },
            ]}
          >
            {paymentBalanceOk
              ? 'Pagos cubren el total'
              : `Faltan ${formatUSD(Math.max(0, totalUsd - totalPayments))} por cubrir`}
          </Text>
        </View>
      )}

      {/* VES equivalent */}
      {currentRate && (
        <View style={styles.vesCard}>
          <Text style={styles.vesLabel}>Equivalente en Bs.</Text>
          <Text style={styles.vesValue}>
            {formatVES(convertToVES(totalUsd, currentRate.venta))}
          </Text>
          <Text style={styles.vesRate}>
            Tasa: {RATE_SOURCE_LABELS[rateSource]} — Bs. {currentRate.venta.toFixed(2)}
          </Text>
        </View>
      )}
    </ScrollView>
  );

  // ─── Step 3: Review & Confirm ───────────────────────────────────
  const renderStep3 = () => (
    <ScrollView
      style={styles.stepContent}
      contentContainerStyle={styles.stepScrollContent}
      keyboardShouldPersistTaps="handled"
    >
      {/* Items summary */}
      <Text style={styles.sectionTitle}>Productos</Text>
      <View style={styles.reviewCard}>
        {selectedItems.map((item) => (
          <View key={item.product_id} style={styles.reviewItem}>
            <View style={styles.reviewItemInfo}>
              <Text style={styles.reviewItemName}>{item.product_name}</Text>
              <Text style={styles.reviewItemDetail}>
                {item.quantity} × {formatUSD(item.unit_price_usd)}
              </Text>
            </View>
            <Text style={styles.reviewItemSubtotal}>
              {formatUSD(calculateSubtotal(item.quantity, item.unit_price_usd))}
            </Text>
          </View>
        ))}
        <View style={styles.reviewTotalRow}>
          <Text style={styles.reviewTotalLabel}>Total USD</Text>
          <Text style={styles.reviewTotalValue}>{formatUSD(totalUsd)}</Text>
        </View>
      </View>

      {/* Payments summary */}
      <Text style={styles.sectionTitle}>Pagos</Text>
      <View style={styles.reviewCard}>
        {payments.map((payment, index) => {
          const method = (paymentMethods as PaymentMethod[] | undefined)?.find(
            (m) => m.id === payment.method_id,
          );
          return (
            <View key={index} style={styles.reviewItem}>
              <Text style={styles.reviewItemName}>
                {method?.label ?? 'Método desconocido'}
              </Text>
              <Text style={styles.reviewItemSubtotal}>
                {formatUSD(payment.amount_usd)}
              </Text>
            </View>
          );
        })}
        <View style={styles.reviewTotalRow}>
          <Text style={styles.reviewTotalLabel}>Total pagado</Text>
          <Text style={styles.reviewTotalValue}>
            {formatUSD(totalPayments)}
          </Text>
        </View>
      </View>

      {/* Exchange rate info */}
      {currentRate && (
        <>
          <Text style={styles.sectionTitle}>Tasa de cambio</Text>
          <View style={styles.reviewCard}>
            <View style={styles.reviewItem}>
              <Text style={styles.reviewItemName}>Fuente</Text>
              <Text style={styles.reviewItemSubtotal}>
                {RATE_SOURCE_LABELS[rateSource]}
              </Text>
            </View>
            <View style={styles.reviewItem}>
              <Text style={styles.reviewItemName}>Tasa (venta)</Text>
              <Text style={styles.reviewItemSubtotal}>
                Bs. {currentRate.venta.toFixed(2)}
              </Text>
            </View>
            <View style={styles.reviewItem}>
              <Text style={styles.reviewItemName}>Total en Bs.</Text>
              <Text style={styles.reviewItemSubtotal}>
                {formatVES(convertToVES(totalUsd, currentRate.venta))}
              </Text>
            </View>
          </View>
        </>
      )}

      {/* Credit toggle */}
      <View style={styles.creditSection}>
        <View style={styles.creditToggle}>
          <Text style={styles.creditLabel}>¿Es fiado?</Text>
          <Switch
            value={isCredit}
            onValueChange={setIsCredit}
            trackColor={{ false: colors.border, true: colors.primaryLight }}
            thumbColor={isCredit ? colors.primary : colors.text.secondary}
          />
        </View>
        {isCredit && (
          <TextInput
            style={styles.input}
            value={customerName}
            onChangeText={setCustomerName}
            placeholder="Nombre del cliente"
            placeholderTextColor={colors.text.secondary}
          />
        )}
      </View>
    </ScrollView>
  );

  // ─── Main render ────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.headerBack}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
          <Text style={styles.headerBackText}>
            {step === 1 ? 'Cancelar' : 'Atrás'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Step indicator */}
      {renderStepIndicator()}
      {renderStepLabel()}

      {/* Step content */}
      <View style={styles.contentContainer}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </View>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        {step < 3 ? (
          <TouchableOpacity
            style={[
              styles.nextButton,
              !(
                (step === 1 && canGoNextFromStep1) ||
                (step === 2 && canGoNextFromStep2)
              ) && styles.buttonDisabled,
            ]}
            onPress={handleNext}
            disabled={
              (step === 1 && !canGoNextFromStep1) ||
              (step === 2 && !canGoNextFromStep2)
            }
          >
            <Text style={styles.nextButtonText}>Siguiente</Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.text.inverse}
            />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.confirmButton,
              createSale.isPending && styles.buttonDisabled,
            ]}
            onPress={handleConfirm}
            disabled={createSale.isPending}
          >
            {createSale.isPending ? (
              <ActivityIndicator size="small" color={colors.text.inverse} />
            ) : (
              <>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={colors.text.inverse}
                />
                <Text style={styles.confirmButtonText}>
                  {isCredit ? 'Registrar venta a crédito' : 'Confirmar venta'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.light,
  },

  // ─── Header ─────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  headerBack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBackText: {
    fontSize: 16,
    color: colors.primary,
    marginLeft: spacing.xs,
  },

  // ─── Step indicator ─────────────────────────────────────────────
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface.light,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepDotDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  stepDotText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  stepDotTextActive: {
    color: colors.text.inverse,
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: colors.border,
    marginHorizontal: spacing.xs,
  },
  stepLineDone: {
    backgroundColor: colors.success,
  },
  stepLabel: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },

  // ─── Content ────────────────────────────────────────────────────
  contentContainer: {
    flex: 1,
  },
  stepContent: {
    flex: 1,
  },
  stepScrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },

  // ─── Search ─────────────────────────────────────────────────────
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.light,
    borderRadius: borderRadius.md,
    margin: spacing.md,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },

  // ─── Selected summary ───────────────────────────────────────────
  selectedSummary: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primaryLight + '20',
    borderRadius: borderRadius.sm,
  },
  selectedSummaryText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },

  // ─── Product list ───────────────────────────────────────────────
  productList: {
    padding: spacing.md,
    paddingTop: 0,
    paddingBottom: 100,
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.light,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  productItemSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  productPrice: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 2,
  },

  // ─── Quantity control ───────────────────────────────────────────
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight + '30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginHorizontal: spacing.sm,
    minWidth: 24,
    textAlign: 'center',
  },

  // ─── Total card ─────────────────────────────────────────────────
  totalCard: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  totalLabel: {
    fontSize: 14,
    color: colors.text.inverse,
    opacity: 0.8,
  },
  totalValue: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text.inverse,
    marginTop: spacing.xs,
  },

  // ─── Section title ──────────────────────────────────────────────
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ─── Rate selector ──────────────────────────────────────────────
  rateSelector: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  rateOption: {
    flex: 1,
    backgroundColor: colors.surface.light,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  rateOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight + '15',
  },
  rateOptionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  rateOptionLabelActive: {
    color: colors.primary,
  },
  rateOptionValue: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 4,
  },
  rateOptionValueActive: {
    color: colors.primary,
    fontWeight: '600',
  },

  // ─── Payment rows ───────────────────────────────────────────────
  paymentRow: {
    backgroundColor: colors.surface.light,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  paymentMethodPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
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
  paymentAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentCurrency: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.secondary,
    marginRight: spacing.sm,
  },
  paymentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    fontSize: 16,
    color: colors.text.primary,
    backgroundColor: colors.background.light,
  },
  removePaymentBtn: {
    marginLeft: spacing.sm,
  },
  paymentMethodLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  addPaymentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.sm,
    borderStyle: 'dashed',
    marginBottom: spacing.md,
  },
  addPaymentText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },

  // ─── Balance indicator ──────────────────────────────────────────
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
  },
  balanceCardOk: {
    backgroundColor: colors.success + '15',
  },
  balanceCardError: {
    backgroundColor: colors.danger + '15',
  },
  balanceText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },

  // ─── VES equivalent ─────────────────────────────────────────────
  vesCard: {
    backgroundColor: colors.surface.light,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  vesLabel: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  vesValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  vesRate: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },

  // ─── Review card ────────────────────────────────────────────────
  reviewCard: {
    backgroundColor: colors.surface.light,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  reviewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  reviewItemInfo: {
    flex: 1,
  },
  reviewItemName: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text.primary,
  },
  reviewItemDetail: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  reviewItemSubtotal: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  reviewTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
  },
  reviewTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  reviewTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },

  // ─── Credit section ─────────────────────────────────────────────
  creditSection: {
    marginTop: spacing.md,
  },
  creditToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface.light,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  creditLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text.primary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text.primary,
    backgroundColor: colors.surface.light,
    marginTop: spacing.sm,
  },

  // ─── Bottom bar ─────────────────────────────────────────────────
  bottomBar: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.background.light,
  },
  nextButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.md,
  },
  nextButtonText: {
    color: colors.text.inverse,
    fontSize: 16,
    fontWeight: '600',
    marginRight: spacing.xs,
  },
  confirmButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.success,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.md,
  },
  confirmButtonText: {
    color: colors.text.inverse,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.5,
  },

  // ─── Empty state ────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
});
