import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pzkqjdkphcwmblbyorbr.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6a3FqZGtwaGN3bWJsYnlvcmJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5NzE1NjEsImV4cCI6MjEwOTU0NzU2MX0.g2PTG7bzasuMj5Z_UoOrBmEDkLgUTTfT-pMtcs_EgoE';

export const supabaseAsys: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

export async function fetchAllRowsAsys(builderFn: () => any, maxLimit = 5000): Promise<any[]> {
  if (!supabaseAsys) throw new Error('Base de datos no inicializada');
  let allRows: any[] = [];
  let from = 0;
  const pageSize = 1000;

  while (allRows.length < maxLimit) {
    const query = builderFn();
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return allRows;
}
