import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, Phone, Mail, User, Power, Shield, ShieldCheck, UserCog, Building2, Send, Link2, X, Clock } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useFeatures } from "@/hooks/use-features";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
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
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface InvitationData {
  id: string;
  email: string;
  role: string;
  branchId?: string | null;
  businessId: string;
  token: string;
  usedAt?: string | null;
  expiresAt: string;
  createdAt: string;
}

const inviteFormSchema = z.object({
  email: z.string().email("Email inválido"),
  role: z.enum(["admin", "vendedor"]).default("vendedor"),
  branchId: z.string().optional(),
});

interface UserData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  role: string;
  isActive: boolean;
  avatar?: string;
  profileImageUrl?: string | null;
  createdAt: string;
}

interface BranchData {
  id: string;
  number: number;
  name: string;
  isActive: boolean;
}

const roleLabels: Record<string, { label: string; icon: typeof Shield }> = {
  sistemas: { label: "Sistemas", icon: UserCog },
  admin: { label: "Administrador", icon: ShieldCheck },
  vendedor: { label: "Vendedor", icon: User },
};

const userFormSchema = z.object({
  email: z.string().email("Email inválido"),
  firstName: z.string().min(1, "El nombre es requerido"),
  lastName: z.string().min(1, "El apellido es requerido"),
  phone: z.string().optional(),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  isAdmin: z.boolean().default(false),
});

type UserFormValues = z.infer<typeof userFormSchema>;

