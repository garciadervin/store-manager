import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  usePaymentMethods,
  useCreatePaymentMethod,
  useUpdatePaymentMethod,
  useDeletePaymentMethod,
} from '../../../src/hooks/usePaymentMethods';
import type { PaymentMethod } from '../../../src/utils/types';
import { colors } from '../../../src/theme/colors';
import { spacing, borderRadius } from '../../../src/theme/spacing';

export default function PaymentMethodsScreen() {
  const { data: methods, isLoading, isError, error } = usePaymentMethods();
  const createMutation = useCreatePaymentMethod();
  const updateMutation = useUpdatePaymentMethod();
  const deleteMutation = useDeletePaymentMethod();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [label, setLabel] = useState('');
  const [instructions, setInstructions] = useState('');

  // ─── Modal handlers ──────────────────────────────────────────────

  const openAddModal = () => {
    setEditingMethod(null);
    setLabel('');
    setInstructions('');
    setModalVisible(true);
  };

  const openEditModal = (method: PaymentMethod) => {
    setEditingMethod(method);
    setLabel(method.label);
    setInstructions(method.instructions ?? '');
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingMethod(null);
    setLabel('');
    setInstructions('');
  };

  const handleSave = async () => {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      Alert.alert('Error', 'El nombre del método de pago es obligatorio.');
      return;
    }

    try {
      if (editingMethod) {
        await updateMutation.mutateAsync({
          id: editingMethod.id,
          data: {
            label: trimmedLabel,
            instructions: instructions.trim() || undefined,
          },
        });
      } else {
        await createMutation.mutateAsync({
          label: trimmedLabel,
          instructions: instructions.trim() || undefined,
        });
      }
      closeModal();
    } catch (err) {
      Alert.alert('Error', 'No se pudo guardar el método de pago.');
    }
  };

  const confirmDelete = (method: PaymentMethod) => {
    Alert.alert(
      'Eliminar método',
      `¿Estás seguro de eliminar "${method.label}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(method.id),
        },
      ],
    );
  };

  // ─── Render helpers ──────────────────────────────────────────────

  const renderItem = ({ item }: { item: PaymentMethod }) => (
    <Pressable
      style={({ pressed }) => [
        styles.methodItem,
        pressed && styles.methodItemPressed,
      ]}
      onPress={() => openEditModal(item)}
      onLongPress={() => confirmDelete(item)}
    >
      <View style={styles.methodContent}>
        <View style={styles.methodIcon}>
          <Ionicons name="card-outline" size={22} color={colors.primary} />
        </View>
        <View style={styles.methodInfo}>
          <Text style={styles.methodLabel}>{item.label}</Text>
          {item.instructions ? (
            <Text style={styles.methodInstructions} numberOfLines={2}>
              {item.instructions}
            </Text>
          ) : null}
        </View>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => confirmDelete(item)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="trash-outline" size={18} color={colors.danger} />
      </TouchableOpacity>
    </Pressable>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="wallet-outline" size={64} color={colors.text.secondary} />
      <Text style={styles.emptyTitle}>Sin métodos de pago</Text>
      <Text style={styles.emptySubtitle}>
        Agrega métodos como transferencia, efectivo o pago móvil.
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
          {error?.message ?? 'Error al cargar métodos de pago'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={methods as PaymentMethod[]}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={
          (methods as PaymentMethod[] | undefined)?.length === 0
            ? styles.emptyListContainer
            : styles.listContainer
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={openAddModal}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color={colors.text.inverse} />
      </TouchableOpacity>

      {/* Add / Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.modalBackdrop} onPress={closeModal} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingMethod ? 'Editar método' : 'Nuevo método'}
              </Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={24} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Nombre *</Text>
            <TextInput
              style={styles.input}
              value={label}
              onChangeText={setLabel}
              placeholder="Ej: Transferencia, Efectivo, Pago Móvil"
              placeholderTextColor={colors.text.secondary}
              autoFocus
            />

            <Text style={styles.fieldLabel}>Instrucciones</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={instructions}
              onChangeText={setInstructions}
              placeholder="Ej: 0412-1234567 (opcional)"
              placeholderTextColor={colors.text.secondary}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[
                styles.saveButton,
                (!label.trim() || createMutation.isPending || updateMutation.isPending) &&
                  styles.saveButtonDisabled,
              ]}
              onPress={handleSave}
              disabled={
                !label.trim() || createMutation.isPending || updateMutation.isPending
              }
            >
              {createMutation.isPending || updateMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.text.inverse} />
              ) : (
                <Text style={styles.saveButtonText}>Guardar</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  listContainer: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  emptyListContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },

  // ─── Method item ────────────────────────────────────────────────
  methodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.light,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  methodItemPressed: {
    opacity: 0.7,
  },
  methodContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  methodIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primaryLight + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  methodInfo: {
    flex: 1,
  },
  methodLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  methodInstructions: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  deleteButton: {
    padding: spacing.sm,
    marginLeft: spacing.sm,
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

  // ─── Modal ──────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    backgroundColor: colors.background.light,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 40 : spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
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
  textArea: {
    minHeight: 80,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: colors.text.inverse,
    fontSize: 16,
    fontWeight: '600',
  },
});
