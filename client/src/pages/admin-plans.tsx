import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";
import { Building2, Check, X } from "lucide-react";

interface Feature {
  id: string;
  key: string;
  name: string;
  description: string | null;
}

interface PlanFeature {
  planId: string;
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
  planFeatures: PlanFeature[];
  businessCount: number;
}

interface AdminPlansResponse {
  plans: Plan[];
  features: Feature[];
}

interface BusinessRow {
  id: string;
  razonSocial: string;
  plan: string;
  planName: string;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  graceEndsAt: string | null;
  nextPaymentAt: string | null;
  isActive: boolean;
}

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return format(parseISO(d), "dd/MM/yyyy", { locale: es }); } catch { return d; }
}

const STATUS_LABELS: Record<string, string> = {
  active: "Activa",
  trial: "Trial",
  grace: "Gracia",
  expired: "Vencida",
  cancelled: "Cancelada",
  pending: "Pendiente",
};

export default function AdminPlansPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"plans" | "businesses">("plans");

  if (user?.role !== "sistemas") {
    navigate("/");
    return null;
  }

  const { data, isLoading } = useQuery<AdminPlansResponse>({
    queryKey: ["/api/admin/plans"],
  });

  const { data: businesses, isLoading: bizLoading } = useQuery<BusinessRow[]>({
    queryKey: ["/api/admin/businesses/subscriptions"],
  });

  const updatePlanFeature = useMutation({
    mutationFn: ({ planId, featureKey, enabled, limit }: { planId: string; featureKey: string; enabled: boolean; limit: number | null }) =>
      apiRequest("PATCH", "/api/admin/plan-features", { planId, featureKey, enabled, limit }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
      toast({ title: "Actualizado" });
    },
    onError: () => toast({ title: "Error", description: "No se pudo actualizar", variant: "destructive" }),
  });

  const updatePrice = useMutation({
    mutationFn: ({ id, price }: { id: string; price: string }) =>
      apiRequest("PATCH", `/api/admin/plans/${id}`, { price }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
      toast({ title: "Precio actualizado" });
    },
    onError: () => toast({ title: "Error", description: "No se pudo actualizar el precio", variant: "destructive" }),
  });

  const changeBizPlan = useMutation({
    mutationFn: ({ bizId, planId }: { bizId: string; planId: string }) =>
      apiRequest("PATCH", `/api/admin/businesses/${bizId}/plan`, { planId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses/subscriptions"] });
      toast({ title: "Plan actualizado" });
    },
    onError: () => toast({ title: "Error", description: "No se pudo cambiar el plan", variant: "destructive" }),
  });

  const updateBizSubscription = useMutation({
    mutationFn: ({ bizId, subscriptionStatus }: { bizId: string; subscriptionStatus: string }) =>
      apiRequest("PATCH", `/api/admin/businesses/${bizId}/subscription`, { subscriptionStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/businesses/subscriptions"] });
      toast({ title: "Estado actualizado" });
    },
    onError: () => toast({ title: "Error", description: "Error al actualizar", variant: "destructive" }),
  });

  const plans = data?.plans ?? [];
  const features = data?.features ?? [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Gestión de Planes</h1>
          <p className="text-sm text-muted-foreground">Administrá planes, features y suscripciones de negocios</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={activeTab === "plans" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("plans")}
            data-testid="button-tab-plans"
          >
            Planes y features
          </Button>
          <Button
            variant={activeTab === "businesses" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("businesses")}
            data-testid="button-tab-businesses"
          >
            Negocios
          </Button>
        </div>
      </div>

      {activeTab === "plans" && (
        isLoading ? (
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-48 bg-muted rounded" />)}
          </div>
        ) : (
          <div className="space-y-6">
            {plans.map(plan => (
              <Card key={plan.id} data-testid={`card-plan-${plan.slug}`}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-semibold">{plan.name}</h2>
                        <Badge variant="secondary" data-testid={`badge-business-count-${plan.slug}`}>
                          {plan.businessCount} negocios
                        </Badge>
                        {!plan.isActive && <Badge variant="destructive">Inactivo</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">slug: {plan.slug}</p>
                    </div>
                    <PriceEditor plan={plan} onSave={(price) => updatePrice.mutate({ id: plan.id, price })} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 font-medium text-muted-foreground">Feature</th>
                          <th className="text-center py-2 font-medium text-muted-foreground w-24">Activo</th>
                          <th className="text-center py-2 font-medium text-muted-foreground w-32">Límite</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {features.map(feat => {
                          const pf = plan.planFeatures.find(f => f.featureKey === feat.key);
                          const enabled = pf?.enabled ?? false;
                          const limit = pf?.limit ?? null;
                          return (
                            <tr key={feat.key} data-testid={`row-feature-${plan.slug}-${feat.key}`}>
                              <td className="py-2.5">
                                <p className="font-medium">{feat.name}</p>
                                {feat.description && <p className="text-xs text-muted-foreground">{feat.description}</p>}
                              </td>
                              <td className="py-2.5 text-center">
                                <Switch
                                  checked={enabled}
                                  onCheckedChange={(checked) =>
                                    updatePlanFeature.mutate({ planId: plan.id, featureKey: feat.key, enabled: checked, limit })
                                  }
                                  data-testid={`switch-feature-${plan.slug}-${feat.key}`}
                                />
                              </td>
                              <td className="py-2.5 text-center">
                                {enabled ? (
                                  <LimitEditor
                                    value={limit}
                                    onSave={(v) => updatePlanFeature.mutate({ planId: plan.id, featureKey: feat.key, enabled, limit: v })}
                                  />
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}

      {activeTab === "businesses" && (
        bizLoading ? (
          <div className="animate-pulse h-64 bg-muted rounded" />
        ) : (
          <Card>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium text-muted-foreground">Negocio</th>
                      <th className="text-left py-2 font-medium text-muted-foreground">Plan</th>
                      <th className="text-left py-2 font-medium text-muted-foreground">Estado</th>
                      <th className="text-left py-2 font-medium text-muted-foreground">Vencimiento</th>
                      <th className="text-left py-2 font-medium text-muted-foreground">Cambiar plan</th>
                      <th className="text-left py-2 font-medium text-muted-foreground">Estado sub.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(businesses ?? []).map(biz => (
                      <tr key={biz.id} data-testid={`row-biz-${biz.id}`}>
                        <td className="py-3">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-medium">{biz.razonSocial}</span>
                          </div>
                        </td>
                        <td className="py-3 capitalize">{biz.planName}</td>
                        <td className="py-3">
                          <Badge variant={biz.isActive ? "default" : "destructive"} className="text-xs">
                            {biz.isActive ? "Activo" : "Inactivo"}
                          </Badge>
                        </td>
                        <td className="py-3 text-xs text-muted-foreground">
                          {biz.trialEndsAt ? `Trial: ${formatDate(biz.trialEndsAt)}` : biz.nextPaymentAt ? `Pago: ${formatDate(biz.nextPaymentAt)}` : "—"}
                        </td>
                        <td className="py-3">
                          <Select
                            value={plans.find(p => p.slug === biz.plan)?.id || ""}
                            onValueChange={(planId) => changeBizPlan.mutate({ bizId: biz.id, planId })}
                          >
                            <SelectTrigger className="h-8 w-32" data-testid={`select-plan-${biz.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {plans.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-3">
                          <Select
                            value={biz.subscriptionStatus || "trial"}
                            onValueChange={(s) => updateBizSubscription.mutate({ bizId: biz.id, subscriptionStatus: s })}
                          >
                            <SelectTrigger className="h-8 w-32" data-testid={`select-status-${biz.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                                <SelectItem key={k} value={k}>{v}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}

function PriceEditor({ plan, onSave }: { plan: Plan; onSave: (p: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(plan.price);

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-semibold text-lg">
          {parseFloat(plan.price) === 0 ? "Gratis" : `$ ${new Intl.NumberFormat("es-AR").format(parseFloat(plan.price))}/mes`}
        </span>
        <Button size="sm" variant="outline" onClick={() => setEditing(true)} data-testid={`button-edit-price-${plan.slug}`}>
          Editar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        className="h-8 w-28"
        type="number"
        value={value}
        onChange={e => setValue(e.target.value)}
        data-testid={`input-price-${plan.slug}`}
      />
      <Button size="sm" onClick={() => { onSave(value); setEditing(false); }} data-testid={`button-save-price-${plan.slug}`}>
        <Check className="h-3.5 w-3.5" />
      </Button>
      <Button size="sm" variant="ghost" onClick={() => { setValue(plan.price); setEditing(false); }}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function LimitEditor({ value, onSave }: { value: number | null; onSave: (v: number | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value?.toString() ?? "");

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {value === null ? "Sin límite" : `${value}`}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 justify-center">
      <Input
        className="h-7 w-20 text-xs text-center"
        type="number"
        placeholder="∞"
        value={local}
        onChange={e => setLocal(e.target.value)}
      />
      <Button size="sm" variant="ghost" className="h-7 px-1.5" onClick={() => { onSave(local === "" ? null : parseInt(local)); setEditing(false); }}>
        <Check className="h-3 w-3" />
      </Button>
    </div>
  );
}
