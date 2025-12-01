import { Link, useLocation } from "wouter";
import { Package, ShoppingCart, BarChart3, Users, ClipboardList, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function Navigation() {
  const [location] = useLocation();
  const { user, isAdmin, logout } = useAuth();

  const navItems = [
    { path: "/", label: "Productos", icon: Package, roles: ["admin", "vendedor"] },
    { path: "/sales", label: "Ventas", icon: ShoppingCart, roles: ["admin", "vendedor"] },
    { path: "/reports", label: "Reportes", icon: BarChart3, roles: ["admin"] },
    { path: "/users", label: "Usuarios", icon: Users, roles: ["admin"] },
    { path: "/audit", label: "Auditoría", icon: ClipboardList, roles: ["admin"] },
  ];

  const visibleItems = navItems.filter(item => 
    item.roles.includes(user?.role || "")
  );

  const getInitials = () => {
    if (!user) return "U";
    return `${user.firstName?.charAt(0) || ""}${user.lastName?.charAt(0) || ""}`.toUpperCase() || "U";
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background">
      <div className="container mx-auto px-4 md:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <Link href="/">
              <a className="flex items-center gap-2 text-xl font-semibold" data-testid="link-home">
                <Package className="h-6 w-6 text-primary" />
                <span>Inventario</span>
              </a>
            </Link>
            <nav className="hidden md:flex items-center gap-4">
              {visibleItems.map((item) => {
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
          
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full" data-testid="button-user-menu">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.firstName || "Usuario"} />
                    <AvatarFallback>{getInitials()}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    <p className="font-medium">{user?.firstName} {user?.lastName}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      Rol: {user?.role === "admin" ? "Administrador" : "Vendedor"}
                    </p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} data-testid="button-logout">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Cerrar sesión</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      <div className="md:hidden border-t">
        <div className="container mx-auto px-4">
          <nav className="flex items-center justify-around py-2 gap-1 overflow-x-auto">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path;
              return (
                <Link key={item.path} href={item.path}>
                  <a data-testid={`link-nav-mobile-${item.label.toLowerCase()}`} className="flex-shrink-0">
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
