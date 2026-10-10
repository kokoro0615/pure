import type { PublicLocale } from "../lib/publicLocale";

// VIP card registration and confirmation copy. Japanese is the approved source;
// English, Portuguese and Korean follow the Tickets/FAQ locale set.
export const VIP_CHECKOUT_COPY = {
  backToMap: [
    "テーブルマップへ戻る",
    "Back to table map",
    "Voltar ao mapa de mesas",
    "테이블 맵으로 돌아가기",
  ],
  step: ["ステップ 2 / 3", "Step 2 / 3", "Etapa 2 / 3", "2 / 3 단계"],
  reservationBadge: ["ご予約", "Reservation", "Reserva", "예약"],
  vipBookingLabel: ["VIP予約", "VIP Booking", "Reserva VIP", "VIP 예약"],
  cardRegistrationBadge: ["VIPカード登録", "VIP CARD REGISTRATION", "REGISTRO DE CARTÃO VIP", "VIP 카드 등록"],
  vipReservationBadge: ["VIP予約", "VIP RESERVATION", "RESERVA VIP", "VIP 예약"],
  poweredByStripe: ["Stripeによる安全な決済", "Powered by Stripe", "Pagamento seguro com Stripe", "Stripe 보안 결제"],
  seatNumber: ["{id}番席", "Seat {id}", "Lugar {id}", "{id}번 좌석"],
  conciergeHold: [
    "コンシェルジュでの仮押さえ",
    "Concierge hold",
    "Reserva pelo concierge",
    "컨시어지 예약",
  ],
  secureCardRegistration: [
    "安全なカード登録",
    "Secure Card Registration",
    "Registro seguro do cartão",
    "안전한 카드 등록",
  ],
  onlineBookingPreparing: [
    "オンライン予約準備中",
    "Online booking preparing",
    "Reserva online em preparação",
    "온라인 예약 준비 중",
  ],
  title: [
    "カード情報の登録",
    "Register your card",
    "Registro do cartão",
    "카드 정보 등록",
  ],
  titleDisabled: [
    "オンライン予約準備中",
    "Online booking coming soon",
    "Reserva online em breve",
    "온라인 예약 준비 중",
  ],
  introLead: [
    "予約枠を確保するためのカード登録です。",
    "Register a card to secure your table.",
    "Registre um cartão para garantir sua mesa.",
    "테이블을 확보하기 위한 카드 등록입니다.",
  ],
  noChargeToday: [
    "本日の請求は発生しません。",
    "You won't be charged today.",
    "Nenhuma cobrança será feita hoje.",
    "오늘은 결제되지 않습니다.",
  ],
  introRest: [
    "当日は店舗でのお支払い、キャンセル時のみ登録カードが対象になります。",
    "You pay at the venue on the night; the registered card is used only if a cancellation applies.",
    "O pagamento é feito no local, no dia; o cartão registrado só é usado em caso de cancelamento.",
    "당일 매장에서 결제하며, 취소 시에만 등록된 카드가 대상이 됩니다.",
  ],
  introDisabled: [
    "PURE Osaka VIPの公開オンライン予約は最終確認中です。カード登録へは進まず、LINEまたはお電話でご相談ください。",
    "Public online booking for PURE Osaka VIP is in final review. Please contact us on LINE or by phone instead of registering a card.",
    "A reserva online VIP do PURE Osaka está em revisão final. Fale conosco pelo LINE ou por telefone, sem registrar um cartão.",
    "PURE Osaka VIP 온라인 예약은 최종 확인 중입니다. 카드 등록 대신 LINE 또는 전화로 문의해 주세요.",
  ],
  disabledOperational: [
    "現在、カード登録の受付準備を確認しています。カード登録画面へは進まず、LINEまたはお電話でご希望のお席・日程をご相談ください。",
    "We are checking card registration readiness. Please contact us on LINE or by phone with your preferred table and date.",
    "Estamos verificando o registro de cartões. Fale conosco pelo LINE ou por telefone com a mesa e a data desejadas.",
    "현재 카드 등록 접수 준비를 확인하고 있습니다. LINE 또는 전화로 원하시는 좌석과 일정을 문의해 주세요.",
  ],
  disabledDefault: [
    "現在、PURE Osaka VIPの公開オンライン予約は最終リリース確認中です。カード登録画面へは進まず、LINEまたはお電話でご希望のお席・日程をご相談ください。",
    "PURE Osaka VIP online booking is in final release review. Please contact us on LINE or by phone with your preferred table and date.",
    "A reserva online VIP do PURE Osaka está em revisão final de lançamento. Fale conosco pelo LINE ou por telefone com a mesa e a data desejadas.",
    "PURE Osaka VIP 온라인 예약은 최종 출시 확인 중입니다. LINE 또는 전화로 원하시는 좌석과 일정을 문의해 주세요.",
  ],
  secureCheckout: [
    "安全なお手続き",
    "Secure checkout",
    "Checkout seguro",
    "보안 결제",
  ],
  securePaymentEntry: [
    "安全な決済入力",
    "Secure payment entry",
    "Entrada de pagamento segura",
    "안전한 결제 입력",
  ],
  ssl: [
    "256-bit SSL 暗号化",
    "256-bit SSL encryption",
    "Criptografia SSL de 256 bits",
    "256비트 SSL 암호화",
  ],
  pci: [
    "PCI-DSS 準拠",
    "PCI-DSS compliant",
    "Conformidade PCI-DSS",
    "PCI-DSS 준수",
  ],
  selectedTable: [
    "選択したテーブル",
    "Selected Table",
    "Mesa selecionada",
    "선택한 테이블",
  ],
  orderSummary: [
    "ご予約内容",
    "Order summary",
    "Resumo da reserva",
    "예약 요약",
  ],
  seat: ["お席", "Table", "Mesa", "좌석"],
  visitDate: ["ご来店日", "Date", "Data", "방문일"],
  visitTime: ["ご来店時間", "Arrival time", "Horário de chegada", "방문 시간"],
  guests: ["ご人数", "Guests", "Pessoas", "인원"],
  estimate: ["お見積り", "Estimate", "Estimativa", "예상 금액"],
  guestsMax: [
    "最大 {count} 名",
    "Up to {count} guests",
    "Até {count} pessoas",
    "최대 {count}명",
  ],
  guestCount: ["{count}名", "{count} guests", "{count} pessoas", "{count}명"],
  guestCountOne: ["{count}名", "{count} guest", "{count} pessoa", "{count}명"],
  dateAtBooking: [
    "予約時に選択",
    "Choose below",
    "Escolha abaixo",
    "아래에서 선택",
  ],
  dueToday: ["本日のお支払い", "Due today", "A pagar hoje", "오늘 결제 금액"],
  summaryNote: [
    "登録時に請求は発生しません。お会計は当日店舗にて、キャンセル時のみ登録カードが対象です。",
    "Registering does not charge your card. You settle the bill at the venue; the card is used only if a cancellation applies.",
    "O registro não gera cobrança. A conta é paga no local; o cartão só é usado em caso de cancelamento.",
    "등록 시 결제되지 않습니다. 계산은 당일 매장에서 하며, 취소 시에만 등록 카드가 대상입니다.",
  ],
  stepSelect: ["席を選択", "Choose table", "Escolher mesa", "좌석 선택"],
  stepCard: ["カード登録", "Register card", "Registrar cartão", "카드 등록"],
  stepConfirm: ["店舗確認", "Venue confirms", "Confirmação", "매장 확인"],
  trustPayAtVenue: [
    "当日は店舗でお支払い",
    "Pay at the venue on the night",
    "Pagamento no local, no dia",
    "당일 매장에서 결제",
  ],
  trustNoCharge: [
    "現時点での請求はありません",
    "No charge right now",
    "Nenhuma cobrança agora",
    "현재 청구 금액 없음",
  ],
  trustCancelOnly: [
    "キャンセル時のみ登録カードが対象",
    "Card used only for cancellations",
    "Cartão usado só em cancelamentos",
    "취소 시에만 등록 카드 대상",
  ],
  askOnLine: ["LINEで相談", "Ask on LINE", "Falar pelo LINE", "LINE으로 상담"],
  cardIntroTitle: [
    "カードのご登録",
    "Card registration",
    "Registro do cartão",
    "카드 등록",
  ],
  cardIntroBody: [
    "下記のご来店日時・ご連絡先をご確認のうえ「カード登録へ進む」を押してください。予約枠を確保し、続けて Stripe の安全なカード入力欄が表示されます。",
    "Check your date, time and contact details below, then press “Continue to card registration”. We hold your table and open Stripe's secure card form.",
    "Confira a data, o horário e o contato abaixo e toque em “Continuar para o cartão”. Reservamos sua mesa e abrimos o formulário seguro da Stripe.",
    "아래 방문 일시와 연락처를 확인한 후 「카드 등록 진행」을 눌러 주세요. 테이블을 확보한 뒤 Stripe의 안전한 카드 입력란이 표시됩니다.",
  ],
  email: ["メールアドレス", "Email", "E-mail", "이메일"],
  emailHelper: [
    "予約確認用",
    "For your booking confirmation",
    "Para a confirmação da reserva",
    "예약 확인용",
  ],
  phone: ["電話番号", "Phone", "Telefone", "전화번호"],
  phoneHelper: [
    "当日連絡用",
    "For contact on the night",
    "Para contato no dia",
    "당일 연락용",
  ],
  contactHint: [
    "メールアドレスまたは電話番号のどちらかをご入力ください。",
    "Enter an email address or a phone number.",
    "Informe um e-mail ou um telefone.",
    "이메일 주소 또는 전화번호 중 하나를 입력해 주세요.",
  ],
  missing_customer_contact: [
    "メールアドレスまたは電話番号のどちらかを入力してください。",
    "Enter an email address or a phone number.",
    "Informe um e-mail ou um telefone.",
    "이메일 주소 또는 전화번호 중 하나를 입력해 주세요.",
  ],
  invalid_customer_email: [
    "メールアドレスの形式をご確認ください。",
    "Check the email address format.",
    "Verifique o formato do e-mail.",
    "이메일 주소 형식을 확인해 주세요.",
  ],
  invalid_customer_phone: [
    "電話番号は日本国内番号または国際番号で入力してください。",
    "Enter a Japanese or international phone number (e.g. +81…).",
    "Informe um número japonês ou internacional (ex.: +81…).",
    "일본 국내 번호 또는 국제 번호(예: +81…)로 입력해 주세요.",
  ],
  stripeNote: [
    "カード情報は次のステップで開く Stripe の安全な入力欄にのみご入力いただきます。カード番号・CVC が PURE のサーバーを経由することはありません。",
    "You enter card details only in Stripe's secure form in the next step. Your card number and CVC never pass through PURE's servers.",
    "Os dados do cartão são informados apenas no formulário seguro da Stripe, na próxima etapa. O número e o CVC nunca passam pelos servidores do PURE.",
    "카드 정보는 다음 단계의 Stripe 안전 입력란에만 입력합니다. 카드 번호와 CVC는 PURE 서버를 거치지 않습니다.",
  ],
  stripeUnavailable: [
    "現在、オンラインでのカード登録はご利用いただけません。ご予約は LINE またはお電話でご相談ください。",
    "Online card registration is currently unavailable. Please book on LINE or by phone.",
    "O registro online do cartão está indisponível no momento. Reserve pelo LINE ou por telefone.",
    "현재 온라인 카드 등록을 이용할 수 없습니다. 예약은 LINE 또는 전화로 문의해 주세요.",
  ],
  consent: [
    "キャンセルポリシーとカード登録の目的を確認しました。",
    "I have read the cancellation policy and understand why my card is registered.",
    "Li a política de cancelamento e entendo por que o cartão é registrado.",
    "취소 정책과 카드 등록 목적을 확인했습니다.",
  ],
  policyEyebrow: [
    "キャンセルポリシー",
    "Cancellation Policy",
    "Política de cancelamento",
    "취소 정책",
  ],
  policyHeading: [
    "キャンセルポリシー",
    "Cancellation policy",
    "Política de cancelamento",
    "취소 정책",
  ],
  policyTitle: [
    "VIP予約 キャンセルポリシー",
    "VIP Reservation Cancellation Policy",
    "Política de cancelamento da reserva VIP",
    "VIP 예약 취소 정책",
  ],
  policyOpen: [
    "キャンセルポリシーを見る",
    "View cancellation policy",
    "Ver política de cancelamento",
    "취소 정책 보기",
  ],
  policyOpenShort: ["詳細を見る", "Details", "Detalhes", "자세히 보기"],
  policyClose: ["閉じる", "Close", "Fechar", "닫기"],
  policyFeeFree: ["無料", "Free", "Grátis", "무료"],
  policyStageFreeShort: [
    "1時間前まで",
    "Until 1h before",
    "Até 1h antes",
    "1시간 전까지",
  ],
  policyStageLateShort: [
    "1時間前以降",
    "Within 1 hour",
    "Menos de 1h",
    "1시간 전 이후",
  ],
  policyStageNoShowShort: [
    "無断15分経過",
    "No-show 15 min",
    "Ausência 15 min",
    "무단 15분 경과",
  ],
  policyStageFree: [
    "予約時間の1時間前まで",
    "Up to 1 hour before",
    "Até 1 hora antes",
    "예약 시간 1시간 전까지",
  ],
  policyStageLate: [
    "1時間前を過ぎてから",
    "Less than 1 hour before",
    "Menos de 1 hora antes",
    "1시간 전이 지난 후",
  ],
  policyStageNoShow: [
    "予約時間から連絡なく15分経過",
    "15 min past, no contact",
    "15 min após, sem contato",
    "연락 없이 15분 경과",
  ],
  policyRailBefore: ["1時間前", "1h before", "1h antes", "1시간 전"],
  policyRailNoShow: ["+15分", "+15 min", "+15 min", "+15분"],
  policyFullText: ["ポリシー全文", "Full policy", "Política completa", "정책 전문"],
  policySectionDeadline: [
    "キャンセル期限",
    "Cancellation deadline",
    "Prazo de cancelamento",
    "취소 기한",
  ],
  policySectionLate: [
    "直前のキャンセル",
    "Late cancellation",
    "Cancelamento tardio",
    "직전 취소",
  ],
  policySectionNoShow: [
    "無断キャンセル",
    "No-show",
    "Não comparecimento",
    "무단 취소",
  ],
  policySectionDelay: ["遅刻される場合", "Arriving late", "Atrasos", "지각하는 경우"],
  policySectionSpecial: [
    "特別期間・イベント",
    "Special periods and events",
    "Períodos e eventos especiais",
    "특별 기간·이벤트",
  ],
  policyDeadline: [
    "ご予約のキャンセルは、予約時間の1時間前までにご連絡ください。それまでにキャンセルのご連絡をいただいた場合、キャンセル料は発生いたしません。",
    "Please contact us to cancel your reservation no later than 1 hour before your reservation time. Cancellations received by then incur no cancellation fee.",
    "Para cancelar a reserva, entre em contato até 1 hora antes do horário reservado. Cancelamentos comunicados até esse prazo não geram taxa de cancelamento.",
    "예약 취소는 예약 시간 1시간 전까지 연락해 주세요. 그때까지 취소 연락을 주시면 취소 수수료가 발생하지 않습니다.",
  ],
  policyLate: [
    "予約時間の1時間前を過ぎてからのキャンセルは、キャンセル料としてご予約金額の100％を申し受けます。",
    "Cancellations made less than 1 hour before your reservation time incur a cancellation fee of 100% of the reservation amount.",
    "Cancelamentos feitos com menos de 1 hora de antecedência do horário reservado estão sujeitos a uma taxa de cancelamento de 100% do valor da reserva.",
    "예약 시간 1시간 전이 지난 후의 취소는 취소 수수료로 예약 금액의 100%를 받습니다.",
  ],
  policyNoShow: [
    "ご予約時間を過ぎてもご来店がなく、ご連絡のないまま15分を経過した場合は無断キャンセルとし、ご予約を自動的にキャンセルいたします。この場合も、ご予約金額の100％を申し受けます。",
    "If you have not arrived and have not contacted us by 15 minutes after your reservation time, the reservation is treated as a no-show and cancelled automatically. A fee of 100% of the reservation amount also applies in this case.",
    "Se você não chegar nem entrar em contato em até 15 minutos após o horário reservado, a reserva será considerada não comparecimento e cancelada automaticamente. Também neste caso será cobrado 100% do valor da reserva.",
    "예약 시간이 지나도 방문하지 않고 연락 없이 15분이 경과한 경우 무단 취소로 간주하여 예약을 자동으로 취소합니다. 이 경우에도 예약 금액의 100%를 받습니다.",
  ],
  policyDelay: [
    "遅刻される場合は、必ずご連絡ください。事前に遅刻のご連絡をいただいた場合は自動キャンセルとはなりませんが、VIP席のご利用時間は当初の予約時間から開始し、ご到着時間にかかわらず終了時間の延長はいたしません。",
    "If you are running late, please be sure to contact us. If you let us know in advance, your reservation will not be cancelled automatically; however, your VIP table time starts at the original reservation time and the end time will not be extended, regardless of when you arrive.",
    "Em caso de atraso, entre em contato conosco. Com aviso prévio, a reserva não será cancelada automaticamente; porém, o uso da mesa VIP começa no horário original da reserva e o horário de término não será prorrogado, independentemente da hora de chegada.",
    "늦으시는 경우 반드시 연락해 주세요. 사전에 지각 연락을 주시면 자동 취소되지 않지만, VIP석 이용 시간은 당초 예약 시간부터 시작되며 도착 시간과 관계없이 종료 시간은 연장되지 않습니다.",
  ],
  policySpecial: [
    "なお、年末年始・ハロウィン・周年イベント・特別イベント等については、通常とは異なるキャンセルポリシーを設定する場合があります。その場合は、ご予約時に表示・ご案内する条件が優先されます。",
    "For the New Year holidays, Halloween, anniversary events, special events and similar occasions, a cancellation policy different from the standard one may apply. In that case, the terms shown or communicated at the time of booking take precedence.",
    "No período de Ano-Novo, Halloween, eventos de aniversário, eventos especiais e ocasiões semelhantes, pode ser aplicada uma política de cancelamento diferente da habitual. Nesse caso, prevalecem as condições exibidas ou informadas no momento da reserva.",
    "또한 연말연시, 할로윈, 주년 이벤트, 특별 이벤트 등에는 통상과 다른 취소 정책이 적용될 수 있습니다. 이 경우 예약 시 표시·안내되는 조건이 우선합니다.",
  ],
  securityTitle: [
    "ロボット認証",
    "Security check",
    "Verificação de segurança",
    "보안 확인",
  ],
  securityDescription: [
    "不正な予約を防ぐための確認です。通常は自動で完了します。",
    "Keeps bots from holding tables. It usually completes on its own.",
    "Impede que bots reservem mesas. Normalmente é concluída sozinha.",
    "봇의 예약을 막기 위한 확인입니다. 보통 자동으로 완료됩니다.",
  ],
  securityLoading: [
    "認証を読み込んでいます…",
    "Loading security check…",
    "Carregando a verificação…",
    "보안 확인을 불러오는 중…",
  ],
  securityPending: ["確認中", "Checking", "Verificando", "확인 중"],
  securityReady: ["確認済み", "Verified", "Verificado", "확인 완료"],
  securityExpired: ["期限切れ", "Expired", "Expirada", "만료됨"],
  securityError: ["読み込み失敗", "Couldn't load", "Falha", "불러오기 실패"],
  securityMissing: ["利用不可", "Unavailable", "Indisponível", "사용 불가"],
  securityExpiredHelp: [
    "確認の有効期限が切れました。もう一度確認してください。",
    "The check expired. Please verify again.",
    "A verificação expirou. Verifique novamente.",
    "확인이 만료되었습니다. 다시 확인해 주세요.",
  ],
  securityErrorHelp: [
    "認証を読み込めませんでした。通信環境をご確認のうえ、もう一度お試しください。",
    "The check couldn't load. Check your connection and try again.",
    "Não foi possível carregar a verificação. Confira sua conexão e tente novamente.",
    "보안 확인을 불러오지 못했습니다. 네트워크를 확인한 후 다시 시도해 주세요.",
  ],
  securityMissingHelp: [
    "現在ロボット認証をご利用いただけません。LINE またはお電話でご相談ください。",
    "The security check is unavailable right now. Please contact us on LINE or by phone.",
    "A verificação está indisponível no momento. Fale conosco pelo LINE ou por telefone.",
    "현재 보안 확인을 이용할 수 없습니다. LINE 또는 전화로 문의해 주세요.",
  ],
  verifyAgain: [
    "もう一度確認",
    "Verify again",
    "Verificar de novo",
    "다시 확인",
  ],
  submit: [
    "カード登録へ進む",
    "Continue to card registration",
    "Continuar para o cartão",
    "카드 등록 진행",
  ],
  submitting: ["送信中…", "Sending…", "Enviando…", "전송 중…"],
  waitContact: [
    "連絡先を入力すると進めます。",
    "Add your contact details to continue.",
    "Informe seu contato para continuar.",
    "연락처를 입력하면 진행할 수 있습니다.",
  ],
  waitSecurity: [
    "ロボット認証の完了後に進めます。",
    "You can continue once the security check completes.",
    "Você pode continuar após a verificação de segurança.",
    "보안 확인이 완료되면 진행할 수 있습니다.",
  ],
  reset: ["リセット", "Reset", "Redefinir", "초기화"],
  turnstileRequired: [
    "ロボット認証をもう一度お試しください。",
    "Please complete the security check again.",
    "Conclua a verificação de segurança novamente.",
    "보안 확인을 다시 진행해 주세요.",
  ],
  slotRequired: [
    "ご来店日時を選択してください。",
    "Choose a date and arrival time.",
    "Escolha a data e o horário de chegada.",
    "방문 일시를 선택해 주세요.",
  ],
  holdUnavailable: [
    "選択した日時のお席は確保できませんでした。別の日時をお選びください。",
    "This table couldn't be held for that time. Please choose another date or time.",
    "Não foi possível reservar a mesa nesse horário. Escolha outra data ou horário.",
    "선택한 일시의 좌석을 확보하지 못했습니다. 다른 일시를 선택해 주세요.",
  ],
  rateLimited: [
    "短時間に操作が集中しました。少し時間をおいて再度お試しください。",
    "Too many attempts in a short time. Please wait a moment and try again.",
    "Muitas tentativas em pouco tempo. Aguarde um momento e tente novamente.",
    "짧은 시간에 요청이 많았습니다. 잠시 후 다시 시도해 주세요.",
  ],
  bookingUnavailable: [
    "現在オンライン予約を受け付けできません。LINE またはお電話でご相談ください。",
    "Online booking is unavailable right now. Please contact us on LINE or by phone.",
    "A reserva online está indisponível agora. Fale conosco pelo LINE ou por telefone.",
    "현재 온라인 예약을 받을 수 없습니다. LINE 또는 전화로 문의해 주세요.",
  ],
  holdFailed: [
    "カード登録を開始できませんでした。時間をおいて再度お試しいただくか、LINE またはお電話でご相談ください。",
    "We couldn't start card registration. Please try again shortly, or contact us on LINE or by phone.",
    "Não foi possível iniciar o registro do cartão. Tente novamente em instantes ou fale conosco pelo LINE ou por telefone.",
    "카드 등록을 시작하지 못했습니다. 잠시 후 다시 시도하거나 LINE 또는 전화로 문의해 주세요.",
  ],
  availabilityEmpty: [
    "現在この席のオンライン予約枠は準備中です。日程が確定し次第このページに表示されます。お急ぎの場合は LINE またはお電話でご相談ください。",
    "Online availability for this table is being prepared and will appear here once dates are set. If it's urgent, contact us on LINE or by phone.",
    "A disponibilidade online desta mesa está em preparação e aparecerá aqui quando as datas forem definidas. Se for urgente, fale pelo LINE ou por telefone.",
    "이 좌석의 온라인 예약 일정은 준비 중이며 확정되는 대로 이 페이지에 표시됩니다. 급하신 경우 LINE 또는 전화로 문의해 주세요.",
  ],
  availabilityError: [
    "予約枠を取得できませんでした。通信状況をご確認のうえ、再読み込みをお試しください。",
    "We couldn't load availability. Check your connection and reload.",
    "Não foi possível carregar a disponibilidade. Confira sua conexão e recarregue.",
    "예약 가능 시간을 불러오지 못했습니다. 네트워크를 확인한 후 다시 불러와 주세요.",
  ],
  reload: ["再読み込み", "Reload", "Recarregar", "다시 불러오기"],
  stripeSecureField: [
    "Stripe の安全な入力欄です。カード番号・CVC は PURE のサーバーを経由しません。",
    "This is Stripe's secure form. Your card number and CVC never pass through PURE's servers.",
    "Este é o formulário seguro da Stripe. O número do cartão e o CVC nunca passam pelos servidores do PURE.",
    "Stripe의 안전한 입력란입니다. 카드 번호와 CVC는 PURE 서버를 거치지 않습니다.",
  ],
  stripeCheckoutSecureField: [
    "Stripe Checkout の安全な入力欄です。カード番号・CVC は PURE のサーバーを経由しません。",
    "This is Stripe Checkout's secure form. Your card number and CVC never pass through PURE's servers.",
    "Este é o formulário seguro do Stripe Checkout. O número do cartão e o CVC nunca passam pelos servidores do PURE.",
    "Stripe Checkout의 안전한 입력란입니다. 카드 번호와 CVC는 PURE 서버를 거치지 않습니다.",
  ],
  cardRegistered: [
    "カードを登録しました",
    "Card registered",
    "Cartão registrado",
    "카드를 등록했습니다",
  ],
  registering: ["登録中…", "Registering…", "Registrando…", "등록 중…"],
  registerWithStripe: [
    "Stripe でカードを登録",
    "Register card with Stripe",
    "Registrar cartão com a Stripe",
    "Stripe로 카드 등록",
  ],
  homeAria: [
    "PURE Osaka ホームへ",
    "PURE Osaka home",
    "Início do PURE Osaka",
    "PURE Osaka 홈으로",
  ],
  cardSetupFailedTitle: [
    "カード登録を完了できませんでした",
    "We couldn't complete card registration",
    "Não foi possível concluir o registro do cartão",
    "카드 등록을 완료하지 못했습니다",
  ],
  cardSetupDoneTitle: [
    "カード登録が完了しました",
    "Your card is registered",
    "Seu cartão foi registrado",
    "카드 등록이 완료되었습니다",
  ],
  cardSetupFailedBody: [
    "認証またはカード情報の再入力が必要です。お手数ですが予約コードを添えてお問い合わせください。",
    "Authentication or card details need to be entered again. Please contact us with your reservation code.",
    "É preciso autenticar ou informar o cartão novamente. Fale conosco informando o código da reserva.",
    "인증 또는 카드 정보를 다시 입력해야 합니다. 번거로우시겠지만 예약 코드와 함께 문의해 주세요.",
  ],
  cardSetupDoneBody: [
    "VIPテーブルの仮押さえカードを登録しました。当日のご来店をお待ちしております。",
    "Your card for the VIP table hold is registered. We look forward to seeing you.",
    "O cartão da pré-reserva da mesa VIP foi registrado. Esperamos por você.",
    "VIP 테이블 가예약 카드를 등록했습니다. 당일 방문을 기다리겠습니다.",
  ],
  cardSavedConfirmed: [
    "カード保存済み・予約確定",
    "Card saved · Booking confirmed",
    "Cartão salvo · Reserva confirmada",
    "카드 저장 완료 · 예약 확정",
  ],
  bookingConfirmed: [
    "予約確定",
    "Booking confirmed",
    "Reserva confirmada",
    "예약 확정",
  ],
  confirmingBooking: [
    "確定処理を確認中",
    "Confirming your booking",
    "Confirmando a reserva",
    "확정 처리 확인 중",
  ],
  reservationCode: [
    "予約コード",
    "Reservation code",
    "Código da reserva",
    "예약 코드",
  ],
  reservationDetailsAria: [
    "ご予約内容",
    "Reservation details",
    "Detalhes da reserva",
    "예약 내용",
  ],
  reservationDetails: [
    "予約内容",
    "Reservation details",
    "Detalhes da reserva",
    "예약 내용",
  ],
  time: ["時間", "Time", "Horário", "시간"],
  minimalNote: [
    "ご予約内容は確認メール、または予約コードでお問い合わせください。",
    "See your confirmation email, or contact us with your reservation code.",
    "Consulte o e-mail de confirmação ou fale conosco com o código da reserva.",
    "예약 내용은 확인 메일을 보시거나 예약 코드로 문의해 주세요.",
  ],
  chargeToday: ["本日の請求", "Charged today", "Cobrança hoje", "오늘 청구"],
  chargeTodayValue: [
    "なし（当日店舗にてお支払い）",
    "None (pay at the venue)",
    "Nenhuma (pagamento no local)",
    "없음 (당일 매장 결제)",
  ],
  receiptNumber: [
    "受付番号",
    "Reference",
    "Número de referência",
    "접수 번호",
  ],
  noteNoCharge: [
    "登録時の請求は発生しません。お会計は当日店舗にて承ります。",
    "Registering does not charge your card. You pay at the venue on the night.",
    "O registro não gera cobrança. O pagamento é feito no local, no dia.",
    "등록 시 결제되지 않습니다. 계산은 당일 매장에서 받습니다.",
  ],
  noteCancellation: [
    "キャンセルポリシーに該当する場合のみ、登録カードが対象になります。",
    "The registered card is used only when the cancellation policy applies.",
    "O cartão registrado só é usado quando a política de cancelamento se aplica.",
    "취소 정책에 해당하는 경우에만 등록 카드가 대상이 됩니다.",
  ],
  noteContact: [
    "確定のご連絡や変更は LINE またはお電話で承ります。",
    "For confirmation or changes, contact us on LINE or by phone.",
    "Para confirmação ou alterações, fale conosco pelo LINE ou por telefone.",
    "확정 연락 및 변경은 LINE 또는 전화로 받습니다.",
  ],
  viewReservation: [
    "予約内容を確認",
    "View reservation",
    "Ver reserva",
    "예약 내용 확인",
  ],
  checkOnLine: [
    "LINEで予約を確認",
    "Check booking on LINE",
    "Confirmar pelo LINE",
    "LINE으로 예약 확인",
  ],
  contactOnLine: [
    "LINEで問い合わせ",
    "Contact on LINE",
    "Contato pelo LINE",
    "LINE으로 문의",
  ],
  urgentCallBefore: [
    "お急ぎの場合は",
    "If it's urgent, call",
    "Se for urgente, ligue para",
    "급하신 경우",
  ],
  urgentCallAfter: [
    "までお電話ください。",
    ".",
    ".",
    "로 전화해 주세요.",
  ],
  backToTop: ["トップへ戻る", "Back to home", "Voltar ao início", "홈으로"],
  pendingAria: ["確認待ち", "Awaiting confirmation", "Aguardando confirmação", "확인 대기"],
  doneAria: [
    "カード登録完了",
    "Card registration complete",
    "Registro do cartão concluído",
    "카드 등록 완료",
  ],
  actionRequired: [
    "対応が必要です",
    "Action required",
    "Ação necessária",
    "조치 필요",
  ],
  confirmationPending: [
    "確認待ち",
    "Confirmation pending",
    "Confirmação pendente",
    "확정 대기 중",
  ],
  processing: ["処理中", "Processing", "Processando", "처리 중"],
  checkingCardSetup: [
    "カード登録を確認しています",
    "Checking your card registration",
    "Verificando o registro do cartão",
    "카드 등록을 확인하고 있습니다",
  ],
  actionRequiredBody: [
    "Stripeの認証またはカード情報の再入力が必要です。予約コードを添えて店舗へお問い合わせください。",
    "Stripe authentication or card details need to be entered again. Please contact the venue with your reservation code.",
    "É preciso autenticar na Stripe ou informar o cartão novamente. Fale com a casa informando o código da reserva.",
    "Stripe 인증 또는 카드 정보를 다시 입력해야 합니다. 예약 코드와 함께 매장에 문의해 주세요.",
  ],
  pendingBody: [
    "カード登録の最終確認を待っています。確定までは完了扱いになりません。",
    "Waiting for final confirmation of your card registration. It isn't complete until confirmed.",
    "Aguardando a confirmação final do registro do cartão. Ele só é concluído após a confirmação.",
    "카드 등록의 최종 확인을 기다리고 있습니다. 확정 전까지는 완료되지 않습니다.",
  ],
  statusReservation: ["予約", "Reservation", "Reserva", "예약"],
  statusCardSaved: ["カード保存", "Card saved", "Cartão salvo", "카드 저장"],
  holdDeadline: [
    "仮押さえ期限:",
    "Hold expires:",
    "Pré-reserva válida até:",
    "가예약 기한:",
  ],
  reservationConfirmed: [
    "予約確定",
    "Reservation confirmed",
    "Reserva confirmada",
    "예약 확정",
  ],
  holdSecured: [
    "仮押さえ完了",
    "Hold secured",
    "Pré-reserva garantida",
    "가예약 완료",
  ],
  bookingReceived: [
    "ご予約を承りました",
    "Your booking is received",
    "Recebemos sua reserva",
    "예약을 접수했습니다",
  ],
  bookingReceivedBody: [
    "確認内容を下記にまとめました。当日のご来店をお待ちしております。",
    "Your details are summarized below. We look forward to seeing you.",
    "Os detalhes estão resumidos abaixo. Esperamos por você.",
    "확인 내용을 아래에 정리했습니다. 당일 방문을 기다리겠습니다.",
  ],
  table: ["テーブル", "Table", "Mesa", "테이블"],
  date: ["日付", "Date", "Data", "날짜"],
  guestsLabel: ["人数", "Guests", "Pessoas", "인원"],
  payAtVenueNote: [
    "当日は店舗でのお支払いです。現時点でカードへの請求は発生していません。キャンセル時のみ登録カードが対象になります。",
    "You pay at the venue on the night. Your card has not been charged; it is used only if a cancellation applies.",
    "O pagamento é feito no local, no dia. O cartão não foi cobrado e só é usado em caso de cancelamento.",
    "당일 매장에서 결제합니다. 현재 카드에 청구된 금액은 없으며, 취소 시에만 등록 카드가 대상이 됩니다.",
  ],
  holdValidUntil: [
    "この仮押さえは {datetime} まで有効です。確定のご連絡は店舗より差し上げます。",
    "This hold is valid until {datetime}. The venue will contact you to confirm.",
    "Esta pré-reserva é válida até {datetime}. A casa entrará em contato para confirmar.",
    "이 가예약은 {datetime}까지 유효합니다. 확정 연락은 매장에서 드립니다.",
  ],
  cardSecured: ["カード登録済み", "Card secured", "Cartão protegido", "카드 확보"],
  confirming: ["確認中", "Confirming", "Confirmando", "확인 중"],
  checkingReservation: [
    "予約内容を確認しています",
    "Checking your reservation",
    "Verificando sua reserva",
    "예약 내용을 확인하고 있습니다",
  ],
  pleaseWait: [
    "この画面のまま少々お待ちください。通常は数秒で反映されます。",
    "Please stay on this page. It usually updates within a few seconds.",
    "Permaneça nesta página. Normalmente atualiza em poucos segundos.",
    "이 화면에서 잠시만 기다려 주세요. 보통 몇 초 안에 반영됩니다.",
  ],
  lookupUnavailable: [
    "確認できません",
    "Lookup unavailable",
    "Consulta indisponível",
    "조회 불가",
  ],
  reservationNotFound: [
    "予約情報が見つかりませんでした",
    "We couldn't find your reservation",
    "Não encontramos sua reserva",
    "예약 정보를 찾지 못했습니다",
  ],
  linkExpired: [
    "リンクの有効期限が切れているか、確認用トークンが正しくない可能性があります。",
    "The link may have expired, or the confirmation token may be incorrect.",
    "O link pode ter expirado ou o token de confirmação pode estar incorreto.",
    "링크가 만료되었거나 확인용 토큰이 올바르지 않을 수 있습니다.",
  ],
  withCodeBefore: [
    "お手元の予約コード",
    "Please have your reservation code",
    "Tenha em mãos o código da reserva",
    "예약 코드",
  ],
  withCodeAfter: [
    "をご用意のうえ、LINE またはお電話でお問い合わせください。",
    "ready and contact us on LINE or by phone.",
    "e fale conosco pelo LINE ou por telefone.",
    "를 준비하신 후 LINE 또는 전화로 문의해 주세요.",
  ],
  withoutCode: [
    "LINE またはお電話でお気軽にご確認ください。",
    "Feel free to check with us on LINE or by phone.",
    "Fale conosco pelo LINE ou por telefone.",
    "LINE 또는 전화로 편하게 확인해 주세요.",
  ],
  tableMap: ["席マップへ", "Table map", "Mapa de mesas", "좌석 맵"],
} as const satisfies Record<
  string,
  readonly [string, string, string, string]
