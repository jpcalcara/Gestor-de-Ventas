import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ToggleLeft, ToggleRight, Shield, Globe, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface Feature {
  key: string;
  name: string;
  description: string | null;
  enabledGlobally: boolean;
}

interface Plan {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

interface PlanFeature {
  id: string;
  planId: string;
  featureKey: string;
  enabled: boolean;
  limit: number | null;
}

interface FeatureFlagsData {
  features: Feature[];
  plans: Plan[];
  planFeatures: PlanFeature[];
}

const featureLabels: Record<string, string> = {
  multisucursal: "Multisucursal",
  usuarios_ilimitados: "Usuarios ilimitados",
  audit_log: "Registro de auditoría",
  reportes_avanzados: "Reportes avanzados",
  api_access: "Acceso a API",
  exportar_datos: "Exportación de datos",
  ai_image_recognition: "Reconocimiento de imagen IA",
  ai_price_suggestion: "Sugerencia de precio IA",
};

export default function AdminFeatureFlagsPage() {
  const { toast } = useToast();
  const [pendingToggles, setPendingToggles] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery<FeatureFlagsData>({
    queryKey: ["/api/admin/feature-flags"],
  });

  const globalToggleMutation = useMutation({
    mutationFn: async ({ key, enabledGlobally }: { key: string; enabledGlobally: boolean }) => {
      return await apiRequest("PATCH", `/api/admin/feature-flags/${key}/global`, { enabledGlobally });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/feature-flags"] });
      toast({ title: "Feature actualizada", description: "El estado global se actualizó correctamente." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
    onSettled: (_data, _err, variables) => {
      setPendingToggles(prev => { const s = new Set(prev); s.delete(`global:${variables.key}`); return s; });
    },
  });

  const planToggleMutation = useMutation({
    mutationFn: async ({ key, planId, enabled }: { key: string; planId: string; enabled: boolean }) => {
      return await apiRequest("PATCH", `/api/admin/feature-flags/${key}/plan/${planId}`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/feature-flags"] });
      toast({ title: "Plan actualizado", description: "La disponibilidad del feature en el plan se actualizó." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
    onSettled: (_data, _err, variables) => {
      setPendingToggles(prev => { const s = new Set(prev); s.delete(`${variables.planId}:${variables.key}`); return s; });
    },
  });

  const handleGlobalToggle = (key: string, current: boolean) => {
    const id = `global:${key}`;
    setPendingToggles(prev => new Set(prev).add(id));
    globalToggleMutation.mutate({ key, enabledGlobally: !current });
  };

  const handlePlanToggle = (key: string, planId: string, current: boolean) => {
    const id = `${planId}:${key}`;
    setPendingToggles(prev => new Set(prev).add(id));
    planToggleMutation.mutate({ key, planId, enabled: !current });
  };

  const getPlanFeatureEnabled = (featureKey: string, planId: string): boolean => {
    if (!data) return false;
    const pf = data.planFeatures.find(pf => pf.featureKey === featureKey && pf.planId === planId);
    return pf?.enabled ?? false;
  };

  const activePlans = data?.plans.filter(p => p.isActive) ?? [];

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        <div className="space-y-1">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Feature Flags</h1>
        <p className="text-sm text-muted-foreground">
          Controlá qué funcionalidades están disponibles globalmente y por plan.
        </p>
      </div>

      <div className="space-y-4">
        {(data?.features ?? []).map((feature) => {
          const label = featureLabels[feature.key] || feature.key;
          const isGlobalPending = pendingToggles.has(`global:${feature.key}`);

          return (
            <Card key={feature.key} data-testid={`card-feature-${feature.key}`}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-base">{label}</CardTitle>
                      <Badge variant="outline" className="font-mono text-xs">
                        {feature.key}
                      </Badge>
                    </div>
                    {feature.description && (
                      <CardDescription>{feature.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Global:</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isGlobalPending}
                      onClick={() => handleGlobalToggle(feature.key, feature.enabledGlobally)}
                      data-testid={`button-global-toggle-${feature.key}`}
                    >
                      {feature.enabledGlobally
                        ? <ToggleRight className="h-6 w-6 text-green-500" />
                        : <ToggleLeft className="h-6 w-6 text-muted-foreground" />
                      }
                    </Button>
                    <Badge variant={feature.enabledGlobally ? "default" : "secondary"} data-testid={`badge-global-status-${feature.key}`}>
                      {feature.enabledGlobally ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
                    <Package className="h-3.5 w-3.5" />
                    <span>Disponibilidad por plan</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {activePlans.map((plan) => {
                      const enabled = getPlanFeatureEnabled(feature.key, plan.id);
                      const isPlanPending = pendingToggles.has(`${plan.id}:${feature.key}`);

                      return (
                        <div
                          key={plan.id}
                          className="flex items-center justify-between rounded-md border px-3 py-2"
                          data-testid={`row-plan-feature-${plan.slug}-${feature.key}`}
                        >
                          <div className="flex items-center gap-2">
                            <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm font-medium">{plan.name}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={isPlanPending}
                            onClick={() => handlePlanToggle(feature.key, plan.id, enabled)}
                            data-testid={`button-plan-toggle-${plan.slug}-${feature.key}`}
                          >
                            {enabled
                              ? <ToggleRight className="h-5 w-5 text-green-500" />
                              : <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                            }
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
