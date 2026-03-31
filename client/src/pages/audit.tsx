import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FeatureGate } from "@/components/feature-gate";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { 
  Package, 
  ShoppingCart, 
  User, 
  Plus, 
  Pencil, 
  Trash2,
  Clock,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  actionType: string;
  entity: string;
  entityId: string | null;
  details: string | null;
  createdAt: string;
}

const actionTypeLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  crear: { label: "Crear", variant: "default" },
  editar: { label: "Editar", variant: "secondary" },
  eliminar: { label: "Eliminar", variant: "destructive" },
  registrar_venta: { label: "Registrar Venta", variant: "default" },
  editar_venta: { label: "Editar Venta", variant: "secondary" },
  eliminar_venta: { label: "Eliminar Venta", variant: "destructive" },
  crear_usuario: { label: "Crear Usuario", variant: "default" },
  editar_usuario: { label: "Editar Usuario", variant: "secondary" },
  eliminar_usuario: { label: "Eliminar Usuario", variant: "destructive" },
};

const entityIcons: Record<string, typeof Package> = {
  producto: Package,
  venta: ShoppingCart,
  usuario: User,
};

export default function AuditPage() {
  const { isAdmin } = useAuth();
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const { data: response = { logs: [], total: 0 }, isLoading } = useQuery<{ logs: AuditLog[]; total: number }>({
    queryKey: ["/api/audit-logs", page],
    queryFn: async () => {
      const res = await fetch(`/api/audit-logs?offset=${page * pageSize}&limit=${pageSize}`);
      return res.json();
    },
    enabled: isAdmin,
  });

  const logs = response.logs || [];
  const total = response.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  if (!isAdmin) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No tienes permiso para ver esta página.
          </CardContent>
        </Card>
      </div>
    );
  }

  const getActionIcon = (actionType: string) => {
    if (actionType.includes("crear") || actionType.includes("registrar")) {
      return Plus;
    }
    if (actionType.includes("editar")) {
      return Pencil;
    }
    if (actionType.includes("eliminar")) {
      return Trash2;
    }
    return Clock;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      relative: formatDistanceToNow(date, { addSuffix: true, locale: es }),
      absolute: date.toLocaleString("es-AR", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    };
  };

  return (
    <FeatureGate feature="auditoria">
    <div className="container mx-auto px-4 md:px-8 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Registro de Auditoría</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Historial de todas las acciones realizadas en el sistema
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="text-muted-foreground">Cargando registros...</div>
        </div>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No hay registros de auditoría.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {logs.map((log) => {
              const EntityIcon = entityIcons[log.entity] || Package;
              const ActionIcon = getActionIcon(log.actionType);
              const actionInfo = actionTypeLabels[log.actionType] || { 
                label: log.actionType, 
                variant: "outline" as const 
              };
              const dateInfo = formatDate(log.createdAt);

              return (
                <Card key={log.id} data-testid={`audit-log-${log.id}`}>
                  <CardContent className="py-4">
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <EntityIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{log.userName}</span>
                          <Badge variant={actionInfo.variant}>
                            <ActionIcon className="h-3 w-3 mr-1" />
                            {actionInfo.label}
                          </Badge>
                          <Badge variant="outline" className="capitalize">
                            {log.entity}
                          </Badge>
                        </div>
                        {log.details && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {log.details}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span title={dateInfo.absolute}>{dateInfo.relative}</span>
                          <span>•</span>
                          <span>{dateInfo.absolute}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-6 border-t">
              <div className="text-sm text-muted-foreground">
                {total === 0 ? "Sin registros" : `Mostrando ${page * pageSize + 1}-${Math.min((page + 1) * pageSize, total)} de ${total}`}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  data-testid="button-audit-prev"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  data-testid="button-audit-next"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
    </FeatureGate>
  );
}
