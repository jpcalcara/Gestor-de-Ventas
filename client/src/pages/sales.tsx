import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Minus, Trash2, ShoppingCart, CreditCard, Banknote, Smartphone, ArrowRightLeft, ChevronsUpDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

  const handleSubmit = () => {
    if (!canSubmit) return;
    
    createOrderMutation.mutate({
      paymentMethod,
      paidAmount: paymentMethod === "efectivo" ? paidAmountNum : undefined,
      items: cart,
    });
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
    </div>
  );
}
