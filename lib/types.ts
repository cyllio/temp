export type Participante = {
  rowNumber: number;
  pessoa: string;
  valorIndividual: number;
  statusPagamento: string;
  dataPagamento: string;
};

export type Rateio = {
  id: string;
  dataEmail: string;
  assunto: string;
  remetente: string;
  chavePix: string;
  valorTotalRateio: number;
  participantes: Participante[];
};

export type NovoParticipante = {
  pessoa: string;
  valorIndividual: number;
};
