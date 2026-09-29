import {
  PoultryItem,
  EggRecord,
  BroodingRecord,
  HatchRecord,
  ExpenseRecord,
  ExpenseCategory,
  SaleRecord,
} from '../types';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';
import { calculateExpectedHatchDate, getBroodingStatusAndCountdown } from '../utils/calculations';

// In-memory / localStorage cache fallback for pre-database setup testing
const STORAGE_PREFIX = 'kgp_db_';

function getLocalData<T>(table: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + table);
    if (!raw) return defaultValue;
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

function setLocalData<T>(table: string, value: T): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + table, JSON.stringify(value));
  } catch (err) {
    console.error(`Failed to cache ${table}`, err);
  }
}

// Initial realistic default data for Kingdom Group Poultry Management
const defaultPoultry: PoultryItem[] = [
  {
    id: 'p-uuid-1',
    poultry_id: 'KGP-H101',
    type: 'Hen',
    breed: 'Improved Kienyeji',
    sex: 'Female',
    quantity: 25,
    date_acquired: '2026-06-10',
    age_weeks: 32,
    source: 'Hatched on farm',
    purchase_price: 15000,
    estimated_unit_value: 22000,
    current_status: 'Laying',
    notes: 'High laying performance flock, vaccination up to date.',
  },
  {
    id: 'p-uuid-2',
    poultry_id: 'KGP-R102',
    type: 'Rooster',
    breed: 'Kienyeji',
    sex: 'Male',
    quantity: 4,
    date_acquired: '2026-06-10',
    age_weeks: 34,
    source: 'Purchased',
    purchase_price: 25000,
    estimated_unit_value: 30000,
    current_status: 'Breeding',
    notes: 'Alpha breeding roosters for natural mating.',
  },
  {
    id: 'p-uuid-3',
    poultry_id: 'KGP-D103',
    type: 'Duck',
    breed: 'Improved Duck',
    sex: 'Female',
    quantity: 12,
    date_acquired: '2026-05-15',
    age_weeks: 40,
    source: 'Hatched on farm',
    purchase_price: 18000,
    estimated_unit_value: 28000,
    current_status: 'Laying',
    notes: 'Healthy laying ducks in pond run.',
  },
  {
    id: 'p-uuid-4',
    poultry_id: 'KGP-DK104',
    type: 'Drake',
    breed: 'Improved Duck',
    sex: 'Male',
    quantity: 3,
    date_acquired: '2026-05-15',
    age_weeks: 40,
    source: 'Purchased',
    purchase_price: 26000,
    estimated_unit_value: 32000,
    current_status: 'Active',
    notes: 'Breeding drakes.',
  },
  {
    id: 'p-uuid-5',
    poultry_id: 'KGP-C105',
    type: 'Chick',
    breed: 'Chotara',
    sex: 'Unknown',
    quantity: 45,
    date_acquired: '2026-09-05',
    age_weeks: 3,
    source: 'Hatched on farm',
    purchase_price: 0,
    estimated_unit_value: 6500,
    current_status: 'Growing',
    notes: 'Brooder unit 2, on starter feed.',
  },
];

const defaultEggs: EggRecord[] = [
  {
    id: 'egg-uuid-1',
    hen_id: 'KGP-H101',
    date: '2026-09-25',
    total_eggs: 22,
    good_eggs: 20,
    damaged_eggs: 2,
    eggs_brooding: 6,
    eggs_sold: 10,
    eggs_consumed: 2,
    eggs_remaining: 2,
    notes: 'Morning collection from pen A',
  },
  {
    id: 'egg-uuid-2',
    hen_id: 'KGP-D103',
    date: '2026-09-26',
    total_eggs: 10,
    good_eggs: 9,
    damaged_eggs: 1,
    eggs_brooding: 5,
    eggs_sold: 3,
    eggs_consumed: 0,
    eggs_remaining: 1,
    notes: 'Duck egg collection',
  },
];

