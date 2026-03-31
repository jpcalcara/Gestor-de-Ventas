import { useState, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Building2, User, CreditCard, Check } from "lucide-react";

interface CuitInputProps {
  value?: string;
  onChange: (val: string) => void;
}

function CuitInput({ value = "", onChange }: CuitInputProps) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  const part1 = digits.slice(0, 2);
  const part2 = digits.slice(2, 10);
  const part3 = digits.slice(10, 11);

  const ref2 = useRef<HTMLInputElement>(null);
  const ref3 = useRef<HTMLInputElement>(null);
  const ref1 = useRef<HTMLInputElement>(null);

  const build = (p1: string, p2: string, p3: string) =>
    (p1 + p2 + p3).replace(/\D/g, "");

  const handlePart1 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, 2);
    onChange(build(v, part2, part3));
    if (v.length === 2) ref2.current?.focus();
  };

  const handlePart2 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, 8);
    onChange(build(part1, v, part3));
    if (v.length === 8) ref3.current?.focus();
  };

  const handlePart3 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, 1);
    onChange(build(part1, part2, v));
  };

  const handleKeyDown2 = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && part2 === "") ref1.current?.focus();
  };

  const handleKeyDown3 = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && part3 === "") ref2.current?.focus();
  };

  return (
    <div className="flex items-center gap-1.5" data-testid="input-cuit-group">
      <input
        ref={ref1}
        type="text"
        inputMode="numeric"
        maxLength={2}
        value={part1}
        onChange={handlePart1}
        placeholder="20"
        data-testid="input-cuit-part1"
        className="w-12 h-9 rounded-md border border-input bg-background px-2 text-sm text-center ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      />
      <span className="text-muted-foreground font-medium select-none">-</span>
      <input
        ref={ref2}
        type="text"
        inputMode="numeric"
        maxLength={8}
        value={part2}
        onChange={handlePart2}
        onKeyDown={handleKeyDown2}
        placeholder="12345678"
        data-testid="input-cuit-part2"
        className="w-28 h-9 rounded-md border border-input bg-background px-2 text-sm text-center ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      />
      <span className="text-muted-foreground font-medium select-none">-</span>
      <input
        ref={ref3}
        type="text"
        inputMode="numeric"
        maxLength={1}
        value={part3}
        onChange={handlePart3}
        onKeyDown={handleKeyDown3}
        placeholder="9"
        data-testid="input-cuit-part3"
        className="w-9 h-9 rounded-md border border-input bg-background px-2 text-sm text-center ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      />
    </div>
  );
}

const step1Schema = z.object({
  razonSocial: z.string().min(2, "Requerido"),
  cuit: z.string().optional(),
  encargado: z.string().optional(),
  telefono: z.string().optional(),
  mail: z.string().email("Email inválido").optional().or(z.literal("")),
});

