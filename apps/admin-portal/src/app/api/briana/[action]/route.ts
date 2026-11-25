import { NextRequest, NextResponse } from 'next/server';
import { handleBrianaAction } from '@/lib/briana-handlers';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { action: string } }
) {
  try {
    const action = params.action;
    const body = await req.json().catch(() => ({}));
    const args = Array.isArray(body) ? body : (body.args || []);

    const result = await handleBrianaAction(action, args, body);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error(`Error procesando acción /api/briana/${params?.action}:`, err);
    return NextResponse.json(
      { success: false, error: err.message || 'Error interno en el servidor' },
      { status: 500 }
    );
  }
}
