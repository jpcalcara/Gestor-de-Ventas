import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Minus, Trash2, ShoppingCart, CreditCard, Banknote, Smartphone, ArrowRightLeft, ChevronsUpDown, Check, Loader2, ExternalLink, Camera, RotateCcw, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatPrice, formatNumber } from "@/lib/format";
import { 
  type Product, 
  type CartItem, 
  type PaymentMethod,
  paymentMethodEnum,
  unitTypeEnum,
  type BranchStock,
} from "@shared/schema";

const paymentMethodLabels: Record<PaymentMethod, { label: string; icon: typeof CreditCard }> = {
  efectivo: { label: "Efectivo", icon: Banknote },
  debito: { label: "Débito", icon: CreditCard },
  credito: { label: "Crédito", icon: CreditCard },
  qr: { label: "QR", icon: Smartphone },
  transferencia: { label: "Transferencia", icon: ArrowRightLeft },
};

const unitTypeLabels: Record<string, string> = {
  unidad: "Unidad",
  gramos: "Gramos",
  litros: "Litros",
};

// ─── Payment Modal ────────────────────────────────────────────────────────────

interface MPStatus { connected: boolean; mpUserId: string | null; connectedAt: string | null; }

interface PrefData { preferenceId: string; initPoint: string; qrData?: string; }

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  paymentMethod: PaymentMethod;
  cart: CartItem[];
  cartTotal: number;
  branchId: string | null;
  createOrderAsync: (data: { paymentMethod: PaymentMethod; items: CartItem[] }) => Promise<any>;
  onSuccess: () => void;
}

