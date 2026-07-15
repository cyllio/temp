import { NextResponse } from 'next/server';

type ParticipanteEmail = {
  pessoa: string;
  email: string;
  valorIndividual: number;
  statusPagamento: string;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { assunto, chavePix, participantes } = body as {
      assunto: string;
      chavePix: string;
      participantes: ParticipanteEmail[];
    };

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !from) {
      return NextResponse.json(
        { error: 'Envio de e-mail não configurado. Defina RESEND_API_KEY e RESEND_FROM_EMAIL nas variáveis de ambiente.' },
        { status: 500 }
      );
    }
    if (!assunto || !Array.isArray(participantes) || participantes.length === 0) {
      return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 });
    }

    const destinatarios = participantes.filter(
      (p) => p.email && p.email.trim() && p.statusPagamento.toLowerCase() !== 'pago'
    );

    if (destinatarios.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum participante pendente com e-mail cadastrado para esse rateio.' },
        { status: 400 }
      );
    }

    const emails = destinatarios.map((p) => ({
      from,
      to: p.email.trim(),
      subject: `Rateio: ${assunto}`,
      html: `<p>Oi, ${p.pessoa}!</p><p>Sua parte no rateio "${assunto}" é de <strong>R$ ${p.valorIndividual.toFixed(
        2
      )}</strong>.</p>${chavePix ? `<p>Chave Pix: <strong>${chavePix}</strong></p>` : ''}<p>Obrigado!</p>`,
    }));

    const res = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emails),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Falha ao enviar e-mails (${res.status}): ${text}`);
    }

    return NextResponse.json({
      ok: true,
      enviados: destinatarios.length,
      ignorados: participantes.length - destinatarios.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
