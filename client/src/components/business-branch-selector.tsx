import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, MapPin } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";

interface Branch {
  id: string;
  number: number;
  name: string;
  address: string;
  isActive: boolean;
}

export function BusinessBranchSelectorModal() {
  const { branchId, selectBranch, isBranchLoading, user } = useAuth();
  const { toast } = useToast();
  const [isSelecting, setIsSelecting] = useState(false);

  const { data: branches = [], isLoading: branchesLoading } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    enabled: !!user,
  });

  const activeBranches = branches.filter((b) => b.isActive);

  if (!user || isBranchLoading || branchesLoading) {
    return null;
  }

  if (branchId) {
    return null;
  }

  if (activeBranches.length === 0) {
    return null;
  }

  const handleSelectBranch = async (branch: Branch) => {
    setIsSelecting(true);
    try {
      await selectBranch(branch.id);
      toast({
        title: "Sucursal seleccionada",
        description: `Ahora estás en ${branch.name}`,
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

  return (
    <Dialog open={!branchId && activeBranches.length > 0}>
      <DialogContent className="max-w-md" hideCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Seleccionar Sucursal
          </DialogTitle>
          <DialogDescription>
            Elige la sucursal donde vas a trabajar
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-4">
          {activeBranches.map((branch) => (
            <Card
              key={branch.id}
              className="cursor-pointer hover-elevate"
              onClick={() => !isSelecting && handleSelectBranch(branch)}
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
