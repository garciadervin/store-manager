import { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSale, useRefundSale } from '../../../src/hooks/useSales';
import { usePaymentMethods } from '../../../src/hooks/usePaymentMethods';
import { formatUSD, formatVES, formatDateTime } from '../../../src/utils/format';
import { colors } from '../../../src/theme/colors';
import { spacing, borderRadius } from '../../../src/theme/spacing';
import type { PaymentMethod } from '../../../src/utils/types';

// Extended sale type with related items and payments from the repository
interface SaleDetail {
  id: number;
  timestamp: string;
  total_usd: number;
  total_ves: number;
  rate_value: number;
  rate_source: string;
  status: 'completed' | 'refunded';
  notes: string | null;
  created_at: string;
  items: Array<{
    id: number;
    sale_id: number;
    product_id: number | null;
    product_name: string;
    quantity: number;
    unit_price_usd: number;
    subtotal_usd: number;
  }>;
  payments: Array<{
    id: number;
    sale_id: number;
    method_id: number;
    amount_usd: number;
    created_at: string;
  }>;
}

export default function SaleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const saleId = Number(id);

  const { data: sale, isLoading, isError, error } = useSale(saleId);
  const { data: paymentMethods } = usePaymentMethods();
  const refundSale = useRefundSale();

  // ─── Helpers ─────────────────────────────────────────────────────

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'completed':
        return { bg: colors.success + '20', text: colors.success };
      case 'refunded':
        return { bg: colors.danger + '20', text: colors.danger };
      default:
        return { bg: colors.surface.light, text: colors.text.secondary };
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completada';
      case 'refunded':
        return 'Reembolsada';
      default:
        return status;
    }
  };

  const getMethodName = useCallback(
    (methodId: number): string => {
      if (!paymentMethods) return `Método #${methodId}`;
      const method = (paymentMethods as PaymentMethod[]).find(
        (m) => m.id === methodId,
      );
      return method?.label ?? `Método #${methodId}`;
    },
    [paymentMethods],
  );

  // ─── Share via WhatsApp ──────────────────────────────────────────
  const handleShare = useCallback(() => {
    if (!sale) return;
    const s = sale as unknown as SaleDetail;

    const lines: string[] = [
      '🧾 *RECIBO DE VENTA*',
      '─────────────────',
      `📅 ${formatDateTime(s.timestamp)}`,
      `🆔 #${s.id}`,
      '',
      '*Productos:*',
    ];

    if (s.items) {
      for (const item of s.items) {
        lines.push(
          `  • ${item.product_name} x${item.quantity} — ${formatUSD(item.subtotal_usd)}`,
        );
      }
    }

    lines.push('');
    lines.push(`*Total USD:* ${formatUSD(s.total_usd)}`);
    lines.push(`*Total Bs.:* ${formatVES(s.total_ves)}`);
    lines.push(`*Tasa:* ${s.rate_source} — Bs. ${s.rate_value.toFixed(2)}`);

    if (s.payments && s.payments.length > 0) {
      lines.push('');
      lines.push('*Pagos:*');
      for (const payment of s.payments) {
        lines.push(
          `  • ${getMethodName(payment.method_id)}: ${formatUSD(payment.amount_usd)}`,
        );
      }
    }

    if (s.notes) {
      lines.push('');
      lines.push(`📝 ${s.notes}`);
    }

    lines.push('');
    lines.push('─────────────────');
    lines.push('Gracias por su compra 🙌');

    const text = encodeURIComponent(lines.join('\n'));
    const url = `https://wa.me/?text=${text}`;

    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'No se pudo abrir WhatsApp.');
    });
  }, [sale, getMethodName]);

  // ─── Refund ──────────────────────────────────────────────────────
  const handleRefund = useCallback(() => {
    if (!sale) return;
    const s = sale as unknown as SaleDetail;
    if (s.status !== 'completed') {
      Alert.alert('No disponible', 'Esta venta ya fue reembolsada.');
      return;
    }

    Alert.alert(
      'Reembolsar venta',
      `¿Estás seguro de reembolsar esta venta por ${formatUSD(s.total_usd)}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Reembolsar',
          style: 'destructive',
          onPress: async () => {
            try {
              await refundSale.mutateAsync(s.id);
              Alert.alert('Reembolsado', 'La venta ha sido reembolsada.');
            } catch {
              Alert.alert('Error', 'No se pudo reembolsar la venta.');
            }
          },
        },
      ],
    );
  }, [sale, refundSale]);

  // ─── Loading / Error ─────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isError || !sale) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
        <Text style={styles.errorText}>
          {error?.message ?? 'Venta no encontrada'}
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const s = sale as unknown as SaleDetail;
  const statusStyle = getStatusStyle(s.status);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      {/* ─── Header ──────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.headerDate}>{formatDateTime(s.timestamp)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusText, { color: statusStyle.text }]}>
              {getStatusLabel(s.status)}
            </Text>
          </View>
        </View>
        <Text style={styles.headerId}>Venta #{s.id}</Text>
      </View>

      {/* ─── Totals ──────────────────────────────────────────────── */}
      <View style={styles.totalsCard}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total USD</Text>
          <Text style={styles.totalValueUSD}>{formatUSD(s.total_usd)}</Text>
        </View>
        <View style={styles.totalDivider} />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total Bs.</Text>
          <Text style={styles.totalValueVES}>{formatVES(s.total_ves)}</Text>
        </View>
      </View>

      {/* ─── Items ───────────────────────────────────────────────── */}
      <Text style={styles.sectionTitle}>Productos</Text>
      <View style={styles.card}>
        {s.items && s.items.length > 0 ? (
          s.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.product_name}</Text>
                <Text style={styles.itemDetail}>
                  {item.quantity} × {formatUSD(item.unit_price_usd)}
                </Text>
              </View>
              <Text style={styles.itemSubtotal}>
                {formatUSD(item.subtotal_usd)}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>Sin productos registrados</Text>
        )}
      </View>

      {/* ─── Payments ────────────────────────────────────────────── */}
      <Text style={styles.sectionTitle}>Pagos</Text>
      <View style={styles.card}>
        {s.payments && s.payments.length > 0 ? (
          s.payments.map((payment) => (
            <View key={payment.id} style={styles.itemRow}>
              <Text style={styles.itemName}>
                {getMethodName(payment.method_id)}
              </Text>
              <Text style={styles.itemSubtotal}>
                {formatUSD(payment.amount_usd)}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>Sin pagos registrados</Text>
        )}
      </View>

      {/* ─── Exchange rate ───────────────────────────────────────── */}
      <Text style={styles.sectionTitle}>Tasa de cambio</Text>
      <View style={styles.card}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Fuente</Text>
          <Text style={styles.infoValue}>{s.rate_source}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Tasa</Text>
          <Text style={styles.infoValue}>Bs. {s.rate_value.toFixed(2)}</Text>
        </View>
      </View>

      {/* ─── Notes ───────────────────────────────────────────────── */}
      {s.notes ? (
        <>
          <Text style={styles.sectionTitle}>Notas</Text>
          <View style={styles.card}>
            <Text style={styles.notesText}>{s.notes}</Text>
          </View>
        </>
      ) : null}

      {/* ─── Actions ─────────────────────────────────────────────── */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.shareButton}
          onPress={handleShare}
          activeOpacity={0.8}
        >
          <Ionicons name="share-outline" size={20} color={colors.primary} />
          <Text style={styles.shareButtonText}>Compartir recibo</Text>
        </TouchableOpacity>

        {s.status === 'completed' && (
          <TouchableOpacity
            style={[styles.refundButton, refundSale.isPending && styles.buttonDisabled]}
            onPress={handleRefund}
            disabled={refundSale.isPending}
            activeOpacity={0.8}
          >
            {refundSale.isPending ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <>
                <Ionicons name="refresh-outline" size={20} color={colors.danger} />
                <Text style={styles.refundButtonText}>Reembolsar</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
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

  // ─── Header ─────────────────────────────────────────────────────
  header: {
    marginBottom: spacing.lg,
  },
  headerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerDate: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  headerId: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: spacing.xs,
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

  // ─── Totals card ────────────────────────────────────────────────
  totalsCard: {
    backgroundColor: colors.surface.light,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 15,
    color: colors.text.secondary,
  },
  totalValueUSD: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
  },
  totalValueVES: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
  },
  totalDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing.sm,
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

  // ─── Items ──────────────────────────────────────────────────────
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text.primary,
  },
  itemDetail: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  itemSubtotal: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },

  // ─── Info rows ──────────────────────────────────────────────────
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },

  // ─── Notes ──────────────────────────────────────────────────────
  notesText: {
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 20,
  },

  // ─── Empty ──────────────────────────────────────────────────────
  emptyText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },

  // ─── Actions ────────────────────────────────────────────────────
  actions: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  shareButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primaryLight + '20',
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.md,
  },
  shareButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  refundButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  refundButtonText: {
    color: colors.danger,
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
