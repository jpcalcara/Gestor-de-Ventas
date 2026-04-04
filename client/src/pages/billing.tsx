import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useFeatures } from "@/hooks/use-features";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useSearch } from "wouter";
import { useEffect } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  CreditCard, CalendarDays, AlertTriangle, CheckCircle2, XCircle,
  Clock, ArrowUpCircle, ArrowDownCircle, AlertCircle,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Link } from "wouter";

interface SubscriptionEvent {
  id: string;
  type: string;
  description: string;
  createdAt: string;
}

interface PlanOption {
  id: string;
  slug: string;
  name: string;
  price: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
}

interface ChangePlanPreview {
  currentPlan: { name: string; price: number; slug: string };
  targetPlan: { name: string; price: number; slug: string };
  diasTranscurridos: number;
  diasRestantes: number;
  diferencial: number;
  tipo: "upgrade" | "downgrade" | "same";
  efectivaEn: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle2 }> = {
  active:       { label: "Activa",              variant: "default",     icon: CheckCircle2 },
  trial:        { label: "Período de prueba",   variant: "secondary",   icon: Clock },
  grace:        { label: "Período de gracia",   variant: "outline",     icon: AlertTriangle },
  grace_period: { label: "Período de gracia",   variant: "outline",     icon: AlertTriangle },
  expired:      { label: "Vencida",             variant: "destructive", icon: XCircle },
  cancelled:    { label: "Cancelada",           variant: "destructive", icon: XCircle },
  pending:      { label: "Pendiente",           variant: "secondary",   icon: Clock },
};

const EVENT_LABELS: Record<string, string> = {
  subscription_created:     "Suscripción creada",
  subscription_activated:   "Suscripción activada",
  subscription_cancelled:   "Suscripción cancelada",
  subscription_expired:     "Suscripción vencida",
  payment_received:         "Pago recibido",
  payment_success:          "Pago aprobado",
  payment_failed:           "Pago rechazado",
  plan_changed:             "Cambio de plan",
  plan_changed_by_admin:    "Cambio de plan (sistemas)",
  plan_upgrade_applied:     "Upgrade aplicado",
  plan_downgrade_scheduled: "Downgrade programado",
  plan_downgrade_applied:   "Downgrade aplicado",
  plan_downgrade_cancelled: "Downgrade cancelado",
  grace_period_started:     "Inicio período de gracia",
};

const fmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  try { return format(parseISO(dateStr), "d 'de' MMMM yyyy", { locale: es }); }
  catch { return dateStr; }
}

