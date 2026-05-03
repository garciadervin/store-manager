import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  useProducts,
  useSearchProducts,
  useProductsByCategory,
} from '../../../src/hooks/useProducts';
import type { Product } from '../../../src/utils/types';
import { formatUSD } from '../../../src/utils/format';
import { colors } from '../../../src/theme/colors';
import { spacing, borderRadius } from '../../../src/theme/spacing';

export default function InventoryScreen() {
  const { data: allProducts, isLoading, isError, error, refetch, isRefetching } = useProducts();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const searchResults = useSearchProducts(debouncedQuery);
  const categoryResults = useProductsByCategory(selectedCategory ?? '');

  // Debounce search input
  const debounceTimer = useMemo(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return (text: string) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        setDebouncedQuery(text);
      }, 300);
    };
  }, []);

  const handleSearchChange = useCallback(
    (text: string) => {
      setSearchQuery(text);
      debounceTimer(text);
    },
    [debounceTimer],
  );

  // Determine which products to display
  const displayProducts = useMemo(() => {
    if (debouncedQuery) {
      return (searchResults.data as Product[] | undefined) ?? [];
    }
    if (selectedCategory) {
      return (categoryResults.data as Product[] | undefined) ?? [];
    }
    return (allProducts as Product[] | undefined) ?? [];
  }, [debouncedQuery, searchResults.data, selectedCategory, categoryResults.data, allProducts]);

  // Extract unique categories from all products
  const categories = useMemo(() => {
    if (!allProducts) return [];
    const cats = new Set<string>();
    (allProducts as Product[]).forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats).sort();
  }, [allProducts]);

  const isLoadingData =
    isLoading ||
    (debouncedQuery ? searchResults.isLoading : false) ||
    (selectedCategory ? categoryResults.isLoading : false);

  // ─── Render helpers ──────────────────────────────────────────────

  const renderProduct = ({ item }: { item: Product }) => (
    <Pressable
      style={({ pressed }) => [
        styles.productItem,
        pressed && styles.productItemPressed,
      ]}
      onPress={() => router.push(`/(tabs)/inventory/${item.id}`)}
    >
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{item.name}</Text>
        {item.category ? (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{item.category}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.productMeta}>
        <Text style={styles.productPrice}>{formatUSD(item.price_usd)}</Text>
        <Text
          style={[
            styles.productStock,
            item.stock_qty <= 0 && styles.productStockEmpty,
          ]}
        >
          {item.stock_qty} {item.unit_type === 'unit' ? 'uds.' : item.unit_type}
        </Text>
      </View>
    </Pressable>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="cube-outline" size={64} color={colors.text.secondary} />
      <Text style={styles.emptyTitle}>
        {debouncedQuery
          ? 'Sin resultados'
          : selectedCategory
            ? 'Sin productos en esta categoría'
            : 'Inventario vacío'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {debouncedQuery || selectedCategory
          ? 'Intenta con otros términos o categorías.'
          : 'Agrega tu primer producto para comenzar.'}
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
          {error?.message ?? 'Error al cargar productos'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search-outline"
          size={20}
          color={colors.text.secondary}
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={handleSearchChange}
          placeholder="Buscar productos..."
          placeholderTextColor={colors.text.secondary}
          clearButtonMode="while-editing"
        />
        {searchQuery ? (
          <TouchableOpacity
            onPress={() => {
              setSearchQuery('');
              setDebouncedQuery('');
            }}
          >
            <Ionicons name="close-circle" size={20} color={colors.text.secondary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Category filter chips */}
      {categories.length > 0 && !debouncedQuery ? (
        <FlatList
          horizontal
          data={categories}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContainer}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.chip,
                selectedCategory === item && styles.chipActive,
              ]}
              onPress={() =>
                setSelectedCategory(
                  selectedCategory === item ? null : item,
                )
              }
            >
              <Text
                style={[
                  styles.chipText,
                  selectedCategory === item && styles.chipTextActive,
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
      ) : null}

      {/* Product list */}
      <FlatList
        data={displayProducts}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderProduct}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={
          displayProducts.length === 0
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
        onPress={() => router.push('/(tabs)/inventory/new')}
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

  // ─── Search ─────────────────────────────────────────────────────
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.light,
    borderRadius: borderRadius.md,
    margin: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text.primary,
  },

  // ─── Category chips ─────────────────────────────────────────────
  chipsContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface.light,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  chipTextActive: {
    color: colors.text.inverse,
  },

  // ─── List ───────────────────────────────────────────────────────
  listContainer: {
    padding: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 100,
  },
  emptyListContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },

  // ─── Product item ───────────────────────────────────────────────
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.light,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  productItemPressed: {
    opacity: 0.7,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight + '20',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginTop: spacing.xs,
  },
  categoryText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '500',
  },
  productMeta: {
    alignItems: 'flex-end',
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  productStock: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  productStockEmpty: {
    color: colors.danger,
    fontWeight: '600',
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
