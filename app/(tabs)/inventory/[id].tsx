import { useState, useEffect } from 'react';
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
import { router, useLocalSearchParams } from 'expo-router';
import {
  useProduct,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
} from '../../../src/hooks/useProducts';
import { formatUSD } from '../../../src/utils/format';
import { colors } from '../../../src/theme/colors';
import { spacing, borderRadius } from '../../../src/theme/spacing';

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const productId = isNew ? null : Number(id);

  const { data: product, isLoading, isError, error } = useProduct(productId ?? 0);
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const deleteMutation = useDeleteProduct();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [priceUsd, setPriceUsd] = useState('');
  const [stockQty, setStockQty] = useState('');
  const [unitType, setUnitType] = useState('unit');

  // Load existing product data into form
  useEffect(() => {
    if (product && !isNew) {
      const p = product as {
        name: string;
        category: string | null;
        price_usd: number;
        stock_qty: number;
        unit_type: string;
      };
      setName(p.name);
      setCategory(p.category ?? '');
      setPriceUsd(String(p.price_usd));
      setStockQty(String(p.stock_qty));
      setUnitType(p.unit_type);
    }
  }, [product, isNew]);

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

    const data = {
      name: name.trim(),
      category: category.trim() || undefined,
      price_usd: parseFloat(priceUsd),
      stock_qty: parseInt(stockQty, 10),
      unit_type: unitType.trim() || 'unit',
    };

    try {
      if (isNew) {
        await createMutation.mutateAsync({
          name: data.name,
          price_usd: data.price_usd,
          stock_qty: data.stock_qty,
        });
      } else if (productId) {
        await updateMutation.mutateAsync({
          id: productId,
          data: {
            name: data.name,
            category: data.category,
            price_usd: data.price_usd,
            stock_qty: data.stock_qty,
            unit_type: data.unit_type,
          },
        });
      }
      router.back();
    } catch (err) {
      Alert.alert('Error', 'No se pudo guardar el producto.');
    }
  };

  // ─── Delete ──────────────────────────────────────────────────────

  const confirmDelete = () => {
    if (!productId) return;
    const p = product as { name: string } | undefined;
    Alert.alert(
      'Eliminar producto',
      `¿Estás seguro de eliminar "${p?.name ?? 'este producto'}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync(productId);
              router.back();
            } catch (err) {
              Alert.alert('Error', 'No se pudo eliminar el producto.');
            }
          },
        },
      ],
    );
  };

  // ─── Loading / Error ─────────────────────────────────────────────

  if (!isNew && isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isNew && isError) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
        <Text style={styles.errorText}>
          {error?.message ?? 'Error al cargar producto'}
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;

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
          style={[styles.saveButton, isSaving && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.text.inverse} />
          ) : (
            <Text style={styles.saveButtonText}>
              {isNew ? 'Crear producto' : 'Guardar cambios'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Delete button (only for existing products) */}
        {!isNew && productId ? (
          <TouchableOpacity
            style={[styles.deleteButton, isDeleting && styles.buttonDisabled]}
            onPress={confirmDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <>
                <Ionicons
                  name="trash-outline"
                  size={18}
                  color={colors.danger}
                  style={{ marginRight: spacing.sm }}
                />
                <Text style={styles.deleteButtonText}>Eliminar producto</Text>
              </>
            )}
          </TouchableOpacity>
        ) : null}
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
  deleteButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  deleteButtonText: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
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

  // ─── Error ──────────────────────────────────────────────────────
  errorText: {
    fontSize: 15,
    color: colors.danger,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
