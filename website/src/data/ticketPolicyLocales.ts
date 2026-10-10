import type { PublicLocale } from "../lib/publicLocale";
import type { TICKET_POLICIES } from "../lib/tickets/ticketCommercialTerms";
type PolicyKey = keyof typeof TICKET_POLICIES;
// Translations of the current 2026-09-22.1 terms. Existing JA/EN and historical
// purchase snapshots remain owned by ticketCommercialTerms, not this UI dictionary.
export const TICKET_POLICY_TRANSLATION_VERSION = "2026-09-22.1";
export const DRINK_SAFETY_TRANSLATIONS = {
  pt: "Podemos recusar o serviço de bebidas alcoólicas se você estiver muito embriagado ou se a equipe identificar um risco à segurança.",
  ko: "만취 상태이거나 직원이 안전상 문제가 있다고 판단하는 경우 주류 제공을 거절할 수 있습니다.",
};
export const TICKET_POLICY_TRANSLATIONS: Record<
  "pt" | "ko",
  Record<PolicyKey, string>
> = {
  pt: {
    age: "A entrada é permitida a partir de 18 anos. Bebidas alcoólicas somente a partir de 20 anos.",
    identity:
      "Todos os convidados devem apresentar um documento de identificação com foto. A entrada depende da confirmação da idade e da identidade.",
    price:
      "Os preços são por pessoa, com impostos incluídos e sem taxa adicional de compra online. Bebidas não incluídas no passe, reentrada e outros serviços opcionais são cobrados à parte.",
    payment:
      "Pague no momento da compra usando um dos métodos oferecidos pelo Stripe. Conclua o pagamento antes do prazo exibido na tela de pagamento.",
    provision:
      "O ingresso eletrônico é emitido após a confirmação do pagamento e pode ser consultado no Wallet. O serviço é prestado durante o horário de funcionamento da noite selecionada.",
    refundCancellation:
      "Em regra, não há reembolso por cancelamento, alteração de data, não comparecimento ou atraso por parte do cliente. Se o organizador cancelar o evento ou alterar a data, os ingressos não utilizados serão reembolsados integralmente pelo método de pagamento original, sem dedução de taxa de reembolso do PURE. Falhas de serviço atribuíveis ao estabelecimento serão tratadas individualmente. Os direitos previstos em lei não são limitados.",
    wristbandReentry:
      "Se desejar retornar, retire um cartão de reentrada com a equipe ao sair. Ao retornar, apresente o cartão e pague JPY 500. Não é necessário deslizar o ingresso novamente.",
    multipleTickets:
      "Todos os convidados do mesmo pedido devem entrar juntos. O comprador e todos os acompanhantes devem chegar juntos e apresentar os ingressos no smartphone do comprador. Não é permitida a entrada separada. Quando a equipe concluir o check-in deslizando a tela, todos os ingressos do pedido serão marcados como utilizados e não poderão ser usados novamente.",
    transfer:
      "A revenda e a transferência para terceiros não são permitidas. Não compartilhe o link do pedido, o acesso ao Wallet, códigos de verificação ou chaves de acesso.",
    connectivity:
      "É necessária uma conexão à internet para realizar a entrada. Aguarde a equipe verificar o resultado confirmado pelo servidor antes de entrar. Em caso de problemas com o dispositivo, a conexão ou o e-mail, peça ajuda à equipe da entrada.",
    drinkScope: `O passe de bebidas é válido para o cardápio de bebidas ilimitadas designado pelo estabelecimento, durante o horário de funcionamento daquela noite. Bebidas premium e garrafas fora desse cardápio são cobradas à parte. Não é permitido compartilhar. ${DRINK_SAFETY_TRANSLATIONS.pt} O ingresso de entrada geral não inclui bebidas ilimitadas.`,
    support:
      "Para suporte ou reembolso, entre em contato pelo Instagram oficial ou pelo telefone +81-6-6214-6600, informando o número do pedido e a data do evento. O prazo para o reembolso aparecer varia conforme o método de pagamento e a instituição financeira.",
  },
  ko: {
    age: "만 18세 이상 입장할 수 있습니다. 음주는 만 20세 이상만 가능합니다.",
    identity:
      "입장객 전원의 사진이 있는 신분증을 제시해 주세요. 나이와 본인 확인이 되지 않으면 입장할 수 없습니다.",
    price:
      "표시 가격은 1인 기준이며 세금이 포함되어 있습니다. 온라인 구매 수수료는 없습니다. 패스에 포함되지 않은 음료, 재입장 등 선택 서비스는 별도 요금이 부과됩니다.",
    payment:
      "구매 시 Stripe 결제 화면에 표시된 결제 수단으로 결제해 주세요. 해당 화면에 표시된 기한 내에 결제를 완료해 주세요.",
    provision:
      "결제 확인 후 전자 티켓이 발행되며 Wallet에서 확인할 수 있습니다. 서비스는 선택한 영업일의 영업시간 내에 제공됩니다.",
    refundCancellation:
      "고객 사정에 따른 취소, 날짜 변경, 미사용 또는 지각으로 인한 환불은 원칙적으로 불가합니다. 주최 측이 공연을 취소하거나 개최일을 변경하면 미사용 티켓을 원래 결제 수단으로 전액 환불하며, PURE의 환불 수수료는 공제하지 않습니다. 매장 귀책으로 서비스를 이용하지 못한 경우에는 개별 대응합니다. 법률에 따른 권리를 제한하지 않습니다.",
    wristbandReentry:
      "재입장을 원하시면 퇴장 시 직원에게 재입장 카드를 받아 주세요. 재입장 시 카드를 제시하고 JPY 500을 결제해 주세요. 티켓을 다시 스와이프할 필요는 없습니다.",
    multipleTickets:
      "같은 주문의 일행은 모두 동시에 입장해야 합니다. 구매자와 모든 동행인이 모인 후 구매자의 스마트폰으로 티켓을 제시해 주세요. 개별 입장은 불가합니다. 직원이 스와이프하여 체크인을 완료하면 해당 주문의 모든 티켓이 사용 완료로 처리되며 다시 사용할 수 없습니다.",
    transfer:
      "재판매 및 제삼자에게 양도하는 것은 허용되지 않습니다. 주문 전용 링크, Wallet 로그인 정보, 인증 코드, 패스키를 다른 사람과 공유하지 마세요.",
    connectivity:
      "입장 처리에는 인터넷 연결이 필요합니다. 직원이 서버에서 확정된 결과를 확인한 후 입장해 주세요. 기기, 통신 또는 이메일에 문제가 있으면 입장 직원에게 문의해 주세요.",
    drinkScope: `음료 패스는 해당 영업일의 영업시간 동안 매장에서 지정한 무제한 음료 메뉴에 적용됩니다. 해당 메뉴에 포함되지 않은 프리미엄 음료와 보틀은 별도 요금입니다. 다른 사람과 공유할 수 없습니다. ${DRINK_SAFETY_TRANSLATIONS.ko} 일반 입장권에는 무제한 음료가 포함되지 않습니다.`,
    support:
      "문의 또는 환불 상담은 주문 번호와 영업일을 기재하여 공식 Instagram 또는 +81-6-6214-6600로 연락해 주세요. 환불 반영 시점은 결제 수단과 금융기관에 따라 다릅니다.",
  },
};
/**
 * Earlier issued terms differ from the current version only in these clauses.
 * Keyed by the exact Japanese record so an unknown wording never reuses a
 * translation of different text.
 */
