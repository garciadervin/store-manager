import { useState, useCallback, useMemo, useEffect } from 'react';
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
import { useQuery } from '@tanstack/react-query';
import {
  useDebts,
  useDebtsByStatus,
} from '../../../src/hooks/useDebts';
import { getDebtSummary } from '../../../src/db/repositories/debts';
import { formatUSD } from '../../../src/utils/format';
import { colors } from '../../../src/theme/colors';
import { spacing, borderRadius } from '../../../src/theme/spacing';
import type { Debt } from '../../../src/utils/types';

type FilterTab = 'pending' | 'partial' | 'settled' | 'all';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'pending', label: 'Pendientes' },
  { key: 'partial', label: 'Parciales' },
  { key: 'settled', label: 'Pagados' },
  { key: 'all', label: 'Todos' },
];

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

export default function DebtsScreen() {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  const { data: allDebts, isLoading, isError, error, refetch, isRefetching } = useDebts();
  const { data: filteredDebts, isLoading: filterLoading } = useDebtsByStatus(
    activeFilter !== 'all' ? activeFilter : '',
  );
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['debts', 'summary'],
    queryFn: () => getDebtSummary(),
  });

  // Refetch summary when debts change
  useEffect(() => {
    if (allDebts) {
      refetch();
    }
  }, [allDebts]);

  const displayDebts = useMemo(() => {
    if (activeFilter === 'all') {
      return (allDebts as Debt[] | undefined) ?? [];
    }
    return (filteredDebts as Debt[] | undefined) ?? [];
  }, [activeFilter, allDebts, filteredDebts]);

  const isLoadingData = isLoading || filterLoading || summaryLoading;

  // ─── Days since helper ──────────────────────────────────────────────

  const daysSince = (dateStr: string | null): number | null => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  // ─── Render helpers ─────────────────────────────────────────────────

  const renderSummaryCard = () => {
    const s = summary ?? { total_outstanding: 0, total_pending: 0, total_partial: 0 };
    return (
      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <Ionicons name="cash-outline" size={20} color={colors.text.inverse} />
          <Text style={styles.summaryTitle}>Total por cobrar</Text>
        </View>
        <Text style={styles.summaryAmount}>{formatUSD(s.total_outstanding)}</Text>
        <View style={styles.summaryBreakdown}>
          <View style={styles.breakdownItem}>
            <View style={[styles.breakdownDot, { backgroundColor: colors.danger }]} />
            <Text style={styles.breakdownLabel}>Pendientes</Text>
            <Text style={styles.breakdownValue}>{formatUSD(s.total_pending)}</Text>
          </View>
          <View style={styles.breakdownItem}>
            <View style={[styles.breakdownDot, { backgroundColor: colors.warning }]} />
            <Text style={styles.breakdownLabel}>Parciales</Text>
            <Text style={styles.breakdownValue}>{formatUSD(s.total_partial)}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderFilterTabs = () => (
    <View style={styles.filterContainer}>
      {FILTER_TABS.map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[
            styles.filterTab,
            activeFilter === tab.key && styles.filterTabActive,
          ]}
          onPress={() => setActiveFilter(tab.key)}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.filterTabText,
              activeFilter === tab.key && styles.filterTabTextActive,
            ]}
          >
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderDebtCard = ({ item }: { item: Debt }) => {
    const statusStyle = STATUS_COLORS[item.status] ?? STATUS_COLORS.pending;
    const days = daysSince(item.last_contact_date ?? item.created_at);

    return (
      <Pressable
        style={({ pressed }) => [
          styles.debtCard,
          pressed && styles.debtCardPressed,
        ]}
        onPress={() => router.push(`/(tabs)/debts/${item.id}`)}
      >
        <View style={styles.debtCardHeader}>
          <View style={styles.debtCustomerRow}>
            <Ionicons name="person-outline" size={16} color={colors.text.secondary} />
            <Text style={styles.debtCustomerName}>{item.customer_name}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusText, { color: statusStyle.text }]}>
              {STATUS_LABELS[item.status] ?? item.status}
            </Text>
          </View>
        </View>

        <View style={styles.debtCardBody}>
          <Text style={styles.debtBalanceLabel}>Saldo pendiente</Text>
          <Text style={styles.debtBalanceValue}>{formatUSD(item.balance_due_usd)}</Text>
        </View>

        <View style={styles.debtCardFooter}>
          <Ionicons name="time-outline" size={14} color={colors.text.secondary} />
          <Text style={styles.debtDaysText}>
            {days !== null
              ? days === 0
                ? 'Hoy'
                : `Hace ${days} día${days === 1 ? '' : 's'}`
              : 'Sin contacto'}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.text.secondary} style={styles.chevron} />
        </View>
      </Pressable>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="receipt-outline" size={64} color={colors.text.secondary} />
      <Text style={styles.emptyTitle}>
        {activeFilter === 'all' ? 'Sin fiados registrados' : 'Sin resultados'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {activeFilter === 'all'
          ? 'Registra tu primer fiado para comenzar.'
          : 'No hay fiados en esta categoría.'}
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
          {error?.message ?? 'Error al cargar fiados'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={displayDebts}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={
          <>
            {renderSummaryCard()}
            {renderFilterTabs()}
          </>
        }
        renderItem={renderDebtCard}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={
          displayDebts.length === 0
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
        onPress={() => router.push('/(tabs)/debts/new')}
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

  // ─── Summary card ────────────────────────────────────────────────
  summaryCard: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    margin: spacing.md,
    marginBottom: spacing.sm,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  summaryTitle: {
    fontSize: 14,
    color: colors.text.inverse,
    opacity: 0.85,
    marginLeft: spacing.sm,
    fontWeight: '500',
  },
  summaryAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text.inverse,
    marginBottom: spacing.md,
  },
  summaryBreakdown: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breakdownDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  breakdownLabel: {
    fontSize: 12,
    color: colors.text.inverse,
    opacity: 0.75,
    marginRight: spacing.xs,
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.inverse,
  },

  // ─── Filter tabs ─────────────────────────────────────────────────
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  filterTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface.light,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterTabText: {
    fontSize: 13,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: colors.text.inverse,
  },

  // ─── List ────────────────────────────────────────────────────────
  listContainer: {
    padding: spacing.md,
    paddingTop: 0,
    paddingBottom: 100,
  },
  emptyListContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },

  // ─── Debt card ───────────────────────────────────────────────────
  debtCard: {
    backgroundColor: colors.surface.light,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  debtCardPressed: {
    opacity: 0.7,
  },
  debtCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  debtCustomerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  debtCustomerName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginLeft: spacing.sm,
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

  // ─── Debt card body ──────────────────────────────────────────────
  debtCardBody: {
    marginBottom: spacing.sm,
  },
  debtBalanceLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  debtBalanceValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
  },

  // ─── Debt card footer ────────────────────────────────────────────
  debtCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: spacing.sm,
  },
  debtDaysText: {
    fontSize: 12,
    color: colors.text.secondary,
    marginLeft: spacing.xs,
    flex: 1,
  },
  chevron: {
    marginLeft: 'auto',
  },

  // ─── Empty state ─────────────────────────────────────────────────
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

  // ─── Error ───────────────────────────────────────────────────────
  errorText: {
    fontSize: 15,
    color: colors.danger,
    textAlign: 'center',
    marginTop: spacing.md,
  },

  // ─── FAB ─────────────────────────────────────────────────────────
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