>;

export type VipCheckoutCopyKey = keyof typeof VIP_CHECKOUT_COPY;

const indices = { ja: 0, en: 1, pt: 2, ko: 3 } as const;

export function vipCheckoutText(
  locale: PublicLocale,
  key: VipCheckoutCopyKey,
  values: Record<string, string | number> = {},
) {
  const resolvedKey =
    key === "guestCount" && Number(values.count) === 1 ? "guestCountOne" : key;
  return VIP_CHECKOUT_COPY[resolvedKey][indices[locale]].replace(
    /\{(\w+)\}/g,
    (_, name) => String(values[name] ?? `{${name}}`),
  );
}

/** Map a hold/contact error code to guest-facing copy; unknown codes stay generic. */
export function vipCheckoutErrorKey(code: string): VipCheckoutCopyKey {
  if (
    code === "missing_customer_contact" ||
    code === "invalid_customer_email" ||
    code === "invalid_customer_phone"
  )
    return code;
  if (code === "slot_required") return "slotRequired";
  if (code.includes("turnstile")) return "turnstileRequired";
  if (code === "hold_unavailable") return "holdUnavailable";
  if (code === "public_hold_rate_limited" || code === "rate_limit_unavailable")
    return "rateLimited";
  if (code === "public_booking_disabled" || code === "public_booking_unavailable")
    return "bookingUnavailable";
  return "holdFailed";
}

/** Locales understood by Stripe.js Elements/Checkout. */
export const STRIPE_LOCALES = {
  ja: "ja",
  en: "en",
  pt: "pt-BR",
  ko: "ko",
} as const satisfies Record<PublicLocale, string>;

/** Locales understood by Cloudflare Turnstile. */
export const TURNSTILE_LANGUAGES = {
  ja: "ja",
  en: "en",
  pt: "pt-br",
  ko: "ko",
} as const satisfies Record<PublicLocale, string>;
