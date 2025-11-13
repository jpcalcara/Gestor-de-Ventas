import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Edit, Trash2, PackageX, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ProductForm } from "@/components/product-form";
import { DeleteProductDialog } from "@/components/delete-product-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { Product } from "@shared/schema";

export default function ProductsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const filteredProducts = products?.filter(product =>
    product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.description.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
    setIsEditDialogOpen(true);
  };

  const handleDelete = (product: Product) => {
    setProductToDelete(product);
  };

  const handleAddSuccess = () => {
    setIsAddDialogOpen(false);
  };

  const handleEditSuccess = () => {
    setIsEditDialogOpen(false);
    setSelectedProduct(null);
  };

  const handleDeleteSuccess = () => {
    setProductToDelete(null);
  };

  return (
    <div className="container mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Productos</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestiona tu inventario de productos</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
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
            <ProductForm onSuccess={handleAddSuccess} />
          </DialogContent>
        </Dialog>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="p-0">
                <Skeleton className="aspect-square w-full rounded-t-lg" />
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
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
            {!searchQuery && (
              <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-first-product">
                <Plus className="h-4 w-4 mr-2" />
                Agregar Producto
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => {
            const isLowStock = Number(product.stock) < 10;
            return (
              <Card key={product.id} className="overflow-hidden hover-elevate" data-testid={`card-product-${product.id}`}>
                <CardHeader className="p-0">
                  <div className="aspect-square bg-muted relative">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.title}
                        className="w-full h-full object-cover"
                        data-testid={`img-product-${product.id}`}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-16 w-16 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div>
                    <h3 className="text-lg font-semibold line-clamp-1" data-testid={`text-product-title-${product.id}`}>
                      {product.title}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1" data-testid={`text-product-description-${product.id}`}>
                      {product.description}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xl font-bold" data-testid={`text-product-price-${product.id}`}>
                        ${Number(product.price).toFixed(2)}
                      </p>
                    </div>
                    <Badge variant={isLowStock ? "destructive" : "secondary"} data-testid={`badge-stock-${product.id}`}>
                      {isLowStock && "⚠ "}Stock: {product.stock}
                    </Badge>
                  </div>
                </CardContent>
                <CardFooter className="p-4 pt-0 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleEdit(product)}
                    data-testid={`button-edit-${product.id}`}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(product)}
                    data-testid={`button-delete-${product.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardFooter>
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
