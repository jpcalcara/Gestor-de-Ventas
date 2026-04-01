import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, ArrowLeft, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PlanFeature {
  featureKey: string;
  enabled: boolean;
  limit: number | null;
}

interface Plan {
  id: string;
  name: string;
  slug: string;
  price: string;
  description: string | null;
  isActive: boolean;
  features: PlanFeature[];
}

const FEATURE_LABELS: Record<string, string> = {
  multisucursal: "Múltiples sucursales",
  usuarios_ilimitados: "Usuarios ilimitados",
  reportes_basicos: "Reportes de ventas",
  reportes_avanzados: "Reportes avanzados",
  exportar_excel: "Exportar a Excel",
  auditoria: "Auditoría de operaciones",
  invitaciones: "Invitar usuarios",
  qr_cobros: "QR de cobros",
};

const ALL_FEATURE_KEYS = Object.keys(FEATURE_LABELS);

export default function PricingPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: plans, isLoading } = useQuery<Plan[]>({
    queryKey: ["/api/plans"],
  });

  const { data: me } = useQuery<{ id: string } | null>({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  const isLoggedIn = !!me?.id;

  const checkoutMutation = useMutation({
    mutationFn: (planSlug: string) =>
      apiRequest("POST", "/api/subscription/checkout", { planSlug }),
    onSuccess: (data: any) => {
      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        navigate("/billing");
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo iniciar el pago",
        variant: "destructive",
      });
    },
  });

  const formatPrice = (price: string) => {
    const num = parseFloat(price);
    if (num === 0) return "Gratis";
    return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(num);
  };

  const getFeatureValue = (plan: Plan, key: string): { enabled: boolean; limit: number | null } => {
    const pf = plan.features.find(f => f.featureKey === key);
    return { enabled: pf?.enabled ?? false, limit: pf?.limit ?? null };
  };

  const handlePlanClick = (plan: Plan) => {
    if (isLoggedIn) {
      if (parseFloat(plan.price) === 0) {
        navigate("/billing");
        return;
      }
      checkoutMutation.mutate(plan.slug);
    } else {
      navigate(`/register?plan=${plan.slug}`);
    }
  };

  const activePlans = plans?.filter(p => p.isActive) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="mb-8">
          <button
            onClick={() => navigate(isLoggedIn ? "/billing" : "/login")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            data-testid="link-back-login"
          >
            <ArrowLeft className="h-4 w-4" />
            {isLoggedIn ? "Volver a facturación" : "Volver al inicio"}
          </button>
        </div>

        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold mb-3">Planes y precios</h1>
          <p className="text-muted-foreground text-base max-w-xl mx-auto">
            Elegí el plan que mejor se adapte a tu negocio. Podés cambiar en cualquier momento.
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardContent className="h-64" />
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {activePlans.map((plan, idx) => {
              const isPopular = idx === 1;
              const isPending = checkoutMutation.isPending && checkoutMutation.variables === plan.slug;
              return (
                <Card
                  key={plan.id}
                  data-testid={`card-plan-${plan.slug}`}
                  className={isPopular ? "border-primary shadow-md" : ""}
                >
                  <CardHeader className="pb-4">
                    {isPopular && (
                      <Badge className="w-fit mb-2" data-testid={`badge-popular-${plan.slug}`}>
                        Más popular
                      </Badge>
                    )}
                    <h2 className="text-xl font-bold">{plan.name}</h2>
                    {plan.description && (
                      <p className="text-sm text-muted-foreground">{plan.description}</p>
                    )}
                    <div className="mt-3">
                      <span className="text-3xl font-bold" data-testid={`text-price-${plan.slug}`}>
                        {formatPrice(plan.price)}
                      </span>
                      {parseFloat(plan.price) > 0 && (
                        <span className="text-muted-foreground text-sm">/mes</span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button
                      className="w-full"
                      variant={isPopular ? "default" : "outline"}
                      onClick={() => handlePlanClick(plan)}
                      disabled={checkoutMutation.isPending}
                      data-testid={`button-select-plan-${plan.slug}`}
                    >
                      {isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : parseFloat(plan.price) === 0 ? (
                        "Empezar gratis"
                      ) : (
                        "Contratar"
                      )}
                    </Button>

                    <ul className="space-y-2 pt-2">
                      {ALL_FEATURE_KEYS.map(key => {
                        const { enabled, limit } = getFeatureValue(plan, key);
                        return (
                          <li key={key} className="flex items-start gap-2 text-sm">
                            {enabled ? (
                              <Check className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                            ) : (
                              <X className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                            )}
                            <span className={enabled ? "" : "text-muted-foreground"}>
                              {FEATURE_LABELS[key]}
                              {enabled && limit !== null && ` (hasta ${limit})`}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {!isLoggedIn && (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              ¿Ya tenés una cuenta?{" "}
              <button
                onClick={() => navigate("/login")}
                className="text-foreground underline underline-offset-2 hover:no-underline"
                data-testid="link-go-login"
              >
                Iniciá sesión
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
