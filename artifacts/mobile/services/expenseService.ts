import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Expense } from '@/types/expense';

const STORAGE_KEY = 'fahrtdoc_expenses';

export async function loadExpenses(): Promise<Expense[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Expense[]) : [];
  } catch {
    return [];
  }
}

export async function saveExpense(expense: Expense): Promise<void> {
  try {
    const existing = await loadExpenses();
    const updated = [expense, ...existing];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // silently fail
  }
}

export async function deleteExpense(id: string): Promise<void> {
  const existing = await loadExpenses();
  const updated = existing.filter((e) => e.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export async function updateExpense(expense: Expense): Promise<void> {
  try {
    const existing = await loadExpenses();
    const updated = existing.map((e) => (e.id === expense.id ? expense : e));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // silently fail
  }
}