export default function UsersPage() {
  const { isAdmin, user: currentUser } = useAuth();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserData | null>(null);
  const [assigningBranchesUser, setAssigningBranchesUser] = useState<UserData | null>(null);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const isSistemas = currentUser?.role === "sistemas";
  const { hasFeature } = useFeatures();

  const { data: users = [], isLoading } = useQuery<UserData[]>({
    queryKey: ["/api/users"],
    enabled: isAdmin,
  });

  const { data: allBranches = [] } = useQuery<BranchData[]>({
    queryKey: ["/api/branches"],
  });

  const { data: invitations = [] } = useQuery<InvitationData[]>({
    queryKey: ["/api/invitations"],
    enabled: isAdmin && !isSistemas,
  });

  const inviteForm = useForm<z.infer<typeof inviteFormSchema>>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: { email: "", role: "vendedor", branchId: undefined },
  });

  const createInvitationMutation = useMutation({
    mutationFn: async (data: z.infer<typeof inviteFormSchema>) => {
      return await apiRequest("POST", "/api/invitations", data);
    },
    onSuccess: () => {
      toast({ title: "Invitación creada", description: "El enlace de invitación ha sido generado" });
      queryClient.invalidateQueries({ queryKey: ["/api/invitations"] });
      inviteForm.reset({ email: "", role: "vendedor", branchId: undefined });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteInvitationMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/invitations/${id}`, undefined);
    },
    onSuccess: () => {
      toast({ title: "Invitación eliminada" });
      queryClient.invalidateQueries({ queryKey: ["/api/invitations"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    });
  };

  const { data: userBranchData } = useQuery<{ branchIds: string[] }>({
    queryKey: ["/api/users", assigningBranchesUser?.id, "branches"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${assigningBranchesUser?.id}/branches`, { credentials: "include" });
      if (!res.ok) throw new Error("Error al cargar sucursales del usuario");
      return res.json();
    },
    enabled: !!assigningBranchesUser,
  });

  useEffect(() => {
    if (userBranchData) {
      setSelectedBranchIds(userBranchData.branchIds || []);
    }
  }, [userBranchData]);

  const filteredUsers = users.filter((user) => {
    if (isSistemas) return true;
    return user.role !== "sistemas";
  });

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      phone: "",
      password: "",
      isAdmin: false,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: UserFormValues) => {
      return await apiRequest("POST", "/api/users", {
        ...data,
        role: data.isAdmin ? "admin" : "vendedor",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Usuario creado correctamente" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<UserFormValues> }) => {
      return await apiRequest("PATCH", `/api/users/${id}`, {
        ...data,
        role: data.isAdmin ? "admin" : "vendedor",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Usuario actualizado correctamente" });
      setEditingUser(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Usuario eliminado correctamente" });
      setDeletingUser(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return await apiRequest("PATCH", `/api/users/${id}`, { isActive });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ 
        title: variables.isActive ? "Usuario habilitado" : "Usuario deshabilitado",
        description: variables.isActive 
          ? "El usuario puede acceder al sistema" 
          : "El usuario ya no puede acceder al sistema"
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const assignBranchesMutation = useMutation({
    mutationFn: async ({ userId, branchIds }: { userId: string; branchIds: string[] }) => {
      return await apiRequest("PATCH", `/api/users/${userId}/branches`, { branchIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", assigningBranchesUser?.id, "branches"] });
      toast({ title: "Sucursales asignadas correctamente" });
      setAssigningBranchesUser(null);
      setSelectedBranchIds([]);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (data: UserFormValues) => {
    if (editingUser) {
      const updateData: any = {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        isAdmin: data.isAdmin,
      };
      if (data.password) {
        updateData.password = data.password;
      }
      updateMutation.mutate({ id: editingUser.id, data: updateData });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEditDialog = (user: UserData) => {
    setEditingUser(user);
    form.reset({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone || "",
      password: "",
      isAdmin: user.role === "admin",
    });
  };

  const openCreateDialog = () => {
    setEditingUser(null);
    form.reset({
      email: "",
      firstName: "",
      lastName: "",
      phone: "",
      password: "",
      isAdmin: false,
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
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Gestión de Usuarios</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Administra los usuarios del sistema
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isSistemas && hasFeature("usuarios_ilimitados") && (
            <Button variant="outline" onClick={() => setIsInviteDialogOpen(true)} data-testid="button-invite-user">
              <Send className="h-4 w-4 mr-2" />
              Invitar
            </Button>
          )}
          <Dialog open={isDialogOpen || !!editingUser} onOpenChange={(open) => {
            if (!open) {
              setIsDialogOpen(false);
              setEditingUser(null);
              form.reset();
            }
          }}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} data-testid="button-add-user">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Usuario
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingUser ? "Editar Usuario" : "Crear Nuevo Usuario"}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input placeholder="Juan" {...field} data-testid="input-firstName" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Apellido</FormLabel>
                      <FormControl>
                        <Input placeholder="Pérez" {...field} data-testid="input-lastName" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input 
                          type="email" 
                          placeholder="usuario@email.com" 
                          disabled={!!editingUser}
                          {...field} 
                          data-testid="input-email" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono (opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="+54 11 1234-5678" {...field} data-testid="input-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {editingUser ? "Nueva Contraseña (dejar vacío para mantener)" : "Contraseña"}
                      </FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="••••••" 
                          {...field} 
                          data-testid="input-password" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isAdmin"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-isAdmin"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Administrador</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          {field.value 
                            ? "Tendrá acceso completo al sistema" 
                            : "Solo podrá consultar productos y registrar ventas"}
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setIsDialogOpen(false);
                      setEditingUser(null);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-submit-user"
                  >
                    {editingUser ? "Guardar Cambios" : "Crear Usuario"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="text-muted-foreground">Cargando usuarios...</div>
        </div>
      ) : filteredUsers.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No hay usuarios registrados.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredUsers.map((user) => {
            const roleInfo = roleLabels[user.role] || roleLabels.vendedor;
            const RoleIcon = roleInfo.icon;
            const canToggleActive = isSistemas || (currentUser?.role === "admin" && user.role === "vendedor");
            const canEdit = isSistemas || user.role !== "sistemas";
            const canDelete = isSistemas || user.role !== "sistemas";
            const isCurrentUser = currentUser?.id === user.id;

            return (
              <Card 
                key={user.id} 
                data-testid={`card-user-${user.id}`}
                className={!user.isActive ? "opacity-60" : ""}
              >
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        user.role === "sistemas" 
                          ? "bg-purple-100 dark:bg-purple-900/30" 
                          : user.role === "admin" 
                            ? "bg-primary/10" 
                            : "bg-muted"
                      }`}>
                        <RoleIcon className={`h-5 w-5 ${
                          user.role === "sistemas" 
                            ? "text-purple-600 dark:text-purple-400" 
                            : user.role === "admin" 
                              ? "text-primary" 
                              : "text-muted-foreground"
                        }`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">
                            {user.firstName} {user.lastName}
                          </span>
                          <Badge variant={
                            user.role === "sistemas" 
                              ? "default" 
                              : user.role === "admin" 
                                ? "secondary" 
                                : "outline"
                          } className={user.role === "sistemas" ? "bg-purple-600 hover:bg-purple-700" : ""}>
                            {roleInfo.label}
                          </Badge>
                          {!user.isActive && (
                            <Badge variant="destructive">
                              Deshabilitado
                            </Badge>
                          )}
                          {isCurrentUser && (
                            <Badge variant="outline" className="text-xs">
                              Tú
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {user.email}
                          </span>
                          {user.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {user.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {canToggleActive && !isCurrentUser && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground hidden sm:inline">
                            {user.isActive ? "Activo" : "Inactivo"}
                          </span>
                          <Switch
                            checked={user.isActive}
                            onCheckedChange={(checked) => 
                              toggleActiveMutation.mutate({ id: user.id, isActive: checked })
                            }
                            disabled={toggleActiveMutation.isPending}
                            data-testid={`switch-active-user-${user.id}`}
                          />
                        </div>
                      )}
                      {isSistemas && user.role !== "sistemas" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setAssigningBranchesUser(user);
                            setSelectedBranchIds([]);
                          }}
                          title="Asignar sucursales"
                          data-testid={`button-assign-branches-${user.id}`}
                        >
                          <Building2 className="h-4 w-4" />
                        </Button>
                      )}
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(user)}
                          data-testid={`button-edit-user-${user.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && !isCurrentUser && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingUser(user)}
                          data-testid={`button-delete-user-${user.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deletingUser} onOpenChange={() => setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar a {deletingUser?.firstName} {deletingUser?.lastName}?
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingUser && deleteMutation.mutate(deletingUser.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog 
        open={!!assigningBranchesUser} 
        onOpenChange={(open) => {
          if (!open) {
            setAssigningBranchesUser(null);
            setSelectedBranchIds([]);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Asignar Sucursales a {assigningBranchesUser?.firstName} {assigningBranchesUser?.lastName}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Selecciona las sucursales a las que tendrá acceso este usuario:
            </p>
            {allBranches.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay sucursales disponibles. Crea una sucursal primero.
              </p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {allBranches.filter(b => b.isActive).map((branch) => (
                  <div 
                    key={branch.id} 
                    className="flex items-center gap-3 p-3 border rounded-lg hover-elevate cursor-pointer"
                    onClick={() => {
                      if (selectedBranchIds.includes(branch.id)) {
                        setSelectedBranchIds(prev => prev.filter(id => id !== branch.id));
                      } else {
                        setSelectedBranchIds(prev => [...prev, branch.id]);
                      }
                    }}
                  >
                    <Checkbox
                      checked={selectedBranchIds.includes(branch.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedBranchIds(prev => [...prev, branch.id]);
                        } else {
                          setSelectedBranchIds(prev => prev.filter(id => id !== branch.id));
                        }
                      }}
                      data-testid={`checkbox-branch-${branch.id}`}
                    />
                    <div className="flex-1">
                      <div className="font-medium">
                        Sucursal {branch.number} - {branch.name}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAssigningBranchesUser(null);
                setSelectedBranchIds([]);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (assigningBranchesUser) {
                  assignBranchesMutation.mutate({
                    userId: assigningBranchesUser.id,
                    branchIds: selectedBranchIds,
                  });
                }
              }}
              disabled={assignBranchesMutation.isPending}
              data-testid="button-save-branches"
            >
              {assignBranchesMutation.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite dialog */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Invitar Usuario</DialogTitle>
          </DialogHeader>
          <Form {...inviteForm}>
            <form onSubmit={inviteForm.handleSubmit((d) => createInvitationMutation.mutate(d))} className="space-y-4">
              <FormField
                control={inviteForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="usuario@email.com" {...field} data-testid="input-invite-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={inviteForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rol</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-invite-role">
                          <SelectValue placeholder="Seleccionar rol" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="vendedor">Vendedor</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={inviteForm.control}
                name="branchId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sucursal (opcional)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-invite-branch">
                          <SelectValue placeholder="Sin asignar a sucursal" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {allBranches.map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={createInvitationMutation.isPending} data-testid="button-create-invitation">
                {createInvitationMutation.isPending ? "Generando..." : "Generar Invitación"}
              </Button>
            </form>
          </Form>

          {invitations.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium mb-3">Invitaciones Pendientes</h3>
              <div className="space-y-2">
                {invitations.filter(i => !i.usedAt && new Date(i.expiresAt) > new Date()).map(inv => (
                  <div key={inv.id} className="flex items-center justify-between gap-2 p-2 rounded-md border text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{inv.email}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Expira {new Date(inv.expiresAt).toLocaleDateString("es-AR")}
                        {" · "}{inv.role}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => copyInviteLink(inv.token)}
                        title={copiedToken === inv.token ? "¡Copiado!" : "Copiar enlace"}
                        data-testid={`button-copy-invite-${inv.id}`}
                      >
                        <Link2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteInvitationMutation.mutate(inv.id)}
                        data-testid={`button-delete-invite-${inv.id}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