function formatSeconds(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function PaymentModal({ open, onClose, paymentMethod, cart, cartTotal, branchId, createOrderAsync, onSuccess }: PaymentModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<"init" | "waiting" | "approved" | "rejected" | "error">("init");
  const [prefData, setPrefData] = useState<PrefData | null>(null);
  const [mpStatus, setMpStatus] = useState<MPStatus | null>(null);
  const [mpLoading, setMpLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Camera states (transferencia)
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const clearPolling = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) { stream.getTracks().forEach(t => t.stop()); setStream(null); }
    setCameraActive(false);
  }, [stream]);

  const resetModal = useCallback(() => {
    clearPolling();
    stopCamera();
    setStep("init");
    setPrefData(null);
    setMpStatus(null);
    setMpLoading(false);
    setTimeLeft(600);
    setCapturedImage(null);
    setFilePreview(null);
    setSelectedFile(null);
    setCameraError(false);
    setCameraActive(false);
    setSubmitting(false);
  }, [clearPolling, stopCamera]);

  useEffect(() => {
    if (!open) { resetModal(); return; }

    if (paymentMethod === "transferencia") return;

    setMpLoading(true);
    fetch("/api/mercadopago/status", { credentials: "include" })
      .then(r => r.json())
      .then((status: MPStatus) => {
        setMpStatus(status);
        setMpLoading(false);
        if (status.connected && (paymentMethod === "qr")) {
          createPreference();
        }
      })
      .catch(() => { setMpLoading(false); setCameraError(true); });
  }, [open, paymentMethod]);

  useEffect(() => { return () => { clearPolling(); stopCamera(); }; }, [clearPolling, stopCamera]);

  const createPreference = async () => {
    setMpLoading(true);
    try {
      const data = await apiRequest("POST", "/api/mercadopago/create-preference", {
        items: cart,
        paymentMethod,
      }) as PrefData;
      setPrefData(data);
      setStep("waiting");
      setMpLoading(false);
      startPolling(data.preferenceId);
      if (paymentMethod === "qr") startTimer();
    } catch (err: any) {
      setMpLoading(false);
      toast({ title: "Error al crear preferencia MP", description: err.message, variant: "destructive" });
    }
  };

  const startPolling = (preferenceId: string) => {
    clearPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/mercadopago/payment-status/${preferenceId}`, { credentials: "include" });
        const { status } = await res.json();
        if (status === "approved") {
          clearPolling();
          await createOrderAsync({ paymentMethod, items: cart });
          setStep("approved");
          onSuccess();
        } else if (status === "rejected") {
          clearPolling();
          setStep("rejected");
        }
      } catch { /* continue polling */ }
    }, 3000);
  };

  const startTimer = () => {
    clearInterval(timerRef.current!);
    setTimeLeft(600);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current!); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  const openMPCheckout = async () => {
    if (!prefData) {
      await createPreference();
      return;
    }
    window.open(prefData.initPoint, "_blank");
    startPolling(prefData.preferenceId);
    setStep("waiting");
  };

  // Camera
  const openCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setStream(s);
      setCameraActive(true);
      setCameraError(false);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = s; }, 100);
    } catch {
      setCameraError(true);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    setCapturedImage(dataUrl);
    stopCamera();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setFilePreview(url);
  };

  const confirmTransfer = async () => {
    if (!capturedImage && !selectedFile) return;
    setSubmitting(true);
    try {
      const orderData = await createOrderAsync({ paymentMethod, items: cart });
      const orderId = orderData?.id ?? orderData?.orderId;
      if (orderId) {
        const formData = new FormData();
        if (selectedFile) {
          formData.append("image", selectedFile);
        } else if (capturedImage) {
          const res = await fetch(capturedImage);
          const blob = await res.blob();
          formData.append("image", blob, "comprobante.jpg");
        }
        await fetch(`/api/sale-orders/${orderId}/transfer-voucher`, {
          method: "POST",
          body: formData,
          credentials: "include",
        });
      }
      setStep("approved");
      onSuccess();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => { resetModal(); onClose(); };

  const renderMPNotConnected = () => (
    <div className="flex flex-col items-center gap-3 py-4">
      <AlertCircle className="h-10 w-10 text-muted-foreground" />
      <p className="text-sm text-center text-muted-foreground">
        El negocio no tiene MercadoPago configurado. Contactá al administrador.
      </p>
      <Button variant="outline" onClick={handleClose}>Cerrar</Button>
    </div>
  );

  const renderDebitCredit = () => {
    if (mpLoading) return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    if (!mpStatus?.connected) return renderMPNotConnected();
    if (step === "approved") return renderApproved();
    if (step === "rejected") return (
      <div className="flex flex-col items-center gap-3 py-4">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="font-medium">Pago rechazado</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={() => { setStep("init"); setPrefData(null); }}>Reintentar</Button>
        </div>
      </div>
    );
    if (step === "waiting") return (
      <div className="flex flex-col items-center gap-4 py-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground text-center">Esperando confirmación de pago...</p>
        <p className="text-xs text-muted-foreground">La ventana de MercadoPago debería haberse abierto</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleClose}>Cancelar</Button>
          <Button size="sm" variant="outline" onClick={() => prefData && window.open(prefData.initPoint, "_blank")}>
            <ExternalLink className="h-4 w-4 mr-1" /> Volver a abrir
          </Button>
        </div>
      </div>
    );
    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <p className="text-3xl font-bold">{formatPrice(cartTotal)}</p>
        <p className="text-sm text-muted-foreground">Total a cobrar</p>
        {mpLoading ? (
          <Button disabled><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generando link...</Button>
        ) : (
          <Button onClick={openMPCheckout} className="w-full max-w-xs">
            <ExternalLink className="h-4 w-4 mr-2" /> Pagar con MercadoPago
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={handleClose}>Cancelar</Button>
      </div>
    );
  };

  const renderQR = () => {
    if (mpLoading) return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    if (!mpStatus?.connected) return renderMPNotConnected();
    if (step === "approved") return renderApproved();
    if (step === "rejected") return (
      <div className="flex flex-col items-center gap-3 py-4">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="font-medium">Pago rechazado</p>
        <Button onClick={() => { setStep("init"); setPrefData(null); createPreference(); }}>
          <RefreshCw className="h-4 w-4 mr-2" /> Reintentar
        </Button>
      </div>
    );
    if (!prefData) return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    return (
      <div className="flex flex-col items-center gap-4 py-2">
        <div className="p-4 bg-white rounded-lg border">
          <QRCodeSVG value={prefData.qrData ?? prefData.initPoint} size={220} />
        </div>
        <p className="text-2xl font-bold">{formatPrice(cartTotal)}</p>
        <p className="text-sm text-muted-foreground">Escaneá con la app de MercadoPago</p>
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-muted-foreground">Esperando pago...</span>
          <span className={`font-mono font-medium ${timeLeft <= 60 ? "text-destructive" : "text-foreground"}`}>
            {formatSeconds(timeLeft)}
          </span>
        </div>
        {timeLeft === 0 && (
          <Button onClick={() => { setPrefData(null); setTimeLeft(600); createPreference(); }}>
            <RefreshCw className="h-4 w-4 mr-2" /> Generar nuevo QR
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={handleClose}>Cancelar</Button>
      </div>
    );
  };

  const renderTransfer = () => {
    if (step === "approved") return renderApproved();
    if (capturedImage || filePreview) {
      const preview = capturedImage ?? filePreview!;
      return (
        <div className="flex flex-col items-center gap-4">
          <img src={preview} alt="Comprobante" className="max-h-64 rounded-lg border object-contain" />
          <div className="flex gap-2 w-full">
            <Button variant="outline" className="flex-1" onClick={() => { setCapturedImage(null); setFilePreview(null); setSelectedFile(null); }} disabled={submitting}>
              <RotateCcw className="h-4 w-4 mr-2" /> Repetir
            </Button>
            <Button className="flex-1" onClick={confirmTransfer} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Confirmar
            </Button>
          </div>
        </div>
      );
    }
    if (cameraActive) {
      return (
        <div className="flex flex-col items-center gap-4">
          <video ref={videoRef} autoPlay playsInline className="w-full max-w-sm rounded-lg border" />
          <canvas ref={canvasRef} className="hidden" />
          <Button onClick={capturePhoto} className="w-full max-w-sm">
            <Camera className="h-4 w-4 mr-2" /> Capturar foto
          </Button>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center gap-4 py-2">
        <p className="text-2xl font-bold">{formatPrice(cartTotal)}</p>
        <p className="text-sm text-muted-foreground text-center">Capturá el comprobante de transferencia</p>
        {!cameraError ? (
          <Button onClick={openCamera} className="w-full max-w-xs">
            <Camera className="h-4 w-4 mr-2" /> Abrir cámara
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground text-center">Cámara no disponible. Subí una imagen del comprobante.</p>
        )}
        <div className="w-full max-w-xs space-y-2">
          <Label className="text-xs text-muted-foreground">O subir imagen del comprobante</Label>
          <Input type="file" accept="image/*" capture="environment" onChange={handleFileSelect} className="text-sm" />
        </div>
        <Button variant="ghost" size="sm" onClick={handleClose}>Cancelar</Button>
      </div>
    );
  };

  const renderApproved = () => (
    <div className="flex flex-col items-center gap-3 py-4">
      <CheckCircle2 className="h-12 w-12 text-green-600" />
      <p className="text-lg font-semibold">Venta registrada</p>
      <p className="text-sm text-muted-foreground">El pago fue procesado exitosamente</p>
      <Button onClick={handleClose}>Cerrar</Button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {paymentMethod === "debito" && "Cobro con Débito"}
            {paymentMethod === "credito" && "Cobro con Crédito"}
            {paymentMethod === "qr" && "Cobro con QR"}
            {paymentMethod === "transferencia" && "Cobro por Transferencia"}
          </DialogTitle>
          {step !== "approved" && (
            <DialogDescription>
              Total: {formatPrice(cartTotal)}
            </DialogDescription>
          )}
        </DialogHeader>
        {paymentMethod === "debito" || paymentMethod === "credito" ? renderDebitCredit()
          : paymentMethod === "qr" ? renderQR()
          : renderTransfer()}
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

interface BranchStockWithProduct {
  id: string;
  branchId: string;
  productId: string;
  stock: string;
  lowStockThreshold: number | null;
  product: Product;
}

export default function SalesPage() {
  const { toast } = useToast();
  const { branchId, branchName } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [productComboOpen, setProductComboOpen] = useState(false);
  const [quantity, setQuantity] = useState<string>("1");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("efectivo");
  const [paidAmount, setPaidAmount] = useState<string>("");

  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    enabled: !!branchId,
  });

  const { data: branchStocks = [], isLoading: stocksLoading } = useQuery<BranchStockWithProduct[]>({
    queryKey: ["/api/branches", branchId, "stocks"],
    enabled: !!branchId,
  });

  const isLoading = productsLoading || stocksLoading;

  const getProductStock = (productId: string): number => {
    const branchStock = (branchStocks ?? []).find(bs => bs.productId === productId);
    return branchStock ? Number(branchStock.stock) : 0;
  };

  const productsWithStock = products?.map(p => ({
    ...p,
    stock: getProductStock(p.id).toString(),
  })).filter(p => Number(p.stock) > 0) || [];

  const selectedProduct = productsWithStock.find(p => p.id === selectedProductId);

  const createOrderMutation = useMutation({
    mutationFn: async (data: { paymentMethod: PaymentMethod; paidAmount?: number; items: CartItem[] }) => {
      if (!branchId) {
        throw new Error("Debe seleccionar una sucursal primero");
      }
      return await apiRequest("POST", `/api/branches/${branchId}/sale-orders`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/branches", branchId, "stocks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sale-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/audit-logs"] });
      toast({
        title: "Venta registrada",
        description: "La venta se ha registrado exitosamente.",
      });
      setCart([]);
      setPaymentMethod("efectivo");
      setPaidAmount("");
    },
    onError: (error: any) => {
      toast({
        title: "Error al registrar venta",
        description: error.message || "No se pudo completar la operación",
        variant: "destructive",
      });
    },
  });

  const addToCart = () => {
    if (!selectedProduct) return;
    
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast({
        title: "Cantidad inválida",
        description: "Ingrese una cantidad válida mayor a 0",
        variant: "destructive",
      });
      return;
    }

    if (qty > Number(selectedProduct.stock)) {
      toast({
        title: "Stock insuficiente",
        description: `Solo hay ${formatNumber(Number(selectedProduct.stock))} ${unitTypeLabels[selectedProduct.unitType]} disponibles`,
        variant: "destructive",
      });
      return;
    }

    const existingIndex = cart.findIndex(item => item.productId === selectedProduct.id);
    
    if (existingIndex >= 0) {
      const newCart = [...cart];
      const newQty = Number(newCart[existingIndex].quantity) + qty;
      
      if (newQty > Number(selectedProduct.stock)) {
        toast({
          title: "Stock insuficiente",
          description: `Solo hay ${formatNumber(Number(selectedProduct.stock))} ${unitTypeLabels[selectedProduct.unitType]} disponibles`,
          variant: "destructive",
        });
        return;
      }
      
      newCart[existingIndex] = {
        ...newCart[existingIndex],
        quantity: newQty,
      };
      setCart(newCart);
    } else {
      setCart([...cart, {
        productId: selectedProduct.id,
        quantity: qty,
        unitType: selectedProduct.unitType as typeof unitTypeEnum[number],
        unitPrice: Number(selectedProduct.price),
        productTitle: selectedProduct.title,
      }]);
    }

    setSelectedProductId("");
    setQuantity("1");
  };

  const updateCartQuantity = (index: number, newQuantity: number) => {
    const item = cart[index];
    const product = productsWithStock.find(p => p.id === item.productId);
    
    if (!product) return;
    
    if (newQuantity <= 0) {
      removeFromCart(index);
      return;
    }
    
    if (newQuantity > Number(product.stock)) {
      toast({
        title: "Stock insuficiente",
        description: `Solo hay ${formatNumber(Number(product.stock))} ${unitTypeLabels[product.unitType]} disponibles`,
        variant: "destructive",
      });
      return;
    }

    const newCart = [...cart];
    newCart[index] = { ...item, quantity: newQuantity };
    setCart(newCart);
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.unitPrice * Number(item.quantity)), 0);
  
  const paidAmountNum = parseFloat(paidAmount) || 0;
  const changeAmount = paymentMethod === "efectivo" ? paidAmountNum - cartTotal : 0;
  const canSubmit = cart.length > 0 && (paymentMethod !== "efectivo" || paidAmountNum >= cartTotal);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  const handleSubmit = () => {
    if (!canSubmit) return;
    if (paymentMethod === "efectivo") {
      createOrderMutation.mutate({
        paymentMethod,
        paidAmount: paidAmountNum,
        items: cart,
      });
    } else {
      setPaymentModalOpen(true);
    }
  };

  const createOrderAsync = async (data: { paymentMethod: PaymentMethod; items: CartItem[] }) => {
    if (!branchId) throw new Error("Debe seleccionar una sucursal primero");
    return await apiRequest("POST", `/api/branches/${branchId}/sale-orders`, data);
  };

  const handlePaymentSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    queryClient.invalidateQueries({ queryKey: ["/api/branches", branchId, "stocks"] });
    queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
    queryClient.invalidateQueries({ queryKey: ["/api/sale-orders"] });
    queryClient.invalidateQueries({ queryKey: ["/api/audit-logs"] });
    setCart([]);
    setPaymentMethod("efectivo");
    setPaidAmount("");
    setPaymentModalOpen(false);
    toast({ title: "Venta registrada", description: "La venta se ha registrado exitosamente." });
  };

  const getQuantityStep = (unitType: string) => {
    return unitType === "unidad" ? 1 : 0.1;
  };

  const getQuantityMin = (unitType: string) => {
    return unitType === "unidad" ? 1 : 0.1;
  };

  return (
    <div className="container mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">Registrar Venta</h1>
        <p className="text-sm text-muted-foreground mt-1">Agrega productos al carrito y registra la venta</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Agregar Productos</CardTitle>
            <CardDescription>Selecciona productos y agrégalos al carrito</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <Label>Producto</Label>
                <Popover open={productComboOpen} onOpenChange={setProductComboOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={productComboOpen}
                      className="w-full justify-between font-normal"
                      data-testid="select-product"
                    >
                      <span className="truncate">
                        {selectedProduct ? selectedProduct.title : "Seleccionar producto..."}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar por nombre, código..." data-testid="input-product-search" />
                      <CommandList>
                        <CommandEmpty>No se encontraron productos.</CommandEmpty>
                        <CommandGroup>
                          {productsWithStock.map((product) => (
                            <CommandItem
                              key={product.id}
                              value={`${product.title} ${product.barcode ?? ""} ${product.description}`}
                              onSelect={() => {
                                setSelectedProductId(product.id);
                                setProductComboOpen(false);
                              }}
                              data-testid={`option-product-${product.id}`}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 shrink-0 ${selectedProductId === product.id ? "opacity-100" : "opacity-0"}`}
                              />
                              <span className="flex-1 truncate">{product.title}</span>
                              <span className="ml-2 text-xs text-muted-foreground shrink-0">
                                {formatNumber(Number(product.stock))} {unitTypeLabels[product.unitType]}
                              </span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label>Cantidad {selectedProduct && `(${unitTypeLabels[selectedProduct.unitType]})`}</Label>
                <Input
                  type="number"
                  min={selectedProduct ? getQuantityMin(selectedProduct.unitType) : 1}
                  step={selectedProduct ? getQuantityStep(selectedProduct.unitType) : 1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Cantidad"
                  data-testid="input-quantity"
                />
                {selectedProduct && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Precio: {formatPrice(Number(selectedProduct.price))} por {unitTypeLabels[selectedProduct.unitType].toLowerCase()}
                  </p>
                )}
              </div>

              <div className="flex items-end">
                <Button 
                  onClick={addToCart} 
                  disabled={!selectedProduct || isLoading}
                  className="w-full"
                  data-testid="button-add-to-cart"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar
                </Button>
              </div>
            </div>

            {cart.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="hidden sm:flex px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <div className="flex-1 min-w-0">Producto</div>
                  <div className="w-32 text-center shrink-0">Cantidad</div>
                  <div className="w-24 text-right shrink-0">P. Unit.</div>
                  <div className="w-24 text-right shrink-0">Subtotal</div>
                  <div className="w-8 shrink-0"></div>
                </div>
                <div className="divide-y">
                  {cart.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 px-3 py-3" data-testid={`cart-item-${index}`}>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.productTitle}</p>
                        <Badge variant="outline" className="mt-0.5 text-xs">
                          {unitTypeLabels[item.unitType]}
                        </Badge>
                      </div>
                      <div className="w-32 flex items-center justify-center gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => updateCartQuantity(index, Number(item.quantity) - (item.unitType === "unidad" ? 1 : 0.1))}
                          data-testid={`button-decrease-${index}`}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-10 text-center text-sm tabular-nums">
                          {item.unitType === "unidad" ? formatNumber(Number(item.quantity)) : Number(item.quantity).toFixed(1)}
                        </span>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => updateCartQuantity(index, Number(item.quantity) + (item.unitType === "unidad" ? 1 : 0.1))}
                          data-testid={`button-increase-${index}`}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="w-24 text-right text-sm text-muted-foreground tabular-nums shrink-0">
                        {formatPrice(item.unitPrice)}
                      </div>
                      <div className="w-24 text-right text-sm font-semibold tabular-nums shrink-0" data-testid={`text-subtotal-${index}`}>
                        {formatPrice(item.unitPrice * Number(item.quantity))}
                      </div>
                      <div className="w-8 flex justify-end shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => removeFromCart(index)}
                          data-testid={`button-remove-${index}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {cart.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/20">
                <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground" data-testid="text-empty-cart">
                  El carrito está vacío. Agrega productos para continuar.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumen de Venta</CardTitle>
            <CardDescription>Método de pago y total</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Método de Pago</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                <SelectTrigger data-testid="select-payment-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethodEnum.map((method) => {
                    const { label, icon: Icon } = paymentMethodLabels[method];
                    return (
                      <SelectItem key={method} value={method} data-testid={`option-payment-${method}`}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {paymentMethod === "efectivo" && (
              <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                <div>
                  <Label>Monto recibido</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    placeholder="¿Con cuánto paga?"
                    data-testid="input-paid-amount"
                  />
                </div>
                {paidAmountNum > 0 && (
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-sm font-medium">Vuelto a dar:</span>
                    <span 
                      className={`text-lg font-bold ${changeAmount >= 0 ? 'text-green-600' : 'text-destructive'}`}
                      data-testid="text-change-amount"
                    >
                      {changeAmount >= 0 ? formatPrice(changeAmount) : "Monto insuficiente"}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2 pt-4 border-t">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Items en carrito:</span>
                <span className="font-medium" data-testid="text-cart-items-count">{cart.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cantidad total:</span>
                <span className="font-medium" data-testid="text-total-quantity">
                  {cart.reduce((sum, item) => sum + Number(item.quantity), 0)}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-base font-semibold">Total:</span>
                <span className="text-2xl font-bold text-primary" data-testid="text-cart-total">
                  {formatPrice(cartTotal)}
                </span>
              </div>
            </div>

            <Button
              className="w-full"
              size="lg"
              disabled={!canSubmit || createOrderMutation.isPending}
              onClick={handleSubmit}
              data-testid="button-submit-sale"
            >
              {createOrderMutation.isPending ? (
                "Procesando..."
              ) : (
                <>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Registrar Venta
                </>
              )}
            </Button>

            {paymentMethod === "efectivo" && cart.length > 0 && paidAmountNum < cartTotal && paidAmountNum > 0 && (
              <p className="text-xs text-destructive text-center" data-testid="text-insufficient-payment">
                El monto recibido es menor al total de la venta
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <PaymentModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        paymentMethod={paymentMethod}
        cart={cart}
        cartTotal={cartTotal}
        branchId={branchId}
        createOrderAsync={createOrderAsync}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
