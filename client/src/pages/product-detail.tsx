import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { ArrowLeft, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatPrice, formatNumber, isLowStock } from "@/lib/format";
import type { Product } from "@shared/schema";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: product, isLoading } = useQuery<Product>({
    queryKey: ["/api/products", id],
    queryFn: async () => {
      const response = await fetch(`/api/products/${id}`);
      if (!response.ok) {
        throw new Error("Producto no encontrado");
      }
      return response.json();
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 md:px-8 py-6 md:py-8">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Package className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Producto no encontrado</h2>
          <p className="text-sm text-muted-foreground mb-6">
            El producto que buscas no existe o fue eliminado
          </p>
          <Link href="/products">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver a Productos
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const lowStock = isLowStock(product.stock);

  return (
    <div className="container mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/products">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-product-title">
            {product.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Detalles del producto</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Imagen del producto */}
        <Card>
          <CardContent className="p-6">
            {product.imageUrl ? (
              <div className="aspect-square rounded-lg overflow-hidden border">
                <img
                  src={product.imageUrl}
                  alt={product.title}
                  className="w-full h-full object-cover"
                  data-testid="img-product"
                />
              </div>
            ) : (
              <div className="aspect-square rounded-lg border bg-muted flex items-center justify-center">
                <Package className="h-24 w-24 text-muted-foreground" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Información del producto */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Información General</CardTitle>
              <CardDescription>Detalles y características del producto</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Descripción</p>
                <p className="text-base" data-testid="text-product-description">
                  {product.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Precio Unitario</p>
                  <p className="text-2xl font-bold" data-testid="text-product-price">
                    {formatPrice(product.price)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Stock Disponible</p>
                  <div className="flex items-center gap-2">
                    <p
                      className={`text-2xl font-bold ${lowStock ? "text-destructive" : ""}`}
                      data-testid="text-product-stock"
                    >
                      {formatNumber(product.stock)}
                    </p>
                    {lowStock && (
                      <Badge variant="destructive" data-testid="badge-low-stock">
                        Stock Bajo
                      </Badge>
                    )}
                  </div>
                  {lowStock && (
                    <p className="text-sm text-destructive mt-1">
                      Menos de 50 unidades disponibles
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Características</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between py-2 border-b">
                <span className="text-sm text-muted-foreground">ID del Producto</span>
                <span className="text-sm font-mono" data-testid="text-product-id">
                  {product.id}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-sm text-muted-foreground">Estado</span>
                <Badge variant={product.stock > 0 ? "default" : "secondary"}>
                  {product.stock > 0 ? "Disponible" : "Agotado"}
                </Badge>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-sm text-muted-foreground">Valor Total en Stock</span>
                <span className="text-sm font-semibold" data-testid="text-total-value">
                  {formatPrice(Number(product.price) * product.stock)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
