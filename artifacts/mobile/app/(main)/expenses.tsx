import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import type { Expense, ExpenseCategory } from '@/types/expense';
import {
  deleteExpense,
  loadExpenses,
  saveExpense,
  updateExpense,
} from '@/services/expenseService';
import {
  analyzeReceipt,
  type AnalysisResult,
} from '@/services/receiptAnalyzer';

// ─── Constants ─────────────────────────────────────────────────────────────────

const PRIMARY = '#1a2b6b';
const BG = '#f2f2f7';
const CARD_STYLE = {
  backgroundColor: '#fff',
  borderRadius: 12,
  borderWidth: 0.5,
  borderColor: '#e8e8e8',
} as const;

const CATEGORY_CONFIG: Record<
  ExpenseCategory,
  { label: string; icon: React.ComponentProps<typeof Feather>['name']; color: string }
> = {
  kraftstoff: { label: 'Kraftstoff', icon: 'droplet', color: '#e67e22' },
  wartung: { label: 'Wartung', icon: 'tool', color: '#27ae60' },
  parkgebuehr: { label: 'Parkgebühr', icon: 'map-pin', color: PRIMARY },
  sonstiges: { label: 'Sonstiges', icon: 'tag', color: '#8e44ad' },
};

const PERIODS = ['1 Mon.', '3 Mon.', '6 Mon.', 'Dieses Jahr'] as const;
type Period = (typeof PERIODS)[number];

const CATEGORIES: ExpenseCategory[] = ['kraftstoff', 'wartung', 'parkgebuehr', 'sonstiges'];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function filterExpenses(expenses: Expense[], period: Period): Expense[] {
  const now = new Date();
  let from: Date;
  if (period === '1 Mon.') from = new Date(now.getFullYear(), now.getMonth(), 1);
  else if (period === '3 Mon.') from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  else if (period === '6 Mon.') from = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  else from = new Date(now.getFullYear(), 0, 1);
  return expenses.filter((e) => new Date(e.date) >= from);
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

type FormState = {
  category: ExpenseCategory;
  amount: string;
  description: string;
  date: string;
  linkedTripId: string;
  note: string;
};

const emptyForm = (): FormState => ({
  category: 'sonstiges',
  amount: '',
  description: '',
  date: new Date().toISOString().split('T')[0],
  linkedTripId: '',
  note: '',
});

// ─── Sub-components ────────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
      {[0, 1, 2, 3].map((i) => (
        <React.Fragment key={i}>
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: i <= step ? PRIMARY : '#e8e8e8',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: i <= step ? '#fff' : '#999', fontSize: 12, fontWeight: '700' }}>
              {i + 1}
            </Text>
          </View>
          {i < 3 && (
            <View style={{ width: 24, height: 2, backgroundColor: i < step ? PRIMARY : '#e8e8e8' }} />
          )}
        </React.Fragment>
      ))}
    </View>
  );
}

