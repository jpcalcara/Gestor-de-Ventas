import { Link, useLocation } from "wouter";
import { Package, ShoppingCart, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Navigation() {
  const [location] = useLocation();

  const navItems = [
    { path: "/", label: "Productos", icon: Package },
    { path: "/sales", label: "Ventas", icon: ShoppingCart },
    { path: "/reports", label: "Reportes", icon: BarChart3 },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background">
      <div className="container mx-auto px-4 md:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/">
              <a className="flex items-center gap-2 text-xl font-semibold" data-testid="link-home">
                <Package className="h-6 w-6 text-primary" />
                <span>Inventario</span>
              </a>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.path;
                return (
                  <Link key={item.path} href={item.path}>
                    <a data-testid={`link-nav-${item.label.toLowerCase()}`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={isActive ? "bg-accent" : ""}
                      >
                        <Icon className="h-4 w-4 mr-2" />
                        {item.label}
                      </Button>
                    </a>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>
      <div className="md:hidden border-t">
        <div className="container mx-auto px-4">
          <nav className="flex items-center justify-around py-2 gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path;
              return (
                <Link key={item.path} href={item.path}>
                  <a data-testid={`link-nav-mobile-${item.label.toLowerCase()}`} className="flex-1">
                    <div
                      className={`flex flex-col items-center gap-1 py-2 px-2 rounded-md hover-elevate ${isActive ? "bg-accent" : ""}`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-xs">{item.label}</span>
                    </div>
                  </a>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