const step2Schema = z.object({
  firstName: z.string().min(1, "Requerido"),
  lastName: z.string().min(1, "Requerido"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
  confirmPassword: z.string().min(1, "Requerido"),
}).refine(data => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

const step3Schema = z.object({
  planSlug: z.string().min(1, "Seleccioná un plan"),
});

type Step1 = z.infer<typeof step1Schema>;
type Step2 = z.infer<typeof step2Schema>;
type Step3 = z.infer<typeof step3Schema>;

interface Plan {
  id: string;
  name: string;
  slug: string;
  price: string;
  description: string | null;
}

const STEPS = [
  { label: "Negocio", icon: Building2 },
  { label: "Cuenta", icon: User },
  { label: "Plan", icon: CreditCard },
];

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [step1Data, setStep1Data] = useState<Step1 | null>(null);
  const [step2Data, setStep2Data] = useState<Step2 | null>(null);
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const preselectedPlan = params.get("plan") || "";
  const { toast } = useToast();

  const { data: plans } = useQuery<Plan[]>({
    queryKey: ["/api/plans"],
  });
  const activePlans = plans?.filter(p => p.isActive !== false) ?? [];

  const form1 = useForm<Step1>({ resolver: zodResolver(step1Schema), defaultValues: { razonSocial: "", cuit: "", encargado: "", telefono: "", mail: "" } });
  const form2 = useForm<Step2>({ resolver: zodResolver(step2Schema), defaultValues: { firstName: "", lastName: "", email: "", password: "", confirmPassword: "" } });
  const form3 = useForm<Step3>({ resolver: zodResolver(step3Schema), defaultValues: { planSlug: preselectedPlan } });

  const registerMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/auth/register-business", data),
    onSuccess: (data: any) => {
      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else if (data?.redirect) {
        window.location.href = data.redirect;
      } else {
        navigate("/login");
      }
    },
    onError: (err: any) => {
      const msg = err?.message || "Error al registrarse";
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const handleStep1 = (data: Step1) => { setStep1Data(data); setStep(2); };
  const handleStep2 = (data: Step2) => { setStep2Data(data); setStep(3); };
  const handleStep3 = (data: Step3) => {
    if (!step1Data || !step2Data) return;
    registerMutation.mutate({ ...step1Data, ...step2Data, planSlug: data.planSlug });
  };

  const formatPrice = (price: string) => {
    const num = parseFloat(price);
    if (num === 0) return "Gratis";
    return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(num) + "/mes";
  };

  return (
    <div className="min-h-screen bg-background flex items-start justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold mb-1">Crear cuenta</h1>
          <p className="text-sm text-muted-foreground">Completá los pasos para registrar tu negocio</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => {
            const num = i + 1;
            const active = step === num;
            const done = step > num;
            return (
              <div key={num} className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 text-sm font-medium ${active ? "text-foreground" : done ? "text-foreground" : "text-muted-foreground"}`}>
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs ${active ? "bg-primary text-primary-foreground" : done ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {done ? <Check className="h-3 w-3" /> : num}
                  </div>
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && <div className="h-px w-8 bg-border" />}
              </div>
            );
          })}
        </div>

        <Card>
          <CardHeader className="pb-4">
            <h2 className="font-semibold text-base">{STEPS[step - 1].label}</h2>
          </CardHeader>
          <CardContent>
            {step === 1 && (
              <Form {...form1}>
                <form onSubmit={form1.handleSubmit(handleStep1)} className="space-y-4">
                  <FormField control={form1.control} name="razonSocial" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Razón social *</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-razon-social" placeholder="Mi Empresa S.A." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="flex flex-wrap gap-3">
                    <FormField control={form1.control} name="cuit" render={({ field }) => (
                      <FormItem className="shrink-0">
                        <FormLabel>CUIT</FormLabel>
                        <FormControl>
                          <CuitInput value={field.value ?? ""} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form1.control} name="encargado" render={({ field }) => (
                      <FormItem className="flex-1 min-w-32">
                        <FormLabel>Encargado</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-encargado" placeholder="Nombre del encargado" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form1.control} name="telefono" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teléfono</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-telefono" placeholder="+54 9 11..." />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form1.control} name="mail" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email del negocio</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-mail-negocio" placeholder="info@empresa.com" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button type="submit" data-testid="button-step1-next">
                      Siguiente <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </form>
              </Form>
            )}

            {step === 2 && (
              <Form {...form2}>
                <form onSubmit={form2.handleSubmit(handleStep2)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form2.control} name="firstName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre *</FormLabel>
                        <FormControl><Input {...field} data-testid="input-first-name" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form2.control} name="lastName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Apellido *</FormLabel>
                        <FormControl><Input {...field} data-testid="input-last-name" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form2.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email *</FormLabel>
                      <FormControl><Input {...field} type="email" data-testid="input-email" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form2.control} name="password" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contraseña *</FormLabel>
                      <FormControl><Input {...field} type="password" data-testid="input-password" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form2.control} name="confirmPassword" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmar contraseña *</FormLabel>
                      <FormControl><Input {...field} type="password" data-testid="input-confirm-password" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="flex justify-between pt-2">
                    <Button type="button" variant="outline" onClick={() => setStep(1)} data-testid="button-step2-back">
                      <ArrowLeft className="h-4 w-4 mr-1" /> Atrás
                    </Button>
                    <Button type="submit" data-testid="button-step2-next">
                      Siguiente <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </form>
              </Form>
            )}

            {step === 3 && (
              <Form {...form3}>
                <form onSubmit={form3.handleSubmit(handleStep3)} className="space-y-4">
                  <FormField control={form3.control} name="planSlug" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plan *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-plan">
                            <SelectValue placeholder="Seleccioná un plan" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {activePlans.map(plan => (
                            <SelectItem key={plan.id} value={plan.slug} data-testid={`option-plan-${plan.slug}`}>
                              {plan.name} — {formatPrice(plan.price)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <p className="text-xs text-muted-foreground">
                    Al registrarte aceptás los términos y condiciones del servicio.
                  </p>
                  <div className="flex justify-between pt-2">
                    <Button type="button" variant="outline" onClick={() => setStep(2)} data-testid="button-step3-back">
                      <ArrowLeft className="h-4 w-4 mr-1" /> Atrás
                    </Button>
                    <Button type="submit" disabled={registerMutation.isPending} data-testid="button-step3-submit">
                      {registerMutation.isPending ? "Creando cuenta..." : "Crear cuenta"}
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-4">
          ¿Ya tenés una cuenta?{" "}
          <button onClick={() => navigate("/login")} className="text-foreground underline underline-offset-2 hover:no-underline" data-testid="link-go-login">
            Iniciá sesión
          </button>
        </p>
      </div>
    </div>
  );
}
