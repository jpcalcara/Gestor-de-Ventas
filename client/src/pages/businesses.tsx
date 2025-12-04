import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, Mail, Phone } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface BusinessData {
  id: string;
  razonSocial: string;
  cuit?: string;
  encargado?: string;
  telefono?: string;
  mail?: string;
  isActive: boolean;
  createdAt: string;
}

const businessFormSchema = z.object({
  razonSocial: z.string().min(1, "La razón social es requerida"),
  cuit: z.string().optional().or(z.literal("")).nullable(),
  encargado: z.string().optional().or(z.literal("")).nullable(),
  telefono: z.string().optional().or(z.literal("")).nullable(),
  mail: z.string().email("Email inválido").optional().or(z.literal("")).nullable(),
  isActive: z.boolean().default(true),
});

type BusinessFormValues = z.infer<typeof businessFormSchema>;

export default function BusinessesPage() {
  const { isAdmin, user } = useAuth();
  const { toast } = useToast();
  const isSistemas = user?.role === "sistemas";
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<BusinessData | null>(null);
  const [deletingBusiness, setDeletingBusiness] = useState<BusinessData | null>(null);

  const { data: businesses = [], isLoading } = useQuery<BusinessData[]>({
    queryKey: ["/api/businesses"],
    enabled: isAdmin,
  });

  const form = useForm<BusinessFormValues>({
    resolver: zodResolver(businessFormSchema),
    defaultValues: {
      razonSocial: "",
      cuit: null,
      encargado: null,
      telefono: null,
      mail: null,
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: BusinessFormValues) => {
      return await apiRequest("POST", "/api/businesses", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/businesses"] });
      toast({ title: "Negocio creado correctamente" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<BusinessFormValues> }) => {
      return await apiRequest("PATCH", `/api/businesses/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/businesses"] });
      toast({ title: "Negocio actualizado correctamente" });
      setEditingBusiness(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/businesses/${id}`, { method: "DELETE", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error al eliminar");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/businesses"] });
      toast({ title: "Negocio eliminado correctamente" });
      setDeletingBusiness(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (data: BusinessFormValues) => {
    if (editingBusiness) {
      updateMutation.mutate({ id: editingBusiness.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEditDialog = (business: BusinessData) => {
    setEditingBusiness(business);
    form.reset({
      razonSocial: business.razonSocial,
      cuit: business.cuit || null,
      encargado: business.encargado || null,
      telefono: business.telefono || null,
      mail: business.mail || null,
      isActive: business.isActive,
    });
  };

  const openCreateDialog = () => {
    setEditingBusiness(null);
    form.reset({
      razonSocial: "",
      cuit: null,
      encargado: null,
      telefono: null,
      mail: null,
      isActive: true,
    });
    setIsDialogOpen(true);
  };

  if (!isAdmin) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No tienes permiso para ver esta página.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 md:px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Gestión de Negocios</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Administra los negocios del sistema
          </p>
        </div>
        <Dialog open={isDialogOpen || !!editingBusiness} onOpenChange={(open) => {
          if (!open) {
            setIsDialogOpen(false);
            setEditingBusiness(null);
            form.reset();
          }
        }}>
          {isSistemas && (
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog} data-testid="button-add-business">
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Negocio
              </Button>
            </DialogTrigger>
          )}
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingBusiness ? "Editar Negocio" : "Crear Nuevo Negocio"}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="razonSocial"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Razón Social *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Nombre del negocio"
                          {...field}
                          data-testid="input-razon-social"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cuit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CUIT (opcional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="20-12345678-9"
                          {...field}
                          value={field.value || ""}
                          data-testid="input-cuit"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="encargado"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Encargado (opcional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Nombre del encargado"
                          {...field}
                          value={field.value || ""}
                          data-testid="input-encargado"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="telefono"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono (opcional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="+54 11 2345-6789"
                          {...field}
                          value={field.value || ""}
                          data-testid="input-telefono"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="mail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email (opcional)</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="contacto@negocio.com"
                          {...field}
                          value={field.value || ""}
                          data-testid="input-mail"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <FormLabel className="text-base">Negocio Activo</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Si está desactivado, no se podrá seleccionar
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-business-active"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      setEditingBusiness(null);
                      form.reset();
                    }}
                    data-testid="button-cancel-business"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-save-business"
                  >
                    {createMutation.isPending || updateMutation.isPending ? "Guardando..." : "Guardar"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-32" />
            </Card>
          ))}
        </div>
      ) : businesses.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No hay negocios registrados
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {businesses.map((business) => (
            <Card key={business.id} data-testid={`card-business-${business.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{business.razonSocial}</CardTitle>
                  </div>
                  {business.isActive && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                      Activo
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {business.cuit && (
                  <p className="text-sm text-muted-foreground">
                    <strong>CUIT:</strong> {business.cuit}
                  </p>
                )}
                {business.encargado && (
                  <p className="text-sm text-muted-foreground">
                    <strong>Encargado:</strong> {business.encargado}
                  </p>
                )}
                {business.telefono && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    {business.telefono}
                  </p>
                )}
                {business.mail && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    {business.mail}
                  </p>
                )}
                <div className="flex gap-2 pt-4">
                  {isSistemas && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditDialog(business)}
                        data-testid={`button-edit-business-${business.id}`}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeletingBusiness(business)}
                        data-testid={`button-delete-business-${business.id}`}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Eliminar
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deletingBusiness}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Negocio</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar "{deletingBusiness?.razonSocial}"? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingBusiness(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingBusiness && deleteMutation.mutate(deletingBusiness.id)}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
