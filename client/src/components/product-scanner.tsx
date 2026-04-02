import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, ScanLine, Loader2, RotateCcw, Check, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface ScannedProductData {
  title?: string;
  description?: string;
  brand?: string;
  imageUrl?: string;
  barcode?: string;
  unitType?: string;
  source: "openfoodfacts" | "ai-vision" | "manual";
  confidence?: "high" | "medium" | "low";
  priceSuggestion?: { suggested: number; range: string; source: string } | null;
}

interface ProductScannerProps {
  onProductFound: (data: ScannedProductData) => void;
  onClose: () => void;
}

type ScannerState = "idle" | "scanning" | "photo" | "loading" | "found" | "not-found";

export function ProductScanner({ onProductFound, onClose }: ProductScannerProps) {
  const [state, setState] = useState<ScannerState>("idle");
  const [loadingMessage, setLoadingMessage] = useState("");
  const [foundData, setFoundData] = useState<ScannedProductData | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<any>(null);
  const { toast } = useToast();

  const stopCamera = useCallback(() => {
    if (readerRef.current) {
      try {
        readerRef.current.reset();
      } catch {}
      readerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const lookupBarcode = async (code: string) => {
    setState("loading");
    setLoadingMessage("Buscando producto...");
    try {
      const data = await apiRequest("GET", `/api/product-lookup/barcode/${encodeURIComponent(code)}`);
      setFoundData(data as ScannedProductData);
      setState("found");
    } catch (err: any) {
      setErrorMessage(err.message || "No se encontró el producto");
      setFoundData({ barcode: code, source: "manual" });
      setState("not-found");
    }
  };

  const startBarcodeScanner = async () => {
    setState("scanning");
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === "videoinput");
      const backCamera = videoDevices.find(d =>
        d.label.toLowerCase().includes("back") ||
        d.label.toLowerCase().includes("rear") ||
        d.label.toLowerCase().includes("trasera") ||
        d.label.toLowerCase().includes("environment")
      );
      const deviceId = backCamera?.deviceId || undefined;

      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : { facingMode: "environment" },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        reader.decodeFromVideoElement(videoRef.current, (result) => {
          if (result) {
            const code = result.getText();
            stopCamera();
            lookupBarcode(code);
          }
        });
      }
    } catch (err: any) {
      stopCamera();
      toast({
        title: "Error de cámara",
        description: "No se pudo acceder a la cámara. Verificá los permisos del navegador.",
        variant: "destructive",
      });
      setState("idle");
    }
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setState("loading");
    setLoadingMessage("Analizando imagen con IA...");

    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64Data = result.split(",")[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const mimeType = file.type || "image/jpeg";
      const data = await apiRequest("POST", "/api/product-lookup/image", {
        imageBase64: base64,
        mimeType,
      });

      setFoundData(data as ScannedProductData);
      setState("found");
    } catch (err: any) {
      setErrorMessage(err.message || "No se pudo analizar la imagen");
      setState("not-found");
    }
  };

  const reset = () => {
    stopCamera();
    setState("idle");
    setFoundData(null);
    setErrorMessage("");
  };

  const confidenceLabel: Record<string, { text: string; color: string }> = {
    high: { text: "Alta confianza", color: "text-green-600 dark:text-green-400" },
    medium: { text: "Confianza media", color: "text-yellow-600 dark:text-yellow-400" },
    low: { text: "Baja confianza", color: "text-red-600 dark:text-red-400" },
  };

  if (state === "idle") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground text-center">
          Escaneá un código de barras o sacá una foto del producto para completar los datos automáticamente.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-auto py-6 flex flex-col gap-2"
            onClick={startBarcodeScanner}
            data-testid="button-scan-barcode"
          >
            <ScanLine className="h-8 w-8" />
            <span className="text-sm font-medium">Escanear código de barras</span>
          </Button>
          <label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoCapture}
              data-testid="input-scan-photo"
            />
            <div className="h-auto py-6 flex flex-col gap-2 items-center justify-center border rounded-md cursor-pointer hover-elevate">
              <Camera className="h-8 w-8" />
              <span className="text-sm font-medium">Identificar por foto</span>
            </div>
          </label>
        </div>
      </div>
    );
  }

  if (state === "scanning") {
    return (
      <div className="space-y-4">
        <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
            data-testid="video-scanner"
          />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-32 border-2 border-white/60 rounded-lg" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground text-center">
          Apuntá la cámara al código de barras del producto
        </p>
        <Button variant="outline" className="w-full" onClick={reset} data-testid="button-cancel-scan">
          <X className="h-4 w-4 mr-2" />
          Cancelar
        </Button>
      </div>
    );
  }

  if (state === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{loadingMessage}</p>
      </div>
    );
  }

  if (state === "found" && foundData) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            {foundData.imageUrl && (
              <div className="w-full aspect-square max-w-[200px] mx-auto rounded-lg overflow-hidden border">
                <img
                  src={foundData.imageUrl}
                  alt={foundData.title || "Producto"}
                  className="w-full h-full object-contain"
                  data-testid="img-scanned-product"
                />
              </div>
            )}
            <div className="space-y-1">
              {foundData.title && (
                <h3 className="text-base font-semibold" data-testid="text-scanned-title">{foundData.title}</h3>
              )}
              {foundData.brand && (
                <p className="text-sm text-muted-foreground" data-testid="text-scanned-brand">
                  Marca: {foundData.brand}
                </p>
              )}
              {foundData.description && (
                <p className="text-sm text-muted-foreground" data-testid="text-scanned-description">
                  {foundData.description}
                </p>
              )}
              {foundData.barcode && (
                <p className="text-sm text-muted-foreground" data-testid="text-scanned-barcode">
                  Código: {foundData.barcode}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" data-testid="badge-scan-source">
                {foundData.source === "openfoodfacts" ? "Open Food Facts" : "Identificado por IA"}
              </Badge>
              {foundData.confidence && (
                <span className={`text-xs ${confidenceLabel[foundData.confidence]?.color}`} data-testid="text-scan-confidence">
                  {confidenceLabel[foundData.confidence]?.text}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => onProductFound(foundData)} data-testid="button-use-scanned-data">
            <Check className="h-4 w-4 mr-2" />
            Usar estos datos
          </Button>
          <Button variant="outline" onClick={reset} data-testid="button-scan-again">
            <RotateCcw className="h-4 w-4 mr-2" />
            Buscar de nuevo
          </Button>
        </div>
      </div>
    );
  }

  if (state === "not-found") {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center justify-center py-8 space-y-3 text-center">
          <AlertCircle className="h-10 w-10 text-muted-foreground" />
          <div>
            <h3 className="text-base font-medium" data-testid="text-not-found">No encontramos este producto</h3>
            <p className="text-sm text-muted-foreground mt-1">{errorMessage}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoCapture}
              data-testid="input-retry-photo"
            />
            <div className="w-full flex items-center justify-center gap-2 border rounded-md py-2 cursor-pointer hover-elevate">
              <Camera className="h-4 w-4" />
              <span className="text-sm">Intentar con foto</span>
            </div>
          </label>
          {foundData?.barcode && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() =>
                onProductFound({ barcode: foundData.barcode, source: "manual" })
              }
              data-testid="button-continue-manual"
            >
              Continuar sin datos (solo código de barras)
            </Button>
          )}
          <Button variant="ghost" className="w-full" onClick={reset} data-testid="button-reset-scanner">
            <RotateCcw className="h-4 w-4 mr-2" />
            Volver al inicio
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
