import { handleCors } from '../_shared/cors.ts';
import { getServiceClient, getAuthenticatedUser } from '../_shared/supabase.ts';
import { jsonResponse, errorResponse } from '../_shared/response.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const allowed = await checkRateLimit(req, 'get-user-stats');
  if (!allowed) {
    return errorResponse(req, 'Troppe richieste. Attendi un minuto e riprova', 429, 'RATE_LIMIT_EXCEEDED');
  }

  try {
    const user = await getAuthenticatedUser(req);
    const supabase = getServiceClient();

    // Costruisce la query base filtrando ricevute non eliminate
    let query = supabase
      .from('receipts')
      .select('id, receipt_date, total_amount, category, group_id, receipt_groups(id, name, color)')
      .neq('status', 'deleted');

    if (user) {
      query = query.eq('user_id', user.id);
    }

    const { data: receipts, error } = await query;

    if (error) {
      console.error('Database error in get-user-stats:', error);
      return errorResponse(req, 'Errore nel recupero delle statistiche', 500, 'DB_ERROR');
    }

    const list = receipts || [];
    const totalReceipts = list.length;
    const totalSpending = list.reduce((sum, r) => sum + Number(r.total_amount || 0), 0);
    const averageSpending = totalReceipts > 0 ? Number((totalSpending / totalReceipts).toFixed(2)) : 0;

    // Aggregazione per Categoria
    const categoryMap: Record<string, { category: string; total: number; count: number }> = {};
    list.forEach(r => {
      const cat = r.category || 'Non categorizzato';
      if (!categoryMap[cat]) {
        categoryMap[cat] = { category: cat, total: 0, count: 0 };
      }
      categoryMap[cat].total += Number(r.total_amount || 0);
      categoryMap[cat].count += 1;
    });

    const categorySpending = Object.values(categoryMap).map(c => ({
      ...c,
      total: Number(c.total.toFixed(2)),
    })).sort((a, b) => b.total - a.total);

    // Aggregazione per Gruppo
    const groupMap: Record<string, { group_id: string | null; group_name: string; color: string | null; total: number; count: number }> = {};
    list.forEach(r => {
      const gObj = Array.isArray(r.receipt_groups) ? r.receipt_groups[0] : r.receipt_groups;
      const gId = r.group_id || 'none';
      const gName = gObj?.name || (r.group_id ? 'Gruppo sconosciuto' : 'Nessun gruppo');
      const gColor = gObj?.color || null;

      if (!groupMap[gId]) {
        groupMap[gId] = { group_id: r.group_id, group_name: gName, color: gColor, total: 0, count: 0 };
      }
      groupMap[gId].total += Number(r.total_amount || 0);
      groupMap[gId].count += 1;
    });

    const groupSpending = Object.values(groupMap).map(g => ({
      ...g,
      total: Number(g.total.toFixed(2)),
    })).sort((a, b) => b.total - a.total);

    // Aggregazione andamento mensile (ultimi 12 mesi)
    const monthlyMap: Record<string, { month: string; total: number; count: number }> = {};
    list.forEach(r => {
      if (r.receipt_date) {
        const monthKey = r.receipt_date.substring(0, 7); // YYYY-MM
        if (!monthlyMap[monthKey]) {
          monthlyMap[monthKey] = { month: monthKey, total: 0, count: 0 };
        }
        monthlyMap[monthKey].total += Number(r.total_amount || 0);
        monthlyMap[monthKey].count += 1;
      }
    });

    const monthlyTrends = Object.values(monthlyMap).map(m => ({
      ...m,
      total: Number(m.total.toFixed(2)),
    })).sort((a, b) => a.month.localeCompare(b.month));

    return jsonResponse(req, {
      total_spending: Number(totalSpending.toFixed(2)),
      average_spending: averageSpending,
      total_receipts: totalReceipts,
      category_spending: categorySpending,
      group_spending: groupSpending,
      monthly_trends: monthlyTrends,
    });
  } catch (err) {
    console.error('get-user-stats error:', err);
    return errorResponse(req, 'Errore interno del server', 500, 'INTERNAL_ERROR');
  }
});
