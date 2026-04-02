import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, Search, Edit, Trash2, PackageX, Package, ScanLine, Barcode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ProductForm } from "@/components/product-form";
import { ProductScanner, type ScannedProductData } from "@/components/product-scanner";
import { DeleteProductDialog } from "@/components/delete-product-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice, formatNumber, isLowStock } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import type { Product } from "@shared/schema";

export default function ProductsPage() {
  const [, setLocation] = useLocation();
  const { isAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [prefillData, setPrefillData] = useState<{
    title?: string;
    description?: string;
    imageUrl?: string;
    barcode?: string;
  } | undefined>(undefined);
  const [priceSuggestion, setPriceSuggestion] = useState<{ suggested: number; range: string; source: string } | null>(null);

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const filteredProducts = products?.filter(product => {
    const q = searchQuery.toLowerCase();
    return (
      product.title.toLowerCase().includes(q) ||
      product.description.toLowerCase().includes(q) ||
      (product.barcode && product.barcode.toLowerCase().includes(q))
    );
  }) || [];

  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
    setIsEditDialogOpen(true);
  };

  const handleDelete = (product: Product) => {
    setProductToDelete(product);
  };

  const handleAddSuccess = () => {
    setIsAddDialogOpen(false);
    setPrefillData(undefined);
    setPriceSuggestion(null);
  };

  const handleEditSuccess = () => {
    setIsEditDialogOpen(false);
    setSelectedProduct(null);
  };

  const handleDeleteSuccess = () => {
    setProductToDelete(null);
  };

  const handleScanResult = (data: ScannedProductData) => {
    setIsScannerOpen(false);
    setPrefillData({
      title: data.title,
      description: data.description,
      imageUrl: data.imageUrl,
      barcode: data.barcode,
    });
    setPriceSuggestion(data.priceSuggestion ?? null);
    setIsAddDialogOpen(true);
  };

  return (
    <div className="container mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Productos</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestiona tu inventario de productos</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2 flex-wrap">
            <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-scan-product">
                  <ScanLine className="h-4 w-4 mr-2" />
                  Escanear producto
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Escanear Producto</DialogTitle>
                </DialogHeader>
                <ProductScanner
                  onProductFound={handleScanResult}
                  onClose={() => setIsScannerOpen(false)}
                />
              </DialogContent>
            </Dialog>

            <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
              setIsAddDialogOpen(open);
              if (!open) setPrefillData(undefined);
            }}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-product">
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Producto
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Nuevo Producto</DialogTitle>
                </DialogHeader>
                <ProductForm prefillData={prefillData} priceSuggestion={priceSuggestion} onSuccess={handleAddSuccess} />
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      <div className="w-full max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar productos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-products"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-16 w-16 rounded-md flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-4 w-1/3" />
                  </div>
                  <Skeleton className="h-6 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <PackageX className="h-12 w-12 text-muted-foreground" />
            <div>
              <h3 className="text-base font-medium" data-testid="text-no-products">
                {searchQuery ? "No se encontraron productos" : "No hay productos registrados"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                {searchQuery
                  ? "Intenta con otros términos de búsqueda"
                  : "Comienza agregando tu primer producto al inventario"}
              </p>
            </div>
            {!searchQuery && isAdmin && (
              <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-first-product">
                <Plus className="h-4 w-4 mr-2" />
                Agregar Producto
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredProducts.map((product) => {
            const lowStock = isLowStock(Number(product.stock));
            return (
              <Card key={product.id} className="hover-elevate" data-testid={`card-product-${product.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div 
                      className="h-16 w-16 rounded-md bg-muted flex-shrink-0 overflow-hidden cursor-pointer"
                      onClick={() => setLocation(`/products/${product.id}`)}
                    >
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.title}
                          className="w-full h-full object-cover"
                          data-testid={`img-product-${product.id}`}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 
                        className="text-base font-semibold cursor-pointer hover:underline" 
                        data-testid={`text-product-title-${product.id}`}
                        onClick={() => setLocation(`/products/${product.id}`)}
                      >
                        {product.title}
                      </h3>
                      {product.barcode && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Barcode className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="text-xs text-muted-foreground font-mono" data-testid={`text-product-barcode-${product.id}`}>
                            {product.barcode}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-4 mt-1 flex-wrap">
                        <div>
                          <span className="text-sm text-muted-foreground">Precio: </span>
                          <span className="text-sm font-semibold" data-testid={`text-product-price-${product.id}`}>
                            {formatPrice(product.price)}
                          </span>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">Stock: </span>
                          <span 
                            className={`text-sm font-semibold ${lowStock ? "text-destructive" : ""}`}
                            data-testid={`text-product-stock-${product.id}`}
                          >
                            {formatNumber(product.stock)}
                          </span>
                          {lowStock && (
                            <Badge variant="destructive" className="ml-2" data-testid={`badge-low-stock-${product.id}`}>
                              Stock Bajo
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleEdit(product)}
                          data-testid={`button-edit-${product.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleDelete(product)}
                          data-testid={`button-delete-${product.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Producto</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <ProductForm
              product={selectedProduct}
              onSuccess={handleEditSuccess}
            />
          )}
        </DialogContent>
      </Dialog>

      <DeleteProductDialog
        product={productToDelete}
        open={!!productToDelete}
        onOpenChange={(open: boolean) => !open && setProductToDelete(null)}
        onSuccess={handleDeleteSuccess}
      />
    </div>
  );
}
