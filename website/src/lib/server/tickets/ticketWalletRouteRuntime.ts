import "server-only";

import { randomUUID } from "node:crypto";

import { ticketWalletPrivateHeaders } from "./ticketWalletHttp";

type RequestHandler = (request: Request) => Promise<Response>;
type OperationResultHandler = (request: Request, operationId: string) => Promise<Response>;
type ScheduleAfter = (callback: () => void | Promise<void>) => void;

type WalletApi = Readonly<{
  bootstrapOtp?: RequestHandler;
  requestOtp?: RequestHandler;
  verifyOtp?: RequestHandler;
  readSession?: RequestHandler;
  logout?: RequestHandler;
  readWallet?: RequestHandler;
}>;

type AdmissionApi = Readonly<{
  readReadiness?: RequestHandler;
  prepare?: RequestHandler;
  commit?: RequestHandler;
  readResult?: OperationResultHandler;
}>;

export type TicketWalletRouteRuntimeDependencies = Readonly<{
  createWalletApi(scheduleOtpDelivery?: (jobId: string) => void): WalletApi;
  admissionApi: AdmissionApi;
  handleWebhook: RequestHandler;
  runSpecificEmailJob(jobId: string): Promise<unknown>;
}>;

export function createTicketWalletRouteRuntime(
  dependencies: TicketWalletRouteRuntimeDependencies,
) {
  const walletApi = () => dependencies.createWalletApi();
  return Object.freeze({
    bootstrap(request: Request) {
      return requireHandler(walletApi().bootstrapOtp)(request);
    },
    otpRequest(
      request: Request,
      options: Readonly<{ scheduleAfter: ScheduleAfter }>,
    ) {
      const api = dependencies.createWalletApi((jobId) => {
        try {
          options.scheduleAfter(async () => {
            try {
              await dependencies.runSpecificEmailJob(jobId);
            } catch {
              // The durable outbox and cron recovery remain authoritative.
            }
          });
        } catch {
          // Failure to register the latency fast path must not undo a durable
          // challenge/job transaction or alter its generic public response.
        }
      });
      return requireHandler(api.requestOtp)(request);
    },
    otpVerify(request: Request) {
      return requireHandler(walletApi().verifyOtp)(request);
    },
    sessionRead(request: Request) {
      return requireHandler(walletApi().readSession)(request);
    },
    logout(request: Request) {
      return requireHandler(walletApi().logout)(request);
    },
    walletRead(request: Request) {
      return requireHandler(walletApi().readWallet)(request);
    },
    admissionReadiness(request: Request) {
      return requireHandler(dependencies.admissionApi.readReadiness)(request);
    },
    admissionPrepare(request: Request) {
      return requireHandler(dependencies.admissionApi.prepare)(request);
    },
    admissionCommit(request: Request) {
      return requireHandler(dependencies.admissionApi.commit)(request);
    },
    admissionResult(request: Request, operationId: string) {
      return requireOperationHandler(dependencies.admissionApi.readResult)(request, operationId);
    },
    resendWebhook(request: Request) {
      return dependencies.handleWebhook(request);
    },
  });
}

type TicketWalletRouteRuntime = ReturnType<typeof createTicketWalletRouteRuntime>;

export function handleTicketWalletBootstrap(request: Request) {
  return invokeProduction((runtime) => runtime.bootstrap(request));
}

export function handleTicketWalletOtpRequest(
  request: Request,
  options: Readonly<{ scheduleAfter: ScheduleAfter }>,
) {
  return invokeProduction((runtime) => runtime.otpRequest(request, options));
}

export function handleTicketWalletOtpVerify(request: Request) {
  return invokeProduction((runtime) => runtime.otpVerify(request));
}

export function handleTicketWalletSessionRead(request: Request) {
  return invokeProduction((runtime) => runtime.sessionRead(request));
}

export function handleTicketWalletLogout(request: Request) {
  return invokeProduction((runtime) => runtime.logout(request));
}

export function handleTicketWalletRead(request: Request) {
  return invokeProduction((runtime) => runtime.walletRead(request));
}

export function handleTicketAdmissionReadiness(request: Request) {
  return invokeProduction((runtime) => runtime.admissionReadiness(request));
}

export function handleTicketAdmissionPrepare(request: Request) {
  return invokeProduction((runtime) => runtime.admissionPrepare(request));
}

export function handleTicketAdmissionCommit(request: Request) {
  return invokeProduction((runtime) => runtime.admissionCommit(request));
}

export function handleTicketAdmissionResult(request: Request, operationId: string) {
  return invokeProduction((runtime) => runtime.admissionResult(request, operationId));
}

export function handleResendWebhook(request: Request) {
  return invokeProduction((runtime) => runtime.resendWebhook(request));
}

async function invokeProduction(
  invoke: (runtime: TicketWalletRouteRuntime) => Promise<Response>,
) {
  try {
    const { getTicketWalletProductionRouteRuntime } = await import(
      "./ticketWalletProductionRuntime"
    );
    return await invoke(getTicketWalletProductionRouteRuntime());
  } catch {
    return unavailableResponse();
  }
}

function requireHandler(handler: RequestHandler | undefined) {
  if (!handler) throw new Error("TICKET_WALLET_ROUTE_NOT_CONFIGURED");
  return handler;
}

function requireOperationHandler(handler: OperationResultHandler | undefined) {
  if (!handler) throw new Error("TICKET_WALLET_ROUTE_NOT_CONFIGURED");
  return handler;
}

function unavailableResponse() {
  const requestId = randomUUID();
  return Response.json({ ok: false, error: "feature_unavailable", requestId }, {
    status: 503,
    headers: {
      ...ticketWalletPrivateHeaders(),
      "x-request-id": requestId,
    },
  });
}
