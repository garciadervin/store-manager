import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        headerShown: true,
      }}
    >
      <Tabs.Screen
        name="inventory/index"
        options={{
          title: 'Inventario',
          tabBarLabel: 'Inventario',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cube-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="inventory/[id]"
        options={{
          title: 'Producto',
          href: null,
        }}
      />
      <Tabs.Screen
        name="inventory/new"
        options={{
          title: 'Nuevo Producto',
          href: null,
        }}
      />
      <Tabs.Screen
        name="sales/index"
        options={{
          title: 'Ventas',
          tabBarLabel: 'Ventas',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="debts/index"
        options={{
          title: 'Fiados',
          tabBarLabel: 'Fiados',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings/index"
        options={{
          title: 'Ajustes',
          tabBarLabel: 'Ajustes',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings/payment-methods"
        options={{
          title: 'Métodos de Pago',
          href: null,
        }}
      />
    </Tabs>
  );
}
