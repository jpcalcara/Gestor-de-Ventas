import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShoppingCart, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatPrice, formatNumber } from "@/lib/format";
import { insertSaleSchema, type InsertSale, type Product } from "@shared/schema";

export default function SalesPage() {
  const { toast } = useToast();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const form = useForm<InsertSale>({
    resolver: zodResolver(insertSaleSchema),
    defaultValues: {
      productId: "",
      quantity: 1,
    },
  });

  const productId = form.watch("productId");
  const quantity = form.watch("quantity");

  useEffect(() => {
    if (productId && products) {
      const product = products.find(p => p.id === productId);
      setSelectedProduct(product || null);
    } else {
      setSelectedProduct(null);
    }
  }, [productId, products]);

  const createSaleMutation = useMutation({
    mutationFn: async (data: InsertSale) => {
      return await apiRequest("POST", "/api/sales", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      toast({
        title: "Venta registrada",
        description: "La venta se ha registrado exitosamente y el stock ha sido actualizado.",
      });
      form.reset({
        productId: "",
        quantity: 1,
      });
      setSelectedProduct(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error al registrar venta",
        description: error.message || "No se pudo completar la operación",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertSale) => {
    createSaleMutation.mutate(data);
  };

  const unitPrice = selectedProduct ? Number(selectedProduct.price) : 0;
  const totalPrice = unitPrice * (Number(quantity) || 0);
  const hasInsufficientStock = selectedProduct && (Number(quantity) || 0) > selectedProduct.stock;

  return (
    <div className="container mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">Registrar Venta</h1>
        <p className="text-sm text-muted-foreground mt-1">Registra una nueva venta de productos</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Información de Venta</CardTitle>
            <CardDescription>Selecciona el producto y la cantidad vendida</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="productId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Producto</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-product">
                            <SelectValue placeholder="Seleccionar producto" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {products?.map((product) => (
                            <SelectItem key={product.id} value={product.id} data-testid={`option-product-${product.id}`}>
                              {product.title} (Stock: {formatNumber(product.stock)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cantidad</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          placeholder="Ingrese la cantidad"
                          {...field}
                          data-testid="input-quantity"
                        />
                      </FormControl>
                      <FormMessage />
                      {hasInsufficientStock && (
                        <p className="text-sm text-destructive" data-testid="text-insufficient-stock">
                          Stock insuficiente. Disponible: {selectedProduct.stock}
                        </p>
                      )}
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={createSaleMutation.isPending || hasInsufficientStock || !selectedProduct}
                  data-testid="button-submit-sale"
                >
                  {createSaleMutation.isPending ? (
                    "Procesando..."
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Registrar Venta
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumen de Venta</CardTitle>
            <CardDescription>Vista previa del total a registrar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedProduct ? (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Producto:</span>
                    <span className="font-medium" data-testid="text-summary-product">{selectedProduct.title}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Stock disponible:</span>
                    <span className="font-medium" data-testid="text-summary-stock">{formatNumber(selectedProduct.stock)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Precio unitario:</span>
                    <span className="font-medium" data-testid="text-summary-unit-price">{formatPrice(unitPrice)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Cantidad:</span>
                    <span className="font-medium" data-testid="text-summary-quantity">{formatNumber(quantity || 0)}</span>
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <span className="text-base font-semibold">Total:</span>
                    <span className="text-2xl font-bold text-primary" data-testid="text-summary-total">
                      {formatPrice(totalPrice)}
                    </span>
                  </div>
                </div>
                {quantity && selectedProduct && (
                  <div className="p-3 bg-muted rounded-md">
                    <p className="text-sm text-muted-foreground">
                      Stock después de la venta: <span className="font-medium text-foreground" data-testid="text-stock-after-sale">
                        {formatNumber(Math.max(0, selectedProduct.stock - (Number(quantity) || 0)))}
                      </span>
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground" data-testid="text-no-product-selected">
                  Selecciona un producto para ver el resumen
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
