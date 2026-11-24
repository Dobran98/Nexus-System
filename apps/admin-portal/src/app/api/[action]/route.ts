import { NextRequest, NextResponse } from 'next/server';
import { handleOrianaAction } from '@/lib/oriana-handlers';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { action: string } }
) {
  try {
    const action = params.action;
    const body = await req.json().catch(() => ({}));
    const args = body.args || [];

    const result = await handleOrianaAction(action, args, body);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error(`Error procesando acción /api/${params?.action}:`, err);
    return NextResponse.json(
      { success: false, message: err.message || 'Error interno en el servidor' },
      { status: 500 }
    );
  }
}