function CategoryGrid({
  selected,
  aiSuggestion,
  onSelect,
}: {
  selected: ExpenseCategory;
  aiSuggestion?: ExpenseCategory;
  onSelect: (c: ExpenseCategory) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
      {CATEGORIES.map((cat) => {
        const cfg = CATEGORY_CONFIG[cat];
        const isSelected = selected === cat;
        const isAI = aiSuggestion === cat;
        return (
          <TouchableOpacity
            key={cat}
            onPress={() => onSelect(cat)}
            style={{
              flex: 1,
              minWidth: '45%',
              padding: 12,
              borderRadius: 10,
              borderWidth: 1.5,
              borderColor: isSelected ? cfg.color : '#e8e8e8',
              backgroundColor: isSelected ? cfg.color + '18' : '#fff',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Feather name={cfg.icon} size={18} color={isSelected ? cfg.color : '#aaa'} />
            <Text style={{ fontSize: 12, fontWeight: '600', color: isSelected ? cfg.color : '#555' }}>
              {cfg.label}
            </Text>
            {isAI && (
              <View style={{ backgroundColor: PRIMARY, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 }}>
                <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>KI-Vorschlag</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function ExpenseFormFields({
  form,
  onChange,
  trips,
}: {
  form: FormState;
  onChange: (patch: Partial<FormState>) => void;
  trips: { id: string; date: string; startAddr: string; endAddr: string; km: number }[];
}) {
  const inputStyle = {
    borderWidth: 1,
    borderColor: '#e8e8e8',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1a1a1a',
    backgroundColor: '#fff',
    marginBottom: 10,
  } as const;

  const labelStyle = { fontSize: 11, fontWeight: '700' as const, color: '#888', letterSpacing: 0.5, marginBottom: 5 };

  const [showTripPicker, setShowTripPicker] = useState(false);
  const linkedTrip = trips.find((t) => t.id === form.linkedTripId);

  return (
    <View>
      <Text style={labelStyle}>BESCHREIBUNG *</Text>
      <TextInput
        style={inputStyle}
        value={form.description}
        onChangeText={(v) => onChange({ description: v })}
        placeholder="z.B. Tanken Shell Autobahn"
        placeholderTextColor="#bbb"
        maxLength={80}
        blurOnSubmit={false}
        returnKeyType="next"
      />

      <Text style={labelStyle}>BETRAG (CHF) *</Text>
      <TextInput
        style={inputStyle}
        value={form.amount}
        onChangeText={(v) => onChange({ amount: v })}
        placeholder="0.00"
        placeholderTextColor="#bbb"
        keyboardType="decimal-pad"
        blurOnSubmit={false}
        returnKeyType="next"
      />

      <Text style={labelStyle}>DATUM</Text>
      <TextInput
        style={inputStyle}
        value={form.date}
        onChangeText={(v) => onChange({ date: v })}
        placeholder="JJJJ-MM-TT"
        placeholderTextColor="#bbb"
        maxLength={10}
        blurOnSubmit={false}
        returnKeyType="next"
      />

      <Text style={labelStyle}>FAHRT VERKNÜPFEN (OPTIONAL)</Text>
      <TouchableOpacity
        onPress={() => setShowTripPicker(true)}
        style={{ ...inputStyle, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Text style={{ color: linkedTrip ? '#1a1a1a' : '#bbb', fontSize: 14, flex: 1 }} numberOfLines={1}>
          {linkedTrip
            ? `${fmtDate(linkedTrip.date)} · ${linkedTrip.km.toFixed(1)} km`
            : 'Keine Fahrt verknüpft'}
        </Text>
        <Feather name={form.linkedTripId ? 'x-circle' : 'chevron-down'} size={14} color="#aaa"
          onPress={form.linkedTripId ? (e) => { e.stopPropagation?.(); onChange({ linkedTripId: '' }); } : undefined}
        />
      </TouchableOpacity>

      <Text style={labelStyle}>NOTIZ (OPTIONAL)</Text>
      <TextInput
        style={{ ...inputStyle, minHeight: 60, textAlignVertical: 'top' }}
        value={form.note}
        onChangeText={(v) => onChange({ note: v })}
        placeholder="Weitere Angaben..."
        placeholderTextColor="#bbb"
        multiline
        maxLength={200}
        scrollEnabled={false}
      />

      {/* Trip Picker Modal */}
      <Modal visible={showTripPicker} transparent animationType="slide" onRequestClose={() => setShowTripPicker(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '60%', padding: 20 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 14, color: '#1a1a1a' }}>Fahrt auswählen</Text>
            <FlatList
              data={trips.slice(0, 50)}
              keyExtractor={(t) => t.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => { onChange({ linkedTripId: item.id }); setShowTripPicker(false); }}
                  style={{ paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#1a1a1a' }}>
                    {fmtDate(item.date)} · {item.km.toFixed(1)} km
                  </Text>
                  <Text style={{ fontSize: 12, color: '#888', marginTop: 2 }} numberOfLines={1}>
                    {item.startAddr} → {item.endAddr}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={{ color: '#888', textAlign: 'center', paddingVertical: 20 }}>Keine Fahrten vorhanden</Text>
              }
            />
            <TouchableOpacity
              onPress={() => setShowTripPicker(false)}
              style={{ marginTop: 14, padding: 14, backgroundColor: '#f2f2f7', borderRadius: 10, alignItems: 'center' }}
            >
              <Text style={{ fontWeight: '700', color: '#555' }}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function ExpensesScreen() {
  const insets = useSafeAreaInsets();
  const { trips } = useApp();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [period, setPeriod] = useState<Period>('1 Mon.');
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);

  // Scan flow state
  const [scanStep, setScanStep] = useState(0);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [scanForm, setScanForm] = useState<FormState>(emptyForm());
  const [addForm, setAddForm] = useState<FormState>(emptyForm());

  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editForm, setEditForm] = useState<FormState>(emptyForm());

  const scrollRef = useRef<ScrollView>(null);

  const loadAllExpenses = useCallback(async () => {
    const data = await loadExpenses();
    setExpenses(data);
  }, []);

  useEffect(() => {
    loadAllExpenses();
  }, [loadAllExpenses]);

  // BUG 2: Load total km from trips in same period
  const [totalKm, setTotalKm] = useState(0);
  useEffect(() => {
    async function loadTripKm() {
      try {
        const raw = await AsyncStorage.getItem('trips');
        if (!raw) { setTotalKm(0); return; }
        const allTrips: unknown = JSON.parse(raw);
        if (!Array.isArray(allTrips)) { setTotalKm(0); return; }
        const now = new Date();
        let from: Date;
        if (period === '1 Mon.') from = new Date(now.getFullYear(), now.getMonth(), 1);
        else if (period === '3 Mon.') from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        else if (period === '6 Mon.') from = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        else from = new Date(now.getFullYear(), 0, 1);
        const km = (allTrips as Record<string, unknown>[]).reduce((sum, t) => {
          const d = new Date((t.startTime as number | undefined)
            ? new Date(t.startTime as number).toISOString()
            : ((t.date as string | undefined) ?? (t.createdAt as string | undefined) ?? ''));
          if (d >= from && d <= now) {
            return sum + (Number(t.km) || Number(t.distance) || 0);
          }
          return sum;
        }, 0);
        setTotalKm(km);
      } catch {
        setTotalKm(0);
      }
    }
    loadTripKm();
  }, [period]);

  // Run AI analysis when entering step 1
  useEffect(() => {
    if (scanStep !== 1 || !imageUri) return;
    setAnalysisLoading(true);
    analyzeReceipt(imageUri)
      .then((result) => {
        setAnalysisResult(result);
        setScanForm({
          category: result.category,
          amount: result.amount > 0 ? result.amount.toFixed(2) : '',
          description: result.description,
          date: result.date,
          linkedTripId: '',
          note: '',
        });
        setScanStep(2);
      })
      .catch(() => {
        Alert.alert('Analyse fehlgeschlagen', 'Bitte Daten manuell eingeben.');
        setScanStep(2);
      })
      .finally(() => setAnalysisLoading(false));
  }, [scanStep, imageUri]);

  // ── Derived stats (BUG 1: all as useMemo) ────────────────────────────────────

  const filteredExpenses = useMemo(() => {
    const now = new Date();
    let from: Date;
    if (period === '1 Mon.') from = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (period === '3 Mon.') from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    else if (period === '6 Mon.') from = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    else from = new Date(now.getFullYear(), 0, 1);
    return expenses.filter((e) => {
      const d = new Date(e.date);
      return d >= from && d <= now;
    });
  }, [expenses, period]);

  const filteredSorted = useMemo(
    () => [...filteredExpenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [filteredExpenses]
  );

  const totalAmount = useMemo(
    () => filteredExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0),
    [filteredExpenses]
  );

  const kraftstoffTotal = useMemo(
    () => filteredExpenses.filter((e) => e.category === 'kraftstoff').reduce((s, e) => s + (Number(e.amount) || 0), 0),
    [filteredExpenses]
  );
  const wartungTotal = useMemo(
    () => filteredExpenses.filter((e) => e.category === 'wartung').reduce((s, e) => s + (Number(e.amount) || 0), 0),
    [filteredExpenses]
  );
  const parkTotal = useMemo(
    () => filteredExpenses.filter((e) => e.category === 'parkgebuehr').reduce((s, e) => s + (Number(e.amount) || 0), 0),
    [filteredExpenses]
  );
  const sonstigesTotal = useMemo(
    () => filteredExpenses.filter((e) => e.category === 'sonstiges').reduce((s, e) => s + (Number(e.amount) || 0), 0),
    [filteredExpenses]
  );

  // BUG 2: kostenProKm — null when no km data
  const kostenProKm = useMemo<number | null>(() => {
    if (totalKm <= 0 || totalAmount <= 0) return null;
    return totalAmount / totalKm;
  }, [totalAmount, totalKm]);

  // BUG 5: category data — only categories with amount > 0
  const categoryData = useMemo(() => {
    return [
      { key: 'kraftstoff' as ExpenseCategory, label: 'Kraftstoff', amount: kraftstoffTotal, color: '#e67e22', icon: 'droplet' as const },
      { key: 'wartung' as ExpenseCategory, label: 'Wartung', amount: wartungTotal, color: '#27ae60', icon: 'tool' as const },
      { key: 'parkgebuehr' as ExpenseCategory, label: 'Parkgebühr', amount: parkTotal, color: PRIMARY, icon: 'map-pin' as const },
      { key: 'sonstiges' as ExpenseCategory, label: 'Sonstiges', amount: sonstigesTotal, color: '#8e44ad', icon: 'tag' as const },
    ].filter((c) => c.amount > 0);
  }, [kraftstoffTotal, wartungTotal, parkTotal, sonstigesTotal]);

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const handlePickImage = async (mode: 'library' | 'camera' | 'document') => {
    try {
      if (mode === 'document') {
        const result = await DocumentPicker.getDocumentAsync({
          type: ['image/*', 'application/pdf'],
          copyToCacheDirectory: true,
        });
        if (!result.canceled && result.assets[0]) {
          setImageUri(result.assets[0].uri);
          setScanStep(1);
        }
        return;
      }

      const pick = mode === 'camera'
        ? ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true })
        : ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });

      const result = await pick;
      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
        setScanStep(1);
      }
    } catch (err) {
      Alert.alert('Fehler', 'Bild konnte nicht geladen werden.');
    }
  };

  const handleSaveScan = async () => {
    const amountNum = parseFloat(scanForm.amount.replace(',', '.'));
    if (!scanForm.description.trim() || !(amountNum > 0)) {
      Alert.alert('Pflichtfelder', 'Bitte Beschreibung und Betrag (> 0) angeben.');
      return;
    }
    Keyboard.dismiss();
    const expense: Expense = {
      id: Date.now().toString(),
      category: scanForm.category,
      amount: Math.round(amountNum * 100) / 100,
      description: scanForm.description.trim(),
      date: scanForm.date,
      receiptUri: imageUri ?? undefined,
      linkedTripId: scanForm.linkedTripId || undefined,
      note: scanForm.note.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    await saveExpense(expense);
    await loadAllExpenses();
    setScanStep(3);
  };

  const handleSaveAdd = async () => {
    const amountNum = parseFloat(addForm.amount.replace(',', '.'));
    if (!addForm.description.trim() || !(amountNum > 0)) {
      Alert.alert('Pflichtfelder', 'Bitte Beschreibung und Betrag (> 0) angeben.');
      return;
    }
    Keyboard.dismiss();
    const expense: Expense = {
      id: Date.now().toString(),
      category: addForm.category,
      amount: Math.round(amountNum * 100) / 100,
      description: addForm.description.trim(),
      date: addForm.date,
      linkedTripId: addForm.linkedTripId || undefined,
      note: addForm.note.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    await saveExpense(expense);
    await loadAllExpenses();
    setAddModalVisible(false);
    setAddForm(emptyForm());
  };

  const handleDelete = async (id: string) => {
    Alert.alert('Eintrag löschen', 'Diesen Kosteneintrag wirklich löschen?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          await deleteExpense(id);
          await loadAllExpenses();
        },
      },
    ]);
  };

  const openEditModal = (expense: Expense) => {
    setEditingExpense(expense);
    setEditForm({
      category: expense.category,
      amount: expense.amount.toFixed(2),
      description: expense.description,
      date: expense.date,
      linkedTripId: expense.linkedTripId ?? '',
      note: expense.note ?? '',
    });
    setEditModalVisible(true);
  };

  const closeEditModal = () => {
    Keyboard.dismiss();
    setTimeout(() => {
      setEditModalVisible(false);
      setEditingExpense(null);
      setEditForm(emptyForm());
    }, 100);
  };

  const handleSaveEdit = async () => {
    if (!editingExpense) return;
    const amountNum = parseFloat(editForm.amount.replace(',', '.'));
    if (!editForm.description.trim() || !(amountNum > 0)) {
      Alert.alert('Pflichtfelder', 'Bitte Beschreibung und Betrag (> 0) angeben.');
      return;
    }
    Keyboard.dismiss();
    const updated: Expense = {
      ...editingExpense,
      category: editForm.category,
      amount: Math.round(amountNum * 100) / 100,
      description: editForm.description.trim(),
      date: editForm.date,
      linkedTripId: editForm.linkedTripId || undefined,
      note: editForm.note.trim() || undefined,
    };
    await updateExpense(updated);
    await loadAllExpenses();
    closeEditModal();
  };

  const handleDeleteFromEdit = () => {
    if (!editingExpense) return;
    Alert.alert('Eintrag löschen', 'Diesen Kosteneintrag wirklich löschen?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          await deleteExpense(editingExpense.id);
          await loadAllExpenses();
          closeEditModal();
        },
      },
    ]);
  };

  const resetScanModal = () => {
    setScanStep(0);
    setImageUri(null);
    setAnalysisResult(null);
    setScanForm(emptyForm());
    setAnalysisLoading(false);
  };

  const closeScanModal = () => {
    setScanModalVisible(false);
    resetScanModal();
  };

  // ── Render helpers ────────────────────────────────────────────────────────────

  const renderExpenseItem = ({ item }: { item: Expense }) => {
    const cfg = CATEGORY_CONFIG[item.category];
    const renderRightActions = () => (
      <TouchableOpacity
        onPress={() => handleDelete(item.id)}
        style={{
          backgroundColor: '#c0392b',
          justifyContent: 'center',
          alignItems: 'center',
          width: 70,
          borderRadius: 12,
          marginBottom: 8,
          marginLeft: 4,
        }}
      >
        <Feather name="trash-2" size={18} color="#fff" />
        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', marginTop: 3 }}>Löschen</Text>
      </TouchableOpacity>
    );

    return (
      <Swipeable renderRightActions={renderRightActions} overshootRight={false}>
        <TouchableOpacity
          onPress={() => openEditModal(item)}
          activeOpacity={0.7}
        >
          <View
            style={{
              ...CARD_STYLE,
              flexDirection: 'row',
              alignItems: 'center',
              padding: 12,
              marginBottom: 8,
              gap: 12,
            }}
          >
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                backgroundColor: cfg.color + '18',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Feather name={cfg.icon} size={16} color={cfg.color} />
            </View>
            <View style={{ flex: 1, flexShrink: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '500', color: '#000', flex: 1, flexShrink: 1 }} numberOfLines={2}>
                {item.description}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                <Text style={{ fontSize: 11, color: '#888' }}>{fmtDate(item.date)}</Text>
                {item.receiptUri && (
                  <View style={{ backgroundColor: PRIMARY + '18', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 9, color: PRIMARY, fontWeight: '700' }}>Gescannt</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#c0392b' }}>
                −CHF {item.amount.toFixed(2)}
              </Text>
              <Feather name="chevron-right" size={12} color="#ccc" />
            </View>
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  // ── Screen header content (rendered inside FlatList ListHeaderComponent) ──────

  const ListHeader = () => (
    <View>
      {/* Period filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 16, gap: 8, flexDirection: 'row' }}
      >
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p}
            onPress={() => setPeriod(p)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: 20,
              backgroundColor: period === p ? PRIMARY : '#fff',
              borderWidth: 0.5,
              borderColor: period === p ? PRIMARY : '#ccc',
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: period === p ? '#fff' : '#666' }}>
              {p}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Stats 2×2 grid */}
      <View style={{ paddingHorizontal: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'Gesamt', value: `CHF ${totalAmount.toFixed(2)}`, icon: 'bar-chart-2' as const, color: PRIMARY },
          {
            label: 'Kosten/km',
            value: kostenProKm !== null ? `CHF ${kostenProKm.toFixed(2)}/km` : '— CHF/km',
            icon: 'navigation' as const,
            color: '#27ae60',
          },
          { label: 'Kraftstoff', value: `CHF ${kraftstoffTotal.toFixed(2)}`, icon: 'droplet' as const, color: '#e67e22' },
          { label: 'Wartung', value: `CHF ${wartungTotal.toFixed(2)}`, icon: 'tool' as const, color: '#27ae60' },
        ].map((stat) => (
          <View
            key={stat.label}
            style={{ ...CARD_STYLE, flex: 1, minWidth: '45%', padding: 14 }}
          >
            <Feather name={stat.icon} size={14} color={stat.color} />
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#1a1a1a', marginTop: 6 }}>
              {stat.value}
            </Text>
            <Text style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Category distribution (BUG 5: only categories with amount > 0) */}
      {categoryData.length > 0 && (
        <View style={{ ...CARD_STYLE, marginHorizontal: 14, padding: 14, marginBottom: 14 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#888', letterSpacing: 0.5, marginBottom: 12 }}>
            KOSTENVERTEILUNG
          </Text>
          {categoryData.map((cat) => {
            const barPct = totalAmount > 0
              ? Math.round((cat.amount / totalAmount) * 100)
              : 0;
            return (
              <View key={cat.key} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                    <Feather name={cat.icon} size={13} color={cat.color} />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#555' }}>{cat.label}</Text>
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#1a1a1a' }}>
                    CHF {cat.amount.toFixed(2)}
                  </Text>
                </View>
                <View style={{ height: 6, backgroundColor: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
                  <View style={{ height: 6, width: `${barPct}%` as `${number}%`, backgroundColor: cat.color, borderRadius: 3 }} />
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Scan banner */}
      <TouchableOpacity
        onPress={() => { resetScanModal(); setScanModalVisible(true); }}
        style={{
          backgroundColor: PRIMARY,
          borderRadius: 12,
          marginHorizontal: 14,
          marginBottom: 14,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
        }}
        activeOpacity={0.85}
      >
        <View style={{ width: 42, height: 42, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
          <Feather name="camera" size={20} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Beleg scannen</Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 }}>
            KI erkennt Betrag & Kategorie automatisch
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.6)" />
      </TouchableOpacity>

      {/* List section label */}
      {filteredSorted.length > 0 && (
        <Text style={{ fontSize: 11, fontWeight: '700', color: '#888', letterSpacing: 0.5, marginHorizontal: 14, marginBottom: 8 }}>
          EINTRÄGE ({filteredSorted.length})
        </Text>
      )}
    </View>
  );

  // ── Scan Modal ────────────────────────────────────────────────────────────────

  const ScanModal = () => (
    <Modal visible={scanModalVisible} transparent animationType="slide" onRequestClose={closeScanModal}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: '#f2f2f7',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: '93%',
              paddingTop: 12,
            }}
          >
            {/* Handle */}
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#ccc', alignSelf: 'center', marginBottom: 16 }} />

            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 16 }}>
              <Text style={{ flex: 1, fontSize: 17, fontWeight: '800', color: '#1a1a1a' }}>Beleg scannen</Text>
              <TouchableOpacity onPress={() => { Keyboard.dismiss(); setTimeout(closeScanModal, 100); }}>
                <Feather name="x" size={20} color="#888" />
              </TouchableOpacity>
            </View>

            <StepIndicator step={scanStep} />

            <ScrollView
              ref={scrollRef}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Step 0 — Image source */}
              {scanStep === 0 && (
                <View style={{ gap: 12 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 4, textAlign: 'center' }}>
                    Beleg aufnehmen
                  </Text>
                  {[
                    { mode: 'library' as const, icon: 'image' as const, label: 'Mediathek', sub: 'Bild aus Fotos wählen' },
                    { mode: 'camera' as const, icon: 'camera' as const, label: 'Kamera', sub: 'Beleg fotografieren' },
                    { mode: 'document' as const, icon: 'file-text' as const, label: 'Dokument scannen', sub: 'PDF oder Bilddatei' },
                  ].map((opt) => (
                    <TouchableOpacity
                      key={opt.mode}
                      onPress={() => handlePickImage(opt.mode)}
                      style={{
                        ...CARD_STYLE,
                        flexDirection: 'row',
                        alignItems: 'center',
                        padding: 16,
                        gap: 14,
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: PRIMARY + '18', alignItems: 'center', justifyContent: 'center' }}>
                        <Feather name={opt.icon} size={20} color={PRIMARY} />
                      </View>
                      <View>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a1a' }}>{opt.label}</Text>
                        <Text style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{opt.sub}</Text>
                      </View>
                      <Feather name="chevron-right" size={16} color="#ccc" style={{ marginLeft: 'auto' }} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Step 1 — AI Analysis */}
              {scanStep === 1 && (
                <View style={{ alignItems: 'center', gap: 16 }}>
                  {imageUri && (
                    <Image
                      source={{ uri: imageUri }}
                      style={{ width: '100%', height: 200, borderRadius: 12, resizeMode: 'cover' }}
                    />
                  )}
                  <ActivityIndicator size="large" color={PRIMARY} />
                  <Text style={{ fontSize: 14, color: '#555', textAlign: 'center' }}>
                    KI analysiert Beleg...
                  </Text>
                </View>
              )}

              {/* Step 2 — Review & Edit */}
              {scanStep === 2 && (
                <View>
                  {imageUri && (
                    <Image
                      source={{ uri: imageUri }}
                      style={{ width: '100%', height: 120, borderRadius: 12, resizeMode: 'cover', marginBottom: 14 }}
                    />
                  )}
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#888', letterSpacing: 0.5, marginBottom: 10 }}>
                    KATEGORIE
                  </Text>
                  <CategoryGrid
                    selected={scanForm.category}
                    aiSuggestion={analysisResult?.category}
                    onSelect={(c) => setScanForm((f) => ({ ...f, category: c }))}
                  />
                  <ExpenseFormFields
                    form={scanForm}
                    onChange={(patch) => setScanForm((f) => ({ ...f, ...patch }))}
                    trips={trips}
                  />
                  <TouchableOpacity
                    onPress={handleSaveScan}
                    style={{ backgroundColor: PRIMARY, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 4 }}
                  >
                    <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Speichern</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Step 3 — Confirmation */}
              {scanStep === 3 && (
                <View style={{ alignItems: 'center', gap: 16 }}>
                  <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: '#eafaf1', alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name="check" size={30} color="#1a6b3a" />
                  </View>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: '#1a1a1a' }}>Beleg gespeichert</Text>
                  <View style={{ ...CARD_STYLE, alignSelf: 'stretch', padding: 14, gap: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: '#888', fontSize: 13 }}>Beschreibung</Text>
                      <Text style={{ color: '#1a1a1a', fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
                        {scanForm.description}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: '#888', fontSize: 13 }}>Betrag</Text>
                      <Text style={{ color: '#c0392b', fontSize: 13, fontWeight: '700' }}>
                        CHF {parseFloat(scanForm.amount || '0').toFixed(2)}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: '#888', fontSize: 13 }}>Kategorie</Text>
                      <Text style={{ color: '#1a1a1a', fontSize: 13, fontWeight: '600' }}>
                        {CATEGORY_CONFIG[scanForm.category].label}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => resetScanModal()}
                    style={{ backgroundColor: PRIMARY, borderRadius: 12, padding: 14, alignSelf: 'stretch', alignItems: 'center' }}
                  >
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Weiteren Beleg scannen</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={closeScanModal}
                    style={{ backgroundColor: '#f2f2f7', borderRadius: 12, padding: 14, alignSelf: 'stretch', alignItems: 'center', borderWidth: 1, borderColor: '#e8e8e8' }}
                  >
                    <Text style={{ color: '#555', fontSize: 14, fontWeight: '600' }}>Schliessen</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  // ── Add Modal ─────────────────────────────────────────────────────────────────

  const AddModal = () => (
    <Modal visible={addModalVisible} transparent animationType="slide" onRequestClose={() => { setAddModalVisible(false); setAddForm(emptyForm()); }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#f2f2f7', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '93%', paddingTop: 12 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#ccc', alignSelf: 'center', marginBottom: 16 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 16 }}>
              <Text style={{ flex: 1, fontSize: 17, fontWeight: '800', color: '#1a1a1a' }}>Kosten manuell hinzufügen</Text>
              <TouchableOpacity onPress={() => { Keyboard.dismiss(); setTimeout(() => { setAddModalVisible(false); setAddForm(emptyForm()); }, 100); }}>
                <Feather name="x" size={20} color="#888" />
              </TouchableOpacity>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
              showsVerticalScrollIndicator={false}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#888', letterSpacing: 0.5, marginBottom: 10 }}>
                KATEGORIE
              </Text>
              <CategoryGrid
                selected={addForm.category}
                onSelect={(c) => setAddForm((f) => ({ ...f, category: c }))}
              />
              <ExpenseFormFields
                form={addForm}
                onChange={(patch) => setAddForm((f) => ({ ...f, ...patch }))}
                trips={trips}
              />
              <TouchableOpacity
                onPress={handleSaveAdd}
                style={{ backgroundColor: PRIMARY, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 4 }}
              >
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Speichern</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  // ── Edit Modal ────────────────────────────────────────────────────────────────

  const EditModal = () => (
    <Modal visible={editModalVisible} transparent animationType="slide" onRequestClose={closeEditModal}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#f2f2f7', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '93%', paddingTop: 12 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#ccc', alignSelf: 'center', marginBottom: 16 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 16 }}>
              <Text style={{ flex: 1, fontSize: 17, fontWeight: '800', color: '#1a1a1a' }}>Eintrag bearbeiten</Text>
              <TouchableOpacity onPress={closeEditModal}>
                <Feather name="x" size={20} color="#888" />
              </TouchableOpacity>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
              showsVerticalScrollIndicator={false}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#888', letterSpacing: 0.5, marginBottom: 10 }}>
                KATEGORIE
              </Text>
              <CategoryGrid
                selected={editForm.category}
                onSelect={(c) => setEditForm((f) => ({ ...f, category: c }))}
              />
              <ExpenseFormFields
                form={editForm}
                onChange={(patch) => setEditForm((f) => ({ ...f, ...patch }))}
                trips={trips}
              />
              <TouchableOpacity
                onPress={handleSaveEdit}
                style={{ backgroundColor: PRIMARY, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 4 }}
              >
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Speichern</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDeleteFromEdit}
                style={{ backgroundColor: '#fff', borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 10, borderWidth: 1.5, borderColor: '#c0392b' }}
              >
                <Text style={{ color: '#c0392b', fontSize: 15, fontWeight: '700' }}>Eintrag löschen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={closeEditModal}
                style={{ backgroundColor: '#f2f2f7', borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 8, borderWidth: 1, borderColor: '#e8e8e8' }}
              >
                <Text style={{ color: '#555', fontSize: 14, fontWeight: '600' }}>Abbrechen</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  // ── Main render ───────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingBottom: 14,
          paddingHorizontal: 14,
          backgroundColor: '#fff',
          borderBottomWidth: 0.5,
          borderBottomColor: '#e8e8e8',
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <Text style={{ flex: 1, fontSize: 20, fontWeight: '800', color: '#1a1a1a' }}>Fahrzeugkosten</Text>
        <TouchableOpacity
          onPress={() => { setAddForm(emptyForm()); setAddModalVisible(true); }}
          style={{ backgroundColor: PRIMARY, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <Feather name="plus" size={15} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Hinzufügen</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredSorted}
        keyExtractor={(item) => item.id}
        renderItem={renderExpenseItem}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Feather name="inbox" size={36} color="#ccc" />
            <Text style={{ color: '#aaa', fontSize: 14, marginTop: 12 }}>Noch keine Einträge</Text>
            <Text style={{ color: '#bbb', fontSize: 12, marginTop: 4 }}>Füge deinen ersten Kosteneintrag hinzu</Text>
          </View>
        }
      />

      <ScanModal />
      <AddModal />
      <EditModal />
    </View>
  );
}