// Hen started 18 days ago (due in 3 days) -> 21 days total
// Duck started 10 days ago (due in 30 days) -> 40 days total
const todayIso = new Date().toISOString().split('T')[0];

function getDateOffset(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split('T')[0];
}

const defaultBrooding: BroodingRecord[] = [
  {
    id: 'brd-uuid-1',
    brooding_code: 'BRD-2026-001',
    parent_poultry_id: 'KGP-H101',
    poultry_type: 'Hen',
    breed: 'Improved Kienyeji',
    eggs_placed: 15,
    start_date: getDateOffset(-18),
    expected_hatch_date: getDateOffset(-18 + 21), // Start + 21 days
    status: 'Due Soon',
    notes: 'Nest box 1, very attentive broody hen.',
  },
  {
    id: 'brd-uuid-2',
    brooding_code: 'BRD-2026-002',
    parent_poultry_id: 'KGP-D103',
    poultry_type: 'Duck',
    breed: 'Improved Duck',
    eggs_placed: 20,
    start_date: getDateOffset(-12),
    expected_hatch_date: getDateOffset(-12 + 40), // Start + 40 days
    status: 'Active',
    notes: 'Incubator chamber B, 37.5 C, 70% humidity.',
  },
];

const defaultHatch: HatchRecord[] = [
  {
    id: 'hatch-uuid-1',
    brooding_id: 'brd-uuid-0',
    brooding_code: 'BRD-2026-PREV',
    poultry_type: 'Hen',
    breed: 'Chotara',
    date: getDateOffset(-22),
    eggs_placed: 50,
    eggs_hatched: 45,
    eggs_failed: 5,
    chicks_produced: 45,
    hatch_rate: 90.0,
    mortality_count: 0,
    added_to_inventory: true,
    inventory_poultry_id: 'KGP-C105',
    notes: 'High hatch rate batch. Moved into starter brooding pen.',
  },
];

const defaultExpenses: ExpenseRecord[] = [
  {
    id: 'exp-uuid-1',
    expense_code: 'EXP-2026-001',
    date: getDateOffset(-5),
    category: 'Feed',
    description: 'Grower Pellets 50kg bag (2 bags)',
    quantity: 2,
    unit_cost: 65000,
    total_cost: 130000,
    payment_method: 'M-Pesa',
    supplier: 'Kilimo Bora Feeds Ltd',
    notes: 'High protein quality for laying flock',
  },
  {
    id: 'exp-uuid-2',
    expense_code: 'EXP-2026-002',
    date: getDateOffset(-10),
    category: 'Vaccines',
    description: 'Newcastle Disease + Gumboro combo vaccine vials',
    quantity: 2,
    unit_cost: 18000,
    total_cost: 36000,
    payment_method: 'Cash',
    supplier: 'Arusha Vet Agro-vet',
    notes: 'Administered in drinking water',
  },
  {
    id: 'exp-uuid-3',
    expense_code: 'EXP-2026-003',
    date: getDateOffset(-2),
    category: 'Electricity',
    description: 'LUKU Power recharge for brooder heat lamps',
    quantity: 1,
    unit_cost: 40000,
    total_cost: 40000,
    payment_method: 'Airtel Money',
    supplier: 'TANESCO',
    notes: 'Tokens loaded successfully',
  },
];

const defaultCategories: ExpenseCategory[] = [
  { id: 'cat-1', name: 'Feed', is_default: true },
  { id: 'cat-2', name: 'Vaccines', is_default: true },
  { id: 'cat-3', name: 'Medication', is_default: true },
  { id: 'cat-4', name: 'Poultry purchase', is_default: true },
  { id: 'cat-5', name: 'Equipment', is_default: true },
  { id: 'cat-6', name: 'Housing', is_default: true },
  { id: 'cat-7', name: 'Water', is_default: true },
  { id: 'cat-8', name: 'Electricity', is_default: true },
  { id: 'cat-9', name: 'Transport', is_default: true },
  { id: 'cat-10', name: 'Labour', is_default: true },
  { id: 'cat-11', name: 'Packaging', is_default: true },
  { id: 'cat-12', name: 'Repairs', is_default: true },
  { id: 'cat-13', name: 'Marketing', is_default: true },
  { id: 'cat-14', name: 'Other', is_default: true },
];

