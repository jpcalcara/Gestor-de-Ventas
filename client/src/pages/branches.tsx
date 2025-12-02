import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, MapPin, Building2, Hash, User } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface UserData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface BranchData {
  id: string;
  number: number;
  name: string;
  address: string;
  adminUserId: string | null;
  adminUser?: UserData;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

const branchFormSchema = z.object({
  number: z.coerce.number().min(1, "El número es requerido"),
  name: z.string().min(1, "El nombre es requerido"),
  address: z.string().min(1, "El domicilio es requerido"),
  adminUserId: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
});

type BranchFormValues = z.infer<typeof branchFormSchema>;

export default function BranchesPage() {
  const { isAdmin, user } = useAuth();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchData | null>(null);
  const [deletingBranch, setDeletingBranch] = useState<BranchData | null>(null);

  const { data: branches = [], isLoading } = useQuery<BranchData[]>({
    queryKey: ["/api/branches"],
    enabled: isAdmin,
  });

  const { data: adminUsers = [] } = useQuery<UserData[]>({
    queryKey: ["/api/users", "admins"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Error al cargar usuarios");
      const users: UserData[] = await res.json();
      return users.filter(u => u.role === "admin");
    },
    enabled: isAdmin && user?.role === "sistemas",
  });

  const form = useForm<BranchFormValues>({
    resolver: zodResolver(branchFormSchema),
    defaultValues: {
      number: 1,
      name: "",
      address: "",
      adminUserId: null,
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: BranchFormValues) => {
      return await apiRequest("POST", "/api/branches", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
      toast({ title: "Sucursal creada correctamente" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<BranchFormValues> }) => {
      return await apiRequest("PATCH", `/api/branches/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
      toast({ title: "Sucursal actualizada correctamente" });
      setEditingBranch(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/branches/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
      toast({ title: "Sucursal eliminada correctamente" });
      setDeletingBranch(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (data: BranchFormValues) => {
    if (editingBranch) {
      updateMutation.mutate({ id: editingBranch.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEditDialog = (branch: BranchData) => {
    setEditingBranch(branch);
    form.reset({
      number: branch.number,
      name: branch.name,
      address: branch.address,
      adminUserId: branch.adminUserId,
      isActive: branch.isActive,
    });
  };

  const openCreateDialog = () => {
    setEditingBranch(null);
    const nextNumber = branches.length > 0 
      ? Math.max(...branches.map(b => b.number)) + 1 
      : 1;
    form.reset({
      number: nextNumber,
      name: "",
      address: "",
      adminUserId: null,
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
          <h1 className="text-2xl font-semibold">Gestión de Sucursales</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Administra las sucursales del sistema
          </p>
        </div>
        <Dialog open={isDialogOpen || !!editingBranch} onOpenChange={(open) => {
          if (!open) {
            setIsDialogOpen(false);
            setEditingBranch(null);
            form.reset();
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} data-testid="button-add-branch">
              <Plus className="h-4 w-4 mr-2" />
              Nueva Sucursal
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingBranch ? "Editar Sucursal" : "Crear Nueva Sucursal"}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número de Sucursal</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="1"
                          {...field}
                          data-testid="input-branch-number"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Sucursal Central"
                          {...field}
                          data-testid="input-branch-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Domicilio</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Av. Siempreviva 123, Ciudad"
                          {...field}
                          data-testid="input-branch-address"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {user?.role === "sistemas" && (
                  <FormField
                    control={form.control}
                    name="adminUserId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Administrador del Negocio</FormLabel>
                        <Select
                          value={field.value || "none"}
                          onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-admin-user">
                              <SelectValue placeholder="Seleccionar administrador (opcional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Sin administrador asignado</SelectItem>
                            {adminUsers.map((adminUser) => (
                              <SelectItem key={adminUser.id} value={adminUser.id}>
                                {adminUser.firstName} {adminUser.lastName} ({adminUser.email})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Asocia esta sucursal a un usuario administrador para identificar el negocio
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <FormLabel className="text-base">Sucursal Activa</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Si está desactivada, no se podrá seleccionar
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-branch-active"
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
                      setEditingBranch(null);
                      form.reset();
                    }}
                    data-testid="button-cancel-branch"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-save-branch"
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
      ) : branches.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No hay sucursales</h3>
            <p className="text-muted-foreground mb-4">
              Crea tu primera sucursal para comenzar a operar
            </p>
            <Button onClick={openCreateDialog} data-testid="button-add-first-branch">
              <Plus className="h-4 w-4 mr-2" />
              Crear Sucursal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {branches.map((branch) => (
            <Card 
              key={branch.id} 
              className="hover-elevate"
              data-testid={`card-branch-${branch.id}`}
            >
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
                    <Hash className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-medium">
                      Sucursal {branch.number}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{branch.name}</p>
                  </div>
                </div>
                <Badge variant={branch.isActive ? "default" : "secondary"}>
                  {branch.isActive ? "Activa" : "Inactiva"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <span className="text-muted-foreground">{branch.address}</span>
                </div>
                {branch.adminUser && (
                  <div className="flex items-start gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <span className="text-muted-foreground">
                      Admin: {branch.adminUser.firstName} {branch.adminUser.lastName}
                    </span>
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEditDialog(branch)}
                    data-testid={`button-edit-branch-${branch.id}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeletingBranch(branch)}
                    data-testid={`button-delete-branch-${branch.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deletingBranch} onOpenChange={(open) => !open && setDeletingBranch(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar sucursal?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará la sucursal
              "{deletingBranch?.name}" (Nº {deletingBranch?.number}) y toda la información asociada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-branch">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingBranch && deleteMutation.mutate(deletingBranch.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-branch"
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
