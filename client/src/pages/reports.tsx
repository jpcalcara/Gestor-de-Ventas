import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, DollarSign, Package, User, CreditCard, Banknote, Smartphone, ArrowRightLeft, ShoppingCart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatPrice, formatNumber } from "@/lib/format";
import type { SaleOrderWithItems, Product } from "@shared/schema";
import { format, isToday, parseISO, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";

const paymentMethodLabels: Record<string, string> = {
  efectivo: "Efectivo",
  debito: "Débito",
  credito: "Crédito",
  qr: "QR",
  transferencia: "Transferencia",
};

const paymentMethodIcons: Record<string, typeof CreditCard> = {
  efectivo: Banknote,
  debito: CreditCard,
  credito: CreditCard,
  qr: Smartphone,
  transferencia: ArrowRightLeft,
};

export default function ReportsPage() {
  const today = format(new Date(), "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedProductId, setSelectedProductId] = useState<string>("all");

  const { data: saleOrders, isLoading: ordersLoading } = useQuery<SaleOrderWithItems[]>({
    queryKey: ["/api/sale-orders"],
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const filteredOrders = useMemo(() => {
    if (!saleOrders) return [];

    return saleOrders.filter(order => {
      const orderDate = new Date(order.createdAt);
      
      if (selectedDate) {
        const filterDate = parseISO(selectedDate);
        const orderStart = startOfDay(orderDate);
        const filterStart = startOfDay(filterDate);
        if (orderStart.getTime() !== filterStart.getTime()) return false;
      }

      if (selectedProductId !== "all") {
        const hasProduct = order.items.some(item => item.productId === selectedProductId);
        if (!hasProduct) return false;
      }

      return true;
    });
  }, [saleOrders, selectedDate, selectedProductId]);

  const totalRevenue = filteredOrders.reduce((sum, order) => sum + Number(order.totalAmount), 0);
  const totalItems = filteredOrders.reduce((sum, order) => 
    sum + order.items.reduce((itemSum, item) => itemSum + Number(item.quantity), 0), 0
  );

  const clearFilters = () => {
    setSelectedDate(today);
    setSelectedProductId("all");
  };

  const hasActiveFilters = selectedDate !== today || selectedProductId !== "all";

  const PaymentIcon = ({ method }: { method: string }) => {
    const Icon = paymentMethodIcons[method] || CreditCard;
    return <Icon className="h-4 w-4" />;
  };

  return (
    <div className="container mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">Ventas</h1>
        <p className="text-sm text-muted-foreground mt-1">Historial de ventas realizadas</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Ventas</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-sales">{formatNumber(filteredOrders.length)}</div>
            <p className="text-xs text-muted-foreground mt-1">Ventas registradas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-revenue">{formatPrice(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">Monto acumulado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date-filter">Fecha</Label>
              <Input
                id="date-filter"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                data-testid="input-date-filter"
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
          <CardTitle>
            {selectedDate === today ? "Ventas de Hoy" : `Ventas del ${format(parseISO(selectedDate), "d 'de' MMMM", { locale: es })}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ordersLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-base font-medium" data-testid="text-no-sales">
                {hasActiveFilters ? "No se encontraron ventas" : "No hay ventas hoy"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                {hasActiveFilters
                  ? "Intenta ajustar los filtros de búsqueda"
                  : "Las ventas aparecerán aquí cuando se registren"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => (
                <Card key={order.id} className="overflow-hidden" data-testid={`card-sale-order-${order.id}`}>
                  <div className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <User className="h-4 w-4" />
                          <span className="font-medium text-foreground" data-testid={`text-vendor-name-${order.id}`}>
                            {order.user?.firstName} {order.user?.lastName}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="flex items-center gap-1" data-testid={`badge-payment-${order.id}`}>
                          <PaymentIcon method={order.paymentMethod} />
                          {paymentMethodLabels[order.paymentMethod] || order.paymentMethod}
                        </Badge>
                        <span className="text-sm text-muted-foreground" data-testid={`text-sale-time-${order.id}`}>
                          {format(new Date(order.createdAt), "HH:mm")}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 mb-3">
                      {order.items.map((item, index) => (
                        <div 
                          key={item.id} 
                          className="flex items-center justify-between text-sm py-1"
                          data-testid={`item-${order.id}-${index}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">
                              {formatNumber(Number(item.quantity))} {item.unitType === "unidad" ? "u" : item.unitType}
                            </span>
                            <span>{item.product.title}</span>
                          </div>
                          <span className="font-mono text-muted-foreground">
                            {formatPrice(item.totalPrice)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t">
                      <span className="text-sm text-muted-foreground">
                        {order.items.length} {order.items.length === 1 ? "producto" : "productos"}
                      </span>
                      <span className="text-lg font-semibold font-mono" data-testid={`text-order-total-${order.id}`}>
                        {formatPrice(order.totalAmount)}
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
