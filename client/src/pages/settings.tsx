import { useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Building2, Upload, Save, Image as ImageIcon, CheckCircle2, AlertCircle, LinkIcon, Unlink } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";
import type { CompanySettings } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { SiMercadopago } from "react-icons/si";

const companyNameSchema = z.object({
  companyName: z.string().min(1, "El nombre de la empresa es requerido"),
});

type CompanyNameFormData = z.infer<typeof companyNameSchema>;

interface MPStatus {
  connected: boolean;
  mpUserId: string | null;
  connectedAt: string | null;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);

  const { data: settings, isLoading } = useQuery<CompanySettings>({
    queryKey: ["/api/company-settings"],
  });

  const { data: mpStatus, refetch: refetchMPStatus } = useQuery<MPStatus>({
    queryKey: ["/api/mercadopago/status"],
    enabled: isAdmin,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mp = params.get("mp");
    if (mp === "connected") {
      toast({ title: "MercadoPago conectado exitosamente" });
      refetchMPStatus();
    } else if (mp === "error") {
      toast({ title: "Error al conectar MercadoPago", variant: "destructive" });
    }
    if (mp) {
      params.delete("mp");
      const newUrl = window.location.pathname + (params.toString() ? `?${params.toString()}` : "");
      window.history.replaceState({}, "", newUrl);
    }
  }, []);

  const form = useForm<CompanyNameFormData>({
    resolver: zodResolver(companyNameSchema),
    defaultValues: { companyName: settings?.companyName || "JOTA Sistemas" },
    values: { companyName: settings?.companyName || "JOTA Sistemas" },
  });

  const updateNameMutation = useMutation({
    mutationFn: async (data: CompanyNameFormData) => apiRequest("PATCH", "/api/company-settings", data),
    onSuccess: () => {
      toast({ title: "Nombre actualizado", description: "El nombre de la empresa se ha actualizado correctamente" });
      queryClient.invalidateQueries({ queryKey: ["/api/company-settings"] });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("image", file);
      const response = await fetch("/api/upload/logo", { method: "POST", body: formData, credentials: "include" });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error al subir la imagen");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Logo actualizado", description: "El logo de la empresa se ha actualizado correctamente" });
      queryClient.invalidateQueries({ queryKey: ["/api/company-settings"] });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const connectMPMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", "/api/mercadopago/connect");
      return res as { authUrl: string };
    },
    onSuccess: (data) => {
      window.location.href = data.authUrl;
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const disconnectMPMutation = useMutation({
    mutationFn: async () => apiRequest("DELETE", "/api/mercadopago/disconnect"),
    onSuccess: () => {
      toast({ title: "MercadoPago desconectado" });
      setDisconnectDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/mercadopago/status"] });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) uploadLogoMutation.mutate(file);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 md:px-8 py-6 md:py-8">
        <div className="text-muted-foreground">Cargando configuración...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">Configuración</h1>
        <p className="text-sm text-muted-foreground mt-1">Configura el nombre, logo y cobros de tu empresa</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Nombre de la Empresa
            </CardTitle>
            <CardDescription>Este nombre aparecerá en el login y en la navegación</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((d) => updateNameMutation.mutate(d))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input placeholder="JOTA Sistemas" data-testid="input-company-name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={updateNameMutation.isPending} data-testid="button-save-name">
                  <Save className="h-4 w-4 mr-2" />
                  {updateNameMutation.isPending ? "Guardando..." : "Guardar nombre"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Logo de la Empresa
            </CardTitle>
            <CardDescription>Este logo aparecerá en el login y en la navegación</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              data-testid="input-logo-file"
            />
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-lg border flex items-center justify-center bg-muted overflow-hidden">
                {settings?.logoUrl ? (
                  <img src={settings.logoUrl} alt="Logo actual" className="h-full w-full object-contain" data-testid="img-current-logo" />
                ) : (
                  <Building2 className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{settings?.logoUrl ? "Logo actual" : "Sin logo configurado"}</p>
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploadLogoMutation.isPending} data-testid="button-upload-logo">
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadLogoMutation.isPending ? "Subiendo..." : "Subir logo"}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Formatos permitidos: JPEG, PNG, GIF, WebP. Tamaño máximo: 5MB.</p>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SiMercadopago className="h-5 w-5 text-[#009EE3]" />
                MercadoPago
              </CardTitle>
              <CardDescription>
                Conectá tu cuenta de MercadoPago para cobrar con débito, crédito y QR
              </CardDescription>
            </CardHeader>
            <CardContent>
              {mpStatus?.connected ? (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-sm">Cuenta conectada</p>
                      {mpStatus.mpUserId && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          ID de cuenta: {mpStatus.mpUserId}
                        </p>
                      )}
                      {mpStatus.connectedAt && (
                        <p className="text-xs text-muted-foreground">
                          Conectado el {new Date(mpStatus.connectedAt).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setDisconnectDialogOpen(true)}
                    data-testid="button-disconnect-mp"
                  >
                    <Unlink className="h-4 w-4 mr-2" />
                    Desconectar
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-sm">No conectado</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Conectá tu cuenta para habilitar pagos con débito, crédito y QR
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => connectMPMutation.mutate()}
                    disabled={connectMPMutation.isPending}
                    data-testid="button-connect-mp"
                  >
                    <LinkIcon className="h-4 w-4 mr-2" />
                    {connectMPMutation.isPending ? "Redirigiendo..." : "Conectar MercadoPago"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desconectar MercadoPago</DialogTitle>
            <DialogDescription>
              Al desconectar, los vendedores ya no podrán cobrar con débito, crédito ni QR hasta que vuelvas a conectar la cuenta.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisconnectDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => disconnectMPMutation.mutate()}
              disabled={disconnectMPMutation.isPending}
              data-testid="button-confirm-disconnect-mp"
            >
              {disconnectMPMutation.isPending ? "Desconectando..." : "Desconectar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
