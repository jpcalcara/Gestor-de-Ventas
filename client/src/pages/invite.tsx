import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Building2 } from "lucide-react";

interface InviteInfo {
  id: string;
  email: string;
  role: string;
  businessId: string;
  businessName: string;
  branchId?: string | null;
  expiresAt: string;
}

const acceptSchema = z.object({
  firstName: z.string().min(1, "El nombre es requerido"),
  lastName: z.string().min(1, "El apellido es requerido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

type AcceptFormValues = z.infer<typeof acceptSchema>;

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const { toast } = useToast();
  const [accepted, setAccepted] = useState(false);

  const { data: invite, isLoading, error } = useQuery<InviteInfo>({
    queryKey: ["/api/invitations/token", token],
    queryFn: async () => {
      const res = await fetch(`/api/invitations/token/${token}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error al cargar invitación");
      return data;
    },
    retry: false,
  });

  const form = useForm<AcceptFormValues>({
    resolver: zodResolver(acceptSchema),
    defaultValues: { firstName: "", lastName: "", password: "", confirmPassword: "" },
  });

  const acceptMutation = useMutation({
    mutationFn: async (data: AcceptFormValues) => {
      const res = await fetch(`/api/invitations/token/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ firstName: data.firstName, lastName: data.lastName, password: data.password }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Error al aceptar invitación");
      return result;
    },
    onSuccess: () => {
      setAccepted(true);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Cargando invitación...</div>
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="py-8 text-center">
            <p className="text-destructive font-medium">
              {(error as Error)?.message || "Invitación no válida o expirada"}
            </p>
            <Button variant="outline" className="mt-4" onClick={() => window.location.href = "/login"}>
              Ir al inicio de sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">¡Cuenta creada!</h2>
            <p className="text-muted-foreground mb-6">
              Tu cuenta ha sido creada exitosamente. Ya podés iniciar sesión.
            </p>
            <Button onClick={() => window.location.href = "/login"}>
              Iniciar Sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const roleLabel = invite.role === "admin" ? "Administrador" : "Vendedor";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
          </div>
          <CardTitle>Invitación a {invite.businessName}</CardTitle>
          <CardDescription>
            Fuiste invitado como <strong>{roleLabel}</strong> a {invite.businessName}.
            Completá tus datos para crear tu cuenta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-3 rounded-md bg-muted">
            <p className="text-sm text-muted-foreground">
              <strong>Email:</strong> {invite.email}
            </p>
          </div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(d => acceptMutation.mutate(d))} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
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
              </div>
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Mínimo 6 caracteres" {...field} data-testid="input-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar Contraseña</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Repetí la contraseña" {...field} data-testid="input-confirm-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={acceptMutation.isPending} data-testid="button-accept-invite">
                {acceptMutation.isPending ? "Creando cuenta..." : "Crear Cuenta"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
