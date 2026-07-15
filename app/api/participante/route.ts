import { NextResponse } from 'next/server';
import { updateParticipanteEmail, updateParticipantePagamento } from '@/lib/sheets';

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { rowNumber } = body;
    if (!rowNumber) {
      return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 });
    }

    if (typeof body.email === 'string') {
      await updateParticipanteEmail(Number(rowNumber), body.email.trim());
      return NextResponse.json({ ok: true });
    }

    const { statusPagamento, dataPagamento } = body;
    if (!statusPagamento) {
      return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 });
    }
    await updateParticipantePagamento(Number(rowNumber), String(statusPagamento), String(dataPagamento || ''));
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
