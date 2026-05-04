import { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSales } from '../../../src/hooks/useSales';
import { formatUSD, formatVES, formatDateTime } from '../../../src/utils/format';
import { colors } from '../../../src/theme/colors';
import { spacing, borderRadius } from '../../../src/theme/spacing';
import type { Sale } from '../../../src/utils/types';

export default function SalesHistoryScreen() {
  const { data: sales, isLoading, isError, error, refetch, isRefetching } = useSales();

  // ─── Render helpers ──────────────────────────────────────────────

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

  const renderSale = ({ item }: { item: Sale }) => {
    const statusStyle = getStatusStyle(item.status);
    return (
      <Pressable
        style={({ pressed }) => [
          styles.saleCard,
          pressed && styles.saleCardPressed,
        ]}
        onPress={() => router.push(`/(tabs)/sales/${item.id}`)}
      >
        <View style={styles.saleHeader}>
          <Text style={styles.saleDate}>{formatDateTime(item.timestamp)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusText, { color: statusStyle.text }]}>
              {getStatusLabel(item.status)}
            </Text>
          </View>
        </View>

        <View style={styles.saleTotals}>
          <View style={styles.totalRow}>
            <Ionicons name="cash-outline" size={16} color={colors.text.secondary} />
            <Text style={styles.totalLabel}>Total USD</Text>
            <Text style={styles.totalValue}>{formatUSD(item.total_usd)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Ionicons name="trending-up-outline" size={16} color={colors.text.secondary} />
            <Text style={styles.totalLabel}>Total Bs.</Text>
            <Text style={styles.totalValue}>{formatVES(item.total_ves)}</Text>
          </View>
        </View>

        <View style={styles.saleFooter}>
          <Text style={styles.rateInfo}>
            Tasa: {item.rate_source} — Bs. {item.rate_value.toFixed(2)}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.text.secondary} />
        </View>
      </Pressable>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="receipt-outline" size={64} color={colors.text.secondary} />
      <Text style={styles.emptyTitle}>Sin ventas</Text>
      <Text style={styles.emptySubtitle}>
        Registra tu primera venta para ver el historial aquí.
      </Text>
    </View>
  );

  // ─── Loading / Error ─────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
        <Text style={styles.errorText}>
          {error?.message ?? 'Error al cargar ventas'}
        </Text>
      </View>
    );
  }

  const saleList = (sales as Sale[] | undefined) ?? [];

  return (
    <View style={styles.container}>
      <FlatList
        data={saleList}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderSale}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={
          saleList.length === 0
            ? styles.emptyListContainer
            : styles.listContainer
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(tabs)/sales/new')}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color={colors.text.inverse} />
      </TouchableOpacity>
    </View>
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

  // ─── List ───────────────────────────────────────────────────────
  listContainer: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  emptyListContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },

  // ─── Sale card ──────────────────────────────────────────────────
  saleCard: {
    backgroundColor: colors.surface.light,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  saleCardPressed: {
    opacity: 0.7,
  },
  saleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  saleDate: {
    fontSize: 14,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // ─── Totals ─────────────────────────────────────────────────────
  saleTotals: {
    marginBottom: spacing.sm,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  totalLabel: {
    fontSize: 14,
    color: colors.text.secondary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  totalValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },

  // ─── Footer ─────────────────────────────────────────────────────
  saleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: spacing.sm,
  },
  rateInfo: {
    fontSize: 12,
    color: colors.text.secondary,
  },

  // ─── Empty state ────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },

  // ─── Error ──────────────────────────────────────────────────────
  errorText: {
    fontSize: 15,
    color: colors.danger,
    textAlign: 'center',
    marginTop: spacing.md,
  },

  // ─── FAB ────────────────────────────────────────────────────────
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
