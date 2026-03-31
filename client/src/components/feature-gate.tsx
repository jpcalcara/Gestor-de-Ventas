import { useLocation } from "wouter";
import { useFeatures } from "@/hooks/use-features";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

interface FeatureGateProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

function UpgradeBanner() {
  const [, navigate] = useLocation();
  return (
    <Card className="my-4">
      <CardContent className="py-8 text-center">
        <div className="flex justify-center mb-3">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
            <Lock className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
        <h3 className="font-semibold text-base mb-1">Funcionalidad no disponible</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Esta funcionalidad está disponible en planes superiores.
        </p>
        <Button variant="default" onClick={() => navigate("/pricing")}>
          Ver planes
        </Button>
      </CardContent>
    </Card>
  );
}

export function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  const { hasFeature, isLoading } = useFeatures();

  if (isLoading) return null;
  if (!hasFeature(feature)) return fallback ? <>{fallback}</> : <UpgradeBanner />;
  return <>{children}</>;
}
