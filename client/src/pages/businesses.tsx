import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import {
  Plus, Pencil, ChevronDown, ChevronRight, Eye,
  Building2, MapPin, ToggleLeft, ToggleRight,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface BranchItem {
  id: string;
  number: number;
  name: string;
  address: string;
  isActive: boolean;
}

interface BusinessWithBranches {
  id: string;
  razonSocial: string;
  slug: string | null;
  cuit: string | null;
  encargado: string | null;
  telefono: string | null;
  mail: string | null;
  plan: string;
  isActive: boolean;
  createdAt: string;
  branches: BranchItem[];
}

const INVALIDATE_KEYS = [
  ["/api/businesses-with-branches"],
  ["/api/businesses"],
  ["/api/branches"],
];

const businessFormSchema = z.object({
  razonSocial: z.string().min(1, "La razón social es requerida"),
  plan: z.enum(["free", "starter", "pro"]).default("free"),
  cuit: z.string().optional().or(z.literal("")).nullable(),
  encargado: z.string().optional().or(z.literal("")).nullable(),
  telefono: z.string().optional().or(z.literal("")).nullable(),
  mail: z.string().email("Email inválido").optional().or(z.literal("")).nullable(),
  isActive: z.boolean().default(true),
});
type BusinessFormValues = z.infer<typeof businessFormSchema>;

const branchFormSchema = z.object({
  number: z.coerce.number().int().min(1, "El número debe ser mayor a 0"),
  name: z.string().min(1, "El nombre es requerido"),
  address: z.string().min(1, "La dirección es requerida"),
  isActive: z.boolean().default(true),
});
type BranchFormValues = z.infer<typeof branchFormSchema>;

const planConfig: Record<string, { label: string; avatarBg: string; badge: string }> = {
  free:    { label: "Free",    avatarBg: "bg-muted text-muted-foreground",        badge: "secondary" },
  starter: { label: "Starter", avatarBg: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200", badge: "outline" },
  pro:     { label: "Pro",     avatarBg: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",    badge: "default" },
};

function getInitials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

export default function BusinessesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [bizDialog, setBizDialog] = useState<{ open: boolean; editing: BusinessWithBranches | null }>({ open: false, editing: null });
  const [branchDialog, setBranchDialog] = useState<{ open: boolean; businessId: string; editing: BranchItem | null }>({
    open: false, businessId: "", editing: null,
  });
  const [planChangeTarget, setPlanChangeTarget] = useState<{ businessId: string; businessName: string; newPlan: string } | null>(null);

  const { data: businesses = [], isLoading } = useQuery<BusinessWithBranches[]>({
    queryKey: ["/api/businesses-with-branches"],
  });

  const totalNegocios = businesses.length;
  const totalSucursalesActivas = businesses.reduce((sum, b) => sum + b.branches.filter(br => br.isActive).length, 0);
  const countFree    = businesses.filter(b => b.plan === "free").length;
  const countStarter = businesses.filter(b => b.plan === "starter").length;
  const countPro     = businesses.filter(b => b.plan === "pro").length;

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const invalidateAll = () => INVALIDATE_KEYS.forEach(k => queryClient.invalidateQueries({ queryKey: k }));

  // ── Business mutations ──────────────────────────────────────────────────────
  const bizForm = useForm<BusinessFormValues>({
    resolver: zodResolver(businessFormSchema),
    defaultValues: { razonSocial: "", plan: "free", cuit: null, encargado: null, telefono: null, mail: null, isActive: true },
  });

  const createBizMutation = useMutation({
    mutationFn: (data: BusinessFormValues) => apiRequest("POST", "/api/businesses", data),
    onSuccess: () => { invalidateAll(); toast({ title: "Negocio creado" }); setBizDialog({ open: false, editing: null }); bizForm.reset(); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateBizMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BusinessFormValues> }) => apiRequest("PATCH", `/api/businesses/${id}`, data),
    onSuccess: () => { invalidateAll(); toast({ title: "Negocio actualizado" }); setBizDialog({ open: false, editing: null }); bizForm.reset(); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openBizCreate = () => {
    bizForm.reset({ razonSocial: "", plan: "free", cuit: null, encargado: null, telefono: null, mail: null, isActive: true });
    setBizDialog({ open: true, editing: null });
  };

  const openBizEdit = (b: BusinessWithBranches) => {
    bizForm.reset({ razonSocial: b.razonSocial, plan: (b.plan as any) || "free", cuit: b.cuit, encargado: b.encargado, telefono: b.telefono, mail: b.mail, isActive: b.isActive });
    setBizDialog({ open: true, editing: b });
  };

  const submitBiz = (data: BusinessFormValues) => {
    if (bizDialog.editing) updateBizMutation.mutate({ id: bizDialog.editing.id, data });
    else createBizMutation.mutate(data);
  };

  // ── Branch mutations ────────────────────────────────────────────────────────
  const branchForm = useForm<BranchFormValues>({
    resolver: zodResolver(branchFormSchema),
    defaultValues: { number: 1, name: "", address: "", isActive: true },
  });

  const createBranchMutation = useMutation({
    mutationFn: (data: BranchFormValues & { businessId: string }) => apiRequest("POST", "/api/branches", data),
    onSuccess: () => { invalidateAll(); toast({ title: "Sucursal creada" }); setBranchDialog({ open: false, businessId: "", editing: null }); branchForm.reset(); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateBranchMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BranchFormValues> }) => apiRequest("PATCH", `/api/branches/${id}`, data),
    onSuccess: () => { invalidateAll(); toast({ title: "Sucursal actualizada" }); setBranchDialog({ open: false, businessId: "", editing: null }); branchForm.reset(); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleBranchMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => apiRequest("PATCH", `/api/branches/${id}`, { isActive }),
    onSuccess: () => { invalidateAll(); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openBranchCreate = (businessId: string) => {
    branchForm.reset({ number: 1, name: "", address: "", isActive: true });
    setBranchDialog({ open: true, businessId, editing: null });
  };

  const openBranchEdit = (br: BranchItem, businessId: string) => {
    branchForm.reset({ number: br.number, name: br.name, address: br.address, isActive: br.isActive });
    setBranchDialog({ open: true, businessId, editing: br });
  };

  const submitBranch = (data: BranchFormValues) => {
    if (branchDialog.editing) updateBranchMutation.mutate({ id: branchDialog.editing.id, data });
    else createBranchMutation.mutate({ ...data, businessId: branchDialog.businessId });
  };

  // ── Ver como ────────────────────────────────────────────────────────────────
  const viewAsMutation = useMutation({
    mutationFn: (businessId: string) => apiRequest("POST", "/api/session/business", { businessId }),
    onSuccess: () => { queryClient.clear(); setLocation("/"); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Cambio de plan (sistemas) ────────────────────────────────────────────────
  const changePlanMutation = useMutation({
    mutationFn: ({ businessId, planSlug }: { businessId: string; planSlug: string }) =>
      apiRequest("PATCH", `/api/admin/businesses/${businessId}/plan`, { planSlug }),
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Plan actualizado" });
      setPlanChangeTarget(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (user?.role !== "sistemas") {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card><CardContent className="py-8 text-center text-muted-foreground">Sin acceso.</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 md:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Gestión de negocios</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalNegocios} {totalNegocios === 1 ? "negocio" : "negocios"} · {totalSucursalesActivas} sucursales activas
          </p>
        </div>
        <Button onClick={openBizCreate} data-testid="button-add-business">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo negocio
        </Button>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total negocios", value: totalNegocios },
          { label: "Plan Free",    value: countFree },
          { label: "Plan Starter", value: countStarter },
          { label: "Plan Pro",     value: countPro },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="py-4 px-5">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold mt-1">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Business list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Card key={i} className="animate-pulse"><CardContent className="h-20" /></Card>)}
        </div>
      ) : businesses.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No hay negocios registrados</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {businesses.map(biz => {
            const cfg = planConfig[biz.plan] ?? planConfig.free;
            const isOpen = expanded.has(biz.id);

            return (
              <Card key={biz.id} data-testid={`card-business-${biz.id}`}>
                {/* Business header row */}
                <CardContent className="py-0 px-0">
                  <div
                    className="flex items-center gap-4 px-5 py-4 cursor-pointer hover-elevate rounded-md"
                    onClick={() => toggleExpand(biz.id)}
                    data-testid={`button-toggle-business-${biz.id}`}
                  >
                    {/* Avatar */}
                    <div className={`h-9 w-9 rounded-md flex items-center justify-center text-sm font-semibold shrink-0 ${cfg.avatarBg}`}>
                      {getInitials(biz.razonSocial)}
                    </div>

                    {/* Name + subtitle */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{biz.razonSocial}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[biz.cuit && `CUIT: ${biz.cuit}`, biz.mail].filter(Boolean).join(" · ")}
                      </p>
                    </div>

                    {/* Badges */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={biz.isActive ? "default" : "secondary"} className="text-xs">
                        {biz.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                      <Badge variant={cfg.badge as any} className="text-xs">{cfg.label}</Badge>
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        {biz.branches.length} {biz.branches.length === 1 ? "sucursal" : "sucursales"}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                      <Select
                        value={biz.plan}
                        onValueChange={(newPlan) => {
                          if (newPlan !== biz.plan) {
                            setPlanChangeTarget({ businessId: biz.id, businessName: biz.razonSocial, newPlan });
                          }
                        }}
                      >
                        <SelectTrigger className="h-7 text-xs w-24" data-testid={`select-plan-${biz.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">Free</SelectItem>
                          <SelectItem value="starter">Starter</SelectItem>
                          <SelectItem value="pro">Pro</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="ghost" onClick={() => openBizEdit(biz)} data-testid={`button-edit-business-${biz.id}`}>
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => viewAsMutation.mutate(biz.id)}
                        disabled={viewAsMutation.isPending}
                        data-testid={`button-view-as-${biz.id}`}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        Ver como
                      </Button>
                    </div>

                    {/* Chevron */}
                    {isOpen
                      ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    }
                  </div>

                  {/* Expanded branches */}
                  {isOpen && (
                    <div className="border-t mx-5 pb-3">
                      {biz.branches.length === 0 && (
                        <p className="text-sm text-muted-foreground py-3 pl-1">Sin sucursales</p>
                      )}
                      {biz.branches.map(br => (
                        <div key={br.id} className="flex items-center gap-3 py-2.5 pl-1 pr-0" data-testid={`branch-row-${br.id}`}>
                          <div className={`h-2 w-2 rounded-full shrink-0 ${br.isActive ? "bg-green-500" : "bg-muted-foreground"}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">Sucursal {br.number} · {br.name}</p>
                            <p className={`text-xs ${br.isActive ? "text-muted-foreground" : "text-muted-foreground/60"} flex items-center gap-1`}>
                              <MapPin className="h-3 w-3 shrink-0" />
                              {br.isActive ? br.address : "Inactiva"}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button size="sm" variant="ghost" onClick={() => openBranchEdit(br, biz.id)} data-testid={`button-edit-branch-${br.id}`}>
                              <Pencil className="h-3.5 w-3.5 mr-1" />
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleBranchMutation.mutate({ id: br.id, isActive: !br.isActive })}
                              data-testid={`button-toggle-branch-${br.id}`}
                            >
                              {br.isActive
                                ? <><ToggleLeft className="h-3.5 w-3.5 mr-1" />Desactivar</>
                                : <><ToggleRight className="h-3.5 w-3.5 mr-1" />Activar</>
                              }
                            </Button>
                          </div>
                        </div>
                      ))}

                      {/* Add branch row */}
                      <button
                        className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 mt-1 pl-1 hover:underline"
                        onClick={() => openBranchCreate(biz.id)}
                        data-testid={`button-add-branch-${biz.id}`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Agregar sucursal
                      </button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Business Dialog */}
      <Dialog open={bizDialog.open} onOpenChange={open => { if (!open) { setBizDialog({ open: false, editing: null }); bizForm.reset(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{bizDialog.editing ? "Editar negocio" : "Nuevo negocio"}</DialogTitle>
          </DialogHeader>
          <Form {...bizForm}>
            <form onSubmit={bizForm.handleSubmit(submitBiz)} className="space-y-4">
              <FormField control={bizForm.control} name="razonSocial" render={({ field }) => (
                <FormItem><FormLabel>Razón Social *</FormLabel>
                  <FormControl><Input placeholder="Nombre del negocio" {...field} data-testid="input-razon-social" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={bizForm.control} name="plan" render={({ field }) => (
                <FormItem><FormLabel>Plan</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger data-testid="select-plan"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={bizForm.control} name="cuit" render={({ field }) => (
                <FormItem><FormLabel>CUIT (opcional)</FormLabel>
                  <FormControl><Input placeholder="20-12345678-9" {...field} value={field.value || ""} data-testid="input-cuit" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={bizForm.control} name="encargado" render={({ field }) => (
                <FormItem><FormLabel>Encargado (opcional)</FormLabel>
                  <FormControl><Input placeholder="Nombre del encargado" {...field} value={field.value || ""} data-testid="input-encargado" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={bizForm.control} name="telefono" render={({ field }) => (
                <FormItem><FormLabel>Teléfono (opcional)</FormLabel>
                  <FormControl><Input placeholder="+54 11 2345-6789" {...field} value={field.value || ""} data-testid="input-telefono" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={bizForm.control} name="mail" render={({ field }) => (
                <FormItem><FormLabel>Email (opcional)</FormLabel>
                  <FormControl><Input type="email" placeholder="contacto@negocio.com" {...field} value={field.value || ""} data-testid="input-mail" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={bizForm.control} name="isActive" render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-md border p-3">
                  <div><FormLabel className="text-base">Activo</FormLabel>
                    <p className="text-xs text-muted-foreground">Si está desactivado no se puede seleccionar</p>
                  </div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-business-active" /></FormControl>
                </FormItem>
              )} />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => { setBizDialog({ open: false, editing: null }); bizForm.reset(); }}>Cancelar</Button>
                <Button type="submit" disabled={createBizMutation.isPending || updateBizMutation.isPending} data-testid="button-save-business">
                  {createBizMutation.isPending || updateBizMutation.isPending ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Branch Dialog */}
      <Dialog open={branchDialog.open} onOpenChange={open => { if (!open) { setBranchDialog({ open: false, businessId: "", editing: null }); branchForm.reset(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{branchDialog.editing ? "Editar sucursal" : "Nueva sucursal"}</DialogTitle>
          </DialogHeader>
          <Form {...branchForm}>
            <form onSubmit={branchForm.handleSubmit(submitBranch)} className="space-y-4">
              <FormField control={branchForm.control} name="number" render={({ field }) => (
                <FormItem><FormLabel>Número *</FormLabel>
                  <FormControl><Input type="number" min={1} {...field} data-testid="input-branch-number" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={branchForm.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Nombre *</FormLabel>
                  <FormControl><Input placeholder="Ej: Centro" {...field} data-testid="input-branch-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={branchForm.control} name="address" render={({ field }) => (
                <FormItem><FormLabel>Dirección *</FormLabel>
                  <FormControl><Input placeholder="Av. Corrientes 1234" {...field} data-testid="input-branch-address" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={branchForm.control} name="isActive" render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-md border p-3">
                  <div><FormLabel className="text-base">Activa</FormLabel></div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-branch-active" /></FormControl>
                </FormItem>
              )} />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => { setBranchDialog({ open: false, businessId: "", editing: null }); branchForm.reset(); }}>Cancelar</Button>
                <Button type="submit" disabled={createBranchMutation.isPending || updateBranchMutation.isPending} data-testid="button-save-branch">
                  {createBranchMutation.isPending || updateBranchMutation.isPending ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Plan change AlertDialog for sistemas */}
      <AlertDialog open={!!planChangeTarget} onOpenChange={open => { if (!open) setPlanChangeTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cambiar plan</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Cambiar el plan de <strong>{planChangeTarget?.businessName}</strong> a <strong>{planChangeTarget?.newPlan}</strong>? Este cambio es inmediato y no genera cobro al cliente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => planChangeTarget && changePlanMutation.mutate({ businessId: planChangeTarget.businessId, planSlug: planChangeTarget.newPlan })}
              disabled={changePlanMutation.isPending}
              data-testid="button-confirm-plan-change"
            >
              {changePlanMutation.isPending ? "Guardando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
