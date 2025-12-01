import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, Phone, Mail, User } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

interface UserData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  role: string;
  avatar?: string;
  profileImageUrl?: string | null;
  createdAt: string;
}

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
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserData | null>(null);

  const { data: users = [], isLoading } = useQuery<UserData[]>({
    queryKey: ["/api/users"],
    enabled: isAdmin,
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Gestión de Usuarios</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Administra los usuarios del sistema
          </p>
        </div>
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

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="text-muted-foreground">Cargando usuarios...</div>
        </div>
      ) : users.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No hay usuarios registrados.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {users.map((user) => (
            <Card key={user.id} data-testid={`card-user-${user.id}`}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {user.firstName} {user.lastName}
                        </span>
                        <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                          {user.role === "admin" ? "Administrador" : "Vendedor"}
                        </Badge>
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
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(user)}
                      data-testid={`button-edit-user-${user.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingUser(user)}
                      data-testid={`button-delete-user-${user.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
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
    </div>
  );
}
