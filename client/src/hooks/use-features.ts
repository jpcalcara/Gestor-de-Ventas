import { useQuery } from "@tanstack/react-query";

interface FeaturesData {
  features: Record<string, boolean>;
  limits: Record<string, number | null>;
  subscription?: {
    status: string;
    trialEndsAt?: string | null;
    graceEndsAt?: string | null;
    nextPaymentAt?: string | null;
    planName?: string;
    planSlug?: string;
    pendingPlanId?: string | null;
    pendingPlanName?: string | null;
  };
}

export function useFeatures() {
  const { data, isLoading } = useQuery<FeaturesData>({
    queryKey: ["/api/my-features"],
    staleTime: 5 * 60 * 1000,
  });

  const hasFeature = (key: string): boolean => {
    return data?.features?.[key] ?? false;
  };

  const getLimit = (key: string): number | null => {
    return data?.limits?.[key] ?? null;
  };

  return {
    hasFeature,
    getLimit,
    subscription: data?.subscription,
    features: data?.features ?? {},
    limits: data?.limits ?? {},
    isLoading,
  };
}