const defaultSales: SaleRecord[] = [
  {
    id: 'sal-uuid-1',
    sale_code: 'SAL-2026-001',
    date: getDateOffset(-3),
    product: 'Eggs',
    category: 'Table Eggs',
    quantity: 5, // 5 trays
    unit_price: 10000,
    total_amount: 50000,
    customer: 'Mama Neema Groceries',
    payment_method: 'M-Pesa',
    notes: 'Regular weekly delivery of fresh farm eggs',
  },
  {
    id: 'sal-uuid-2',
    sale_code: 'SAL-2026-002',
    date: getDateOffset(-7),
    product: 'Live chicken',
    category: 'Mature Kienyeji',
    quantity: 4,
    unit_price: 25000,
    total_amount: 100000,
    customer: 'Kilimanjaro Hotel Restaurant',
    payment_method: 'Cash',
    notes: 'Premium dressed live birds',
  },
  {
    id: 'sal-uuid-3',
    sale_code: 'SAL-2026-003',
    date: getDateOffset(-1),
    product: 'Ducks',
    category: 'Live Duck',
    quantity: 2,
    unit_price: 30000,
    total_amount: 60000,
    customer: 'Mr. Joseph Mushi',
    payment_method: 'Tigo Pesa',
    notes: 'Breeding pair for customer farm',
  },
];

