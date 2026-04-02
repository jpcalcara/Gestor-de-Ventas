import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertProductSchema, type InsertProduct, type Product, unitTypeEnum } from "@shared/schema";
import { useFeatures } from "@/hooks/use-features";

const unitTypeLabels: Record<string, string> = {
  unidad: "Unidad (enteros)",
  gramos: "Gramos (peso)",
  litros: "Litros (volumen)",
};

interface PrefillData {
  title?: string;
  description?: string;
  imageUrl?: string;
  barcode?: string;
}

interface PriceSuggestion {
  suggested: number;
  range: string;
  source: string;
}

interface ProductFormProps {
  product?: Product;
  prefillData?: PrefillData;
  priceSuggestion?: PriceSuggestion | null;
  onSuccess?: () => void;
}

export function ProductForm({ product, prefillData, priceSuggestion: initialPriceSuggestion, onSuccess }: ProductFormProps) {
  const { toast } = useToast();
  const { hasFeature } = useFeatures();
  const initialImage = product?.imageUrl || prefillData?.imageUrl || null;
  const [imagePreview, setImagePreview] = useState<string | null>(initialImage);
  const [priceSuggestion] = useState<PriceSuggestion | null>(initialPriceSuggestion ?? null);

  const form = useForm<InsertProduct>({
    resolver: zodResolver(insertProductSchema),
    defaultValues: {
      title: product?.title || prefillData?.title || "",
      description: product?.description || prefillData?.description || "",
      price: product ? Number(product.price) : 0,
      stock: product ? Number(product.stock) : 0,
      unitType: (product?.unitType as typeof unitTypeEnum[number]) || "unidad",
      imageUrl: product?.imageUrl || prefillData?.imageUrl || "",
      barcode: product?.barcode || prefillData?.barcode || "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertProduct) => {
      return await apiRequest("POST", "/api/products", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Producto creado", description: "El producto se ha creado exitosamente." });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({ title: "Error al crear producto", description: error.message || "No se pudo completar la operación", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InsertProduct) => {
      return await apiRequest("PATCH", `/api/products/${product?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Producto actualizado", description: "El producto se ha actualizado exitosamente." });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({ title: "Error al actualizar producto", description: error.message || "No se pudo completar la operación", variant: "destructive" });
    },
  });

  const onSubmit = (data: InsertProduct) => {
    if (product) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setImagePreview(result);
        form.setValue("imageUrl", result);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setImagePreview(null);
    form.setValue("imageUrl", "");
  };

  const formatPriceHint = (n: number) =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n);

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Título</FormLabel>
              <FormControl>
                <Input placeholder="Nombre del producto" {...field} data-testid="input-product-title" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descripción</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe el producto"
                  className="resize-none"
                  rows={3}
                  {...field}
                  data-testid="input-product-description"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="barcode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Código de barras</FormLabel>
              <FormControl>
                <Input
                  placeholder="Ej: 7790895000118"
                  {...field}
                  value={field.value || ""}
                  data-testid="input-product-barcode"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="unitType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de Unidad</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-product-unit-type">
                    <SelectValue placeholder="Seleccionar tipo de unidad" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {unitTypeEnum.map((type) => (
                    <SelectItem key={type} value={type} data-testid={`option-unit-type-${type}`}>
                      {unitTypeLabels[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Precio por {unitTypeLabels[form.watch("unitType") || "unidad"].split(" ")[0]}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    {...field}
                    data-testid="input-product-price"
                  />
                </FormControl>
                <FormMessage />
                {priceSuggestion && hasFeature("ai_price_suggestion") && priceSuggestion.suggested > 0 && (
                  <p className="text-xs text-muted-foreground mt-1" data-testid="text-price-suggestion">
                    Precio sugerido: {formatPriceHint(priceSuggestion.suggested)}
                    {priceSuggestion.range ? ` (${priceSuggestion.range})` : ""}
                    {priceSuggestion.source ? ` — ${priceSuggestion.source}` : ""}
                  </p>
                )}
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="stock"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stock ({unitTypeLabels[form.watch("unitType") || "unidad"].split(" ")[0]})</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    step={form.watch("unitType") === "unidad" ? "1" : "0.1"}
                    placeholder="0"
                    {...field}
                    data-testid="input-product-stock"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="imageUrl"
          render={() => (
            <FormItem>
              <FormLabel>Imagen del Producto</FormLabel>
              <FormControl>
                <div className="space-y-4">
                  {imagePreview ? (
                    <div className="relative aspect-square w-48 rounded-lg overflow-hidden border">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        data-testid="img-product-preview"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2"
                        onClick={clearImage}
                        data-testid="button-clear-image"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <label
                      htmlFor="image-upload"
                      className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer hover-elevate"
                      data-testid="label-upload-image"
                    >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">Click para subir imagen</p>
                        <p className="text-xs text-muted-foreground mt-1">PNG, JPG o WEBP</p>
                      </div>
                      <input
                        id="image-upload"
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleImageChange}
                        data-testid="input-product-image"
                      />
                    </label>
                  )}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2 pt-4">
          <Button type="submit" className="flex-1" disabled={isPending} data-testid="button-submit-product">
            {isPending ? "Guardando..." : product ? "Actualizar Producto" : "Crear Producto"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
