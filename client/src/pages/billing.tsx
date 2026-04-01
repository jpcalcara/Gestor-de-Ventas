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
import { CreditCard, CalendarDays, AlertTriangle, CheckCircle2, XCircle, Clock } from "lucide-react";

interface SubscriptionEvent {
  id: string;
  type: string;
  description: string;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle2 }> = {
  active: { label: "Activa", variant: "default", icon: CheckCircle2 },
  trial: { label: "Período de prueba", variant: "secondary", icon: Clock },
  grace: { label: "Período de gracia", variant: "outline", icon: AlertTriangle },
  expired: { label: "Vencida", variant: "destructive", icon: XCircle },
  cancelled: { label: "Cancelada", variant: "destructive", icon: XCircle },
  pending: { label: "Pendiente", variant: "secondary", icon: Clock },
};

const EVENT_LABELS: Record<string, string> = {
  subscription_created: "Suscripción creada",
  subscription_activated: "Suscripción activada",
  subscription_cancelled: "Suscripción cancelada",
  subscription_expired: "Suscripción vencida",
  payment_received: "Pago recibido",
  plan_changed: "Cambio de plan",
  grace_period_started: "Inicio período de gracia",
};

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  try {
    return format(parseISO(dateStr), "d 'de' MMMM yyyy", { locale: es });
  } catch {
    return dateStr;
  }
}

export default function BillingPage() {
  const { subscription, isLoading } = useFeatures();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const search = useSearch();

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

  const { data: plans } = useQuery<any[]>({
    queryKey: ["/api/plans"],
  });

  const portalMutation = useMutation({
    mutationFn: () => apiRequest("GET", "/api/subscription/portal"),
    onSuccess: (data: any) => {
      if (data?.portalUrl) window.open(data.portalUrl, "_blank");
    },
    onError: () => toast({ title: "Error", description: "No se pudo abrir el portal de pagos", variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/subscription"),
    onSuccess: () => {
      toast({ title: "Suscripción cancelada" });
      queryClient.invalidateQueries({ queryKey: ["/api/my-features"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subscription/events"] });
    },
    onError: () => toast({ title: "Error", description: "No se pudo cancelar la suscripción", variant: "destructive" }),
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
  const activePlans = plans?.filter(p => p.isActive) ?? [];

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Facturación</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Gestioná tu suscripción y pagos</p>
      </div>

      {/* Current plan card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Plan actual</span>
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
                  {formatDate(subscription.trialEndsAt)}
                </p>
              </div>
            )}
            {subscription?.graceEndsAt && (
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Gracia hasta</p>
                <p className="font-medium text-yellow-600 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {formatDate(subscription.graceEndsAt)}
                </p>
              </div>
            )}
            {subscription?.nextPaymentAt && (
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Próximo pago</p>
                <p className="font-medium flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                  {formatDate(subscription.nextPaymentAt)}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {status === "active" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
                data-testid="button-manage-subscription"
              >
                Gestionar pagos
              </Button>
            )}
            {status === "active" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (confirm("¿Estás seguro que querés cancelar la suscripción?")) {
                    cancelMutation.mutate();
                  }
                }}
                disabled={cancelMutation.isPending}
                data-testid="button-cancel-subscription"
              >
                Cancelar suscripción
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Upgrade options for non-active */}
      {(status === "trial" || status === "expired" || status === "cancelled" || status === "grace") && activePlans.length > 0 && (
        <div>
          <h2 className="font-medium text-sm mb-3">Planes disponibles</h2>
          <div className="grid grid-cols-1 gap-3">
            {activePlans.filter(p => parseFloat(p.price) > 0).map((plan: any) => (
              <Card key={plan.id} className="flex flex-row items-center justify-between p-4 gap-4">
                <div>
                  <p className="font-medium text-sm" data-testid={`text-plan-option-${plan.slug}`}>{plan.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(parseFloat(plan.price))}/mes
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
    </div>
  );
}
