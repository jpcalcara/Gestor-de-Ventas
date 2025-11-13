import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Calendar, DollarSign, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice, formatNumber } from "@/lib/format";
import type { SaleWithProduct, Product } from "@shared/schema";
import { format } from "date-fns";

export default function ReportsPage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string>("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const { data: sales, isLoading: salesLoading } = useQuery<SaleWithProduct[]>({
    queryKey: ["/api/sales"],
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const filteredSales = sales?.filter(sale => {
    if (dateFrom && new Date(sale.createdAt) < new Date(dateFrom)) return false;
    if (dateTo && new Date(sale.createdAt) > new Date(dateTo + "T23:59:59")) return false;
    if (selectedProductId !== "all" && sale.productId !== selectedProductId) return false;
    if (minPrice && Number(sale.totalPrice) < Number(minPrice)) return false;
    if (maxPrice && Number(sale.totalPrice) > Number(maxPrice)) return false;
    return true;
  }) || [];

  const totalRevenue = filteredSales.reduce((sum, sale) => sum + Number(sale.totalPrice), 0);
  const totalItems = filteredSales.reduce((sum, sale) => sum + sale.quantity, 0);

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setSelectedProductId("all");
    setMinPrice("");
    setMaxPrice("");
  };

  const hasActiveFilters = dateFrom || dateTo || selectedProductId !== "all" || minPrice || maxPrice;

  return (
    <div className="container mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">Reportes de Ventas</h1>
        <p className="text-sm text-muted-foreground mt-1">Visualiza y filtra el historial de ventas</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Ventas</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-sales">{formatNumber(filteredSales.length)}</div>
            <p className="text-xs text-muted-foreground mt-1">Ventas registradas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-revenue">{formatPrice(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">Monto acumulado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Productos Vendidos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-items">{formatNumber(totalItems)}</div>
            <p className="text-xs text-muted-foreground mt-1">Unidades vendidas</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date-from">Fecha desde</Label>
              <Input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                data-testid="input-date-from"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date-to">Fecha hasta</Label>
              <Input
                id="date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                data-testid="input-date-to"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-filter">Producto</Label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger id="product-filter" data-testid="select-filter-product">
                  <SelectValue placeholder="Todos los productos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los productos</SelectItem>
                  {products?.map((product) => (
                    <SelectItem key={product.id} value={product.id} data-testid={`option-filter-product-${product.id}`}>
                      {product.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="min-price">Precio mínimo</Label>
              <Input
                id="min-price"
                type="number"
                min="0"
                step="0.01"
                placeholder="$0.00"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                data-testid="input-min-price"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-price">Precio máximo</Label>
              <Input
                id="max-price"
                type="number"
                min="0"
                step="0.01"
                placeholder="$0.00"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                data-testid="input-max-price"
              />
            </div>

            <div className="space-y-2 flex items-end">
              <Button
                variant="outline"
                onClick={clearFilters}
                disabled={!hasActiveFilters}
                className="w-full"
                data-testid="button-clear-filters"
              >
                Limpiar filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de Ventas</CardTitle>
        </CardHeader>
        <CardContent>
          {salesLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-base font-medium" data-testid="text-no-sales">
                {hasActiveFilters ? "No se encontraron ventas" : "No hay ventas registradas"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                {hasActiveFilters
                  ? "Intenta ajustar los filtros de búsqueda"
                  : "Las ventas aparecerán aquí cuando se registren"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Precio Unit.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.map((sale) => (
                    <TableRow key={sale.id} data-testid={`row-sale-${sale.id}`}>
                      <TableCell data-testid={`text-sale-date-${sale.id}`}>
                        {format(new Date(sale.createdAt), "dd/MM/yyyy HH:mm")}
                      </TableCell>
                      <TableCell data-testid={`text-sale-product-${sale.id}`}>
                        {sale.product.title}
                      </TableCell>
                      <TableCell className="text-right" data-testid={`text-sale-quantity-${sale.id}`}>
                        {formatNumber(sale.quantity)}
                      </TableCell>
                      <TableCell className="text-right font-mono" data-testid={`text-sale-unit-price-${sale.id}`}>
                        {formatPrice(sale.unitPrice)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold" data-testid={`text-sale-total-${sale.id}`}>
                        {formatPrice(sale.totalPrice)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
