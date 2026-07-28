import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { auth } from '@/auth';
import { getItemAspectsForCategory } from '@/lib/ebay/taxonomyApi';
import { EbayApiError } from '@/lib/ebay/config';

// ── GET /api/ebay/aspects?category_id= ───────────────────────────────────
// Proxies eBay's Taxonomy API getItemAspectsForCategory — category-correct
// item aspects for draft-listing pre-fill (plan.md §5).
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get('category_id');
  if (!categoryId) {
    return NextResponse.json({ error: 'category_id is required' }, { status: 400 });
  }

  try {
    const aspects = await getItemAspectsForCategory(categoryId);
    return NextResponse.json({ aspects });
  } catch (err) {
    if (err instanceof EbayApiError) {
      console.error('eBay aspects lookup failed:', err.status, err.message);
      return NextResponse.json({ error: 'ebay_api_error', message: err.message }, { status: 502 });
    }
    throw err;
  }
}
