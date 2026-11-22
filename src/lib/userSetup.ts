import { supabase } from '@/lib/supabase';

const DEFAULT_CATEGORIES = [
  { name: 'Groceries', color: '#16a34a' },
  { name: 'Dining', color: '#ea580c' },
  { name: 'Transport', color: '#0284c7' },
  { name: 'Shopping', color: '#db2777' },
  { name: 'Bills', color: '#7c3aed' },
  { name: 'Entertainment', color: '#ca8a04' },
  { name: 'Health', color: '#0d9488' },
  { name: 'Other', color: '#64748b' },
];

export async function ensureUserSetup(userId: string): Promise<void> {
  const { error: settingsError } = await supabase
    .from('user_settings')
    .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
  if (settingsError) throw settingsError;

  const { count, error: countError } = await supabase
    .from('categories')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (countError) throw countError;

  if (count === 0) {
    const { error: seedError } = await supabase
      .from('categories')
      .upsert(
        DEFAULT_CATEGORIES.map((category) => ({ ...category, user_id: userId })),
        { onConflict: 'user_id,name', ignoreDuplicates: true },
      );
    if (seedError) throw seedError;
  }
}