const ARCHIVED_POLICY_TRANSLATIONS: ReadonlyArray<{
  key: PolicyKey;
  ja: string;
  pt: string;
  ko: string;
}> = [
  {
    key: "age",
    ja: "20歳以上の方が入場できます。",
    pt: "A entrada é permitida a partir de 20 anos.",
    ko: "만 20세 이상만 입장할 수 있습니다.",
  },
  {
    key: "wristbandReentry",
    ja: "初回入場時に腕へスタンプを押します。再入場を希望する場合は退店時にスタッフから再入場カードを受け取り、再入場時にカードをご提示のうえ500円をお支払いください。チケットの再スワイプは不要です。",
    pt: "Na primeira entrada, a equipe carimba o seu braço. Se desejar retornar, retire um cartão de reentrada com a equipe ao sair. Ao retornar, apresente o cartão e pague JPY 500. Não é necessário deslizar o ingresso novamente.",
    ko: "첫 입장 시 팔에 스탬프를 찍습니다. 재입장을 원하시면 퇴장 시 직원에게 재입장 카드를 받아 주세요. 재입장 시 카드를 제시하고 JPY 500을 결제해 주세요. 티켓을 다시 스와이프할 필요는 없습니다.",
  },
  {
    key: "drinkScope",
    ja: "飲み放題パスは当日の営業時間内、店舗の飲み放題対象メニューに適用します。対象外のプレミアムドリンク・ボトルは別料金です。他の方との共有はできません。安全のため提供をお断りする場合があります。一般入場券に飲み放題は含まれません。",
    pt: "O passe de bebidas é válido para o cardápio de bebidas ilimitadas designado pelo estabelecimento, durante o horário de funcionamento daquela noite. Bebidas premium e garrafas fora desse cardápio são cobradas à parte. Não é permitido compartilhar. O serviço pode ser recusado por segurança. O ingresso de entrada geral não inclui bebidas ilimitadas.",
    ko: "음료 패스는 해당 영업일의 영업시간 동안 매장에서 지정한 무제한 음료 메뉴에 적용됩니다. 해당 메뉴에 포함되지 않은 프리미엄 음료와 보틀은 별도 요금입니다. 다른 사람과 공유할 수 없습니다. 안전을 위해 제공을 거절할 수 있습니다. 일반 입장권에는 무제한 음료가 포함되지 않습니다.",
  },
  {
    key: "multipleTickets",
    ja: "複数枚は購入者と同行者の入場に利用できます。購入者がチケットを提示し、入場者全員が本人確認を受けてください。",
    pt: "Vários ingressos valem para a entrada do comprador e dos acompanhantes. O comprador apresenta os ingressos e todos os convidados passam pela verificação de identidade.",
    ko: "여러 장의 티켓은 구매자와 동행인의 입장에 사용할 수 있습니다. 구매자가 티켓을 제시하고 입장하는 모든 분이 본인 확인을 받아 주세요.",
  },
  {
    key: "transfer",
    ja: "転売・第三者への譲渡はできません。Walletのログイン、確認コード、パスキーを他人と共有しないでください。",
    pt: "A revenda e a transferência para terceiros não são permitidas. Não compartilhe o acesso ao Wallet, códigos de verificação ou chaves de acesso.",
    ko: "재판매 및 제삼자에게 양도하는 것은 허용되지 않습니다. Wallet 로그인 정보, 인증 코드, 패스키를 다른 사람과 공유하지 마세요.",
  },
];

/**
 * The clause of an issued terms record in the page language. Japanese and
 * English are the stored record; Portuguese and Korean translate that exact
 * wording, or return null when no translation of it exists.
 */
export function translatedIssuedTicketPolicy(
  locale: PublicLocale,
  key: PolicyKey,
  record: Readonly<{ ja: string; en: string }>,
  current: typeof TICKET_POLICIES,
): string | null {
  if (locale === "ja" || locale === "en") return record[locale];
  if (record.ja === current[key].ja)
    return TICKET_POLICY_TRANSLATIONS[locale][key];
  return (
    ARCHIVED_POLICY_TRANSLATIONS.find(
      (row) => row.key === key && row.ja === record.ja,
    )?.[locale] ?? null
  );
}

export function translatedTicketPolicy(
  locale: PublicLocale,
  key: PolicyKey,
  source: typeof TICKET_POLICIES,
) {
  return locale === "ja" || locale === "en"
    ? source[key][locale]
    : TICKET_POLICY_TRANSLATIONS[locale][key];
}