export const db = {
  // POULTRY
  async getPoultry(): Promise<PoultryItem[]> {
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        const { data, error } = await client
          .from('poultry')
          .select('*')
          .order('created_at', { ascending: false });
        if (!error && data && data.length > 0) {
          setLocalData('poultry', data);
          return data;
        }
      } catch (err) {
        console.warn('Supabase fetch poultry error, fallback to cache:', err);
      }
    }
    return getLocalData('poultry', defaultPoultry);
  },

  async addPoultry(item: Omit<PoultryItem, 'id' | 'created_at' | 'updated_at'>): Promise<PoultryItem> {
    const newItem: PoultryItem = {
      ...item,
      id: crypto.randomUUID ? crypto.randomUUID() : 'p-' + Date.now(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        const { data, error } = await client.from('poultry').insert([newItem]).select().single();
        if (error) throw new Error(error.message);
        if (data) {
          const list = await db.getPoultry();
          setLocalData('poultry', [data, ...list.filter(x => x.id !== data.id)]);
          return data;
        }
      } catch (err: unknown) {
        console.warn('Supabase add poultry error, saving locally:', err);
      }
    }

    const current = getLocalData('poultry', defaultPoultry);
    const updated = [newItem, ...current];
    setLocalData('poultry', updated);
    return newItem;
  },

  async updatePoultry(id: string, updates: Partial<PoultryItem>): Promise<PoultryItem | null> {
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        const { data, error } = await client
          .from('poultry')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();
        if (error) throw new Error(error.message);
        if (data) {
          const list = await db.getPoultry();
          setLocalData('poultry', list.map(item => item.id === id ? data : item));
          return data;
        }
      } catch (err: unknown) {
        console.warn('Supabase update poultry error:', err);
      }
    }

    const current = getLocalData('poultry', defaultPoultry);
    let updatedItem: PoultryItem | null = null;
    const updated = current.map(item => {
      if (item.id === id) {
        updatedItem = { ...item, ...updates, updated_at: new Date().toISOString() };
        return updatedItem;
      }
      return item;
    });
    setLocalData('poultry', updated);
    return updatedItem;
  },

  async deletePoultry(id: string): Promise<boolean> {
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        const { error } = await client.from('poultry').delete().eq('id', id);
        if (error) throw new Error(error.message);
      } catch (err: unknown) {
        console.warn('Supabase delete poultry error:', err);
      }
    }

    const current = getLocalData('poultry', defaultPoultry);
    const updated = current.filter(item => item.id !== id);
    setLocalData('poultry', updated);
    return true;
  },

  // EGG RECORDS
  async getEggs(): Promise<EggRecord[]> {
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        const { data, error } = await client
          .from('egg_records')
          .select('*')
          .order('date', { ascending: false });
        if (!error && data && data.length > 0) {
          setLocalData('egg_records', data);
          return data;
        }
      } catch (err) {
        console.warn('Supabase fetch eggs error:', err);
      }
    }
    return getLocalData('egg_records', defaultEggs);
  },

  async addEggRecord(record: Omit<EggRecord, 'id' | 'created_at'>): Promise<EggRecord> {
    const newRecord: EggRecord = {
      ...record,
      id: crypto.randomUUID ? crypto.randomUUID() : 'egg-' + Date.now(),
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        const { data, error } = await client.from('egg_records').insert([newRecord]).select().single();
        if (error) throw new Error(error.message);
        if (data) {
          const list = await db.getEggs();
          setLocalData('egg_records', [data, ...list.filter(x => x.id !== data.id)]);
          return data;
        }
      } catch (err: unknown) {
        console.warn('Supabase add egg record error:', err);
      }
    }

    const current = getLocalData('egg_records', defaultEggs);
    const updated = [newRecord, ...current];
    setLocalData('egg_records', updated);
    return newRecord;
  },

  async deleteEggRecord(id: string): Promise<boolean> {
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        const { error } = await client.from('egg_records').delete().eq('id', id);
        if (error) throw new Error(error.message);
      } catch (err) {
        console.warn('Supabase delete egg error:', err);
      }
    }
    const current = getLocalData('egg_records', defaultEggs);
    setLocalData('egg_records', current.filter(x => x.id !== id));
    return true;
  },

  // BROODING
  async getBrooding(): Promise<BroodingRecord[]> {
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        const { data, error } = await client
          .from('brooding')
          .select('*')
          .order('start_date', { ascending: false });
        if (!error && data && data.length > 0) {
          // Recalculate dynamic status based on current date
          const enriched = data.map(item => {
            const { status } = getBroodingStatusAndCountdown(
              item.start_date,
              item.expected_hatch_date,
              item.actual_hatch_date,
              item.hatched_count,
              item.status
            );
            return { ...item, status };
          });
          setLocalData('brooding', enriched);
          return enriched;
        }
      } catch (err) {
        console.warn('Supabase fetch brooding error:', err);
      }
    }

    const localList = getLocalData('brooding', defaultBrooding);
    return localList.map(item => {
      const { status } = getBroodingStatusAndCountdown(
        item.start_date,
        item.expected_hatch_date,
        item.actual_hatch_date,
        item.hatched_count,
        item.status
      );
      return { ...item, status };
    });
  },

  async addBrooding(record: Omit<BroodingRecord, 'id' | 'created_at' | 'updated_at'>): Promise<BroodingRecord> {
    // Ensure accurate expected hatch date calculation based on 21 (Hen) or 40 (Duck)
    const expected = record.expected_hatch_date || calculateExpectedHatchDate(record.start_date, record.poultry_type);
    const { status } = getBroodingStatusAndCountdown(record.start_date, expected);

    const newRecord: BroodingRecord = {
      ...record,
      expected_hatch_date: expected,
      status,
      id: crypto.randomUUID ? crypto.randomUUID() : 'brd-' + Date.now(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        const { data, error } = await client.from('brooding').insert([newRecord]).select().single();
        if (error) throw new Error(error.message);
        if (data) {
          const list = await db.getBrooding();
          setLocalData('brooding', [data, ...list.filter(x => x.id !== data.id)]);
          return data;
        }
      } catch (err: unknown) {
        console.warn('Supabase add brooding error:', err);
      }
    }

    const current = getLocalData('brooding', defaultBrooding);
    const updated = [newRecord, ...current];
    setLocalData('brooding', updated);
    return newRecord;
  },

  async updateBrooding(id: string, updates: Partial<BroodingRecord>): Promise<BroodingRecord | null> {
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        const { data, error } = await client
          .from('brooding')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();
        if (error) throw new Error(error.message);
        if (data) {
          const list = await db.getBrooding();
          setLocalData('brooding', list.map(item => item.id === id ? data : item));
          return data;
        }
      } catch (err: unknown) {
        console.warn('Supabase update brooding error:', err);
      }
    }

    const current = getLocalData('brooding', defaultBrooding);
    let updatedItem: BroodingRecord | null = null;
    const updated = current.map(item => {
      if (item.id === id) {
        updatedItem = { ...item, ...updates, updated_at: new Date().toISOString() };
        return updatedItem;
      }
      return item;
    });
    setLocalData('brooding', updated);
    return updatedItem;
  },

  async deleteBrooding(id: string): Promise<boolean> {
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        const { error } = await client.from('brooding').delete().eq('id', id);
        if (error) throw new Error(error.message);
      } catch (err) {
        console.warn('Supabase delete brooding error:', err);
      }
    }
    const current = getLocalData('brooding', defaultBrooding);
    setLocalData('brooding', current.filter(x => x.id !== id));
    return true;
  },

  // HATCHING
  async getHatchRecords(): Promise<HatchRecord[]> {
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        const { data, error } = await client
          .from('hatch_records')
          .select('*')
          .order('date', { ascending: false });
        if (!error && data && data.length > 0) {
          setLocalData('hatch_records', data);
          return data;
        }
      } catch (err) {
        console.warn('Supabase fetch hatch error:', err);
      }
    }
    return getLocalData('hatch_records', defaultHatch);
  },

  async addHatchRecord(
    record: Omit<HatchRecord, 'id' | 'created_at'>,
    addToInventory: boolean = true
  ): Promise<{ hatch: HatchRecord; createdPoultry?: PoultryItem }> {
    let inventoryPoultryId = record.inventory_poultry_id;
    let createdPoultry: PoultryItem | undefined;

    // Automatically add hatched chicks to flock inventory
    if (addToInventory && record.chicks_produced > 0) {
      const birdType = record.poultry_type === 'Duck' ? 'Duck' : 'Chick';
      const newPoultryCode = `KGP-${birdType === 'Duck' ? 'DK' : 'CHK'}-${Date.now().toString().slice(-4)}`;
      
      const newBird = await db.addPoultry({
        poultry_id: newPoultryCode,
        type: birdType,
        breed: record.breed || 'Improved Kienyeji',
        sex: 'Unknown',
        quantity: record.chicks_produced,
        date_acquired: record.date || new Date().toISOString().split('T')[0],
        age_weeks: 0,
        source: 'Hatched on farm',
        purchase_price: 0,
        estimated_unit_value: birdType === 'Duck' ? 10000 : 6000,
        current_status: 'Growing',
        notes: `Automatically added from hatch event (Brooding ID: ${record.brooding_id})`,
      });

      inventoryPoultryId = newBird.poultry_id;
      createdPoultry = newBird;
    }

    const newHatch: HatchRecord = {
      ...record,
      added_to_inventory: addToInventory,
      inventory_poultry_id: inventoryPoultryId,
      id: crypto.randomUUID ? crypto.randomUUID() : 'htch-' + Date.now(),
      created_at: new Date().toISOString(),
    };

    // Update parent brooding status to 'Hatched'
    if (record.brooding_id) {
      await db.updateBrooding(record.brooding_id, {
        actual_hatch_date: record.date,
        hatched_count: record.eggs_hatched,
        failed_count: record.eggs_failed,
        status: 'Hatched',
      });
    }

    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        const { data, error } = await client.from('hatch_records').insert([newHatch]).select().single();
        if (error) throw new Error(error.message);
        if (data) {
          const list = await db.getHatchRecords();
          setLocalData('hatch_records', [data, ...list.filter(x => x.id !== data.id)]);
          return { hatch: data, createdPoultry };
        }
      } catch (err: unknown) {
        console.warn('Supabase add hatch record error:', err);
      }
    }

    const current = getLocalData('hatch_records', defaultHatch);
    const updated = [newHatch, ...current];
    setLocalData('hatch_records', updated);
    return { hatch: newHatch, createdPoultry };
  },

  async deleteHatchRecord(id: string): Promise<boolean> {
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        const { error } = await client.from('hatch_records').delete().eq('id', id);
        if (error) throw new Error(error.message);
      } catch (err) {
        console.warn('Supabase delete hatch record error:', err);
      }
    }
    const current = getLocalData('hatch_records', defaultHatch);
    setLocalData('hatch_records', current.filter(x => x.id !== id));
    return true;
  },

  // EXPENSES
  async getExpenses(): Promise<ExpenseRecord[]> {
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        const { data, error } = await client
          .from('expenses')
          .select('*')
          .order('date', { ascending: false });
        if (!error && data && data.length > 0) {
          setLocalData('expenses', data);
          return data;
        }
      } catch (err) {
        console.warn('Supabase fetch expenses error:', err);
      }
    }
    return getLocalData('expenses', defaultExpenses);
  },

  async addExpense(record: Omit<ExpenseRecord, 'id' | 'created_at'>): Promise<ExpenseRecord> {
    const total_cost = Math.round(Number(record.quantity) * Number(record.unit_cost));
    const newRecord: ExpenseRecord = {
      ...record,
      total_cost,
      id: crypto.randomUUID ? crypto.randomUUID() : 'exp-' + Date.now(),
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        const { data, error } = await client.from('expenses').insert([newRecord]).select().single();
        if (error) throw new Error(error.message);
        if (data) {
          const list = await db.getExpenses();
          setLocalData('expenses', [data, ...list.filter(x => x.id !== data.id)]);
          return data;
        }
      } catch (err: unknown) {
        console.warn('Supabase add expense error:', err);
      }
    }

    const current = getLocalData('expenses', defaultExpenses);
    const updated = [newRecord, ...current];
    setLocalData('expenses', updated);
    return newRecord;
  },

  async deleteExpense(id: string): Promise<boolean> {
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        const { error } = await client.from('expenses').delete().eq('id', id);
        if (error) throw new Error(error.message);
      } catch (err) {
        console.warn('Supabase delete expense error:', err);
      }
    }
    const current = getLocalData('expenses', defaultExpenses);
    setLocalData('expenses', current.filter(x => x.id !== id));
    return true;
  },

  // EXPENSE CATEGORIES
  async getExpenseCategories(): Promise<ExpenseCategory[]> {
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        const { data, error } = await client
          .from('expense_categories')
          .select('*')
          .order('name', { ascending: true });
        if (!error && data && data.length > 0) {
          setLocalData('expense_categories', data);
          return data;
        }
      } catch (err) {
        console.warn('Supabase fetch categories error:', err);
      }
    }
    return getLocalData('expense_categories', defaultCategories);
  },

  async addExpenseCategory(name: string): Promise<ExpenseCategory> {
    const trimmed = name.trim();
    const newCat: ExpenseCategory = {
      id: crypto.randomUUID ? crypto.randomUUID() : 'cat-' + Date.now(),
      name: trimmed,
      is_default: false,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        const { data, error } = await client.from('expense_categories').insert([newCat]).select().single();
        if (error) throw new Error(error.message);
        if (data) {
          const list = await db.getExpenseCategories();
          setLocalData('expense_categories', [...list, data]);
          return data;
        }
      } catch (err: unknown) {
        console.warn('Supabase add category error:', err);
      }
    }

    const current = getLocalData('expense_categories', defaultCategories);
    if (!current.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
      const updated = [...current, newCat];
      setLocalData('expense_categories', updated);
    }
    return newCat;
  },

  // SALES
  async getSales(): Promise<SaleRecord[]> {
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        const { data, error } = await client
          .from('sales')
          .select('*')
          .order('date', { ascending: false });
        if (!error && data && data.length > 0) {
          setLocalData('sales', data);
          return data;
        }
      } catch (err) {
        console.warn('Supabase fetch sales error:', err);
      }
    }
    return getLocalData('sales', defaultSales);
  },

  async addSale(record: Omit<SaleRecord, 'id' | 'created_at'>): Promise<SaleRecord> {
    const total_amount = Math.round(Number(record.quantity) * Number(record.unit_price));
    const newRecord: SaleRecord = {
      ...record,
      total_amount,
      id: crypto.randomUUID ? crypto.randomUUID() : 'sal-' + Date.now(),
      created_at: new Date().toISOString(),
    };

    // If poultry stock deduction is linked, optionally update poultry stock
    if (record.poultry_id_linked) {
      const poultryList = await db.getPoultry();
      const targetBird = poultryList.find(p => p.id === record.poultry_id_linked || p.poultry_id === record.poultry_id_linked);
      if (targetBird) {
        const newQty = Math.max(0, targetBird.quantity - Number(record.quantity));
        const newStatus = newQty === 0 ? 'Sold' : targetBird.current_status;
        await db.updatePoultry(targetBird.id, { quantity: newQty, current_status: newStatus });
      }
    }

    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        const { data, error } = await client.from('sales').insert([newRecord]).select().single();
        if (error) throw new Error(error.message);
        if (data) {
          const list = await db.getSales();
          setLocalData('sales', [data, ...list.filter(x => x.id !== data.id)]);
          return data;
        }
      } catch (err: unknown) {
        console.warn('Supabase add sale error:', err);
      }
    }

    const current = getLocalData('sales', defaultSales);
    const updated = [newRecord, ...current];
    setLocalData('sales', updated);
    return newRecord;
  },

  async deleteSale(id: string): Promise<boolean> {
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        const { error } = await client.from('sales').delete().eq('id', id);
        if (error) throw new Error(error.message);
      } catch (err) {
        console.warn('Supabase delete sale error:', err);
      }
    }
    const current = getLocalData('sales', defaultSales);
    setLocalData('sales', current.filter(x => x.id !== id));
    return true;
  },

  // RESET ALL DATA (FACTORY RESET)
  async resetAllData(): Promise<{ success: boolean; message: string }> {
    try {
      if (isSupabaseConfigured()) {
        const client = getSupabaseClient();
        // Delete child tables first to respect foreign keys
        await client.from('hatch_records').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await client.from('brooding').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await client.from('egg_records').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await client.from('sales').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await client.from('expenses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await client.from('poultry').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      }

      // Reset local storage cache completely
      setLocalData('poultry', []);
      setLocalData('egg_records', []);
      setLocalData('brooding', []);
      setLocalData('hatch_records', []);
      setLocalData('sales', []);
      setLocalData('expenses', []);
      setLocalData('expense_categories', defaultCategories);

      return { success: true, message: 'All database records and farm data have been completely wiped.' };
    } catch (err: unknown) {
      console.error('Error resetting database:', err);
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Failed to clear data.',
      };
    }
  },

  // REALTIME SUBSCRIPTION
  subscribeToChanges(callback: () => void): () => void {
    if (!isSupabaseConfigured()) return () => {};

    try {
      const client = getSupabaseClient();
      const channel = client
        .channel('kgp_poultry_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public' },
          (payload) => {
            console.log('Realtime change detected:', payload);
            callback();
          }
        )
        .subscribe();

      return () => {
        client.removeChannel(channel);
      };
    } catch (err) {
      console.warn('Realtime subscription error:', err);
      return () => {};
    }
  },
};
