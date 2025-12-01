import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, ChevronDown, Check, MapPin } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Branch {
  id: string;
  number: number;
  name: string;
  address: string;
  isActive: boolean;
}

export function BranchSelectorModal() {
  const { branchId, branchName, selectBranch, isBranchLoading } = useAuth();
  const { toast } = useToast();
  const [isSelecting, setIsSelecting] = useState(false);

  const { data: branches = [], isLoading } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const activeBranches = branches.filter((b) => b.isActive);

  const handleSelect = async (branch: Branch) => {
    setIsSelecting(true);
    try {
      await selectBranch(branch.id);
      toast({
        title: "Sucursal seleccionada",
        description: `Ahora estás trabajando en ${branch.name}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo seleccionar la sucursal",
        variant: "destructive",
      });
    } finally {
      setIsSelecting(false);
    }
  };

  if (isBranchLoading || isLoading) {
    return null;
  }

  if (branchId) {
    return null;
  }

  if (activeBranches.length === 0) {
    return (
      <Dialog open={true}>
        <DialogContent className="max-w-md" hideCloseButton>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Sin Sucursales Disponibles
            </DialogTitle>
            <DialogDescription>
              No hay sucursales activas en el sistema. Contacta al administrador para crear una sucursal.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true}>
      <DialogContent className="max-w-md" hideCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Seleccionar Sucursal
          </DialogTitle>
          <DialogDescription>
            Elige la sucursal donde vas a trabajar hoy
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-4">
          {activeBranches.map((branch) => (
            <Card
              key={branch.id}
              className="cursor-pointer hover-elevate"
              onClick={() => !isSelecting && handleSelect(branch)}
              data-testid={`card-select-branch-${branch.id}`}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                  <span className="text-lg font-semibold text-primary">{branch.number}</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium">{branch.name}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {branch.address}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function BranchSwitcher() {
  const { branchId, branchName, selectBranch } = useAuth();
  const { toast } = useToast();
  const [confirmBranch, setConfirmBranch] = useState<Branch | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const activeBranches = branches.filter((b) => b.isActive);
  const currentBranch = branches.find((b) => b.id === branchId);

  const handleConfirmSwitch = async () => {
    if (!confirmBranch) return;
    
    setIsSwitching(true);
    try {
      await selectBranch(confirmBranch.id);
      toast({
        title: "Sucursal cambiada",
        description: `Ahora estás trabajando en ${confirmBranch.name}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo cambiar la sucursal",
        variant: "destructive",
      });
    } finally {
      setIsSwitching(false);
      setConfirmBranch(null);
    }
  };

  if (!branchId || activeBranches.length <= 1) {
    return currentBranch ? (
      <div className="flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground" data-testid="text-current-branch">
        <Building2 className="h-4 w-4" />
        <span className="hidden sm:inline">{currentBranch.name}</span>
        <span className="sm:hidden">Suc. {currentBranch.number}</span>
      </div>
    ) : null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2" data-testid="button-branch-switcher">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">{currentBranch?.name || "Sucursal"}</span>
            <span className="sm:hidden">Suc. {currentBranch?.number}</span>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {activeBranches.map((branch) => (
            <DropdownMenuItem
              key={branch.id}
              onClick={() => branch.id !== branchId && setConfirmBranch(branch)}
              className="flex items-center justify-between"
              data-testid={`menu-item-branch-${branch.id}`}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{branch.number}.</span>
                <span>{branch.name}</span>
              </div>
              {branch.id === branchId && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={!!confirmBranch} onOpenChange={(open) => !open && setConfirmBranch(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cambiar de sucursal?</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a cambiar de <strong>{currentBranch?.name}</strong> a <strong>{confirmBranch?.name}</strong>.
              Las ventas y operaciones se registrarán en la nueva sucursal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSwitching} data-testid="button-cancel-switch-branch">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmSwitch} 
              disabled={isSwitching}
              data-testid="button-confirm-switch-branch"
            >
              {isSwitching ? "Cambiando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
