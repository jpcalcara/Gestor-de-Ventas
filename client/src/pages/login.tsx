import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Package } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { loginSchema } from "@shared/schema";
import { z } from "zod";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { CompanySettings } from "@shared/schema";

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login, loginWithGoogle } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: companySettings } = useQuery<CompanySettings>({
    queryKey: ["/api/company-settings"],
  });

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login(data.email, data.password);
      toast({
        title: "Bienvenido",
        description: "Has iniciado sesión correctamente",
      });
    } catch (error: any) {
      toast({
        title: "Error al iniciar sesión",
        description: error.message || "Email o contraseña incorrectos",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <div className="flex justify-center mb-2">
            {companySettings?.logoUrl ? (
              <img 
                src={companySettings.logoUrl} 
                alt={companySettings.companyName || "Logo"} 
                className="h-16 w-16 object-contain rounded-lg"
                data-testid="img-company-logo"
              />
            ) : (
              <div className="p-3 bg-primary/10 rounded-lg">
                <Package className="h-8 w-8 text-primary" />
              </div>
            )}
          </div>
          <CardTitle className="text-2xl font-semibold" data-testid="text-company-name">
            {companySettings?.companyName || "JOTA Sistemas"}
          </CardTitle>
          <CardDescription>
            Ingresa tus credenciales para acceder al sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={loginWithGoogle}
            data-testid="button-login-google"
          >
            <SiGoogle className="mr-2 h-4 w-4" />
            Continuar con Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                O continúa con email
              </span>
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="admin@inventory.com"
                        autoComplete="email"
                        data-testid="input-email"
                        {...field}
                      />
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
                    <FormLabel>Contraseña</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="******"
                        autoComplete="current-password"
                        data-testid="input-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full"
                disabled={form.formState.isSubmitting}
                data-testid="button-login"
              >
                {form.formState.isSubmitting ? "Iniciando sesión..." : "Iniciar sesión"}
              </Button>
            </form>
          </Form>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            <p>Credenciales por defecto:</p>
            <p className="font-mono text-xs mt-1">
              admin@inventory.com / admin123
            </p>
          </div>
        </CardContent>
      </Card>
      <p className="text-center text-sm text-muted-foreground mt-4">
        ¿No tenés cuenta?{" "}
        <button
          onClick={() => navigate("/register")}
          className="text-foreground underline underline-offset-2 hover:no-underline"
          data-testid="link-go-register"
        >
          Registrá tu negocio
        </button>
        {" · "}
        <button
          onClick={() => navigate("/pricing")}
          className="text-foreground underline underline-offset-2 hover:no-underline"
          data-testid="link-go-pricing"
        >
          Ver planes
        </button>
      </p>
    </div>
  );
}