function PlanCard({
  plan,
  currentSlug,
  pendingPlanId,
  preview,
  onSelect,
  isLoading,
}: {
  plan: PlanOption;
  currentSlug: string;
  pendingPlanId: string | null;
  preview: ChangePlanPreview | undefined;
  onSelect: (slug: string) => void;
  isLoading: boolean;
}) {
  const isCurrent = plan.slug === currentSlug;
  const isUpgrade = preview?.tipo === "upgrade";
  const isDowngrade = preview?.tipo === "downgrade";
  const price = parseFloat(plan.price);

  return (
    <Card className={`relative transition-all ${isCurrent ? "ring-2 ring-blue-500 dark:ring-blue-400" : ""}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="font-semibold text-base">{plan.name}</p>
              {isCurrent && (
                <Badge variant="default" className="text-xs">Plan actual</Badge>
              )}
              {!isCurrent && preview && isUpgrade && (
                <Badge variant="default" className="text-xs bg-green-600 dark:bg-green-700">
                  <ArrowUpCircle className="h-3 w-3 mr-1" />
                  Upgrade · pagar {fmt.format(preview.diferencial)} ahora
                </Badge>
              )}
              {!isCurrent && preview && isDowngrade && (
                <Badge variant="outline" className="text-xs border-amber-500 text-amber-700 dark:text-amber-400">
                  <ArrowDownCircle className="h-3 w-3 mr-1" />
                  Downgrade · efectivo {preview.efectivaEn ? format(parseISO(preview.efectivaEn), "d/MM/yyyy") : "al vencer el ciclo"}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {price === 0 ? "Gratis" : `${fmt.format(price)}/mes`}
            </p>
            {plan.description && (
              <p className="text-xs text-muted-foreground mt-1">{plan.description}</p>
            )}
          </div>

          {!isCurrent && (
            <Button
              size="sm"
              variant={isUpgrade ? "default" : "outline"}
              onClick={() => onSelect(plan.slug)}
              disabled={isLoading}
              data-testid={`button-select-plan-${plan.slug}`}
            >
              {isUpgrade ? "Hacer upgrade" : price === 0 ? "Cambiar a Free" : "Seleccionar"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function BillingPage() {
  const { subscription, isLoading } = useFeatures();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const search = useSearch();

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (search.includes("subscribed=1")) {
      toast({ title: "Suscripción activada", description: "Tu pago fue procesado correctamente." });
      queryClient.invalidateQueries({ queryKey: ["/api/my-features"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subscription/events"] });
      navigate("/billing", { replace: true });
    } else if (search.includes("payment_failed=1")) {
      toast({ title: "Pago rechazado", description: "No se pudo procesar el pago. Intentá de nuevo.", variant: "destructive" });
      navigate("/billing", { replace: true });
    } else if (search.includes("payment_pending=1")) {
      toast({ title: "Pago pendiente", description: "Tu pago está siendo procesado. Te avisaremos cuando se confirme." });
      queryClient.invalidateQueries({ queryKey: ["/api/my-features"] });
      navigate("/billing", { replace: true });
    }
  }, [search]);

  const { data: events } = useQuery<SubscriptionEvent[]>({
    queryKey: ["/api/subscription/events"],
  });

  const { data: plans = [] } = useQuery<PlanOption[]>({
    queryKey: ["/api/plans"],
  });

  const currentSlug = subscription?.planSlug || "free";

  const { data: preview } = useQuery<ChangePlanPreview>({
    queryKey: ["/api/subscription/change-plan/preview", selectedSlug],
    queryFn: () => fetch(`/api/subscription/change-plan/preview?planSlug=${selectedSlug}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!selectedSlug && selectedSlug !== currentSlug,
    retry: false,
  });

  const changePlanMutation = useMutation({
    mutationFn: (planSlug: string) => apiRequest("POST", "/api/subscription/change-plan", { planSlug }),
    onSuccess: (data: any) => {
      setConfirmOpen(false);
      setSelectedSlug(null);
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast({ title: "Listo", description: data.message || "Plan actualizado" });
        queryClient.invalidateQueries({ queryKey: ["/api/my-features"] });
        queryClient.invalidateQueries({ queryKey: ["/api/subscription/events"] });
        queryClient.invalidateQueries({ queryKey: ["/api/subscription/info"] });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const cancelPendingMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/subscription/change-plan/pending", {}),
    onSuccess: () => {
      toast({ title: "Cambio cancelado", description: "El cambio de plan programado fue cancelado." });
      queryClient.invalidateQueries({ queryKey: ["/api/my-features"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const portalMutation = useMutation({
    mutationFn: () => apiRequest("GET", "/api/subscription/portal"),
    onSuccess: (data: any) => {
      if (data?.portalUrl) window.open(data.portalUrl, "_blank");
    },
    onError: () => toast({ title: "Error", description: "No se pudo abrir el portal de pagos", variant: "destructive" }),
  });

  const checkoutMutation = useMutation({
    mutationFn: (planSlug: string) => apiRequest("POST", "/api/subscription/checkout", { planSlug }),
    onSuccess: (data: any) => {
      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else if (data?.activated) {
        toast({ title: "Plan actualizado", description: "Tu suscripción fue activada correctamente." });
        queryClient.invalidateQueries({ queryKey: ["/api/my-features"] });
        queryClient.invalidateQueries({ queryKey: ["/api/subscription/events"] });
      }
    },
    onError: () => toast({ title: "Error", description: "No se pudo iniciar el pago", variant: "destructive" }),
  });

  const handleSelectPlan = (slug: string) => {
    setSelectedSlug(slug);
    setConfirmOpen(true);
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-muted rounded w-48" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  const status = subscription?.status || "trial";
  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.trial;
  const StatusIcon = statusConfig.icon;
  const activePlans = plans.filter(p => p.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  const isActive = status === "active";

  // Confirmation dialog content
  const confirmTarget = activePlans.find(p => p.slug === selectedSlug);
  const pendingPlanName = subscription?.pendingPlanName;
  const pendingPlanId = subscription?.pendingPlanId;
  const nextPaymentStr = subscription?.nextPaymentAt ? formatDate(subscription.nextPaymentAt as any) : "próximo ciclo";

  let dialogTitle = "";
  let dialogDescription = "";
  if (confirmTarget && preview) {
    if (preview.tipo === "upgrade") {
      dialogTitle = `Upgrade a ${confirmTarget.name}`;
      dialogDescription = `Se cobrará ${fmt.format(preview.diferencial)} ahora por los ${preview.diasRestantes} días restantes del ciclo. A partir del próximo ciclo pagarás ${fmt.format(parseFloat(confirmTarget.price))}/mes completo.`;
    } else if (parseFloat(confirmTarget.price) === 0) {
      dialogTitle = "Cambiar a plan gratuito";
      dialogDescription = `Tu suscripción se cancelará al final del ciclo actual (${nextPaymentStr}). Después pasarás al plan gratuito con funcionalidades limitadas.`;
    } else {
      dialogTitle = `Cambiar a ${confirmTarget.name}`;
      dialogDescription = `Seguirás en tu plan actual hasta el ${nextPaymentStr}. A partir de ahí pasarás a ${confirmTarget.name} por ${fmt.format(parseFloat(confirmTarget.price))}/mes.`;
    }
  } else if (confirmTarget && !preview && selectedSlug !== currentSlug) {
    dialogTitle = `Cambiar a ${confirmTarget.name}`;
    dialogDescription = "¿Confirmás el cambio de plan?";
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Facturación</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Gestioná tu suscripción y pagos</p>
      </div>

      {/* Current subscription card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Suscripción actual</span>
            </div>
            <Badge variant={statusConfig.variant} data-testid="badge-subscription-status">
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusConfig.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Plan</p>
              <p className="font-medium capitalize" data-testid="text-plan-name">
                {subscription?.planName || "Free"}
              </p>
            </div>
            {subscription?.trialEndsAt && (
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Prueba hasta</p>
                <p className="font-medium flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                  {formatDate(subscription.trialEndsAt as any)}
                </p>
              </div>
            )}
            {subscription?.graceEndsAt && (
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Gracia hasta</p>
                <p className="font-medium text-yellow-600 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {formatDate(subscription.graceEndsAt as any)}
                </p>
              </div>
            )}
            {subscription?.nextPaymentAt && (
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Próximo pago</p>
                <p className="font-medium flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                  {formatDate(subscription.nextPaymentAt as any)}
                </p>
              </div>
            )}
          </div>

          {isActive && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
                data-testid="button-manage-subscription"
              >
                Gestionar pagos
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending downgrade banner */}
      {pendingPlanId && pendingPlanName && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Tenés un cambio programado a <strong>{pendingPlanName}</strong> para el {nextPaymentStr}.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => cancelPendingMutation.mutate()}
            disabled={cancelPendingMutation.isPending}
            className="border-amber-400 dark:border-amber-600 text-amber-800 dark:text-amber-300"
            data-testid="button-cancel-pending-plan"
          >
            Cancelar cambio
          </Button>
        </div>
      )}

      {/* Plan selection */}
      {isActive && activePlans.length > 0 && (
        <div>
          <h2 className="font-medium text-sm mb-3">Cambiar plan</h2>
          <div className="space-y-3">
            {activePlans.map(plan => (
              <PlanCard
                key={plan.id}
                plan={plan}
                currentSlug={currentSlug}
                pendingPlanId={pendingPlanId || null}
                preview={selectedSlug === plan.slug ? preview : undefined}
                onSelect={handleSelectPlan}
                isLoading={changePlanMutation.isPending}
              />
            ))}
          </div>
        </div>
      )}

      {/* Upgrade options for non-active */}
      {!isActive && activePlans.length > 0 && (
        <div>
          <h2 className="font-medium text-sm mb-3">Planes disponibles</h2>
          <div className="space-y-3">
            {activePlans.filter(p => parseFloat(p.price) > 0).map((plan) => (
              <Card key={plan.id} className="flex flex-row items-center justify-between p-4 gap-4">
                <div>
                  <p className="font-medium text-sm" data-testid={`text-plan-option-${plan.slug}`}>{plan.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmt.format(parseFloat(plan.price))}/mes
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => checkoutMutation.mutate(plan.slug)}
                  disabled={checkoutMutation.isPending}
                  data-testid={`button-checkout-${plan.slug}`}
                >
                  Contratar
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Subscription events */}
      {events && events.length > 0 && (
        <div>
          <h2 className="font-medium text-sm mb-3">Historial</h2>
          <Card>
            <CardContent className="pt-4 divide-y divide-border">
              {events.map(event => (
                <div key={event.id} className="py-2.5 first:pt-0 last:pb-0" data-testid={`row-event-${event.id}`}>
                  <p className="text-sm font-medium">{EVENT_LABELS[event.type] || event.type}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(event.createdAt)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Confirm plan change dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={open => { if (!open) { setConfirmOpen(false); setSelectedSlug(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>{dialogDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedSlug && changePlanMutation.mutate(selectedSlug)}
              disabled={changePlanMutation.isPending}
              data-testid="button-confirm-plan-change"
            >
              {changePlanMutation.isPending ? "Procesando..." : "Confirmar cambio"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
